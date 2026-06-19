import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/affiliate-sales
 * GLOBAL_ADMIN only: 모든 대리점의 매출 통합 분석
 *
 * Query Parameters:
 *   - period: 'month' | 'quarter' | 'year' (default: 'month')
 *   - year: number (default: 2026)
 *   - month: number 1-12 (required when period=month)
 *
 * Response:
 *   {
 *     ok: true,
 *     data: [
 *       {
 *         affiliateUserId: string,
 *         affiliateName: string,
 *         totalRevenue: number,
 *         conversionRate: number,
 *         avgOrderAmount: number,
 *         pageCount: number,
 *         status: 'active' | 'inactive'
 *       }
 *     ]
 *   }
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    // 권한 검증: GLOBAL_ADMIN만
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const period = (url.searchParams.get('period') ?? 'month') as 'month' | 'quarter' | 'year';
    const now = new Date();
    const year = parseInt(url.searchParams.get('year') ?? now.getFullYear().toString(), 10);
    const monthParam = url.searchParams.get('month');
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    // 기간별 날짜 범위 계산
    let startDate: Date;
    let endDate: Date;

    if (period === 'month') {
      if (month < 1 || month > 12) {
        return NextResponse.json(
          { ok: false, error: 'month must be between 1 and 12' },
          { status: 400 },
        );
      }
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 1); // 다음 달 1일
    } else if (period === 'quarter') {
      const quarter = Math.ceil(month / 3);
      const quarterStartMonth = (quarter - 1) * 3;
      startDate = new Date(year, quarterStartMonth, 1);
      endDate = new Date(year, quarterStartMonth + 3, 1);
    } else { // 'year'
      startDate = new Date(year, 0, 1);
      endDate = new Date(year + 1, 0, 1);
    }

    // [Query 1] 모든 사용자 조회 (affiliateCode가 있는 사용자만)
    const affiliateUsers = await prisma.gmUser.findMany({
      where: {
        affiliateCode: { not: null },
      },
      select: {
        id: true,
        name: true,
        affiliateCode: true,
      },
    });

    if (affiliateUsers.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }

    // affiliateCode 목록 추출
    const affiliateCodes = affiliateUsers
      .filter((u) => u.affiliateCode)
      .map((u) => u.affiliateCode!);

    // [Query 2] affiliateCode가 있는 결제만 조회 (전체 테이블 로드 방지)
    // metadata->>'affiliateCode' IN (affiliateCodes) 조건을 rawSQL로 실행
    // Prisma의 Json path 필터는 string_in을 지원하지 않으므로 $queryRaw 사용
    const payments =
      affiliateCodes.length > 0
        ? await prisma.$queryRaw<
            {
              id: string;
              orderId: string;
              amount: number;
              status: string;
              createdAt: Date;
              metadata: unknown;
            }[]
          >`
          SELECT id, "orderId", amount, status, "createdAt", metadata
          FROM "CrmPayAppPayment"
          WHERE "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}
            AND metadata->>'affiliateCode' = ANY(${affiliateCodes}::text[])
        `
        : [];

    // [Query 3] 모든 CrmLandingPage 조회 (createdByUserId 기반 affiliateCode 매칭)
    // createdByUserId는 문자열이므로 gmUser.id(정수)를 문자열로 변환해서 매칭
    const userIdStrings = affiliateUsers.map(u => u.id.toString());
    const landingPagesWithCreator = await prisma.crmLandingPage.findMany({
      where: {
        createdByUserId: { in: userIdStrings.length > 0 ? userIdStrings : undefined },
      },
      select: {
        id: true,
        createdByUserId: true,
      },
    });

    // Landing Views 조회 (페이지 기반)
    const landingPageIds = landingPagesWithCreator.map(p => p.id);
    const landingViews = landingPageIds.length > 0
      ? await prisma.crmLandingView.findMany({
        where: {
          landingPageId: { in: landingPageIds },
          viewedAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: {
          id: true,
          landingPageId: true,
        },
      })
      : [];

    // 메모리에서 데이터 집계
    const affiliateMap = new Map(affiliateUsers.map((u) => [u.affiliateCode!, u]));

    // affiliateCode별 매출 집계
    const affiliateSalesMap = new Map<string, {
      totalRevenue: number;
      orderCount: number;
      completedCount: number;
    }>();

    for (const payment of payments) {
      const metadata = typeof payment.metadata === 'object' && payment.metadata !== null ? payment.metadata as Record<string, unknown> : {};
      const affiliateCode = (metadata.affiliateCode as string | null) || null;
      if (!affiliateCode || !affiliateMap.has(affiliateCode)) continue;

      const current = affiliateSalesMap.get(affiliateCode) ?? {
        totalRevenue: 0,
        orderCount: 0,
        completedCount: 0,
      };

      current.totalRevenue += payment.amount ?? 0;
      current.orderCount += 1;
      if (payment.status === 'completed' || payment.status === 'paid') {
        current.completedCount += 1;
      }

      affiliateSalesMap.set(affiliateCode, current);
    }

    // landingPageId -> createdByUserId -> affiliateCode 매핑
    const pageCreatorMap = new Map(
      landingPagesWithCreator.map(p => [p.id, p.createdByUserId])
    );

    // userIdString -> affiliateCode 매핑
    const userAffiliateMap = new Map(
      affiliateUsers.map(u => [u.id.toString(), u.affiliateCode!])
    );

    // affiliateCode별 페이지 뷰 집계
    const affiliatePageMap = new Map<string, number>();
    for (const view of landingViews) {
      const creatorId = pageCreatorMap.get(view.landingPageId);
      if (!creatorId) continue;
      const affiliateCode = userAffiliateMap.get(creatorId);
      if (!affiliateCode) continue;
      affiliatePageMap.set(
        affiliateCode,
        (affiliatePageMap.get(affiliateCode) ?? 0) + 1,
      );
    }

    // 최종 결과 생성
    const result = affiliateUsers.map((user) => {
      const code = user.affiliateCode!;
      const sales = affiliateSalesMap.get(code) ?? { totalRevenue: 0, orderCount: 0, completedCount: 0 };
      const pageCount = affiliatePageMap.get(code) ?? 0;

      const conversionRate = pageCount > 0
        ? Math.round((sales.completedCount / pageCount) * 100 * 10) / 10 // 소수 첫 자리까지
        : 0;

      const avgOrderAmount = sales.orderCount > 0
        ? Math.floor(sales.totalRevenue / sales.orderCount)
        : 0;

      return {
        affiliateUserId: String(user.id),
        affiliateName: user.name || user.affiliateCode,
        totalRevenue: sales.totalRevenue,
        conversionRate,
        avgOrderAmount,
        pageCount,
        status: 'active' as const,
      };
    });

    return NextResponse.json({
      ok: true,
      data: result,
      total: result.length,
      page: 1,
      limit: result.length,
      totalPages: 1,
    });
  } catch (err) {
    logger.error('[GET /api/admin/affiliate-sales]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
