/**
 * GET /api/sms-ab-tests/{id}
 * Get single test details with all metrics and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { analyzeABTest } from '@/lib/analytics/sms-ab-test-statistics';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await getAuthContext();
    let orgId: string;

    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ error: 'No organization' }, { status: 400 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const testId = params.id;
    if (!testId) {
      return NextResponse.json({ error: 'Test ID required' }, { status: 400 });
    }

    // Fetch test
    const test = await prisma.smsABTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        objectiveType: true,
        psychologyLens: true,
        copyAngle: true,
        variantATemplate: true,
        variantBTemplate: true,
        segmentCode: true,
        status: true,
        startedAt: true,
        endedAt: true,
        testDays: true,
        minSampleSize: true,
        pValueThreshold: true,
        confidenceLevel: true,
        declaredWinner: true,
        declaredAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        results: {
          select: {
            id: true,
            abTestGroup: true,
            totalSent: true,
            totalOpened: true,
            totalClicked: true,
            totalConverted: true,
            totalResponded: true,
            openRate: true,
            clickRate: true,
            conversionRate: true,
            responseRate: true,
            avgResponseTime: true,
            chiSquare: true,
            zScore: true,
            pValue: true,
            ciLower: true,
            ciUpper: true,
            relativeRisk: true,
            isStatSig: true,
            lastUpdated: true,
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Verify organization access
    if (test.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Calculate fresh statistics from results
    const groupA = test.results.find((r) => r.abTestGroup === 'A');
    const groupB = test.results.find((r) => r.abTestGroup === 'B');

    const stats = analyzeABTest(
      groupA?.totalConverted ?? 0,
      groupA?.totalSent ?? 0,
      groupB?.totalConverted ?? 0,
      groupB?.totalSent ?? 0
    );

    const response = {
      id: test.id,
      name: test.name,
      objectiveType: test.objectiveType,
      psychologyLens: test.psychologyLens,
      copyAngle: test.copyAngle,
      variantATemplate: test.variantATemplate,
      variantBTemplate: test.variantBTemplate,
      segmentCode: test.segmentCode,
      status: test.status,
      startedAt: test.startedAt.toISOString(),
      endedAt: test.endedAt?.toISOString(),
      testDays: test.testDays,
      minSampleSize: test.minSampleSize,
      pValueThreshold: test.pValueThreshold,
      confidenceLevel: test.confidenceLevel,
      declaredWinner: test.declaredWinner,
      declaredAt: test.declaredAt?.toISOString(),
      notes: test.notes,
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
      currentMetrics: {
        groupA: {
          sent: groupA?.totalSent ?? 0,
          opened: groupA?.totalOpened ?? 0,
          clicked: groupA?.totalClicked ?? 0,
          converted: groupA?.totalConverted ?? 0,
          responded: groupA?.totalResponded ?? 0,
          openRate: groupA?.openRate ?? 0,
          clickRate: groupA?.clickRate ?? 0,
          conversionRate: groupA?.conversionRate ?? 0,
          responseRate: groupA?.responseRate ?? 0,
          avgResponseTime: groupA?.avgResponseTime,
        },
        groupB: {
          sent: groupB?.totalSent ?? 0,
          opened: groupB?.totalOpened ?? 0,
          clicked: groupB?.totalClicked ?? 0,
          converted: groupB?.totalConverted ?? 0,
          responded: groupB?.totalResponded ?? 0,
          openRate: groupB?.openRate ?? 0,
          clickRate: groupB?.clickRate ?? 0,
          conversionRate: groupB?.conversionRate ?? 0,
          responseRate: groupB?.responseRate ?? 0,
          avgResponseTime: groupB?.avgResponseTime,
        },
      },
      statistics: {
        pValue: stats.pValue,
        zScore: stats.zScore,
        chiSquare: stats.chiSquare,
        relativeRisk: stats.relativeRisk,
        oddsRatio: stats.oddsRatio,
        isStatisticallySignificant: stats.isStatisticallySignificant,
        confidenceIntervals: {
          A: { lower: stats.ciA_lower, upper: stats.ciA_upper },
          B: { lower: stats.ciB_lower, upper: stats.ciB_upper },
          difference: { lower: stats.ciDifference_lower, upper: stats.ciDifference_upper },
        },
      },
      recommendation: stats.recommendation,
    };

    logger.log('[ABTest] Detail retrieved', { orgId, testId });

    return NextResponse.json({ data: response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[ABTest] Detail failed', { err });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
