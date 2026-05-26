/**
 * A/B Test Lifecycle Management
 * Handles test expiration, completion, and archival
 * Author: CRM Analytics Team
 * Date: 2026-05-27
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { detectWinner } from "./ab-test-automation";

/**
 * Test completion status
 */
export interface TestCompletionResult {
  testId: string;
  completed: boolean;
  reason?: string;
  winner?: "A" | "B";
  declaredAt?: Date;
}

/**
 * Check if test should be marked as expired/completed
 *
 * Criteria:
 * 1. Test running > 14 days
 * 2. Winner has been declared (winner = A or B)
 * OR
 * 1. Test running > 30 days (auto-complete regardless)
 */
export async function checkTestExpiry(testId: string, minDaysForDecision: number = 14, maxDays: number = 30): Promise<TestCompletionResult> {
  try {
    const test = await prisma.smsABTest.findUnique({
      where: { id: testId },
    });

    if (!test) {
      return {
        testId,
        completed: false,
        reason: "Test not found",
      };
    }

    // Calculate test duration
    const now = new Date();
    const testDuration = Math.floor((now.getTime() - test.startedAt.getTime()) / (1000 * 60 * 60 * 24));

    // Already completed
    if (test.status === "COMPLETED") {
      return {
        testId,
        completed: true,
        reason: "Already completed",
        winner: test.declaredWinner as "A" | "B" | undefined,
        declaredAt: test.declaredAt || undefined,
      };
    }

    // Auto-complete if running too long (safety mechanism)
    if (testDuration >= maxDays) {
      const winnerDetection = await detectWinner(testId);

      await prisma.smsABTest.update({
        where: { id: testId },
        data: {
          status: "COMPLETED",
          endedAt: now,
          declaredWinner: winnerDetection.winner || undefined,
          declaredAt: winnerDetection.winner ? now : undefined,
        },
      });

      logger.info("[checkTestExpiry] Auto-completed (max duration)", {
        testId,
        duration: testDuration,
        winner: winnerDetection.winner,
      });

      return {
        testId,
        completed: true,
        reason: `Auto-completed: test running for ${testDuration} days (max: ${maxDays})`,
        winner: winnerDetection.winner,
        declaredAt: winnerDetection.winner ? now : undefined,
      };
    }

    // Check if enough time passed to declare winner
    if (testDuration >= minDaysForDecision) {
      const winnerDetection = await detectWinner(testId);

      // If winner detected, mark as completed
      if (winnerDetection.hasWinner && winnerDetection.winner) {
        await prisma.smsABTest.update({
          where: { id: testId },
          data: {
            status: "COMPLETED",
            endedAt: now,
            declaredWinner: winnerDetection.winner,
            declaredAt: now,
          },
        });

        logger.info("[checkTestExpiry] Winner declared", {
          testId,
          winner: winnerDetection.winner,
          pValue: winnerDetection.pValue,
        });

        return {
          testId,
          completed: true,
          reason: `Winner declared: ${winnerDetection.winner} (p=${winnerDetection.pValue.toFixed(4)})`,
          winner: winnerDetection.winner,
          declaredAt: now,
        };
      }
    }

    // Test still active
    return {
      testId,
      completed: false,
      reason: `Test still active (${testDuration}/${minDaysForDecision} days)`,
    };
  } catch (error) {
    logger.error("[checkTestExpiry]", {
      testId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Archive old timeline records to keep table size manageable
 * Keep last 30 days of snapshots, remove older ones
 */
export async function archiveOldTimelines(testId: string, keepDays: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    // Delete old timeline records
    const result = await prisma.smsABTestTimeline.deleteMany({
      where: {
        abTestId: testId,
        snapshotDate: { lt: cutoffDate },
      },
    });

    if (result.count > 0) {
      logger.info("[archiveOldTimelines]", { testId, deletedCount: result.count, keepDays });
    }

    return result.count;
  } catch (error) {
    logger.error("[archiveOldTimelines]", {
      testId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Batch check expiry for all active tests
 */
export async function checkAllTestsExpiry(organizationId?: string): Promise<TestCompletionResult[]> {
  try {
    const activeTests = await prisma.smsABTest.findMany({
      where: {
        status: "ACTIVE",
        ...(organizationId && { organizationId }),
      },
      select: { id: true },
    });

    const results = await Promise.allSettled(activeTests.map((test) => checkTestExpiry(test.id)));

    const completedResults: TestCompletionResult[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        completedResults.push(result.value);
      } else {
        logger.error("[checkAllTestsExpiry] Single test error", {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return completedResults;
  } catch (error) {
    logger.error("[checkAllTestsExpiry]", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Pause inactive tests (no new sends in 3+ days)
 */
export async function pauseInactiveTests(organizationId?: string): Promise<number> {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Find active tests with no recent sends
    const inactiveTests = await prisma.smsABTest.findMany({
      where: {
        status: "ACTIVE",
        ...(organizationId && { organizationId }),
      },
      include: {
        _count: {
          select: {
            results: {
              where: {
                // Check if any results exist with recent timestamps
                // This is a proxy check - in real scenario, would query SmsLog
              },
            },
          },
        },
      },
    });

    // Filter for truly inactive ones (last activity > 3 days ago)
    const toUpdate = inactiveTests.filter((test) => {
      const lastUpdate = test.updatedAt || test.startedAt;
      const daysSinceUpdate = Math.floor((new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceUpdate >= 3;
    });

    if (toUpdate.length === 0) {
      return 0;
    }

    const result = await prisma.smsABTest.updateMany({
      where: {
        id: { in: toUpdate.map((t) => t.id) },
      },
      data: {
        status: "PAUSED",
      },
    });

    logger.info("[pauseInactiveTests]", {
      organizationId,
      pausedCount: result.count,
    });

    return result.count;
  } catch (error) {
    logger.error("[pauseInactiveTests]", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get test status summary
 */
export async function getTestStatusSummary(
  organizationId: string
): Promise<{ active: number; completed: number; paused: number; withWinner: number }> {
  try {
    const [active, completed, paused, withWinner] = await Promise.all([
      prisma.smsABTest.count({
        where: { organizationId, status: "ACTIVE" },
      }),
      prisma.smsABTest.count({
        where: { organizationId, status: "COMPLETED" },
      }),
      prisma.smsABTest.count({
        where: { organizationId, status: "PAUSED" },
      }),
      prisma.smsABTest.count({
        where: { organizationId, declaredWinner: { not: null } },
      }),
    ]);

    return { active, completed, paused, withWinner };
  } catch (error) {
    logger.error("[getTestStatusSummary]", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
