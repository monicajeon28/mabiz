export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/b2c?month=2026-05
 * B2C 대시보드 탭: 판매 통계, 최근 판매, 여권/PNR 현황
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // ── 조직 필터 (GLOBAL_ADMIN: 전체, OWNER: 자기 조직만) ──
    const orgFilter =
      ctx.sessionUser.role === 'admin'
        ? {}
        : { organizationId: ctx.organizationId! };

    // ── 1) 해당 월 판매 통계 ──
    const monthlySales = await prisma.affiliateSale.findMany({
      where: {
        ...orgFilter,
        createdAt: { gte: startDate, lt: endDate },
      },
      select: { id: true, saleAmount: true },
    });

    const totalSales = monthlySales.reduce((sum, s) => sum + s.saleAmount, 0);
    const salesCount = monthlySales.length;

    // 해당 월 예약 건수 (AffiliateSale 경유)
    const saleIds = monthlySales.map((s) => s.id);
    let reservationCount = 0;
    if (saleIds.length > 0) {
      reservationCount = await prisma.gmReservation.count({
        where: {
          createdAt: { gte: startDate, lt: endDate },
        },
      });
      // OWNER인 경우 AffiliateSale 경유로 필터링 (raw query)
      if (ctx.sessionUser.role !== 'admin') {
        const result = await prisma.$queryRaw<[{ cnt: bigint }]>`
          SELECT COUNT(*)::bigint AS cnt
          FROM "GmReservation" r
          INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
          WHERE a."organizationId" = ${ctx.organizationId}
            AND r."createdAt" >= ${startDate}
            AND r."createdAt" < ${endDate}
        `;
        reservationCount = Number(result[0]?.cnt ?? 0);
      }
    }

    const stats = { totalSales, salesCount, reservationCount };

    // ── 2) 최근 판매 10건 ──
    const recentSales = await prisma.affiliateSale.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ── 3) 여권/PNR 현황 (최근 5건) ──
    // AffiliateSale → orderId → GmReservation.affiliateSaleId 매칭
    let passportPnr: Array<{
      name: string | null;
      passportStatus: string;
      pnrStatus: string;
      finalConfirmStatus: string;
    }> = [];

    const recentSaleIds = await prisma.affiliateSale.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { orderId: true },
    });

    const orderIds = recentSaleIds
      .map((s) => s.orderId)
      .filter((id): id is string => id !== null);

    if (orderIds.length > 0) {
      // GmReservation.affiliateSaleId(Int) ↔ AffiliateSale.orderId(String) 매칭
      const reservations = await prisma.$queryRaw<
        Array<{
          name: string | null;
          passportStatus: string;
          pnrStatus: string;
          finalConfirmStatus: string;
        }>
      >`
        SELECT u."name", r."passportStatus", r."pnrStatus", r."finalConfirmStatus"
        FROM "GmReservation" r
        INNER JOIN "GmUser" u ON u."id" = r."mainUserId"
        WHERE CAST(r."affiliateSaleId" AS TEXT) = ANY(${orderIds})
        ORDER BY r."createdAt" DESC
        LIMIT 5
      `;
      passportPnr = reservations;
    }

    logger.log('[dashboard/b2c] 조회 완료', {
      orgId: ctx.organizationId,
      month: `${year}-${String(month).padStart(2, '0')}`,
    });

    return NextResponse.json({ stats, recentSales, passportPnr });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/b2c] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
