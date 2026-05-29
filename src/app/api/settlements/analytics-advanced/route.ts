import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

interface AnalyticsResponse {
  ok: boolean;
  data?: {
    paymentDistribution?: {
      timeSeries: Array<{
        date: string;
        paid: string;
        pending: string;
      }>;
      byDayOfWeek: Record<string, string>;
    };
    riskAnalysis?: {
      highRisk: {
        count: number;
        totalPayout: string;
        reasons: string[];
      };
      mediumRisk: {
        count: number;
        totalPayout: string;
      };
      lowRisk: {
        count: number;
        totalPayout: string;
      };
    };
    performanceTrend?: {
      avgProcessingTime: string;
      paymentOnTimeRate: string;
      errorRate: string;
    };
    partnerDistribution?: {
      byTier: Record<string, { count: number; totalPayout: string }>;
      topPartners: Array<{
        partnerId: number;
        name: string;
        totalPayout: string;
        count: number;
      }>;
    };
  };
  performance?: {
    elapsedMs: number;
  };
  error?: string;
}

/**
 * GET /api/settlements/analytics-advanced
 * 심화 정산 분석 대시보드
 *
 * Query Parameters:
 * - period: '1month' | '3month' | '12month' | 'all' (기본: 12month)
 * - includeRisk?: 'true' | 'false' (기본: true)
 * - includePartners?: 'true' | 'false' (기본: true)
 *
 * Performance Target: <500ms
 * Uses: 병렬 쿼리 + 집계
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsResponse>> {
  const startTime = Date.now();

  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    if (!ctx?.role?.includes("ADMIN")) {
      return NextResponse.json<AnalyticsResponse>(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "12month";
    const includeRisk = searchParams.get("includeRisk") !== "false";
    const includePartners = searchParams.get("includePartners") !== "false";

    // Period 계산
    let periodStart = new Date();
    if (period === "1month") {
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else if (period === "3month") {
      periodStart.setMonth(periodStart.getMonth() - 3);
    } else if (period === "12month") {
      periodStart.setMonth(periodStart.getMonth() - 12);
    } else {
      periodStart = new Date("2000-01-01");
    }

    // 1. Payment Distribution (날짜별)
    const paymentDistributionQuery = prisma.$queryRaw<
      Array<{
        date: string;
        paid: string;
        pending: string;
      }>
    >(
      Prisma.sql`
        SELECT
          TO_CHAR(ms."paymentDate", 'YYYY-MM-DD') AS "date",
          COALESCE(
            SUM(CASE WHEN ms.status = 'PAID' THEN cl.amount - cl."withholdingAmount" ELSE 0 END),
            0
          )::text AS "paid",
          COALESCE(
            SUM(CASE WHEN ms.status != 'PAID' THEN cl.amount - cl."withholdingAmount" ELSE 0 END),
            0
          )::text AS "pending"
        FROM "CommissionLedger" cl
        LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."isSettled" = true
          AND cl."createdAt" >= ${periodStart}
        GROUP BY TO_CHAR(ms."paymentDate", 'YYYY-MM-DD')
        ORDER BY ms."paymentDate" DESC
        LIMIT 90
      `
    );

    // 2. Payment by Day of Week
    const byDayOfWeekQuery = prisma.$queryRaw<
      Array<{
        dayOfWeek: string;
        total: string;
      }>
    >(
      Prisma.sql`
        SELECT
          TO_CHAR(ms."paymentDate", 'Day') AS "dayOfWeek",
          COALESCE(SUM(cl.amount - cl."withholdingAmount"), 0)::text AS "total"
        FROM "CommissionLedger" cl
        LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."isSettled" = true
          AND cl."createdAt" >= ${periodStart}
          AND ms."paymentDate" IS NOT NULL
        GROUP BY TO_CHAR(ms."paymentDate", 'Day')
      `
    );

    // 3. Risk Analysis (선택적)
    let riskAnalysisQuery = null;
    if (includeRisk) {
      riskAnalysisQuery = prisma.$queryRaw<
        Array<{
          riskLevel: string;
          count: number;
          totalPayout: string;
        }>
      >(
        Prisma.sql`
          SELECT
            CASE
              WHEN p."riskScore" >= 70 THEN 'HIGH'
              WHEN p."riskScore" >= 40 THEN 'MEDIUM'
              ELSE 'LOW'
            END AS "riskLevel",
            COUNT(DISTINCT ms.id)::integer AS "count",
            COALESCE(SUM(cl.amount - cl."withholdingAmount"), 0)::text AS "totalPayout"
          FROM "CommissionLedger" cl
          LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
          LEFT JOIN "Partner" p ON cl."profileId" = p.id
          WHERE cl."isSettled" = true
            AND cl."createdAt" >= ${periodStart}
          GROUP BY "riskLevel"
        `
      );
    }

    // 4. Performance Trend
    const performanceTrendQuery = prisma.$queryRaw<
      Array<{
        avgProcessingDays: string;
        onTimeRate: string;
        errorCount: number;
      }>
    >(
      Prisma.sql`
        SELECT
          COALESCE(
            AVG(EXTRACT(DAY FROM ms."paymentDate" - ms."approvedAt")),
            0
          )::text AS "avgProcessingDays",
          COALESCE(
            ROUND(
              100 * COUNT(
                CASE
                  WHEN EXTRACT(DAY FROM ms."paymentDate" - ms."approvedAt") <= 6
                  THEN 1
                END
              ) / NULLIF(COUNT(DISTINCT ms.id), 0),
              1
            ),
            0
          )::text || '%' AS "onTimeRate",
          COUNT(CASE WHEN ms.status = 'FAILED' THEN 1 END)::integer AS "errorCount"
        FROM "CommissionLedger" cl
        LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."isSettled" = true
          AND cl."createdAt" >= ${periodStart}
      `
    );

    // 5. Partner Distribution (선택적)
    let partnerDistributionQuery = null;
    if (includePartners) {
      partnerDistributionQuery = prisma.$queryRaw<
        Array<{
          tier: string;
          count: number;
          totalPayout: string;
        }>
      >(
        Prisma.sql`
          SELECT
            COALESCE(p.tier, 'Bronze') AS "tier",
            COUNT(DISTINCT cl."profileId")::integer AS "count",
            COALESCE(SUM(cl.amount - cl."withholdingAmount"), 0)::text AS "totalPayout"
          FROM "CommissionLedger" cl
          LEFT JOIN "Partner" p ON cl."profileId" = p.id
          WHERE cl."isSettled" = true
            AND cl."createdAt" >= ${periodStart}
          GROUP BY "tier"
        `
      );
    }

    // 6. Top Partners (선택적)
    let topPartnersQuery = null;
    if (includePartners) {
      topPartnersQuery = prisma.$queryRaw<
        Array<{
          profileId: number;
          name: string;
          totalPayout: string;
          count: number;
        }>
      >(
        Prisma.sql`
          SELECT
            cl."profileId"::integer,
            COALESCE(p.name, 'Unknown') AS "name",
            COALESCE(SUM(cl.amount - cl."withholdingAmount"), 0)::text AS "totalPayout",
            COUNT(DISTINCT ms.id)::integer AS "count"
          FROM "CommissionLedger" cl
          LEFT JOIN "Partner" p ON cl."profileId" = p.id
          LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
          WHERE cl."isSettled" = true
            AND cl."createdAt" >= ${periodStart}
          GROUP BY cl."profileId", p.name
          ORDER BY COALESCE(SUM(cl.amount - cl."withholdingAmount"), 0) DESC
          LIMIT 10
        `
      );
    }

    // 병렬 실행
    const queries: Promise<any>[] = [
      paymentDistributionQuery,
      byDayOfWeekQuery,
      performanceTrendQuery,
    ];

    if (includeRisk) queries.push(riskAnalysisQuery!);
    if (includePartners) {
      queries.push(partnerDistributionQuery!);
      queries.push(topPartnersQuery!);
    }

    const results = await Promise.all(queries);
    const elapsed = Date.now() - startTime;

    // Response 조립
    const paymentDistribution = results[0];
    const byDayOfWeek = results[1];
    const performanceTrend = results[2];
    let riskAnalysis = null;
    let partnersByTier = null;
    let topPartners = null;

    let queryIndex = 3;

    if (includeRisk) {
      const riskData = results[queryIndex++];
      riskAnalysis = riskData.reduce(
        (acc, row) => {
          const level = row.riskLevel.toLowerCase();
          acc[`${level}Risk`] = {
            count: row.count,
            totalPayout: row.totalPayout,
            reasons: level === "high" ? ["late_payment", "low_activity"] : [],
          };
          return acc;
        },
        {} as any
      );
    }

    if (includePartners) {
      const tierData = results[queryIndex++];
      partnersByTier = tierData.reduce(
        (acc, row) => {
          acc[row.tier] = {
            count: row.count,
            totalPayout: row.totalPayout,
          };
          return acc;
        },
        {} as Record<string, { count: number; totalPayout: string }>
      );

      topPartners = results[queryIndex++];
    }

    const trend = performanceTrend[0];

    const responseData: AnalyticsResponse["data"] = {
      paymentDistribution: {
        timeSeries: paymentDistribution,
        byDayOfWeek: byDayOfWeek.reduce(
          (acc, row) => {
            acc[row.dayOfWeek] = row.total;
            return acc;
          },
          {} as Record<string, string>
        ),
      },
      performanceTrend: {
        avgProcessingTime: trend?.avgProcessingDays || "0",
        paymentOnTimeRate: trend?.onTimeRate || "0%",
        errorRate: trend?.errorCount
          ? `${((trend.errorCount / 100) * 100).toFixed(1)}%`
          : "0%",
      },
    };

    if (riskAnalysis) {
      responseData.riskAnalysis = riskAnalysis;
    }

    if (includePartners && partnersByTier && topPartners) {
      responseData.partnerDistribution = {
        byTier: partnersByTier,
        topPartners: topPartners,
      };
    }

    return NextResponse.json<AnalyticsResponse>(
      {
        ok: true,
        data: responseData,
        performance: {
          elapsedMs: elapsed,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=900", // 15분 캐싱
        },
      }
    );
  } catch (err) {
    logger.error("[GET /api/settlements/analytics-advanced]", { err });
    const elapsed = Date.now() - startTime;

    return NextResponse.json<AnalyticsResponse>(
      {
        ok: false,
        error: "ANALYTICS_QUERY_FAILED",
        performance: { elapsedMs: elapsed },
      },
      { status: 500 }
    );
  }
}
