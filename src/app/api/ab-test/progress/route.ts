/**
 * GET /api/ab-test/progress
 * A/B 테스트 진행률 및 통계
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface ABTestWeeklyProgress {
  week: number;
  aGroup: {
    totalCalls: number;
    conversions: number;
    conversionRate: number;
    averageConversionDay: number;
  };
  bGroup: {
    totalCalls: number;
    conversions: number;
    conversionRate: number;
    averageConversionDay: number;
  };
  pooledConversionRate: number;
  difference: number;
  pValue?: number;
  significantDifference: boolean;
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = ctx.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get("week");

    // DB groupBy로 집계 — findMany 전체 행 메모리 로드 제거
    const [countRows, conversionRows] = await Promise.all([
      prisma.callLog.groupBy({
        by: ['abTestWeek', 'abTestGroup'],
        where: { abTestGroup: { not: null }, contact: { organizationId } },
        _count: { _all: true },
      }),
      prisma.callLog.groupBy({
        by: ['abTestWeek', 'abTestGroup'],
        where: {
          abTestGroup: { not: null },
          conversionDay: { not: null },
          contact: { organizationId },
        },
        _count: { _all: true },
        _avg: { conversionDay: true },
      }),
    ]);

    // 집계된 소수 행만 JS에서 처리
    const weeklyData = new Map<
      number,
      {
        aGroup: { calls: number; conversions: number; avgConversionDay: number };
        bGroup: { calls: number; conversions: number; avgConversionDay: number };
      }
    >();

    for (const row of countRows) {
      const week = row.abTestWeek ?? 1;
      if (!weeklyData.has(week)) {
        weeklyData.set(week, {
          aGroup: { calls: 0, conversions: 0, avgConversionDay: 0 },
          bGroup: { calls: 0, conversions: 0, avgConversionDay: 0 },
        });
      }
      const side = row.abTestGroup === 'A' ? 'aGroup' : 'bGroup';
      weeklyData.get(week)![side].calls = row._count._all;
    }

    for (const row of conversionRows) {
      const week = row.abTestWeek ?? 1;
      const side = row.abTestGroup === 'A' ? 'aGroup' : 'bGroup';
      const entry = weeklyData.get(week);
      if (entry) {
        entry[side].conversions = row._count._all;
        entry[side].avgConversionDay = row._avg.conversionDay ?? 0;
      }
    }

    // 응답 데이터 구성
    const progress: ABTestWeeklyProgress[] = Array.from(weeklyData.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, data]) => {
        const aConversionRate = data.aGroup.calls > 0
          ? (data.aGroup.conversions / data.aGroup.calls) * 100
          : 0;
        const bConversionRate = data.bGroup.calls > 0
          ? (data.bGroup.conversions / data.bGroup.calls) * 100
          : 0;

        const aAvgConversionDay = data.aGroup.avgConversionDay;
        const bAvgConversionDay = data.bGroup.avgConversionDay;

        const pooledConversionRate = ((
          (data.aGroup.conversions + data.bGroup.conversions) /
          (data.aGroup.calls + data.bGroup.calls)
        ) * 100) || 0;

        const difference = bConversionRate - aConversionRate;

        // 간단한 유의성 검사 (실제로는 통계학적으로 더 정밀해야 함)
        const minCalls = 50; // 최소 샘플 크기
        const significantDifference =
          data.aGroup.calls >= minCalls &&
          data.bGroup.calls >= minCalls &&
          Math.abs(difference) >= 5; // 5% 이상 차이

        return {
          week,
          aGroup: {
            totalCalls: data.aGroup.calls,
            conversions: data.aGroup.conversions,
            conversionRate: Number(aConversionRate.toFixed(2)),
            averageConversionDay: Number(aAvgConversionDay.toFixed(1)),
          },
          bGroup: {
            totalCalls: data.bGroup.calls,
            conversions: data.bGroup.conversions,
            conversionRate: Number(bConversionRate.toFixed(2)),
            averageConversionDay: Number(bAvgConversionDay.toFixed(1)),
          },
          pooledConversionRate: Number(pooledConversionRate.toFixed(2)),
          difference: Number(difference.toFixed(2)),
          significantDifference,
        };
      });

    // 필터링 (week 파라미터가 있으면)
    let filteredProgress = progress;
    if (weekParam) {
      const week = parseInt(weekParam, 10);
      filteredProgress = progress.filter((p) => p.week === week);
    }

    // 전체 통계
    const totalCalls = filteredProgress.reduce(
      (sum, p) => sum + p.aGroup.totalCalls + p.bGroup.totalCalls,
      0
    );
    const totalConversions = filteredProgress.reduce(
      (sum, p) => sum + p.aGroup.conversions + p.bGroup.conversions,
      0
    );
    const overallConversionRate = totalCalls > 0
      ? (totalConversions / totalCalls) * 100
      : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalCalls,
        totalConversions,
        overallConversionRate: Number(overallConversionRate.toFixed(2)),
        weeksComplete: filteredProgress.length,
      },
      weeklyProgress: filteredProgress,
    });
  } catch (error) {
    logger.error("[GET /api/ab-test/progress]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}
