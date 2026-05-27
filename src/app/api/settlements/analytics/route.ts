import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

interface SettlementAnalytics {
  ok: boolean;
  period: { start: string; end: string };
  summary: {
    totalSettlements: number;
    totalPayout: number;
    avgPayout: number;
    statusDistribution: { [key: string]: number };
    monthlyTrend: Array<{ month: string; count: number; total: number }>;
  };
  recentEvents: Array<{
    id: number;
    eventType: string;
    description: string | null;
    createdAt: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const searchParams = request.nextUrl.searchParams;

    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const days = parseInt(searchParams.get("days") || "30");

    const from = startDate
      ? new Date(startDate)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const to = endDate ? new Date(endDate) : new Date();

    const cacheKey = `settlement:${orgId}:${from.toISOString()}:${to.toISOString()}`;

    // 쿼리 병렬 실행 (N+1 회피)
    const [settlements, events, monthlyData] = await Promise.all([
      prisma.monthlySettlement.findMany({
        where: {
          periodStart: { gte: from },
          periodEnd: { lte: to },
        },
        orderBy: { periodStart: "desc" },
        take: 100,
      }),
      prisma.settlementEvent.findMany({
        where: {
          createdAt: { gte: from, lte: to },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.$queryRaw<
        Array<{ month: string; count: number; total: string }>
      >`
        SELECT
          DATE_TRUNC('month', "periodStart")::date AS month,
          COUNT(*)::int AS count,
          COALESCE((summary->>'totalAmount'), '0') AS total
        FROM "MonthlySettlement"
        WHERE "periodStart" >= ${from}
          AND "periodEnd" <= ${to}
        GROUP BY DATE_TRUNC('month', "periodStart")
        ORDER BY month DESC
      `,
    ]);

    // 통계 계산
    const statusCounts = settlements.reduce(
      (acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      },
      {} as { [key: string]: number }
    );

    const totalAmount = settlements.reduce((sum, s) => {
      const amt = s.summary && typeof s.summary === "object"
        ? (s.summary as any).totalAmount || 0
        : 0;
      return sum + amt;
    }, 0);

    return NextResponse.json<SettlementAnalytics>({
      ok: true,
      period: {
        start: from.toISOString(),
        end: to.toISOString(),
      },
      summary: {
        totalSettlements: settlements.length,
        totalPayout: totalAmount,
        avgPayout: settlements.length > 0 ? totalAmount / settlements.length : 0,
        statusDistribution: statusCounts,
        monthlyTrend: monthlyData.map((m) => ({
          month: new Date(m.month).toISOString().split("T")[0],
          count: m.count,
          total: parseFloat(m.total as any) || 0,
        })),
      },
      recentEvents: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error("[Settlement Analytics]", { err });
    return NextResponse.json(
      { ok: false, message: "정산 분석 조회 실패" },
      { status: 500 }
    );
  }
}
