/**
 * GET /api/sms-ab-tests/[id]
 * 단일 A/B 테스트 상세 정보 + 통계
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { chiSquareTest, computeRecommendation } from '@/lib/stats/chi-square';
import type { ABTestDetailResponse, SmsABTestDTO, MetricsSnapshot } from '@/lib/types/ab-test';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createMetricsSnapshot(sent: number, opened: number, clicked: number, converted: number): MetricsSnapshot {
  return {
    sent,
    opened,
    clicked,
    converted,
    responded: 0,
    openRate: sent > 0 ? opened / sent : 0,
    clickRate: sent > 0 ? clicked / sent : 0,
    conversionRate: sent > 0 ? converted / sent : 0,
    responseRate: 0,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const test = await prisma.smsABTest.findUnique({
      where: { id },
    });

    if (!test || test.organizationId !== session.organizationId) {
      return NextResponse.json({ ok: false, error: 'Not Found' }, { status: 404 });
    }

    // Group A 메트릭
    const groupASent = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'A',
      },
    })) || 0;

    const groupAOpened = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'A',
        openedAt: { not: null },
      },
    })) || 0;

    const groupAClicked = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'A',
        clickedAt: { not: null },
      },
    })) || 0;

    const groupAConverted = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'A',
        convertedAt: { not: null },
      },
    })) || 0;

    // Group B 메트릭
    const groupBSent = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'B',
      },
    })) || 0;

    const groupBOpened = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'B',
        openedAt: { not: null },
      },
    })) || 0;

    const groupBClicked = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'B',
        clickedAt: { not: null },
      },
    })) || 0;

    const groupBConverted = (await prisma.smsLog.count({
      where: {
        organizationId: session.organizationId,
        abTestId: id,
        abTestGroup: 'B',
        convertedAt: { not: null },
      },
    })) || 0;

    // 통계 계산
    const objectiveMetric = test.objectiveType || 'CONVERSION';
    const aSuccess =
      objectiveMetric === 'OPEN_RATE'
        ? groupAOpened
        : objectiveMetric === 'CLICK_RATE'
          ? groupAClicked
          : groupAConverted;
    const bSuccess =
      objectiveMetric === 'OPEN_RATE'
        ? groupBOpened
        : objectiveMetric === 'CLICK_RATE'
          ? groupBClicked
          : groupBConverted;

    const stats = chiSquareTest(
      { success: aSuccess, total: groupASent || 1 },
      { success: bSuccess, total: groupBSent || 1 },
      test.pValueThreshold
    );

    const { winner, recommendation } = computeRecommendation(
      stats,
      { success: aSuccess, total: groupASent || 1 },
      { success: bSuccess, total: groupBSent || 1 },
      test.minSampleSize
    );

    const result: SmsABTestDTO = {
      id: test.id,
      name: test.name || `Test ${test.id.slice(0, 8)}`,
      objectiveType: test.objectiveType || 'CONVERSION',
      psychologyLens: test.psychologyLens || undefined,
      copyAngle: test.copyAngle || undefined,
      variantATemplate: test.variantATemplate || '',
      variantBTemplate: test.variantBTemplate || '',
      status: (test.status || 'ACTIVE') as 'ACTIVE' | 'COMPLETED' | 'PAUSED',
      startedAt: test.startedAt.toISOString(),
      testDays: test.testDays || 7,
      minSampleSize: test.minSampleSize || 100,
      pValueThreshold: test.pValueThreshold || 0.05,
      confidenceLevel: test.confidenceLevel || 0.95,
      declaredWinner: winner,
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
      currentMetrics: {
        groupA: createMetricsSnapshot(groupASent, groupAOpened, groupAClicked, groupAConverted),
        groupB: createMetricsSnapshot(groupBSent, groupBOpened, groupBClicked, groupBConverted),
      },
      statistics: {
        pValue: stats.pValue,
        zScore: stats.zScore,
        chiSquare: stats.chiSquare,
        relativeRisk: stats.relativeRisk,
        oddsRatio: stats.relativeRisk,
        isStatisticallySignificant: stats.isSignificant,
        confidenceIntervals: {
          A: stats.ciA,
          B: stats.ciB,
          difference: stats.ciDifference,
        },
      },
      recommendation,
    };

    return NextResponse.json({ data: result } as ABTestDetailResponse);
  } catch (error) {
    logger.error('[sms-ab-tests/[id]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
