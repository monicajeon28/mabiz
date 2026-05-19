import { createMocks } from 'node-mocks-http';
import handler from '@/app/api/dashboard/recommendations/route';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

// Mock 설정
jest.mock('@/lib/prisma');
jest.mock('@/lib/auth');
jest.mock('@/lib/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetMabizSession = getMabizSession as jest.MockedFunction<typeof getMabizSession>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/dashboard/recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: API 응답 형식 검증 (3개 필드 존재)
   */
  it('should return all 3 required fields in response', async () => {
    mockGetMabizSession.mockResolvedValueOnce({
      organizationId: 'org-123',
      role: 'OWNER',
      userId: 'user-1',
      memberId: 'member-1',
    } as any);

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { segment: 'A', count: 12n },
      { segment: 'B', count: 8n },
    ]);

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { segment: 'A', rate: 0.45 },
      { segment: 'B', rate: 0.38 },
    ]);

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { recommendedProduct: 'AI_PACKAGE', count: 15n },
      { recommendedProduct: 'GOLD_MEMBERSHIP', count: 12n },
    ]);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data).toHaveProperty('ok');
    expect(data).toHaveProperty('segment_distribution');
    expect(data).toHaveProperty('conversion_rates');
    expect(data).toHaveProperty('top_products');
  });

  /**
   * Test 2: segment_distribution 합계 = 전체 Contact 수
   */
  it('should correctly aggregate segment_distribution', async () => {
    mockGetMabizSession.mockResolvedValueOnce({
      organizationId: 'org-123',
      role: 'OWNER',
    } as any);

    const mockSegments = [
      { segment: 'A', count: 12n },
      { segment: 'B', count: 8n },
      { segment: 'C', count: 5n },
    ];

    mockPrisma.$queryRaw.mockResolvedValueOnce(mockSegments);
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { segment: 'A', rate: 0.45 },
      { segment: 'B', rate: 0.38 },
      { segment: 'C', rate: 0.42 },
    ]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { recommendedProduct: 'AI_PACKAGE', count: 15n },
    ]);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    const data = JSON.parse(res._getData());
    const totalContacts = Object.values(data.segment_distribution).reduce(
      (sum: number, val: any) => sum + val,
      0
    );
    expect(totalContacts).toBe(25); // 12 + 8 + 5
  });

  /**
   * Test 3: conversion_rates 범위 [0~1]
   */
  it('should have conversion_rates within [0, 1] range', async () => {
    mockGetMabizSession.mockResolvedValueOnce({
      organizationId: 'org-123',
      role: 'AGENT',
    } as any);

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { segment: 'A', count: 12n },
    ]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { segment: 'A', rate: 0.45 },
    ]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { recommendedProduct: 'AI_PACKAGE', count: 15n },
    ]);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    const data = JSON.parse(res._getData());
    Object.values(data.conversion_rates).forEach((rate: any) => {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  /**
   * Test 4: top_products 정렬 순서 (내림차순)
   */
  it('should return top_products in descending order', async () => {
    mockGetMabizSession.mockResolvedValueOnce({
      organizationId: 'org-123',
      role: 'OWNER',
    } as any);

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { segment: 'A', count: 12n },
    ]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { segment: 'A', rate: 0.45 },
    ]);
    const mockProducts = [
      { recommendedProduct: 'AI_PACKAGE', count: 20n },
      { recommendedProduct: 'GOLD_MEMBERSHIP', count: 15n },
      { recommendedProduct: 'BASIC_PACKAGE', count: 10n },
    ];
    mockPrisma.$queryRaw.mockResolvedValueOnce(mockProducts);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    const data = JSON.parse(res._getData());
    const counts = data.top_products.map((p: any) => p.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  /**
   * Test 5: 빈 데이터 처리 (Contact 없을 시)
   */
  it('should handle empty data gracefully', async () => {
    mockGetMabizSession.mockResolvedValueOnce({
      organizationId: 'org-123',
      role: 'OWNER',
    } as any);

    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.ok).toBe(true);
    expect(Object.keys(data.segment_distribution).length).toBe(0);
    expect(Object.keys(data.conversion_rates).length).toBe(0);
    expect(data.top_products.length).toBe(0);
  });

  /**
   * Test 6: 인증되지 않은 요청 거부
   */
  it('should return 401 for unauthenticated requests', async () => {
    mockGetMabizSession.mockResolvedValueOnce(null);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    expect(res._getStatusCode()).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.ok).toBe(false);
  });

  /**
   * Test 7: organizationId 없는 요청 거부
   */
  it('should return 401 if organizationId is missing', async () => {
    mockGetMabizSession.mockResolvedValueOnce({
      role: 'OWNER',
      // organizationId 없음
    } as any);

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    expect(res._getStatusCode()).toBe(401);
  });

  /**
   * Test 8: DB 에러 처리
   */
  it('should handle database errors gracefully', async () => {
    mockGetMabizSession.mockResolvedValueOnce({
      organizationId: 'org-123',
      role: 'OWNER',
    } as any);

    mockPrisma.$queryRaw.mockRejectedValueOnce(
      new Error('Database connection error')
    );

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler.GET(req as any);

    expect(res._getStatusCode()).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.ok).toBe(false);
  });
});
