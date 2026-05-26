/**
 * A/B Test Automation Service
 * Auto-Winner Detection & Statistical Decision Making
 * Author: CRM Analytics Team
 * Date: 2026-05-27
 */

import { analyzeABTest } from "@/lib/analytics/sms-ab-test-statistics";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Winner detection result
 */
export interface WinnerDetectionResult {
  hasWinner: boolean;
  winner?: "A" | "B";
  confidence: number; // 0-1
  pValue: number;
  sampleSizeA: number;
  sampleSizeB: number;
  conversionRateA: number;
  conversionRateB: number;
  improvementPercent?: number;
  recommendation: string;
  metadata?: {
    isSignificant: boolean;
    minSamplesMet: boolean;
    testDuration: number;
  };
}

/**
 * Detect if A/B test has a clear winner
 *
 * Criteria for declaring winner:
 * 1. p-value < 0.05 (95% confidence)
 * 2. Sample size >= 30 per group (minimum statistical validity)
 * 3. Test running >= 7 days
 */
export async function detectWinner(testId: string): Promise<WinnerDetectionResult> {
  try {
    // Fetch test metadata
    const test = await prisma.smsABTest.findUnique({
      where: { id: testId },
      include: {
        results: true,
        timelines: {
          orderBy: { snapshotDate: "desc" },
          take: 1,
        },
      },
    });

    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    // Fetch latest snapshot data (from SmsLog)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - test.testDays);

    const logs = await prisma.smsLog.findMany({
      where: {
        abTestId: test.id,
        sentAt: { gte: cutoffDate },
      },
      select: {
        abTestGroup: true,
        convertedAt: true,
      },
    });

    if (logs.length === 0) {
      return {
        hasWinner: false,
        confidence: 0,
        pValue: 1.0,
        sampleSizeA: 0,
        sampleSizeB: 0,
        conversionRateA: 0,
        conversionRateB: 0,
        recommendation: "No data yet. Continue testing.",
        metadata: {
          isSignificant: false,
          minSamplesMet: false,
          testDuration: 0,
        },
      };
    }

    // Split logs by group
    const groupA = logs.filter((l) => l.abTestGroup === "A");
    const groupB = logs.filter((l) => l.abTestGroup === "B");

    const sampleSizeA = groupA.length;
    const sampleSizeB = groupB.length;
    const conversionsA = groupA.filter((l) => l.convertedAt).length;
    const conversionsB = groupB.filter((l) => l.convertedAt).length;

    const conversionRateA = sampleSizeA > 0 ? conversionsA / sampleSizeA : 0;
    const conversionRateB = sampleSizeB > 0 ? conversionsB / sampleSizeB : 0;

    // Run statistical analysis
    const analysis = analyzeABTest(conversionsA, sampleSizeA, conversionsB, sampleSizeB, test.testDays);

    // Calculate test duration
    const now = new Date();
    const testDuration = Math.floor((now.getTime() - test.startedAt.getTime()) / (1000 * 60 * 60 * 24));

    // Check minimum criteria
    const hasMinimumSamples = sampleSizeA >= 30 && sampleSizeB >= 30;
    const hasMinimumDuration = testDuration >= 7;
    const isStatisticallySignificant = analysis.pValue < test.pValueThreshold;

    // Determine winner
    let winner: "A" | "B" | undefined;
    let hasWinner = false;
    let improvement = 0;

    if (hasMinimumSamples && hasMinimumDuration && isStatisticallySignificant) {
      hasWinner = true;
      if (conversionRateB > conversionRateA) {
        winner = "B";
        improvement = ((conversionRateB - conversionRateA) / conversionRateA) * 100;
      } else {
        winner = "A";
        improvement = ((conversionRateA - conversionRateB) / conversionRateB) * 100;
      }
    }

    // Generate recommendation
    let recommendationText = "";
    if (hasWinner) {
      recommendationText = `✅ Winner Detected: ${winner} is ${improvement.toFixed(1)}% better (p=${analysis.pValue.toFixed(4)}). Deploy ${winner} immediately.`;
    } else if (isStatisticallySignificant && !hasMinimumSamples) {
      recommendationText = `⚠️ Significant but low sample size. A: ${sampleSizeA}, B: ${sampleSizeB}. Continue testing to confirm.`;
    } else if (isStatisticallySignificant && !hasMinimumDuration) {
      recommendationText = `⚠️ Significant but short duration (${testDuration} days). Continue testing for ${7 - testDuration} more days.`;
    } else if (hasMinimumSamples && hasMinimumDuration) {
      const rateA = (conversionRateA * 100).toFixed(2);
      const rateB = (conversionRateB * 100).toFixed(2);
      if (Math.abs(conversionRateB - conversionRateA) < 0.02) {
        recommendationText = `No significant difference (A: ${rateA}%, B: ${rateB}%, p=${analysis.pValue.toFixed(3)}). Either variant acceptable.`;
      } else if (conversionRateB > conversionRateA) {
        recommendationText = `B shows promise (${rateB}% vs ${rateA}%, p=${analysis.pValue.toFixed(3)}). Continue testing.`;
      } else {
        recommendationText = `A shows promise (${rateA}% vs ${rateB}%, p=${analysis.pValue.toFixed(3)}). Continue testing.`;
      }
    } else {
      recommendationText = `Continue testing. Samples: A=${sampleSizeA}, B=${sampleSizeB}. Duration: ${testDuration}/${7} days.`;
    }

    return {
      hasWinner,
      winner,
      confidence: analysis.pValue < 0.001 ? 0.999 : 1 - analysis.pValue,
      pValue: analysis.pValue,
      sampleSizeA,
      sampleSizeB,
      conversionRateA,
      conversionRateB,
      improvementPercent: improvement || undefined,
      recommendation: recommendationText,
      metadata: {
        isSignificant: isStatisticallySignificant,
        minSamplesMet: hasMinimumSamples,
        testDuration,
      },
    };
  } catch (error) {
    logger.error("[detectWinner]", { testId, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Update SmsABTestResult with latest calculations
 */
export async function updateTestResults(testId: string): Promise<void> {
  try {
    const test = await prisma.smsABTest.findUnique({
      where: { id: testId },
    });

    if (!test) return;

    // Fetch latest data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - test.testDays);

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

    // Split by group
    const groupA = logs.filter((l) => l.abTestGroup === "A");
    const groupB = logs.filter((l) => l.abTestGroup === "B");

    // Calculate metrics
    const metricsA = {
      sent: groupA.length,
      opened: groupA.filter((l) => l.openedAt).length,
      clicked: groupA.filter((l) => l.clickedAt).length,
      converted: groupA.filter((l) => l.convertedAt).length,
    };

    const metricsB = {
      sent: groupB.length,
      opened: groupB.filter((l) => l.openedAt).length,
      clicked: groupB.filter((l) => l.clickedAt).length,
      converted: groupB.filter((l) => l.convertedAt).length,
    };

    // Run analysis
    const analysis = analyzeABTest(
      metricsA.converted,
      metricsA.sent,
      metricsB.converted,
      metricsB.sent,
      test.testDays
    );

    // Update results
    await Promise.all([
      prisma.smsABTestResult.upsert({
        where: { abTestId_abTestGroup: { abTestId: test.id, abTestGroup: "A" } },
        update: {
          totalSent: metricsA.sent,
          totalOpened: metricsA.opened,
          totalClicked: metricsA.clicked,
          totalConverted: metricsA.converted,
          openRate: metricsA.sent > 0 ? metricsA.opened / metricsA.sent : 0,
          clickRate: metricsA.sent > 0 ? metricsA.clicked / metricsA.sent : 0,
          conversionRate: metricsA.sent > 0 ? metricsA.converted / metricsA.sent : 0,
        },
        create: {
          abTestId: test.id,
          organizationId: test.organizationId,
          abTestGroup: "A",
          totalSent: metricsA.sent,
          totalOpened: metricsA.opened,
          totalClicked: metricsA.clicked,
          totalConverted: metricsA.converted,
          openRate: metricsA.sent > 0 ? metricsA.opened / metricsA.sent : 0,
          clickRate: metricsA.sent > 0 ? metricsA.clicked / metricsA.sent : 0,
          conversionRate: metricsA.sent > 0 ? metricsA.converted / metricsA.sent : 0,
          chiSquare: analysis.chiSquare,
          zScore: analysis.zScore,
          pValue: analysis.pValue,
        },
      }),
      prisma.smsABTestResult.upsert({
        where: { abTestId_abTestGroup: { abTestId: test.id, abTestGroup: "B" } },
        update: {
          totalSent: metricsB.sent,
          totalOpened: metricsB.opened,
          totalClicked: metricsB.clicked,
          totalConverted: metricsB.converted,
          openRate: metricsB.sent > 0 ? metricsB.opened / metricsB.sent : 0,
          clickRate: metricsB.sent > 0 ? metricsB.clicked / metricsB.sent : 0,
          conversionRate: metricsB.sent > 0 ? metricsB.converted / metricsB.sent : 0,
        },
        create: {
          abTestId: test.id,
          organizationId: test.organizationId,
          abTestGroup: "B",
          totalSent: metricsB.sent,
          totalOpened: metricsB.opened,
          totalClicked: metricsB.clicked,
          totalConverted: metricsB.converted,
          openRate: metricsB.sent > 0 ? metricsB.opened / metricsB.sent : 0,
          clickRate: metricsB.sent > 0 ? metricsB.clicked / metricsB.sent : 0,
          conversionRate: metricsB.sent > 0 ? metricsB.converted / metricsB.sent : 0,
          chiSquare: analysis.chiSquare,
          zScore: analysis.zScore,
          pValue: analysis.pValue,
        },
      }),
    ]);

    logger.info("[updateTestResults]", { testId, metricsA, metricsB, pValue: analysis.pValue });
  } catch (error) {
    logger.error("[updateTestResults]", { testId, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
