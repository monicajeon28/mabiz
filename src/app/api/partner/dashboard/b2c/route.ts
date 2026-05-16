export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const now = new Date();
    const [year, month] = monthParam ? monthParam.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = startDate;

    const isAdmin = ctx.sessionUser.role === 'admin';
    const orgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };
    const orgId = ctx.organizationId;

    // ── 9개 쿼리 전부 병렬 ──
    const [
      salesAgg, prevSalesAgg, recentSalesRaw,
      reservationCount, prevReservationCount,
      passportPnrRows, passportAggRows, pnrAggRows,
    ] = await Promise.all([
      prisma.affiliateSale.aggregate({
        where: { ...orgFilter, createdAt: { gte: startDate, lt: endDate } },
        _sum: { saleAmount: true }, _count: true,
      }),
      prisma.affiliateSale.aggregate({
        where: { ...orgFilter, createdAt: { gte: prevStart, lt: prevEnd } },
        _sum: { saleAmount: true }, _count: true,
      }),
      prisma.affiliateSale.findMany({ where: orgFilter, orderBy: { createdAt: 'desc' }, take: 10 }),
      // 예약 카운트 (현재/전월)
      isAdmin
        ? prisma.gmReservation.count({ where: { createdAt: { gte: startDate, lt: endDate } } })
        : prisma.$queryRaw<[{ cnt: bigint }]>`
            SELECT COUNT(*)::bigint AS cnt FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            WHERE a."organizationId" = ${orgId} AND r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
          `.then(r => Number(r[0]?.cnt ?? 0)),
      isAdmin
        ? prisma.gmReservation.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } })
        : prisma.$queryRaw<[{ cnt: bigint }]>`
            SELECT COUNT(*)::bigint AS cnt FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            WHERE a."organizationId" = ${orgId} AND r."createdAt" >= ${prevStart} AND r."createdAt" < ${prevEnd}
          `.then(r => Number(r[0]?.cnt ?? 0)),
      // 여권/PNR 최근 5건
      isAdmin
        ? prisma.$queryRaw<Array<{ id: string; name: string | null; passportStatus: string; pnrStatus: string; finalConfirmStatus: string }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus", r."finalConfirmStatus"
            FROM "Reservation" r LEFT JOIN "User" u ON u."id" = r."mainUserId"
            ORDER BY r."createdAt" DESC LIMIT 5`
        : prisma.$queryRaw<Array<{ id: string; name: string | null; passportStatus: string; pnrStatus: string; finalConfirmStatus: string }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus", r."finalConfirmStatus"
            FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            WHERE a."organizationId" = ${orgId}
            ORDER BY r."createdAt" DESC LIMIT 5`,
      // 여권 상태별 집계
      isAdmin
        ? prisma.$queryRaw<Array<{ status: string; cnt: bigint }>>`
            SELECT r."passportStatus" AS status, COUNT(*)::bigint AS cnt FROM "Reservation" r GROUP BY r."passportStatus"`
        : prisma.$queryRaw<Array<{ status: string; cnt: bigint }>>`
            SELECT r."passportStatus" AS status, COUNT(*)::bigint AS cnt FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            WHERE a."organizationId" = ${orgId} GROUP BY r."passportStatus"`,
      // PNR 상태별 집계
      isAdmin
        ? prisma.$queryRaw<Array<{ status: string; cnt: bigint }>>`
            SELECT r."pnrStatus" AS status, COUNT(*)::bigint AS cnt FROM "Reservation" r GROUP BY r."pnrStatus"`
        : prisma.$queryRaw<Array<{ status: string; cnt: bigint }>>`
            SELECT r."pnrStatus" AS status, COUNT(*)::bigint AS cnt FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            WHERE a."organizationId" = ${orgId} GROUP BY r."pnrStatus"`,
    ]);

    const totalSalesAmount = salesAgg._sum.saleAmount ?? 0;
    const salesCount = salesAgg._count;

    const recentSales = recentSalesRaw.map((s) => ({
      id: s.id, productName: s.productName ?? '-', amount: s.saleAmount,
      commission: s.commissionAmount ?? 0,
      commissionRate: s.commissionRate,  // null=확인 중, 숫자=확정
      status: s.status ?? 'PENDING',
      date: s.createdAt.toISOString().slice(0, 10),
    }));

    const passportPnr = passportPnrRows.map((r) => ({
      id: r.id, customerName: r.name ?? '-',
      passportStatus: r.passportStatus ?? 'NONE', pnrStatus: r.pnrStatus ?? 'NONE',
      confirmedAt: r.finalConfirmStatus || null,
    }));

    const toMap = (rows: Array<{ status: string; cnt: bigint }>) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r.status ?? 'NONE'] = Number(r.cnt);
      return m;
    };

    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    return NextResponse.json({
      ok: true,
      data: {
        totalSalesAmount, salesCount,
        reservationCount: reservationCount as number,
        recentSales, passportPnr,
        passportSummary: toMap(passportAggRows),
        pnrSummary: toMap(pnrAggRows),
        trends: {
          totalSalesAmount: calcTrend(Number(totalSalesAmount), Number(prevSalesAgg._sum.saleAmount ?? 0)),
          salesCount: calcTrend(salesCount, prevSalesAgg._count),
          reservationCount: calcTrend(reservationCount as number, prevReservationCount as number),
        },
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/b2c] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
