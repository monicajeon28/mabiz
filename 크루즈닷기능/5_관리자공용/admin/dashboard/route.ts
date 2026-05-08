export const dynamic = 'force-dynamic';

// app/api/admin/dashboard/route.ts
// 관리자 대시보드 통계 API

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getCache, setCache } from '@/lib/redis';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    logger.log('[Admin Dashboard] No session ID');
    return false;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session) {
      logger.log('[Admin Dashboard] Session not found');
      return false;
    }

    if (!session.User) {
      logger.log('[Admin Dashboard] User not found in session');
      return false;
    }

    const isAdmin = session.User.role === 'admin';
    logger.log('[Admin Dashboard] Auth check result:', { isAdmin });
    return isAdmin;
  } catch (error: any) {
    logger.error('[Admin Dashboard] Auth check error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return false;
  }
}

export async function GET() {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      logger.log('[Admin Dashboard] No session cookie found');
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'No session cookie'
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      logger.log('[Admin Dashboard] Admin check failed');
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin check failed'
      }, { status: 403 });
    }

    // Redis 캐시 확인 (5분 TTL)
    const cacheKey = 'admin:dashboard:stats:v1';
    const cached = await getCache<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'X-Cache': 'HIT',
        },
      });
    }

    // 1. 사용자 통계 (전체 - 크루즈몰 + 지니AI 가이드)
    // 성능 최적화: 모든 count 쿼리를 병렬로 실행
    let totalUsers = 0;
    let activeUsers = 0;
    let hibernatedUsers = 0;
    let genieUsers = 0;
    let mallUsers = 0;
    
    try {
      const [
        totalUsersResult,
        activeUsersResult,
        hibernatedUsersResult,
        genieUsersResult,
        mallUsersResult
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isHibernated: false } }),
        prisma.user.count({ where: { isHibernated: true } }),
        prisma.user.count({ where: { role: 'user' } }),
        prisma.user.count({ where: { role: 'community' } }),
      ]);
      
      totalUsers = totalUsersResult;
      activeUsers = activeUsersResult;
      hibernatedUsers = hibernatedUsersResult;
      genieUsers = genieUsersResult;
      mallUsers = mallUsersResult;
    } catch (userError: any) {
      logger.error('[Admin Dashboard] User stats error:', {
        message: userError?.message,
        code: userError?.code,
        meta: userError?.meta,
      });
    }

    // 2. 여행 통계
    let totalTrips = 0;
    let upcomingTrips = 0;
    let inProgressTrips = 0;
    let completedTrips = 0;
    let currentTrips: any[] = [];
    
    try {
      totalTrips = await prisma.trip.count();
      const tripsByStatus = await prisma.trip.groupBy({
        by: ['status'],
        _count: true,
      });
      upcomingTrips = tripsByStatus.find(s => s.status === 'Upcoming')?._count || 0;
      inProgressTrips = tripsByStatus.find(s => s.status === 'InProgress')?._count || 0;
      completedTrips = tripsByStatus.find(s => s.status === 'Completed')?._count || 0;
      
      // 현재 진행 중인 여행 (최대 10개만) - Trip 모델의 실제 필드 사용
      currentTrips = await prisma.trip.findMany({
        where: { status: 'InProgress' },
        take: 10,
        select: {
          id: true,
          shipName: true,
          departureDate: true,
          endDate: true,
          productCode: true,
        },
        orderBy: {
          departureDate: 'asc',
        },
      });
    } catch (tripError: any) {
      logger.error('[Admin Dashboard] Trip stats error:', {
        message: tripError?.message,
        code: tripError?.code,
        meta: tripError?.meta,
      });
    }

    // 4. 만족도 평균 (크루즈몰 후기 - CruiseReview)
    let avgSatisfaction = 0;
    let reviewCount = 0;
    let recentFeedback: any[] = [];
    
    try {
      const reviewStats = await prisma.cruiseReview.aggregate({
        _avg: {
          rating: true,
        },
        _count: {
          id: true,
        },
        where: {
          isApproved: true,
          isDeleted: false,
        },
      });
      avgSatisfaction = reviewStats._avg.rating || 0;
      reviewCount = reviewStats._count.id || 0;
      
      recentFeedback = await prisma.cruiseReview.findMany({
        take: 5,
        where: {
          isApproved: true,
          isDeleted: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          cruiseLine: true,
          shipName: true,
          createdAt: true,
        },
      });
    } catch (reviewError: any) {
      logger.error('[Admin Dashboard] Review stats error:', {
        message: reviewError?.message,
        code: reviewError?.code,
        meta: reviewError?.meta,
      });
    }

    // 6. 알림 통계
    let notificationStats: any[] = [];
    let totalNotifications = 0;
    
    try {
      notificationStats = await prisma.notificationLog.groupBy({
        by: ['notificationType'],
        _count: true,
      });
      totalNotifications = await prisma.notificationLog.count();
    } catch (notificationError: any) {
      logger.error('[Admin Dashboard] Notification stats error:', {
        message: notificationError?.message,
        code: notificationError?.code,
        meta: notificationError?.meta,
      });
    }

    // 8. 크루즈 상품 통계
    let totalProducts = 0;
    try {
      totalProducts = await prisma.cruiseProduct.count();
    } catch (productError: any) {
      logger.error('[Admin Dashboard] Product count error:', {
        message: productError?.message,
        code: productError?.code,
      });
    }

    // 9. PWA 설치 통계
    let pwaGenieInstalled = 0;
    let pwaMallInstalled = 0;
    let pwaBothInstalled = 0;
    
    try {
      pwaGenieInstalled = await prisma.user.count({
        where: { pwaGenieInstalledAt: { not: null } },
      });
      pwaMallInstalled = await prisma.user.count({
        where: { pwaMallInstalledAt: { not: null } },
      });
      pwaBothInstalled = await prisma.user.count({
        where: {
          pwaGenieInstalledAt: { not: null },
          pwaMallInstalledAt: { not: null },
        },
      });
    } catch (pwaError: any) {
      logger.error('[Admin Dashboard] PWA stats error:', {
        message: pwaError?.message,
        code: pwaError?.code,
      });
    }

    // 9. 최근 7일 트렌드 데이터 (일별)
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // 일별 사용자 가입 수 (PostgreSQL 호환)
    let dailyUsers: Array<{ date: string; count: number }> = [];
    let dailyTrips: Array<{ date: string; count: number }> = [];
    let dailyProductViews: Array<{ date: string; count: number }> = [];

    try {
      const dailyUsersRaw = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) as count
        FROM "User"
        WHERE "createdAt" >= ${sevenDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;
      dailyUsers = dailyUsersRaw.map(d => ({
        date: d.date,
        count: Number(d.count),
      }));
    } catch (dailyUsersError: any) {
      logger.error('[Admin Dashboard] Daily users query error:', {
        message: dailyUsersError?.message,
        code: dailyUsersError?.code,
      });
    }

    // 일별 여행 등록 수 (PostgreSQL 호환)
    try {
      const dailyTripsRaw = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) as count
        FROM "Trip"
        WHERE "createdAt" >= ${sevenDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;
      dailyTrips = dailyTripsRaw.map(d => ({
        date: d.date,
        count: Number(d.count),
      }));
    } catch (dailyTripsError: any) {
      logger.error('[Admin Dashboard] Daily trips query error:', {
        message: dailyTripsError?.message,
        code: dailyTripsError?.code,
      });
    }

    // 일별 상품 조회 수 (크루즈몰)
    try {
      const dailyProductViewsRaw = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE("viewedAt") as date,
          COUNT(*) as count
        FROM "ProductView"
        WHERE "viewedAt" >= ${sevenDaysAgo}
        GROUP BY DATE("viewedAt")
        ORDER BY date ASC
      `;
      dailyProductViews = dailyProductViewsRaw.map(d => ({
        date: d.date,
        count: Number(d.count),
      }));
    } catch (dailyProductViewsError: any) {
      logger.error('[Admin Dashboard] Daily product views query error:', {
        message: dailyProductViewsError?.message,
        code: dailyProductViewsError?.code,
      });
    }

    // 일별 통합 데이터 생성
    const trendData: Array<{ date: string; users: number; trips: number; productViews: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const userCount = dailyUsers.find(d => d.date === dateStr)?.count || 0;
      const tripCount = dailyTrips.find(d => d.date === dateStr)?.count || 0;
      const productViewCount = dailyProductViews.find(d => d.date === dateStr)?.count || 0;

      trendData.push({
        date: dateStr,
        users: userCount,
        trips: tripCount,
        productViews: productViewCount,
      });
    }

    // 10. 상품 조회 통계 (크루즈별, 국가별) - 최적화: 필요한 필드만 선택
    let productViews: any[] = [];
    try {
      productViews = await prisma.productView.findMany({
        select: {
          id: true,
          CruiseProduct: {
            select: {
              cruiseLine: true,
              shipName: true,
              itineraryPattern: true,
            },
          },
        },
        take: 500,
        orderBy: { viewedAt: 'desc' },
      });
    } catch (productViewError: any) {
      logger.error('[Admin Dashboard] Product views query error:', {
        message: productViewError?.message,
        code: productViewError?.code,
      });
    }

    // 국가 코드 -> 국가명 매핑
    const COUNTRY_CODE_TO_NAME: Record<string, string> = {
      'JP': '일본',
      'KR': '한국',
      'TH': '태국',
      'VN': '베트남',
      'MY': '말레이시아',
      'SG': '싱가포르',
      'ES': '스페인',
      'FR': '프랑스',
      'IT': '이탈리아',
      'GR': '그리스',
      'TR': '터키',
      'US': '미국',
      'CN': '중국',
      'TW': '대만',
      'HK': '홍콩',
      'PH': '필리핀',
      'ID': '인도네시아',
    };

    // 크루즈별 조회 수 집계
    const cruiseViewCounts = new Map<string, number>();
    productViews.forEach(view => {
      if (view.CruiseProduct) {
        const cruiseName = `${view.CruiseProduct.cruiseLine} ${view.CruiseProduct.shipName}`.trim();
        cruiseViewCounts.set(cruiseName, (cruiseViewCounts.get(cruiseName) || 0) + 1);
      }
    });

    // 국가별 조회 수 집계
    const countryViewCounts = new Map<string, number>();
    productViews.forEach(view => {
      if (view.CruiseProduct?.itineraryPattern) {
        const pattern = view.CruiseProduct.itineraryPattern;
        const countries = new Set<string>();
        
        // destination 필드가 있는 경우
        if (pattern.destination && Array.isArray(pattern.destination)) {
          pattern.destination.forEach((dest: string) => {
            if (dest && typeof dest === 'string') {
              const countryName = dest.split(' - ')[0].split(',')[0].trim();
              if (countryName) countries.add(countryName);
            }
          });
        }
        
        // itineraryPattern이 배열인 경우
        if (Array.isArray(pattern)) {
          pattern.forEach((day: any) => {
            if (day && day.country) {
              const countryCode = day.country;
              const countryName = COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
              if (countryCode !== 'KR') {
                countries.add(countryName);
              }
            }
          });
        }
        
        countries.forEach(country => {
          countryViewCounts.set(country, (countryViewCounts.get(country) || 0) + 1);
        });
      }
    });

    // 상위 10개 크루즈
    const topCruises = Array.from(cruiseViewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // 상위 10개 국가
    const topCountries = Array.from(countryViewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // 11. 어필리에이트 통계
    let totalBranchManagers = 0;
    let totalSalesAgents = 0;
    let totalAffiliateLeads = 0;
    let totalAffiliateSales = 0;
    let totalAffiliateSalesAmount = 0;
    let totalCommissionPending = 0;
    let totalCommissionSettled = 0;
    let recentAffiliateSales: any[] = [];

    // 추가 통계
    let trialLeadsCount = 0; // 지니3일 체험 유입 수 (source가 '1101', 'genie-trial', 'TRIAL' 등)
    let b2bLeadsCount = 0; // B2B 유입 수 (source가 'B2B_LANDING' 등)
    let purchasedCustomersCount = 0; // 구매 고객 수
    let recentTrialLeads: any[] = []; // 최근 지니3일 체험 유입 고객

    try {
      // 대리점장 수
      totalBranchManagers = await prisma.affiliateProfile.count({
        where: { type: 'BRANCH_MANAGER', status: 'ACTIVE' },
      });

      // 판매원 수
      totalSalesAgents = await prisma.affiliateProfile.count({
        where: { type: 'SALES_AGENT', status: 'ACTIVE' },
      });

      // 총 리드 수
      totalAffiliateLeads = await prisma.affiliateLead.count();

      // 총 판매 건수 및 매출액
      const salesStats = await prisma.affiliateSale.aggregate({
        _count: { id: true },
        _sum: { saleAmount: true },
      });
      totalAffiliateSales = salesStats._count.id || 0;
      totalAffiliateSalesAmount = salesStats._sum.saleAmount || 0;

      // 총 수당 (정산 대기 / 정산 완료)
      const commissionStats = await prisma.commissionLedger.groupBy({
        by: ['isSettled'],
        _sum: { amount: true },
      });
      totalCommissionPending = commissionStats.find(s => s.isSettled === false)?._sum.amount || 0;
      totalCommissionSettled = commissionStats.find(s => s.isSettled === true)?._sum.amount || 0;

      // 최근 판매 5건 - 최적화: 필요한 필드만 선택
      recentAffiliateSales = await prisma.affiliateSale.findMany({
        take: 5,
        orderBy: { saleDate: 'desc' },
        select: {
          id: true,
          productCode: true,
          saleAmount: true,
          saleDate: true,
          status: true,
          agentId: true,
          managerId: true,
        },
      });

      // 지니3일 체험 유입 수 (source가 '1101', 'genie-trial', 'TRIAL', 'trial' 포함)
      trialLeadsCount = await prisma.affiliateLead.count({
        where: {
          OR: [
            { source: { contains: '1101' } },
            { source: { contains: 'trial', mode: 'insensitive' } },
            { source: { contains: 'genie-trial', mode: 'insensitive' } },
          ],
        },
      });

      // B2B 유입 수 (source가 'B2B_LANDING' 등)
      b2bLeadsCount = await prisma.affiliateLead.count({
        where: {
          source: { contains: 'B2B', mode: 'insensitive' },
        },
      });

      // 구매 고객 수 (AffiliateSale에서 고유 leadId 또는 고유 전화번호)
      purchasedCustomersCount = await prisma.affiliateSale.count({
        where: {
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      });

      // 최근 지니3일 체험 유입 고객 (최근 10명)
      recentTrialLeads = await prisma.affiliateLead.findMany({
        where: {
          OR: [
            { source: { contains: '1101' } },
            { source: { contains: 'trial', mode: 'insensitive' } },
            { source: { contains: 'genie-trial', mode: 'insensitive' } },
            { source: { contains: 'B2B', mode: 'insensitive' } },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          source: true,
          status: true,
          createdAt: true,
          metadata: true,
        },
      });
    } catch (affiliateError: any) {
      logger.error('[Admin Dashboard] Affiliate stats error:', {
        message: affiliateError?.message,
        code: affiliateError?.code,
        meta: affiliateError?.meta,
      });
    }

    const responseData = {
      ok: true,
      dashboard: {
        users: {
          total: totalUsers, // 전체 (크루즈몰 + 지니AI 가이드)
          active: activeUsers,
          hibernated: hibernatedUsers,
          genieUsers: genieUsers, // 지니AI 가이드 사용자 수
          mallUsers: mallUsers, // 크루즈몰 사용자 수
          source: 'all', // 전체 출처 명시
        },
        trips: {
          total: totalTrips,
          upcoming: upcomingTrips,
          inProgress: inProgressTrips,
          completed: completedTrips,
          source: 'genie', // 지니AI 가이드 출처 명시
        },
        currentTrips: currentTrips.map(trip => ({
          id: trip.id,
          cruiseName: trip.shipName,
          userName: 'N/A',
          userPhone: '',
          startDate: trip.departureDate,
          endDate: trip.endDate,
          destination: null,
        })),
        satisfaction: {
          average: avgSatisfaction ? Math.round(avgSatisfaction * 10) / 10 : 0,
          count: reviewCount,
          source: 'mall', // 크루즈몰 출처 명시
          recentFeedback: recentFeedback.map(review => ({
            id: review.id,
            tripId: null,
            cruiseName: review.cruiseLine && review.shipName 
              ? `${review.cruiseLine} ${review.shipName}` 
              : review.cruiseLine || review.shipName || 'Unknown',
            score: review.rating,
            comments: review.content,
            createdAt: review.createdAt,
          })),
        },
        notifications: {
          total: totalNotifications,
          byType: notificationStats.map(stat => ({
            type: stat.notificationType,
            count: stat._count,
          })),
        },
        pushSubscriptions: mallUsers, // 크루즈몰 가입 인원
        pushSubscriptionsSource: 'mall', // 크루즈몰 출처 명시
        products: totalProducts,
        trends: trendData,
        productViews: {
          topCruises,
          topCountries,
          source: 'mall', // 크루즈몰 출처 명시
        },
        pwaInstalls: {
          genie: pwaGenieInstalled, // 크루즈가이드 지니 바탕화면 추가 수
          mall: pwaMallInstalled, // 크루즈몰 바탕화면 추가 수
          both: pwaBothInstalled, // 둘 다 추가한 사용자 수
        },
        affiliate: {
          branchManagers: totalBranchManagers, // 총 대리점장 수
          salesAgents: totalSalesAgents, // 총 판매원 수
          totalPartners: totalBranchManagers + totalSalesAgents, // 총 파트너 수
          leads: totalAffiliateLeads, // 총 리드 수
          sales: {
            count: totalAffiliateSales, // 총 판매 건수
            amount: totalAffiliateSalesAmount, // 총 매출액
          },
          commission: {
            pending: totalCommissionPending, // 정산 대기 수당
            settled: totalCommissionSettled, // 정산 완료 수당
            total: totalCommissionPending + totalCommissionSettled, // 총 수당
          },
          recentSales: recentAffiliateSales.map(sale => ({
            id: sale.id,
            productCode: sale.productCode,
            saleAmount: sale.saleAmount,
            saleDate: sale.saleDate,
            agentName: `판매원 #${sale.agentId ?? '-'}`,
            managerName: `대리점장 #${sale.managerId ?? '-'}`,
            status: sale.status,
          })),
        },
        // 추가 통계
        trialLeads: trialLeadsCount, // 지니3일 체험 유입 수
        b2bLeads: b2bLeadsCount, // B2B 유입 수
        purchasedCustomers: purchasedCustomersCount, // 구매 고객 수
        recentTrialLeads: recentTrialLeads.map(lead => ({
          id: lead.id,
          name: lead.customerName,
          phone: lead.customerPhone,
          source: lead.source,
          status: lead.status,
          createdAt: lead.createdAt,
          metadata: lead.metadata,
        })),
      },
    };

    // Redis에 5분 캐싱 (300초)
    await setCache(cacheKey, responseData, 300);

    return NextResponse.json(responseData, {
      // 성능 최적화: API 응답 캐싱 헤더 추가
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    logger.error('[Admin Dashboard API] Unexpected error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

