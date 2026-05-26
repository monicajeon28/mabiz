/**
 * SMS A/B Test Analytics API
 * GET /api/sms-ab-tests?orgId=xxx&testId=xxx&days=7
 * Returns comprehensive A/B test analysis with statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeABTest, calculateSnapshot } from "@/lib/analytics/sms-ab-test-statistics";

interface ABTestQuery {
  orgId: string;
  testId?: string;
  days?: number;
  limit?: number;
  offset?: number;
}

/**
 * Fetch and analyze A/B test data from SmsLog
 */
async function getABTestAnalysis(query: ABTestQuery) {
  const { orgId, testId, days = 7, limit = 50, offset = 0 } = query;

  if (!orgId) {
    throw new Error("orgId is required");
  }

  // Fetch tests
  let testFilter: any = {
    organizationId: orgId,
  };

  if (testId) {
    testFilter.id = testId;
  }

  const tests = await prisma.smsABTest.findMany({
    where: testFilter,
    include: {
      results: true,
      timelines: {
        orderBy: { snapshotDate: "desc" },
        take: days,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  if (!tests || tests.length === 0) {
    return {
      tests: [],
      count: 0,
    };
  }

  // If specific test, also fetch recent SMS logs for real-time calculation
  const enrichedTests = await Promise.all(
    tests.map(async (test) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Fetch raw SMS logs for this test
      const logs = await prisma.smsLog.findMany({
        where: {
          abTestId: test.id,
          sentAt: { gte: cutoffDate },
        },
        select: {
          abTestGroup: true,
          openedAt: true,
          clickedAt: true,
          convertedAt: true,
          responseAt: true,
        },
      });

      // Calculate current statistics from logs
      const groupA = logs.filter((l) => l.abTestGroup === "A");
      const groupB = logs.filter((l) => l.abTestGroup === "B");

      const groupA_converted = groupA.filter((l) => l.convertedAt).length;
      const groupB_converted = groupB.filter((l) => l.convertedAt).length;

      const currentAnalysis = analyzeABTest(
        groupA_converted,
        groupA.length,
        groupB_converted,
        groupB.length,
        days
      );

      return {
        ...test,
        currentMetrics: {
          groupA: {
            sent: groupA.length,
            opened: groupA.filter((l) => l.openedAt).length,
            clicked: groupA.filter((l) => l.clickedAt).length,
            converted: groupA_converted,
            responded: groupA.filter((l) => l.responseAt).length,
            openRate: groupA.length > 0 ? groupA.filter((l) => l.openedAt).length / groupA.length : 0,
            clickRate: groupA.length > 0 ? groupA.filter((l) => l.clickedAt).length / groupA.length : 0,
            conversionRate: currentAnalysis.rateA,
            responseRate: groupA.length > 0 ? groupA.filter((l) => l.responseAt).length / groupA.length : 0,
          },
          groupB: {
            sent: groupB.length,
            opened: groupB.filter((l) => l.openedAt).length,
            clicked: groupB.filter((l) => l.clickedAt).length,
            converted: groupB_converted,
            responded: groupB.filter((l) => l.responseAt).length,
            openRate: groupB.length > 0 ? groupB.filter((l) => l.openedAt).length / groupB.length : 0,
            clickRate: groupB.length > 0 ? groupB.filter((l) => l.clickedAt).length / groupB.length : 0,
            conversionRate: currentAnalysis.rateB,
            responseRate: groupB.length > 0 ? groupB.filter((l) => l.responseAt).length / groupB.length : 0,
          },
        },
        statistics: {
          pValue: currentAnalysis.pValue,
          zScore: currentAnalysis.zScore,
          chiSquare: currentAnalysis.chiSquare,
          relativeRisk: currentAnalysis.relativeRisk,
          oddsRatio: currentAnalysis.oddsRatio,
          isStatisticallySignificant: currentAnalysis.isStatisticallySignificant,
          confidenceIntervals: {
            A: { lower: currentAnalysis.ciA_lower, upper: currentAnalysis.ciA_upper },
            B: { lower: currentAnalysis.ciB_lower, upper: currentAnalysis.ciB_upper },
            difference: {
              lower: currentAnalysis.ciDifference_lower,
              upper: currentAnalysis.ciDifference_upper,
            },
          },
        },
        recommendation: currentAnalysis.recommendation,
      };
    })
  );

  return {
    tests: enrichedTests,
    count: enrichedTests.length,
  };
}

/**
 * GET /api/sms-ab-tests
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("orgId");
    const testId = searchParams.get("testId");
    const days = parseInt(searchParams.get("days") || "7");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing required parameter: orgId" },
        { status: 400 }
      );
    }

    const result = await getABTestAnalysis({
      orgId,
      testId: testId || undefined,
      days,
      limit,
      offset,
    });

    return NextResponse.json({
      ok: true,
      data: result.tests,
      count: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[SMS A/B Test API Error]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch A/B test data",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sms-ab-tests
 * Create new A/B test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orgId,
      name,
      objectiveType,
      psychologyLens,
      copyAngle,
      variantATemplate,
      variantBTemplate,
      segmentCode,
      testDays = 7,
      minSampleSize = 100,
      notes,
    } = body;

    if (!orgId || !name || !objectiveType || !variantATemplate || !variantBTemplate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const test = await prisma.smsABTest.create({
      data: {
        organizationId: orgId,
        name,
        objectiveType,
        psychologyLens,
        copyAngle,
        variantATemplate,
        variantBTemplate,
        segmentCode,
        testDays,
        minSampleSize,
        notes,
        status: "ACTIVE",
      },
    });

    // Initialize result records for both groups
    await Promise.all([
      prisma.smsABTestResult.create({
        data: {
          abTestId: test.id,
          organizationId: orgId,
          abTestGroup: "A",
        },
      }),
      prisma.smsABTestResult.create({
        data: {
          abTestId: test.id,
          organizationId: orgId,
          abTestGroup: "B",
        },
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        data: test,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SMS A/B Test Create Error]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create A/B test",
      },
      { status: 500 }
    );
  }
}
