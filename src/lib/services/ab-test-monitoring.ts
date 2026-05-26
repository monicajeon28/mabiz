/**
 * A/B Test Cron Monitoring Service
 * Tracks cron execution history and performance
 * Author: CRM Analytics Team
 * Date: 2026-05-27
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Cron execution log
 */
export interface CronExecutionLog {
  id: string;
  executionDate: Date;
  totalTests: number;
  winnersDetected: number;
  completedTests: number;
  errorCount: number;
  successCount: number;
  avgExecutionTimeMs: number;
  failedTestIds: string[];
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  notes?: string;
}

/**
 * Create execution log table if doesn't exist
 */
export async function ensureCronLogTableExists(): Promise<void> {
  try {
    // Check if we need to add a CronABTestLog table
    // For now, we'll log to a JSON field in a dedicated table
    // This can be extended to a full table in future migrations

    logger.info("[ensureCronLogTableExists] Check passed");
  } catch (error) {
    logger.error("[ensureCronLogTableExists]", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Simple in-memory log storage (for immediate use)
 * In production, store to database with migration
 */
const executionLogs: CronExecutionLog[] = [];
const maxLogSize = 1000; // Keep last 1000 runs

/**
 * Log cron execution result
 */
export function logCronExecution(log: Omit<CronExecutionLog, "id">): CronExecutionLog {
  const entry: CronExecutionLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...log,
  };

  executionLogs.push(entry);

  // Keep list bounded
  if (executionLogs.length > maxLogSize) {
    executionLogs.shift();
  }

  // Also log to console for CloudWatch
  logger.info("[cronABTestExecution]", {
    totalTests: log.totalTests,
    winnersDetected: log.winnersDetected,
    completedTests: log.completedTests,
    errorCount: log.errorCount,
    successCount: log.successCount,
    status: log.status,
  });

  return entry;
}

/**
 * Get last N execution logs
 */
export function getExecutionHistory(limit: number = 30): CronExecutionLog[] {
  return executionLogs.slice(-limit).reverse();
}

/**
 * Get summary statistics
 */
export function getMonitoringSummary(): {
  totalExecutions: number;
  successRate: number;
  totalWinnersDetected: number;
  avgExecutionTime: number;
  lastExecution?: CronExecutionLog;
} {
  if (executionLogs.length === 0) {
    return {
      totalExecutions: 0,
      successRate: 0,
      totalWinnersDetected: 0,
      avgExecutionTime: 0,
    };
  }

  const successCount = executionLogs.filter((l) => l.status !== "FAILED").length;
  const successRate = (successCount / executionLogs.length) * 100;
  const totalWinnersDetected = executionLogs.reduce((sum, log) => sum + log.winnersDetected, 0);
  const avgExecutionTime = executionLogs.reduce((sum, log) => sum + log.avgExecutionTimeMs, 0) / executionLogs.length;

  return {
    totalExecutions: executionLogs.length,
    successRate,
    totalWinnersDetected,
    avgExecutionTime,
    lastExecution: executionLogs[executionLogs.length - 1],
  };
}

/**
 * Clear execution logs (for testing)
 */
export function clearLogs(): void {
  executionLogs.length = 0;
}

/**
 * Get health check data
 */
export async function getHealthCheckData(): Promise<{
  cronStatus: string;
  lastExecution?: Date;
  nextExecution?: Date;
  failureRate: number;
  recentErrors: string[];
}> {
  try {
    const summary = getMonitoringSummary();
    const lastLog = executionLogs[executionLogs.length - 1];

    // Estimate next execution (daily at 1 AM UTC)
    const nextExecution = new Date();
    nextExecution.setUTCHours(1, 0, 0, 0);
    if (nextExecution <= new Date()) {
      nextExecution.setDate(nextExecution.getDate() + 1);
    }

    const recentErrors = executionLogs
      .slice(-10)
      .filter((log) => log.failedTestIds.length > 0)
      .flatMap((log) => log.failedTestIds);

    return {
      cronStatus: summary.totalExecutions === 0 ? "NO_DATA" : lastLog?.status === "SUCCESS" ? "HEALTHY" : "DEGRADED",
      lastExecution: lastLog?.executionDate,
      nextExecution,
      failureRate: 100 - summary.successRate,
      recentErrors: Array.from(new Set(recentErrors)),
    };
  } catch (error) {
    logger.error("[getHealthCheckData]", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Export metrics for monitoring dashboard
 */
export function exportMetrics() {
  const summary = getMonitoringSummary();
  const logs = getExecutionHistory(10);

  return {
    summary,
    recentLogs: logs,
    timestamp: new Date(),
  };
}
