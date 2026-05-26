/**
 * Sequence Completion Detector
 * Monitors sequence progress and handles completion/failure states
 *
 * Responsibilities:
 * - Detect when all 4 days have been sent
 * - Detect sequences that should be marked as failed (7+ days without completion)
 * - Update sequence status appropriately
 * - Track conversion data if applicable
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface CompletionCheckResult {
  completed: number;
  failed: number;
  paused: number;
  errors: Array<{
    instanceId: string;
    error: string;
  }>;
}

/**
 * Check if a sequence instance is complete
 * All 4 days must have been sent
 */
function isComplete(instance: any): boolean {
  return (
    instance.day0SentAt !== null &&
    instance.day1SentAt !== null &&
    instance.day2SentAt !== null &&
    instance.day3SentAt !== null
  );
}

/**
 * Check if a sequence instance should be marked as failed
 * If 7+ days have elapsed without all days being sent
 */
function shouldMarkAsFailed(instance: any): boolean {
  const now = new Date();
  const elapsedMs = now.getTime() - instance.createdAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  // Only mark as failed if:
  // 1. At least 7 days have elapsed
  // 2. Not all days have been sent
  return elapsedDays >= 7 && !isComplete(instance);
}

/**
 * Mark a sequence instance as completed
 */
async function markAsCompleted(instanceId: string): Promise<void> {
  try {
    await prisma.contactSequenceInstance.update({
      where: { id: instanceId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    });

    logger.log('[completion-detector] Marked as completed', { instanceId });
  } catch (error) {
    logger.error('[completion-detector] Error marking completed', {
      instanceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Mark a sequence instance as failed
 */
async function markAsFailed(
  instanceId: string,
  reason: string
): Promise<void> {
  try {
    await prisma.contactSequenceInstance.update({
      where: { id: instanceId },
      data: {
        status: 'FAILED',
        failureReason: reason,
        updatedAt: new Date()
      }
    });

    logger.log('[completion-detector] Marked as failed', {
      instanceId,
      reason
    });
  } catch (error) {
    logger.error('[completion-detector] Error marking failed', {
      instanceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Mark a sequence instance as paused
 * Used when manual intervention is needed
 */
async function markAsPaused(
  instanceId: string,
  pausedBy: string = 'system'
): Promise<void> {
  try {
    await prisma.contactSequenceInstance.update({
      where: { id: instanceId },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
        pausedBy: pausedBy,
        updatedAt: new Date()
      }
    });

    logger.log('[completion-detector] Marked as paused', {
      instanceId,
      pausedBy
    });
  } catch (error) {
    logger.error('[completion-detector] Error marking paused', {
      instanceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Detect completions and failures for a single instance
 */
async function checkInstance(instance: any): Promise<'completed' | 'failed' | 'active' | null> {
  try {
    // Check completion first
    if (isComplete(instance)) {
      await markAsCompleted(instance.id);
      return 'completed';
    }

    // Check if should be marked as failed
    if (shouldMarkAsFailed(instance)) {
      const daysSent = [
        instance.day0SentAt ? 'Day0' : null,
        instance.day1SentAt ? 'Day1' : null,
        instance.day2SentAt ? 'Day2' : null,
        instance.day3SentAt ? 'Day3' : null
      ].filter((d) => d !== null);

      const reason = `Incomplete after 7+ days. Sent: ${daysSent.join(', ') || 'None'}`;
      await markAsFailed(instance.id, reason);
      return 'failed';
    }

    return 'active';
  } catch (error) {
    logger.error('[completion-detector] Error checking instance', {
      instanceId: instance.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Detect completions and failures for all active sequences
 * Run after each cron execution to clean up finished sequences
 */
export async function detectCompletions(
  organizationId: string
): Promise<CompletionCheckResult> {
  const result: CompletionCheckResult = {
    completed: 0,
    failed: 0,
    paused: 0,
    errors: []
  };

  try {
    logger.log('[completion-detector] Starting completion check', {
      organizationId
    });

    // Fetch all ACTIVE sequences for the organization
    const instances = await prisma.contactSequenceInstance.findMany({
      where: {
        status: 'ACTIVE',
        template: {
          organizationId
        }
      },
      orderBy: {
        updatedAt: 'asc'
      }
    });

    logger.log('[completion-detector] Found instances to check', {
      count: instances.length
    });

    // Check each instance
    for (const instance of instances) {
      try {
        const status = await checkInstance(instance);

        if (status === 'completed') {
          result.completed++;
        } else if (status === 'failed') {
          result.failed++;
        }
      } catch (error) {
        result.errors.push({
          instanceId: instance.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.log('[completion-detector] Completion check finished', {
      completed: result.completed,
      failed: result.failed,
      errors: result.errors.length
    });

    return result;
  } catch (error) {
    logger.error('[completion-detector] Completion check failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
}

/**
 * Get summary statistics of sequence health
 * For monitoring and observability
 */
export async function getSequenceHealth(
  organizationId: string
): Promise<{
  active: number;
  completed: number;
  failed: number;
  paused: number;
  totalSent: number;
}> {
  try {
    const [active, completed, failed, paused] = await Promise.all([
      prisma.contactSequenceInstance.count({
        where: {
          status: 'ACTIVE',
          template: { organizationId }
        }
      }),
      prisma.contactSequenceInstance.count({
        where: {
          status: 'COMPLETED',
          template: { organizationId }
        }
      }),
      prisma.contactSequenceInstance.count({
        where: {
          status: 'FAILED',
          template: { organizationId }
        }
      }),
      prisma.contactSequenceInstance.count({
        where: {
          status: 'PAUSED',
          template: { organizationId }
        }
      })
    ]);

    // Count total sent (any instance with at least day0 sent)
    const totalSent = await prisma.contactSequenceInstance.count({
      where: {
        template: { organizationId },
        day0SentAt: { not: null }
      }
    });

    return {
      active,
      completed,
      failed,
      paused,
      totalSent
    };
  } catch (error) {
    logger.error('[completion-detector] Error getting health', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      active: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      totalSent: 0
    };
  }
}
