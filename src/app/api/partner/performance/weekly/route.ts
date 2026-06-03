/**
 * Menu #57: GET /api/partner/performance/weekly
 * 파트너 주간 성과 리포팅 (KPI 대시보드)
 *
 * Query Parameters:
 * ?partnerId=partner_123&weekStart=2026-05-25 (또는 lastWeek)
 *
 * Response:
 * {
 *   "success": true,
 *   "partnerId": "partner_123",
 *   "weekStartDate": "2026-05-25",
 *   "weekEndDate": "2026-05-31",
 *   "kpis": {
 *     "totalCalls": 75,
 *     "appointmentsMade": 11,
 *     "salesClosed": 2,
 *     "revenue": 1200000,
 *     "callToAppointmentRate": 14.7,
 *     "appointmentToSaleRate": 18.2,
 *     "overallConversionRate": 2.7,
 *     "riskScore": 15
 *   },
 *   "trend": {
 *     "prevWeekCalls": 65,
 *     "callGrowth": "+15.4%",
 *     "prevWeekRevenue": 1000000,
 *     "revenueGrowth": "+20%"
 *   },
 *   "status": "On Track" | "Warning" | "Critical"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface WeeklyPerformanceQuery {
  partnerId: string;
  weekStart?: string; // YYYY-MM-DD format
  lastWeek?: string; // "true" for last week
}

function getWeekDateRange(
  startDate?: string
): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);

  if (startDate) {
    const parsedDate = new Date(startDate);
    start.setFullYear(parsedDate.getFullYear());
    start.setMonth(parsedDate.getMonth());
    start.setDate(parsedDate.getDate());
  }

  // 주의 시작일 (월요일)로 설정
  const dayOfWeek = start.getDay();
  const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    resolveOrgId(ctx);

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const weekStart = searchParams.get("weekStart");
    const lastWeek = searchParams.get("lastWeek") === "true";

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId는 필수입니다" },
        { status: 400 }
      );
    }

    // 날짜 범위 결정
    let dateRange = getWeekDateRange();
    if (weekStart) {
      dateRange = getWeekDateRange(weekStart);
    } else if (lastWeek) {
      const now = new Date();
      now.setDate(now.getDate() - 7);
      dateRange = getWeekDateRange(now.toISOString().split("T")[0]);
    }

    // 파트너 존재 여부 확인
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      return NextResponse.json(
        { error: "파트너를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 이번주 성과 조회
    const currentPerformance = await prisma.partnerPerformance.findFirst({
      where: {
        partnerId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 지난주 성과 조회
    const prevDateRange = getWeekDateRange(
      new Date(dateRange.start.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    );

    const prevPerformance = await prisma.partnerPerformance.findFirst({
      where: {
        partnerId,
        createdAt: {
          gte: prevDateRange.start,
          lte: prevDateRange.end,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 기본값 설정
    const totalCalls = currentPerformance?.totalCalls ?? 0;
    const appointmentsMade = currentPerformance?.appointmentsMade ?? 0;
    const salesClosed = currentPerformance?.salesClosed ?? 0;
    const revenue = currentPerformance?.revenue ?? BigInt(0);
    const riskScore = currentPerformance?.riskScore ?? 0;

    // 전환율 계산
    const callToAppointmentRate =
      totalCalls > 0
        ? Number(((appointmentsMade / totalCalls) * 100).toFixed(1))
        : 0;
    const appointmentToSaleRate =
      appointmentsMade > 0
        ? Number(((salesClosed / appointmentsMade) * 100).toFixed(1))
        : 0;
    const overallConversionRate =
      totalCalls > 0 ? Number(((salesClosed / totalCalls) * 100).toFixed(1)) : 0;

    // 추세 계산
    const prevTotalCalls = prevPerformance?.totalCalls ?? 0;
    const prevRevenue = prevPerformance?.revenue ?? BigInt(0);

    const callGrowth =
      prevTotalCalls > 0
        ? Number(
            (((totalCalls - prevTotalCalls) / prevTotalCalls) * 100).toFixed(1)
          )
        : 0;
    const revenueGrowth =
      Number(prevRevenue) > 0
        ? Number(
            (((Number(revenue) - Number(prevRevenue)) / Number(prevRevenue)) *
              100
            ).toFixed(1)
          )
        : 0;

    // 상태 판정
    let status = "On Track";
    if (riskScore >= 75) {
      status = "Critical";
    } else if (riskScore >= 50) {
      status = "Warning";
    }

    return NextResponse.json({
      success: true,
      partnerId,
      partner: {
        name: partner.name,
        incomeLevel: partner.incomeLevel,
        automationRate: partner.automationRate,
      },
      weekStartDate: dateRange.start.toISOString().split("T")[0],
      weekEndDate: dateRange.end.toISOString().split("T")[0],
      kpis: {
        totalCalls,
        appointmentsMade,
        salesClosed,
        revenue: Number(revenue),
        callToAppointmentRate,
        appointmentToSaleRate,
        overallConversionRate,
        riskScore,
        automationScore: currentPerformance?.automationScore ?? 0,
      },
      targets: {
        totalCallsTarget: 75,
        appointmentsMadeTarget: 10,
        salesClosedTarget: 2,
        revenueTarget: 1000000,
        callToAppointmentRateTarget: 13.3,
        appointmentToSaleRateTarget: 20,
        overallConversionRateTarget: 2.7,
      },
      trend: {
        prevWeekCalls: prevTotalCalls,
        callGrowth: `${callGrowth > 0 ? "+" : ""}${callGrowth}%`,
        prevWeekRevenue: Number(prevRevenue),
        revenueGrowth: `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth}%`,
        dayOverDay: totalCalls > 0 ? (totalCalls / 7).toFixed(1) : 0,
      },
      status,
      assessment:
        status === "On Track"
          ? "좋은 진행입니다. 현재 추세 유지하세요!"
          : status === "Warning"
            ? "주의가 필요합니다. 성과가 목표에 못 미치고 있습니다."
            : "긴급 개입이 필요합니다. 담당자와 상담하세요.",
      nextAction:
        status === "On Track"
          ? "다음주 목표: 콜 75회, 약속 10명, 성약 2명"
          : status === "Warning"
            ? "담당자 피드백 받기: 콜 스크립트 개선"
            : "즉시 담당자와 면담 - 기술 부족 진단",
    });
  } catch (error) {
    logger.error('[GET /api/partner/performance/weekly]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "주간 성과 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

