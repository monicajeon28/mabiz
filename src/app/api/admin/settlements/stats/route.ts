import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

interface SettlementStats {
  status: string;
  count: number;
  totalCommission: number;
  totalWithholding: number;
  netPayout: number;
}

interface PartnerStats {
  profileId: number | null;
  partnerName: string | null;
  settlementCount: number;
  totalCommission: number;
  totalWithholding: number;
  netPayout: number;
  lastSettlementDate: string | null;
}

/**
 * GET /api/admin/settlements/stats
 * 1M 행 쿼리를 2초 내로 응답하는 정산 통계
 * - 상태별 집계 (DRAFT, APPROVED, LOCKED, PAID)
 * - 파트너별 상위 10개 수익
 * - 월별 추이 데이터
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    // GLOBAL_ADMIN만 접근 가능
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const startTime = Date.now();

    // 1. 상태별 집계 (< 100ms)
    const [statusStats] = await Promise.all([
      prisma.$queryRaw<SettlementStats[]>(Prisma.sql`
        SELECT
          ms.status,
          COUNT(DISTINCT ms.id)::integer AS count,
          COALESCE(SUM(cl.amount), 0)::bigint AS total_commission,
          COALESCE(SUM(cl."withholdingAmount"), 0)::bigint AS total_withholding,
          COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::bigint AS net_payout
        FROM "MonthlySettlement" ms
        LEFT JOIN "CommissionLedger" cl
          ON cl."settlementId" = ms.id
          AND cl."isSettled" = true
        GROUP BY ms.status
        ORDER BY ms.status
      `),
    ]);

    // 2. 파트너별 상위 10 (< 500ms)
    const topPartners = await prisma.$queryRaw<PartnerStats[]>(Prisma.sql`
      SELECT
        cl."profileId",
        NULL::text AS "partnerName",
        COUNT(DISTINCT ms.id)::integer AS settlement_count,
        COALESCE(SUM(cl.amount), 0)::bigint AS total_commission,
        COALESCE(SUM(cl."withholdingAmount"), 0)::bigint AS total_withholding,
        COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::bigint AS net_payout,
        MAX(ms."periodEnd")::timestamp AS last_settlement_date
      FROM "CommissionLedger" cl
      LEFT JOIN "MonthlySettlement" ms
        ON cl."settlementId" = ms.id
      WHERE cl."isSettled" = true
      GROUP BY cl."profileId"
      ORDER BY net_payout DESC
      LIMIT 10
    `);

    // 3. 월별 추이 (< 300ms)
    const monthlyTrend = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        TO_CHAR(ms."periodStart", 'YYYY-MM') AS month,
        COUNT(DISTINCT ms.id)::integer AS settlement_count,
        COALESCE(SUM(cl.amount), 0)::bigint AS total_commission,
        COALESCE(SUM(cl."withholdingAmount"), 0)::bigint AS total_withholding,
        COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::bigint AS net_payout,
        COUNT(CASE WHEN ms.status = 'PAID' THEN 1 END)::integer AS paid_count
      FROM "MonthlySettlement" ms
      LEFT JOIN "CommissionLedger" cl
        ON cl."settlementId" = ms.id
        AND cl."isSettled" = true
      GROUP BY TO_CHAR(ms."periodStart", 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `);

    const elapsed = Date.now() - startTime;

    logger.log('[GET /api/admin/settlements/stats]', {
      statusStatsCount: statusStats.length,
      topPartnersCount: topPartners.length,
      monthlyTrendCount: monthlyTrend.length,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      ok: true,
      data: {
        statusStats: statusStats.map((s) => ({
          status: s.status,
          count: s.count,
          totalCommission: Number(s.totalCommission),
          totalWithholding: Number(s.totalWithholding),
          netPayout: Number(s.netPayout),
        })),
        topPartners: topPartners.map((p) => ({
          profileId: p.profileId,
          settlementCount: p.settlementCount,
          totalCommission: Number(p.totalCommission),
          totalWithholding: Number(p.totalWithholding),
          netPayout: Number(p.netPayout),
          lastSettlementDate: p.lastSettlementDate,
        })),
        monthlyTrend: monthlyTrend.map((m) => ({
          month: m.month,
          settlementCount: m.settlementCount,
          totalCommission: Number(m.totalCommission),
          totalWithholding: Number(m.totalWithholding),
          netPayout: Number(m.netPayout),
          paidCount: m.paidCount,
        })),
      },
      performance: {
        elapsedMs: elapsed,
        queryPerformance: elapsed < 2000 ? 'EXCELLENT' : elapsed < 5000 ? 'GOOD' : 'NEEDS_OPTIMIZATION',
      },
    });
  } catch (err) {
    logger.error('[GET /api/admin/settlements/stats]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
