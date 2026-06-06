import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { trackShortLinkImpressions, selectABVariant, getABTestVariant } from '@/lib/link-tracking';
import prisma from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    shortLink: {
      findMany: vi.fn(),
    },
    shortLinkImpression: {
      create: vi.fn(),
    },
    shortLinkABTest: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Link Tracking', () => {
  // Test 1: SMS에서 shortlink 감지
  it('should detect shortlinks in SMS body', async () => {
    const mockLinks = [
      { id: 'link-1', code: 'abc12345' },
      { id: 'link-2', code: 'def67890' },
    ];

    const mockImpressions = [
      { id: 'imp-1', shortLinkId: 'link-1' },
      { id: 'imp-2', shortLinkId: 'link-2' },
    ];

    vi.mocked(prisma.shortLink.findMany).mockResolvedValueOnce(mockLinks as any);
    vi.mocked(prisma.shortLinkImpression.create)
      .mockResolvedValueOnce(mockImpressions[0] as any)
      .mockResolvedValueOnce(mockImpressions[1] as any);

    const sms =
      '상품 보기: https://app.com/l/abc12345 또는 https://app.com/l/def67890';
    const impressions = await trackShortLinkImpressions(
      sms,
      'sms',
      'contact-123'
    );

    expect(impressions.length).toBe(2);
    expect(vi.mocked(prisma.shortLink.findMany)).toHaveBeenCalledWith({
      where: {
        code: { in: ['abc12345', 'def67890'] },
      },
      select: { id: true, code: true },
    });
  });

  // Test 2: 링크 없는 SMS
  it('should return empty array if no links', async () => {
    const sms = '안녕하세요';
    const impressions = await trackShortLinkImpressions(sms, 'sms');

    expect(impressions.length).toBe(0);
    expect(vi.mocked(prisma.shortLink.findMany)).not.toHaveBeenCalled();
  });

  // Test 3: A/B 분산 (50:50 통계)
  it('should distribute A/B evenly', () => {
    const results: ('A' | 'B')[] = [];

    for (let i = 0; i < 1000; i++) {
      results.push(selectABVariant());
    }

    const countA = results.filter((r) => r === 'A').length;
    const countB = results.filter((r) => r === 'B').length;

    // 대략 450-550 범위 (통계적 허용범위)
    expect(countA).toBeGreaterThan(450);
    expect(countA).toBeLessThan(550);
    expect(countB).toBeGreaterThan(450);
    expect(countB).toBeLessThan(550);
  });

  // Test 4: A/B 테스트 변형 확인
  it('should identify AB test variant for variant A', async () => {
    const mockTest = {
      id: 'test-1',
      variantA_id: 'link-1',
      variantB_id: 'link-2',
      status: 'ACTIVE',
    };

    vi.mocked(prisma.shortLinkABTest.findFirst).mockResolvedValueOnce(
      mockTest as any
    );

    const result = await getABTestVariant('link-1');

    expect(result).toEqual({ variant: 'A', testId: 'test-1' });
    expect(vi.mocked(prisma.shortLinkABTest.findFirst)).toHaveBeenCalledWith({
      where: { variantA_id: 'link-1', status: 'ACTIVE' },
    });
  });

  // Test 5: A/B 테스트 변형 확인 (B 케이스)
  it('should identify AB test variant for variant B', async () => {
    const mockTest = {
      id: 'test-1',
      variantA_id: 'link-1',
      variantB_id: 'link-2',
      status: 'ACTIVE',
    };

    vi.mocked(prisma.shortLinkABTest.findFirst)
      .mockResolvedValueOnce(null) // variantA 검색 실패
      .mockResolvedValueOnce(mockTest as any); // variantB 검색 성공

    const result = await getABTestVariant('link-2');

    expect(result).toEqual({ variant: 'B', testId: 'test-1' });
  });

  // Test 6: 테스트 없는 링크
  it('should return null if no test', async () => {
    vi.mocked(prisma.shortLinkABTest.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await getABTestVariant('link-3');

    expect(result).toBeNull();
  });
});
