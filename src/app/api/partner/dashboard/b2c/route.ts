export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    // GLOBAL_ADMIN은 organizationId 없어도 접근 가능 (전체 통합 통계 빈 데이터 반환)
    if (!ctx.organizationId) {
      if (ctx.sessionUser?.role === 'admin') {
        return NextResponse.json({
          ok: true,
          message: '조직을 선택하면 상세 데이터를 볼 수 있습니다',
          period: {}, monthSales: 0, prevMonthSales: 0, salesGrowth: 0,
          reservationCount: 0, prevReservationCount: 0,
          recentSales: [], passportPnrList: [], passportAgg: {},
          pnrAgg: {}, totalCount: 0,
        });
      }
      logger.error('[b2c] organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음. 관리자에게 문의하세요.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const now = new Date();
    const [year, month] = monthParam ? monthParam.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = startDate;

    const isAdmin = ctx.sessionUser.role === 'admin';
    const orgFilter = { organizationId: ctx.organizationId };
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
      // 여권/PNR 현황 (완료되지 않은 것들) — JOIN 순서 통일 (r → u → a → om)
      isAdmin
        ? prisma.$queryRaw<Array<{ id: string; name: string | null; passportStatus: string; pnrStatus: string; finalConfirmStatus: string; assignedName: string | null; commissionAmount: number | null; commissionRate: number | null; saleStatus: string | null; saleId: string | null }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus", r."finalConfirmStatus",
                   om."displayName" AS "assignedName", a."commissionAmount", a."commissionRate", a."status" AS "saleStatus", a."id" AS "saleId"
            FROM "Reservation" r
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            LEFT JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            LEFT JOIN "OrganizationMember" om ON om."userId" = a."affiliateUserId" AND om."organizationId" = a."organizationId"
            WHERE (r."passportStatus" != 'ISSUED' OR r."pnrStatus" != 'CONFIRMED')
            ORDER BY r."createdAt" DESC LIMIT 100`
        : prisma.$queryRaw<Array<{ id: string; name: string | null; passportStatus: string; pnrStatus: string; finalConfirmStatus: string; assignedName: string | null; commissionAmount: number | null; commissionRate: number | null; saleStatus: string | null; saleId: string | null }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus", r."finalConfirmStatus",
                   om."displayName" AS "assignedName", a."commissionAmount", a."commissionRate", a."status" AS "saleStatus", a."id" AS "saleId"
            FROM "Reservation" r
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            LEFT JOIN "OrganizationMember" om ON om."userId" = a."affiliateUserId" AND om."organizationId" = a."organizationId"
            WHERE a."organizationId" = ${orgId}
              AND (r."passportStatus" != 'ISSUED' OR r."pnrStatus" != 'CONFIRMED')
            ORDER BY r."createdAt" DESC LIMIT 100`,
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

    // ── 자동 동기화: 여권+PNR 완료 → finalConfirmStatus + 수당 대기 상태로 변환 ──
    const autoConfirmIds = passportPnrRows
      .filter(r => r.passportStatus === 'ISSUED' && r.pnrStatus === 'CONFIRMED' && r.finalConfirmStatus !== 'CONFIRMED')
      .map(r => {
        const parsed = parseInt(r.id, 10);
        if (isNaN(parsed)) {
          logger.warn('[b2c] invalid reservation id for auto-sync', { id: r.id });
          return null;
        }
        return parsed;
      })
      .filter((id): id is number => id !== null);

    if (autoConfirmIds.length > 0) {
      try {
        // Reservation들의 affiliateSaleId 조회
        const reservationsWithSales = await prisma.gmReservation.findMany({
          where: { id: { in: autoConfirmIds } },
          select: { id: true, affiliateSaleId: true },
        });

        // Reservation finalConfirmStatus 일괄 업데이트
        await prisma.gmReservation.updateMany({
          where: { id: { in: autoConfirmIds } },
          data: { finalConfirmStatus: 'CONFIRMED', finalConfirmApprovedAt: new Date() },
        });

        // AffiliateSale 상태 일괄 업데이트 (N+1 쿼리 제거)
        const saleIds = reservationsWithSales
          .filter(rv => rv.affiliateSaleId)
          .map(rv => String(rv.affiliateSaleId));

        if (saleIds.length > 0) {
          await prisma.affiliateSale.updateMany({
            where: { orderId: { in: saleIds } },
            data: { status: 'PENDING_APPROVAL' },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        logger.error('[b2c] auto-sync error', { message, stack });
      }
    }

    const passportPnr = passportPnrRows.map((r) => ({
      id: r.id, customerName: r.name ?? '-',
      passportStatus: r.passportStatus ?? 'NONE', pnrStatus: r.pnrStatus ?? 'NONE',
      confirmedAt: r.finalConfirmStatus || null,
      assignedName: r.assignedName || '-',
      commissionAmount: r.commissionAmount ?? 0,
      saleId: r.saleId || null,
    }));

    const toMap = (rows: Array<{ status: string; cnt: bigint }>) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r.status ?? 'NONE'] = Number(r.cnt);
      return m;
    };

    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    const prevSalesAmount = Number(prevSalesAgg._sum.saleAmount ?? 0);

    return NextResponse.json({
      ok: true,
      data: {
        totalSalesAmount, salesCount,
        reservationCount: reservationCount as number,
        recentSales, passportPnr,
        passportSummary: toMap(passportAggRows),
        pnrSummary: toMap(pnrAggRows),
        trends: {
          totalSalesAmount: calcTrend(totalSalesAmount as number, prevSalesAmount),
          salesCount: calcTrend(salesCount, prevSalesAgg._count),
          reservationCount: calcTrend(reservationCount as number, prevReservationCount as number),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error('[dashboard/b2c] 오류', { message, stack });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
