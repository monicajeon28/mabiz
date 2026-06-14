import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { distributedLock } from './distributed-lock';
import { messagesHandler, analyticsHandler, adminHandler } from './handlers';
import { retryStrategy } from './retry-strategy';
import { webhookLogger } from './webhook-logger';
import crypto from 'crypto';

const HANDLERS_MAP: Record<string, any> = {
  MESSAGE_SENT: messagesHandler,
  ANALYTICS_UPDATED: analyticsHandler,
  ADMIN_ACTION: adminHandler,
};

export interface ProcessRetryQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
  durationMs: number;
}

export const retryProcessor = {
  processQueue: async (): Promise<ProcessRetryQueueResult> => {
    const startTime = Date.now();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;

    const lockerId = crypto.randomUUID();

    try {
      const queuedItems = await prisma.retryQueue.findMany({
        where: {
          status: 'QUEUED',
          scheduledFor: { lte: new Date() },
        },
        orderBy: { priority: 'desc' },
        take: 100,
      });

      logger.log('[Retry Processor] Processing queue', {
        itemCount: queuedItems.length,
        lockerId: lockerId.slice(0, 8),
      });

      for (const item of queuedItems) {
        const webhookEvent = await prisma.webhookEvent.findUnique({
          where: { id: item.webhookEventId },
        });

        if (!webhookEvent) continue;

        const canLock = await distributedLock.canAcquire(item.webhookEventId);
        if (!canLock) continue;

        const locked = await distributedLock.acquire(item.webhookEventId, lockerId);
        if (!locked) continue;

        // 멱등성 보장: processingId (UUID) 생성 — 같은 이벤트 중복 처리 방지
        const processingId = crypto.randomUUID();

        try {
          const handler = HANDLERS_MAP[webhookEvent.webhookType];
          if (!handler) {
            logger.warn('[Retry Processor] Unknown webhook type', {
              webhookType: webhookEvent.webhookType,
              eventId: webhookEvent.eventId,
              processingId,
            });
            deadLettered++;
            await prisma.retryQueue.update({
              where: { webhookEventId: item.webhookEventId },
              data: { status: 'DEAD_LETTER' },
            });
            continue;
          }

          const ctx = {
            eventId: webhookEvent.eventId,
            webhookType: webhookEvent.webhookType,
            organizationId: webhookEvent.organizationId,
            attemptNumber: webhookEvent.retryCount + 1,
            processingId, // 추적용 ID
          };

          webhookLogger.logStart(ctx);

          const result = await handler.handle(webhookEvent.payload, webhookEvent.organizationId);

          if (result.success) {
            succeeded++;

            await prisma.webhookEvent.update({
              where: { id: item.webhookEventId },
              data: {
                status: 'COMPLETED',
                processingEndAt: new Date(),
                executionTimeMs: result.durationMs,
                retryCount: webhookEvent.retryCount + 1,
              },
            });

            await prisma.retryQueue.update({
              where: { webhookEventId: item.webhookEventId },
              data: { status: 'COMPLETED' },
            });

            webhookLogger.logSuccess(ctx, result.durationMs);
          } else {
            failed++;
            webhookEvent.retryCount++;

            if (retryStrategy.shouldRetry(webhookEvent.retryCount + 1)) {
              const nextRetryAt = retryStrategy.calculateNextRetryAt(webhookEvent.retryCount + 1);
              await prisma.retryQueue.update({
                where: { webhookEventId: item.webhookEventId },
                data: {
                  scheduledFor: nextRetryAt,
                  status: 'QUEUED',
                },
              });

              webhookLogger.logRetry(ctx, nextRetryAt, result.errorMessage || 'Handler failure');
            } else {
              deadLettered++;
              await prisma.retryQueue.update({
                where: { webhookEventId: item.webhookEventId },
                data: { status: 'DEAD_LETTER' },
              });

              webhookLogger.logDeadLetterQueue(ctx, `Max retries exceeded: ${result.errorMessage}`);
            }
          }

          processed++;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('[Retry Processor] Processing error', {
            eventId: webhookEvent.eventId,
            error: err.message,
          });
          failed++;
        } finally {
          await distributedLock.release(item.webhookEventId, lockerId).catch(() => {
            // Ignore lock release failures
          });
        }
      }

      const durationMs = Date.now() - startTime;

      logger.log('[Retry Processor] Queue processing complete', {
        processed,
        succeeded,
        failed,
        deadLettered,
        durationMs,
      });

      return {
        processed,
        succeeded,
        failed,
        deadLettered,
        durationMs,
      };
    } catch (error) {
      logger.error('[Retry Processor] Fatal error', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        deadLettered: 0,
        durationMs: Date.now() - startTime,
      };
    }
  },
};
