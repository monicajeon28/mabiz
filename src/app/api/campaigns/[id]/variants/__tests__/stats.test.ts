import { GET } from '../stats/route';
import prisma from '@/lib/prisma';
import * as authModule from '@/lib/rbac';

jest.mock('@/lib/prisma');
jest.mock('@/lib/rbac');
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetAuthContext = authModule.getAuthContext as jest.Mock;
const mockRequireOrgId = authModule.requireOrgId as jest.Mock;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Variant Stats API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRequest = (url: string) => new Request(url);

  it('should return 401 when not authenticated', async () => {
    mockGetAuthContext.mockResolvedValue(null);

    const req = mockRequest('http://localhost/api/campaigns/cmp_123/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_123' } });

    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent campaign', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');
    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue(null);

    const req = mockRequest('http://localhost/api/campaigns/cmp_missing/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_missing' } });

    expect(res.status).toBe(404);
  });

  it('should return 404 for unauthorized campaign (IDOR)', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    // Campaign belongs to org_2
    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_123',
      organizationId: 'org_2',
      title: 'Other Org Campaign',
      status: 'SENT',
    });

    const req = mockRequest('http://localhost/api/campaigns/cmp_123/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_123' } });

    expect(res.status).toBe(404);
  });

  it('should return A/B comparison with chi-square result', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_123',
      organizationId: 'org_1',
      title: '봄 크루즈 캠페인',
      status: 'SENT',
    });

    // Mock SendingHistory data
    mockPrisma.sendingHistory.groupBy.mockResolvedValue([
      { variantKey: 'A', status: 'SENT', _count: { id: 850 } },
      { variantKey: 'A', status: 'FAILED', _count: { id: 150 } },
      { variantKey: 'B', status: 'SENT', _count: { id: 700 } },
      { variantKey: 'B', status: 'FAILED', _count: { id: 300 } },
    ]);

    const req = mockRequest('http://localhost/api/campaigns/cmp_123/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_123' } });

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.campaign.id).toBe('cmp_123');
    expect(data.campaign.title).toBe('봄 크루즈 캠페인');

    expect(data.variants.A).toBeDefined();
    expect(data.variants.B).toBeDefined();
    expect(data.variants.A.sent).toBe(1000);
    expect(data.variants.A.success).toBe(850);
    expect(data.variants.A.failure).toBe(150);
    expect(data.variants.A.successRate).toBe(0.85);

    expect(data.variants.B.sent).toBe(1000);
    expect(data.variants.B.success).toBe(700);
    expect(data.variants.B.failure).toBe(300);
    expect(data.variants.B.successRate).toBe(0.7);

    // Analysis
    expect(data.analysis.chiSquare).toBeDefined();
    expect(data.analysis.chiSquare.chi2).toBeGreaterThan(0);
    expect(data.analysis.chiSquare.pValue).toBeLessThan(0.05);
    expect(data.analysis.chiSquare.isSignificant).toBe(true);
    expect(data.analysis.chiSquare.degreesOfFreedom).toBe(1);

    expect(data.analysis.cramersV).toBeGreaterThan(0);
    expect(data.analysis.recommendation).toBe('A');
    expect(data.analysis.confidence).toBe('HIGH');
    expect(data.analysis.interpretation).toContain('A');
  });

  it('should handle single-message campaign (no variants)', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_single',
      organizationId: 'org_1',
      title: '단일 메시지',
      status: 'SENT',
    });

    // 단일 메시지는 variantKey가 null (SINGLE로 표현됨)
    mockPrisma.sendingHistory.groupBy.mockResolvedValue([
      { variantKey: null, status: 'SENT', _count: { id: 100 } },
      { variantKey: null, status: 'FAILED', _count: { id: 10 } },
    ]);

    const req = mockRequest('http://localhost/api/campaigns/cmp_single/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_single' } });

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.variants.SINGLE).toBeDefined();
    expect(data.variants.SINGLE.sent).toBe(110);
    expect(data.analysis.chiSquare).toBeNull();
    expect(data.analysis.recommendation).toBeNull();
    expect(data.analysis.confidence).toBe('LOW');
  });

  it('should return recommendation based on success rate', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_123',
      organizationId: 'org_1',
      title: 'Test Campaign',
      status: 'SENT',
    });

    // B가 A보다 좋은 경우
    mockPrisma.sendingHistory.groupBy.mockResolvedValue([
      { variantKey: 'A', status: 'SENT', _count: { id: 500 } },
      { variantKey: 'A', status: 'FAILED', _count: { id: 500 } },
      { variantKey: 'B', status: 'SENT', _count: { id: 800 } },
      { variantKey: 'B', status: 'FAILED', _count: { id: 200 } },
    ]);

    const req = mockRequest('http://localhost/api/campaigns/cmp_123/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_123' } });

    const data = await res.json();
    expect(data.analysis.recommendation).toBe('B');
  });

  it('should return confidence level', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_123',
      organizationId: 'org_1',
      title: 'Test',
      status: 'SENT',
    });

    mockPrisma.sendingHistory.groupBy.mockResolvedValue([
      { variantKey: 'A', status: 'SENT', _count: { id: 850 } },
      { variantKey: 'A', status: 'FAILED', _count: { id: 150 } },
      { variantKey: 'B', status: 'SENT', _count: { id: 700 } },
      { variantKey: 'B', status: 'FAILED', _count: { id: 300 } },
    ]);

    const req = mockRequest('http://localhost/api/campaigns/cmp_123/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_123' } });

    const data = await res.json();
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(data.analysis.confidence);
  });

  it('should include metadata with calculation timestamp', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_123',
      organizationId: 'org_1',
      title: 'Test',
      status: 'SENT',
    });

    mockPrisma.sendingHistory.groupBy.mockResolvedValue([
      { variantKey: 'A', status: 'SENT', _count: { id: 100 } },
      { variantKey: 'A', status: 'FAILED', _count: { id: 50 } },
      { variantKey: 'B', status: 'SENT', _count: { id: 90 } },
      { variantKey: 'B', status: 'FAILED', _count: { id: 60 } },
    ]);

    const beforeTime = new Date();
    const req = mockRequest('http://localhost/api/campaigns/cmp_123/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_123' } });
    const afterTime = new Date();

    const data = await res.json();
    expect(data.metadata).toBeDefined();
    expect(data.metadata.calculatedAt).toBeDefined();

    const calcTime = new Date(data.metadata.calculatedAt);
    expect(calcTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
    expect(calcTime.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
  });

  it('should warn about small sample sizes', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_small',
      organizationId: 'org_1',
      title: 'Small Test',
      status: 'SENT',
    });

    mockPrisma.sendingHistory.groupBy.mockResolvedValue([
      { variantKey: 'A', status: 'SENT', _count: { id: 8 } },
      { variantKey: 'A', status: 'FAILED', _count: { id: 2 } },
      { variantKey: 'B', status: 'SENT', _count: { id: 6 } },
      { variantKey: 'B', status: 'FAILED', _count: { id: 4 } },
    ]);

    const req = mockRequest('http://localhost/api/campaigns/cmp_small/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_small' } });

    const data = await res.json();
    expect(data.metadata.sampleSizeRecommendation).toBeTruthy();
    expect(data.metadata.sampleSizeRecommendation).toContain('30');
  });

  it('should handle empty campaign data', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_empty',
      organizationId: 'org_1',
      title: 'Empty Campaign',
      status: 'DRAFT',
    });

    mockPrisma.sendingHistory.groupBy.mockResolvedValue([]);

    const req = mockRequest('http://localhost/api/campaigns/cmp_empty/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_empty' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data.variants)).toHaveLength(0);
  });

  it('should handle PENDING/SKIPPED status correctly', async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user_1', organizationId: 'org_1' },
    });
    mockRequireOrgId.mockReturnValue('org_1');

    mockPrisma.crmMarketingCampaign.findUnique.mockResolvedValue({
      id: 'cmp_123',
      organizationId: 'org_1',
      title: 'Test',
      status: 'SENT',
    });

    // PENDING, SKIPPED는 성공/실패에 포함되지 않음
    mockPrisma.sendingHistory.groupBy.mockResolvedValue([
      { variantKey: 'A', status: 'SENT', _count: { id: 100 } },
      { variantKey: 'A', status: 'PENDING', _count: { id: 50 } },
      { variantKey: 'A', status: 'SKIPPED', _count: { id: 30 } },
      { variantKey: 'B', status: 'SENT', _count: { id: 90 } },
      { variantKey: 'B', status: 'FAILED', _count: { id: 40 } },
    ]);

    const req = mockRequest('http://localhost/api/campaigns/cmp_123/variants/stats');
    const res = await GET(req, { params: { id: 'cmp_123' } });

    const data = await res.json();
    // sent: SENT + PENDING + SKIPPED + FAILED
    expect(data.variants.A.sent).toBe(180);  // 100 + 50 + 30
    expect(data.variants.A.success).toBe(100);  // SENT만 포함
    expect(data.variants.A.failure).toBe(0);  // FAILED가 없음
  });
});
