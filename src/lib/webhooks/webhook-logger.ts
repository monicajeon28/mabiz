import { logger } from '@/lib/logger';

export interface WebhookLogContext {
  eventId: string;
  webhookType: string;
  organizationId: string;
  attemptNumber: number;
}

export const webhookLogger = {
  logStart: (ctx: WebhookLogContext) => {
    logger.log(`[Webhook] Starting ${ctx.webhookType} processing`, {
      eventId: ctx.eventId,
      organizationId: ctx.organizationId,
      attempt: ctx.attemptNumber,
    });
  },

  logSuccess: (ctx: WebhookLogContext, durationMs: number) => {
    logger.log(`[Webhook] ${ctx.webhookType} completed successfully`, {
      eventId: ctx.eventId,
      organizationId: ctx.organizationId,
      durationMs,
      attempt: ctx.attemptNumber,
    });
  },

  logFailure: (ctx: WebhookLogContext, error: Error, durationMs: number) => {
    logger.error(`[Webhook] ${ctx.webhookType} failed`, {
      eventId: ctx.eventId,
      organizationId: ctx.organizationId,
      error: error.message,
      durationMs,
      attempt: ctx.attemptNumber,
      stack: error.stack,
    });
  },

  logRetry: (ctx: WebhookLogContext, nextRetryAt: Date, reason: string) => {
    logger.log(`[Webhook] ${ctx.webhookType} scheduled for retry`, {
      eventId: ctx.eventId,
      organizationId: ctx.organizationId,
      nextRetryAt: nextRetryAt.toISOString(),
      reason,
      attempt: ctx.attemptNumber,
    });
  },

  logDeadLetterQueue: (ctx: WebhookLogContext, reason: string) => {
    logger.error(`[Webhook] ${ctx.webhookType} moved to DLQ`, {
      eventId: ctx.eventId,
      organizationId: ctx.organizationId,
      reason,
      attempt: ctx.attemptNumber,
    });
  },
};
