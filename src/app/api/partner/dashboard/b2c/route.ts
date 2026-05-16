export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/b2c?month=2026-05
 * B2C 대시보드 탭: 판매 통계 + 전월 대비 트렌드 + 최근 판매 + 여권/PNR 현황
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // 전월 범위 (트렌드용)
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = startDate;

    // ── 조직 필터 ──
    const isAdmin = ctx.sessionUser.role === 'admin';
    const orgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };

    // ── 1) 판매 통계: aggregate 사용 (성능 최적화) ──
    const [salesAgg, prevSalesAgg] = await Promise.all([
      prisma.affiliateSale.aggregate({
        where: { ...orgFilter, createdAt: { gte: startDate, lt: endDate } },
        _sum: { saleAmount: true },
        _count: true,
      }),
      prisma.affiliateSale.aggregate({
        where: { ...orgFilter, createdAt: { gte: prevStart, lt: prevEnd } },
        _sum: { saleAmount: true },
        _count: true,
      }),
    ]);

    const totalSalesAmount = salesAgg._sum.saleAmount ?? 0;
    const salesCount = salesAgg._count;
    const prevTotalSales = prevSalesAgg._sum.saleAmount ?? 0;
    const prevSalesCount = prevSalesAgg._count;

    // ── 2) 예약 건수 (단일 JOIN 쿼리) ──
    let reservationCount = 0;
    let prevReservationCount = 0;

    if (isAdmin) {
      const [curr, prev] = await Promise.all([
        prisma.gmReservation.count({
          where: { createdAt: { gte: startDate, lt: endDate } },
        }),
        prisma.gmReservation.count({
          where: { createdAt: { gte: prevStart, lt: prevEnd } },
        }),
      ]);
      reservationCount = curr;
      prevReservationCount = prev;
    } else {
      const [curr, prev] = await Promise.all([
        prisma.$queryRaw<[{ cnt: bigint }]>`
          SELECT COUNT(*)::bigint AS cnt
          FROM "GmReservation" r
          INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
          WHERE a."organizationId" = ${ctx.organizationId}
            AND r."createdAt" >= ${startDate}
            AND r."createdAt" < ${endDate}
        `,
        prisma.$queryRaw<[{ cnt: bigint }]>`
          SELECT COUNT(*)::bigint AS cnt
          FROM "GmReservation" r
          INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
          WHERE a."organizationId" = ${ctx.organizationId}
            AND r."createdAt" >= ${prevStart}
            AND r."createdAt" < ${prevEnd}
        `,
      ]);
      reservationCount = Number(curr[0]?.cnt ?? 0);
      prevReservationCount = Number(prev[0]?.cnt ?? 0);
    }

    // ── 3) 최근 판매 10건 ──
    const recentSalesRaw = await prisma.affiliateSale.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentSales = recentSalesRaw.map((s) => ({
      id: s.id,
      productName: s.productName ?? '-',
      amount: s.saleAmount,
      commission: s.commissionAmount ?? 0,
      status: s.status ?? 'PENDING',
      date: s.createdAt.toISOString().slice(0, 10),
    }));

    // ── 4) 여권/PNR 현황 (단일 JOIN) ──
    const orderIds = recentSalesRaw
      .map((s) => s.orderId)
      .filter((id): id is string => id !== null);

    let passportPnr: Array<{
      id: string; customerName: string;
      passportStatus: string; pnrStatus: string; confirmedAt: string | null;
    }> = [];

    if (orderIds.length > 0) {
      const rows = await prisma.$queryRaw<
        Array<{ id: string; name: string | null; passportStatus: string; pnrStatus: string; finalConfirmStatus: string }>
      >`
        SELECT r."id", u."name", r."passportStatus", r."pnrStatus", r."finalConfirmStatus"
        FROM "GmReservation" r
        INNER JOIN "GmUser" u ON u."id" = r."mainUserId"
        WHERE CAST(r."affiliateSaleId" AS TEXT) = ANY(${orderIds})
        ORDER BY r."createdAt" DESC
        LIMIT 5
      `;
      passportPnr = rows.map((r) => ({
        id: r.id,
        customerName: r.name ?? '-',
        passportStatus: r.passportStatus ?? 'NONE',
        pnrStatus: r.pnrStatus ?? 'NONE',
        confirmedAt: r.finalConfirmStatus || null,
      }));
    }

    // ── 트렌드 계산 ──
    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    logger.log('[dashboard/b2c] 조회 완료', {
      orgId: ctx.organizationId,
      month: `${year}-${String(month).padStart(2, '0')}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        totalSalesAmount,
        salesCount,
        reservationCount,
        recentSales,
        passportPnr,
        trends: {
          totalSalesAmount: calcTrend(Number(totalSalesAmount), Number(prevTotalSales)),
          salesCount: calcTrend(salesCount, prevSalesCount),
          reservationCount: calcTrend(reservationCount, prevReservationCount),
        },
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/b2c] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
