/**
 * GET /api/cron/ab-test-daily-aggregate
 * Vercel Cron Job: Daily A/B Test Aggregation & Analysis
 * Schedule: 0 1 * * * (1 AM UTC daily)
 *
 * Operations:
 * 1. Find all ACTIVE SmsABTest entries
 * 2. Calculate daily metrics from SmsLog
 * 3. Run statistical analysis (χ², z-score, p-value)
 * 4. Save snapshot to SmsABTestTimeline
 * 5. Update SmsABTestResult with latest calculations
 * 6. Check for test completion (14+ days + winner declared)
 * 7. Archive old timeline records
 * 8. Log execution metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeABTest } from "@/lib/analytics/sms-ab-test-statistics";
import { detectWinner, updateTestResults } from "@/lib/services/ab-test-automation";
import { checkTestExpiry, archiveOldTimelines, checkAllTestsExpiry } from "@/lib/services/ab-test-lifecycle";
import { logCronExecution } from "@/lib/services/ab-test-monitoring";
import { logger } from "@/lib/logger";

interface DailyAggregateResult {
  testId: string;
  success: boolean;
  dayNumber: number;
  groupA_sent: number;
  groupA_converted: number;
  groupB_sent: number;
  groupB_converted: number;
  pValue: number;
  isSignificant: boolean;
  hasWinner?: boolean;
  winner?: string;
  error?: string;
}

/**
 * Process single A/B test: calculate daily snapshot
 */
async function processABTest(test: any): Promise<DailyAggregateResult> {
  try {
    // Calculate test age
    const now = new Date();
    const testDuration = Math.floor((now.getTime() - test.startedAt.getTime()) / (1000 * 60 * 60 * 24));
    const dayNumber = testDuration + 1; // Day 1-based

    // Fetch SMS logs sent today (or from test start if < 1 day)
    let cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1); // Last 24 hours

    const logsToday = await prisma.smsLog.findMany({
      where: {
        abTestId: test.id,
        sentAt: {
          gte: cutoffDate,
          lt: now,
        },
      },
      select: {
        abTestGroup: true,
        convertedAt: true,
      },
    });

    // Also fetch cumulative logs from test start for statistics
    const logsCumulative = await prisma.smsLog.findMany({
      where: {
        abTestId: test.id,
        sentAt: { gte: test.startedAt },
      },
      select: {
        abTestGroup: true,
        openedAt: true,
        clickedAt: true,
        convertedAt: true,
      },
    });

    // Split by group
    const groupA = logsCumulative.filter((l) => l.abTestGroup === "A");
    const groupB = logsCumulative.filter((l) => l.abTestGroup === "B");

    const groupA_sent = groupA.length;
    const groupA_converted = groupA.filter((l) => l.convertedAt).length;
    const groupB_sent = groupB.length;
    const groupB_converted = groupB.filter((l) => l.convertedAt).length;

    // Run statistical analysis
    const analysis = analyzeABTest(groupA_converted, groupA_sent, groupB_converted, groupB_sent, dayNumber);

    // Save daily snapshot to timeline
    await prisma.smsABTestTimeline.upsert({
      where: {
        abTestId_snapshotDate: {
          abTestId: test.id,
          snapshotDate: new Date(new Date().toDateString()), // Normalize to date only
        },
      },
      create: {
        abTestId: test.id,
        organizationId: test.organizationId,
        snapshotDate: new Date(new Date().toDateString()),
        dayNumber,
        groupA_sent,
        groupA_opened: groupA.filter((l) => l.openedAt).length,
        groupA_clicked: groupA.filter((l) => l.clickedAt).length,
        groupA_converted,
        groupA_rate: groupA_sent > 0 ? groupA_converted / groupA_sent : 0,
        groupB_sent,
        groupB_opened: groupB.filter((l) => l.openedAt).length,
        groupB_clicked: groupB.filter((l) => l.clickedAt).length,
        groupB_converted,
        groupB_rate: groupB_sent > 0 ? groupB_converted / groupB_sent : 0,
        pValue: analysis.pValue,
        isSignificant: analysis.isStatisticallySignificant,
        recommendation: analysis.recommendation,
      },
      update: {
        groupA_sent,
        groupA_opened: groupA.filter((l) => l.openedAt).length,
        groupA_clicked: groupA.filter((l) => l.clickedAt).length,
        groupA_converted,
        groupA_rate: groupA_sent > 0 ? groupA_converted / groupA_sent : 0,
        groupB_sent,
        groupB_opened: groupB.filter((l) => l.openedAt).length,
        groupB_clicked: groupB.filter((l) => l.clickedAt).length,
        groupB_converted,
        groupB_rate: groupB_sent > 0 ? groupB_converted / groupB_sent : 0,
        pValue: analysis.pValue,
        isSignificant: analysis.isStatisticallySignificant,
        recommendation: analysis.recommendation,
      },
    });

    // Update SmsABTestResult
    await updateTestResults(test.id);

    // Check if test should be marked completed
    const completionResult = await checkTestExpiry(test.id);

    logger.info(`[ABTestDailyAggregate] Processed test ${test.id}`, {
      dayNumber,
      groupA_sent,
      groupA_converted,
      groupB_sent,
      groupB_converted,
      pValue: analysis.pValue,
      significant: analysis.isStatisticallySignificant,
      completed: completionResult.completed,
      winner: completionResult.winner,
    });

    // Archive old timeline records
    await archiveOldTimelines(test.id);

    return {
      testId: test.id,
      success: true,
      dayNumber,
      groupA_sent,
      groupA_converted,
      groupB_sent,
      groupB_converted,
      pValue: analysis.pValue,
      isSignificant: analysis.isStatisticallySignificant,
      hasWinner: completionResult.completed,
      winner: completionResult.winner,
    };
  } catch (error) {
    logger.error(`[ABTestDailyAggregate] Failed to process test ${test.id}`, {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      testId: test.id,
      success: false,
      dayNumber: 0,
      groupA_sent: 0,
      groupA_converted: 0,
      groupB_sent: 0,
      groupB_converted: 0,
      pValue: 1,
      isSignificant: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Main handler
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron authentication
    const authHeader = request.headers.get("Authorization");
    const expectedToken = process.env.CRON_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("[GET /api/cron/ab-test-daily-aggregate] Starting daily aggregation");

    // Fetch all ACTIVE A/B tests
    const activeTests = await prisma.smsABTest.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        organizationId: true,
        name: true,
        startedAt: true,
        testDays: true,
        pValueThreshold: true,
        minSampleSize: true,
      },
    });

    logger.info(`[ABTestDailyAggregate] Found ${activeTests.length} active tests`);

    // Process each test
    const results: DailyAggregateResult[] = [];
    let winnersDetected = 0;
    let completedCount = 0;

    for (const test of activeTests) {
      const result = await processABTest(test);
      results.push(result);

      if (result.success) {
        if (result.hasWinner) {
          winnersDetected++;
          completedCount++;
        }
      }
    }

    // Calculate execution time
    const executionTimeMs = Date.now() - startTime;

    // Count successes and failures
    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;
    const failedTestIds = results.filter((r) => !r.success).map((r) => r.testId);

    // Determine overall status
    const status = errorCount === 0 ? "SUCCESS" : errorCount < successCount ? "PARTIAL" : "FAILED";

    // Log execution
    const logEntry = logCronExecution({
      executionDate: new Date(),
      totalTests: activeTests.length,
      winnersDetected,
      completedTests: completedCount,
      errorCount,
      successCount,
      avgExecutionTimeMs: Math.round(executionTimeMs / activeTests.length),
      failedTestIds,
      status: status as "SUCCESS" | "PARTIAL" | "FAILED",
      notes: `Processed ${successCount}/${activeTests.length} tests. ${winnersDetected} winners detected.`,
    });

    logger.info("[GET /api/cron/ab-test-daily-aggregate] Completed", {
      totalTests: activeTests.length,
      successCount,
      errorCount,
      winnersDetected,
      completedTests: completedCount,
      executionTimeMs,
      status,
    });

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
      executionTimeMs,
      summary: {
        totalTests: activeTests.length,
        processedSuccessfully: successCount,
        processedWithErrors: errorCount,
        winnersDetected,
        completedTests: completedCount,
      },
      results: results.slice(0, 10), // Return first 10 for brevity
      totalResultsCount: results.length,
      logId: logEntry.id,
    });
  } catch (error) {
    logger.error("[GET /api/cron/ab-test-daily-aggregate] Fatal error", {
      error: error instanceof Error ? error.message : String(error),
    });

    const executionTimeMs = Date.now() - startTime;

    logCronExecution({
      executionDate: new Date(),
      totalTests: 0,
      winnersDetected: 0,
      completedTests: 0,
      errorCount: 1,
      successCount: 0,
      avgExecutionTimeMs: executionTimeMs,
      failedTestIds: [],
      status: "FAILED",
      notes: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        success: false,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler (for manual triggers)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
