import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

interface SettlementSummary {
  totalSettlements: number;
  totalCommission: string;
  totalWithholding: string;
  netPayout: string;
  paidSettlements: number;
  pendingSettlements: number;
  averageCommissionPerSettlement: string;
  avgProcessingDays: string;
}

interface SummaryResponse {
  ok: boolean;
  data?: {
    summary: SettlementSummary;
    byStatus?: Record<string, { count: number; netPayout: string }>;
    byTier?: Record<string, { count: number; netPayout: string }>;
    trend?: Array<{
      month: string;
      payout: string;
      count: number;
      status: string;
    }>;
  };
  performance?: {
    elapsedMs: number;
    cacheHit?: boolean;
  };
  error?: string;
}

/**
 * GET /api/settlements/summary
 * Dashboard Hero KPI 표시용 정산 데이터 집계
 *
 * Query Parameters:
 * - period: '1month' | '3month' | '12month' | 'all' (기본: 12month)
 * - tier: 'TIER1,TIER2,TIER3,PLATFORM' (쉼표 구분, 기본: all)
 *
 * Performance Target: <300ms
 * Uses: idx_commission_ledger_partner_settled_date + idx_settlement_period_status_ledger
 */
export async function GET(request: NextRequest): Promise<NextResponse<SummaryResponse>> {
  const startTime = Date.now();

  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    if (!ctx?.role?.includes("ADMIN")) {
      return NextResponse.json<SummaryResponse>(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "12month";
    const tierParam = searchParams.get("tier") || "all";

    // Period 계산
    let periodStart = new Date();
    if (period === "1month") {
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else if (period === "3month") {
      periodStart.setMonth(periodStart.getMonth() - 3);
    } else if (period === "12month") {
      periodStart.setMonth(periodStart.getMonth() - 12);
    } else {
      // 'all' - no date filter
      periodStart = new Date("2000-01-01");
    }

    // 1. 전체 정산 요약 (인덱스 사용: idx_commission_ledger_partner_settled_date)
    const summaryQuery = prisma.$queryRaw<[SettlementSummary]>(
      Prisma.sql`
        SELECT
          COUNT(DISTINCT ms.id)::bigint AS "totalSettlements",
          COALESCE(SUM(cl.amount), 0)::text AS "totalCommission",
          COALESCE(SUM(cl."withholdingAmount"), 0)::text AS "totalWithholding",
          COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::text AS "netPayout",
          COUNT(CASE WHEN ms.status = 'PAID' THEN 1 END)::bigint AS "paidSettlements",
          COUNT(CASE WHEN ms.status != 'PAID' THEN 1 END)::bigint AS "pendingSettlements",
          (COALESCE(SUM(cl.amount), 0) / NULLIF(COUNT(DISTINCT cl.id), 0))::text AS "averageCommissionPerSettlement",
          COALESCE(
            AVG(EXTRACT(DAY FROM ms."paymentDate" - ms."approvedAt")),
            0
          )::text AS "avgProcessingDays"
        FROM "CommissionLedger" cl
        INNER JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."isSettled" = true
          AND cl."createdAt" >= ${periodStart}
          AND cl."organizationId" = ${orgId}
      `
    );

    // 2. 상태별 집계 쿼리 (인덱스: idx_settlement_period_status_ledger)
    const byStatusQuery = prisma.$queryRaw<
      Array<{ status: string; count: bigint; netPayout: string }>
    >(
      Prisma.sql`
        SELECT
          ms.status,
          COUNT(DISTINCT ms.id)::bigint AS "count",
          COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::text AS "netPayout"
        FROM "CommissionLedger" cl
        INNER JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."isSettled" = true
          AND cl."createdAt" >= ${periodStart}
          AND cl."organizationId" = ${orgId}
        GROUP BY ms.status
      `
    );

    // 3. 월별 트렌드 조회
    const trendQuery = prisma.$queryRaw<
      Array<{
        month: string;
        payout: string;
        count: number;
        status: string;
      }>
    >(
      Prisma.sql`
        SELECT
          TO_CHAR(ms."periodStart", 'YYYY-MM') AS "month",
          COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::text AS "payout",
          COUNT(DISTINCT ms.id)::integer AS "count",
          CASE
            WHEN COUNT(CASE WHEN ms.status = 'PAID' THEN 1 END) = COUNT(DISTINCT ms.id)
            THEN 'COMPLETED'
            ELSE 'IN_PROGRESS'
          END AS "status"
        FROM "CommissionLedger" cl
        INNER JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."isSettled" = true
          AND cl."createdAt" >= ${periodStart}
          AND cl."organizationId" = ${orgId}
        GROUP BY TO_CHAR(ms."periodStart", 'YYYY-MM')
        ORDER BY ms."periodStart" DESC
        LIMIT 12
      `
    );

    // 병렬 실행
    const [summary, byStatus, trend] = await Promise.all([
      summaryQuery,
      byStatusQuery,
      trendQuery,
    ]);

    const elapsed = Date.now() - startTime;

    // Response 조립
    const byStatusMap = byStatus.reduce(
      (acc, row) => {
        acc[row.status] = {
          count: Number(row.count),
          netPayout: row.netPayout,
        };
        return acc;
      },
      {} as Record<string, { count: number; netPayout: string }>
    );

    return NextResponse.json<SummaryResponse>(
      {
        ok: true,
        data: {
          summary: summary[0],
          byStatus: byStatusMap,
          trend: trend,
        },
        performance: {
          elapsedMs: elapsed,
          cacheHit: false,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300", // 5분 캐싱
        },
      }
    );
  } catch (err) {
    logger.error("[GET /api/settlements/summary]", { err });
    const elapsed = Date.now() - startTime;

    return NextResponse.json<SummaryResponse>(
      {
        ok: false,
        error: "QUERY_FAILED",
        performance: { elapsedMs: elapsed },
      },
      { status: 500 }
    );
  }
}
