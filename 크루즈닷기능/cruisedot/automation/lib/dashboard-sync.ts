// lib/dashboard-sync.ts
// 대시보드 통계 캐싱 및 동기화 유틸리티

import prisma from '@/lib/prisma';

/**
 * 파트너 대시보드 통계 타입
 */
interface PartnerDashboardStats {
  totalSales: number;
  pendingSales: number;
  approvedSales: number;
  totalCommission: number;
  pendingCommission: number;
  lastUpdated: Date;
}

/**
 * 관리자 대시보드 통계 타입
 */
interface AdminDashboardStats {
  totalSales: number;
  pendingApprovals: number;
  monthlyRevenue: number;
  activeAffiliates: number;
  lastUpdated: Date;
}

/**
 * 메모리 기반 캐시
 */
const dashboardCache = new Map<string, {
  data: PartnerDashboardStats | AdminDashboardStats;
  expiresAt: number;
}>();

const CACHE_TTL = 1 * 60 * 1000; // B-2: 1분 (5분→1분 축소로 관리자 권한 갱신 속도 향상)

/**
 * 캐시 키 생성
 */
function getCacheKey(type: 'partner' | 'admin', profileId?: number): string {
  return type === 'partner' ? `partner:${profileId}` : 'admin:dashboard';
}

/**
 * 캐시에서 데이터 조회
 */
function getFromCache<T>(key: string): T | null {
  const cached = dashboardCache.get(key);
  if (!cached || Date.now() > cached.expiresAt) {
    if (cached) dashboardCache.delete(key);
    return null;
  }
  return cached.data as T;
}

/**
 * 캐시에 데이터 저장
 */
function setCache(key: string, data: PartnerDashboardStats | AdminDashboardStats): void {
  dashboardCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

/**
 * 파트너 대시보드 통계 조회 (캐시 활용)
 */
export async function getPartnerDashboardStats(profileId: number): Promise<PartnerDashboardStats> {
  const cacheKey = getCacheKey('partner', profileId);
  const cached = getFromCache<PartnerDashboardStats>(cacheKey);
  if (cached) return cached;

  try {
    // 판매 통계 조회
    const sales = await prisma.affiliateSale.findMany({
      where: {
        OR: [
          { managerId: profileId },
          { agentId: profileId },
        ],
      },
      select: {
        status: true,
        branchCommission: true,
        salesCommission: true,
        overrideCommission: true,
      },
    });

    const stats: PartnerDashboardStats = {
      totalSales: sales.length,
      pendingSales: sales.filter(s => s.status === 'PENDING' || s.status === 'PENDING_APPROVAL').length,
      approvedSales: sales.filter(s => s.status === 'APPROVED' || s.status === 'CONFIRMED').length,
      totalCommission: sales.reduce((sum, s) => 
        sum + (s.branchCommission || 0) + (s.salesCommission || 0) + (s.overrideCommission || 0), 0),
      pendingCommission: sales
        .filter(s => s.status === 'PENDING' || s.status === 'PENDING_APPROVAL')
        .reduce((sum, s) => 
          sum + (s.branchCommission || 0) + (s.salesCommission || 0) + (s.overrideCommission || 0), 0),
      lastUpdated: new Date(),
    };

    setCache(cacheKey, stats);
    return stats;
  } catch (error) {
    console.error('[Dashboard Sync] Error getting partner stats:', error);
    return {
      totalSales: 0,
      pendingSales: 0,
      approvedSales: 0,
      totalCommission: 0,
      pendingCommission: 0,
      lastUpdated: new Date(),
    };
  }
}

/**
 * 관리자 대시보드 통계 조회
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const cacheKey = getCacheKey('admin');
  const cached = getFromCache<AdminDashboardStats>(cacheKey);
  if (cached) return cached;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalSales, pendingApprovals, monthlyRevenue, activeAffiliates] = await Promise.all([
      prisma.affiliateSale.count(),
      prisma.affiliateSale.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.affiliateSale.aggregate({
        where: {
          status: { in: ['APPROVED', 'CONFIRMED'] },
          confirmedAt: { gte: startOfMonth },
        },
        _sum: { saleAmount: true },
      }),
      prisma.affiliateProfile.count({ where: { status: 'active' } }),
    ]);

    const stats: AdminDashboardStats = {
      totalSales,
      pendingApprovals,
      monthlyRevenue: monthlyRevenue._sum.saleAmount || 0,
      activeAffiliates,
      lastUpdated: new Date(),
    };

    setCache(cacheKey, stats);
    return stats;
  } catch (error) {
    console.error('[Dashboard Sync] Error getting admin stats:', error);
    return {
      totalSales: 0,
      pendingApprovals: 0,
      monthlyRevenue: 0,
      activeAffiliates: 0,
      lastUpdated: new Date(),
    };
  }
}

/**
 * 대시보드 캐시 무효화
 */
export async function invalidateDashboardCache(profileId?: number): Promise<void> {
  if (profileId) {
    dashboardCache.delete(getCacheKey('partner', profileId));
  }
  // 관리자 캐시는 항상 무효화
  dashboardCache.delete(getCacheKey('admin'));
}

/**
 * 판매 승인 시 캐시 갱신
 */
export async function onSaleApproved(saleId: number): Promise<void> {
  try {
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: { managerId: true, agentId: true },
    });
    if (sale) {
      if (sale.managerId) await invalidateDashboardCache(sale.managerId);
      if (sale.agentId) await invalidateDashboardCache(sale.agentId);
    }
  } catch (error) {
    console.error('[Dashboard Sync] Error on sale approved:', error);
  }
}

/**
 * 판매 거부 시 캐시 갱신
 */
export async function onSaleRejected(saleId: number): Promise<void> {
  await onSaleApproved(saleId); // 동일한 로직
}

/**
 * 새 판매 등록 시 캐시 갱신
 */
export async function onSaleCreated(profileId: number): Promise<void> {
  await invalidateDashboardCache(profileId);
}

/**
 * 전체 캐시 초기화
 */
export function clearAllDashboardCache(): void {
  dashboardCache.clear();
}

/**
 * 캐시 상태 조회 (디버깅용)
 */
export function getDashboardCacheStatus(): { size: number; keys: string[] } {
  return {
    size: dashboardCache.size,
    keys: Array.from(dashboardCache.keys()),
  };
}
