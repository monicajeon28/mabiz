/**
 * GET /api/sms-ab-tests
 * A/B 테스트 목록 조회 + 실시간 metrics 계산
 *
 * POST /api/sms-ab-tests
 * 새로운 A/B 테스트 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { chiSquareTest, computeRecommendation } from '@/lib/stats/chi-square';
import type {
  ABTestListResponse,
  SmsABTestDTO,
  MetricsSnapshot,
  ABTestCreateRequest,
} from '@/lib/types/ab-test';

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

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const sinceDate = new Date(Date.now() - days * 86400000);

    // SmsABTest 목록 조회
    const tests = await prisma.smsABTest.findMany({
      where: {
        organizationId: session.organizationId,
        startedAt: { gte: sinceDate },
      },
      take: limit,
      orderBy: { startedAt: 'desc' },
    });

    // 각 테스트별 metrics 계산
    const results: SmsABTestDTO[] = [];

    for (const test of tests) {
      // Group A 메트릭
      const groupALogs = await prisma.smsLog.aggregate({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
          abTestGroup: 'A',
        },
        _count: { id: true },
        _sum: {
          openedAt: true,
          clickedAt: true,
          convertedAt: true,
        },
      });

      const groupASent = groupALogs._count.id;
      const groupAOpened = (await prisma.smsLog.count({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
          abTestGroup: 'A',
          openedAt: { not: null },
        },
      })) || 0;
      const groupAClicked = (await prisma.smsLog.count({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
          abTestGroup: 'A',
          clickedAt: { not: null },
        },
      })) || 0;
      const groupAConverted = (await prisma.smsLog.count({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
          abTestGroup: 'A',
          convertedAt: { not: null },
        },
      })) || 0;

      // Group B 메트릭
      const groupBSent = (await prisma.smsLog.count({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
          abTestGroup: 'B',
        },
      })) || 0;
      const groupBOpened = (await prisma.smsLog.count({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
          abTestGroup: 'B',
          openedAt: { not: null },
        },
      })) || 0;
      const groupBClicked = (await prisma.smsLog.count({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
          abTestGroup: 'B',
          clickedAt: { not: null },
        },
      })) || 0;
      const groupBConverted = (await prisma.smsLog.count({
        where: {
          organizationId: session.organizationId,
          abTestId: test.id,
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

      results.push({
        id: test.id,
        name: test.name || `Test ${test.id.slice(0, 8)}`,
        objectiveType: test.objectiveType || 'CONVERSION',
        psychologyLens: test.psychologyLens || undefined,
        copyAngle: test.copyAngle || undefined,
        variantATemplate: test.variantATemplate || '',
        variantBTemplate: test.variantBTemplate || '',
        status: test.status || 'ACTIVE',
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
      });
    }

    return NextResponse.json({
      data: results,
    } as ABTestListResponse);
  } catch (error) {
    logger.error('[sms-ab-tests] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body: ABTestCreateRequest = await req.json();

    const newTest = await prisma.smsABTest.create({
      data: {
        organizationId: session.organizationId,
        name: body.name,
        objectiveType: body.objectiveType || 'CONVERSION',
        variantATemplate: body.variantATemplate,
        variantBTemplate: body.variantBTemplate,
        psychologyLens: body.psychologyLens,
        copyAngle: body.copyAngle,
        segmentCode: body.segmentCode,
        testDays: body.testDays || 7,
        minSampleSize: body.minSampleSize || 100,
        pValueThreshold: body.pValueThreshold || 0.05,
        confidenceLevel: body.confidenceLevel || 0.95,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    logger.log('[sms-ab-tests] Test created', {
      testId: newTest.id,
      organizationId: session.organizationId,
      objectiveType: newTest.objectiveType,
    });

    return NextResponse.json({
      data: {
        id: newTest.id,
        name: newTest.name || '',
        status: 'ACTIVE',
        createdAt: newTest.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('[sms-ab-tests] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
