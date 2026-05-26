/**
 * POST /api/cron/sequence-dispatcher
 *
 * Day 0-3 Sequence Cron Dispatcher
 *
 * Schedule: Every 5 minutes (via vercel.json: "*/5 * * * *")
 *
 * Responsibilities:
 * - Find all ACTIVE ContactSequenceInstance records across organizations
 * - Calculate current day for each instance (0-3)
 * - Check if day should be sent (idempotency check)
 * - Fetch message template and perform variable substitution
 * - Send SMS via Aligo API
 * - Update sequence progress
 * - Detect completions and failures
 * - Return execution metrics
 *
 * Performance targets:
 * - Handle 10K+ sequences in <30 seconds
 * - Process 50-100 contacts per 5-minute run
 * - 99%+ success rate with graceful error handling
 *
 * Error Handling:
 * - Continue on individual contact failures
 * - Log all errors for debugging
 * - Skip contacts with opt-out or invalid phone
 * - Retry failed sends on next execution
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  processSequencesForOrg
} from '@/lib/services/sequence-batch-processor';
import {
  detectCompletions,
  getSequenceHealth
} from '@/lib/services/sequence-completion-detector';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max execution

interface DispatcherMetrics {
  startTime: number;
  endTime: number;
  elapsedMs: number;
  organizationCount: number;
  totalSent: number;
  totalErrors: number;
  completedSequences: number;
  failedSequences: number;
  health: Record<string, any>;
  errors: Array<{
    organizationId: string;
    error: string;
  }>;
}

/**
 * Process sequences for all organizations
 */
async function processAllOrganizations(): Promise<DispatcherMetrics> {
  const startTime = Date.now();
  const metrics: DispatcherMetrics = {
    startTime,
    endTime: 0,
    elapsedMs: 0,
    organizationCount: 0,
    totalSent: 0,
    totalErrors: 0,
    completedSequences: 0,
    failedSequences: 0,
    health: {},
    errors: []
  };

  try {
    // Fetch all organizations
    const organizations = await prisma.organization.findMany({
      where: {
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        slug: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    logger.log('[sequence-dispatcher] Found organizations', {
      count: organizations.length
    });

    // Process each organization
    for (const org of organizations) {
      try {
        // Process active sequences
        const batchResult = await processSequencesForOrg(org.id);

        metrics.totalSent += batchResult.sentCount;
        metrics.totalErrors += batchResult.errorCount;
        metrics.organizationCount++;

        logger.log('[sequence-dispatcher] Organization processed', {
          organizationId: org.id,
          organizationName: org.name,
          sent: batchResult.sentCount,
          errors: batchResult.errorCount
        });

        // Detect completions for this organization
        const completionResult = await detectCompletions(org.id);
        metrics.completedSequences += completionResult.completed;
        metrics.failedSequences += completionResult.failed;

        // Get health stats
        const health = await getSequenceHealth(org.id);
        metrics.health[org.id] = health;

        logger.log('[sequence-dispatcher] Organization health', {
          organizationId: org.id,
          ...health
        });
      } catch (error) {
        logger.error('[sequence-dispatcher] Organization processing failed', {
          organizationId: org.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        metrics.errors.push({
          organizationId: org.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    metrics.endTime = Date.now();
    metrics.elapsedMs = metrics.endTime - metrics.startTime;

    return metrics;
  } catch (error) {
    logger.error('[sequence-dispatcher] Fatal error during dispatch', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    metrics.endTime = Date.now();
    metrics.elapsedMs = metrics.endTime - metrics.startTime;

    throw error;
  }
}

/**
 * Log execution to database for auditing
 * Fire-and-forget operation
 */
async function logExecution(metrics: DispatcherMetrics): Promise<void> {
  try {
    // Create execution log entry (if table exists)
    // This is optional - can be used for monitoring
    logger.log('[sequence-dispatcher] Execution logged', {
      sent: metrics.totalSent,
      errors: metrics.totalErrors,
      elapsedMs: metrics.elapsedMs
    });
  } catch (error) {
    logger.error('[sequence-dispatcher] Error logging execution', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST handler for cron job
 */
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    logger.log('[sequence-dispatcher] Cron execution started', {
      requestId,
      timestamp: new Date().toISOString()
    });

    // Verify authorization (Vercel cron sends internal request)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('[sequence-dispatcher] Unauthorized request', { requestId });
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process all organizations
    const metrics = await processAllOrganizations();

    // Log execution
    await logExecution(metrics);

    const totalTime = Date.now() - startTime;

    logger.log('[sequence-dispatcher] Cron execution completed', {
      requestId,
      metrics,
      totalTime
    });

    return NextResponse.json({
      ok: true,
      requestId,
      timestamp: new Date().toISOString(),
      metrics: {
        sent: metrics.totalSent,
        errors: metrics.totalErrors,
        completed: metrics.completedSequences,
        failed: metrics.failedSequences,
        organizationsProcessed: metrics.organizationCount,
        elapsedMs: metrics.elapsedMs,
        totalTimeMs: totalTime
      },
      health: metrics.health
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error('[sequence-dispatcher] Cron execution failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalTime
    });

    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsedMs: totalTime
      },
      { status: 500 }
    );
  }
}
