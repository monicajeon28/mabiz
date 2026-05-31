import prisma from '@/lib/prisma';
import { webhookLogger, WebhookLogContext } from './webhook-logger';
import { idempotency } from './idempotency';
import { retryStrategy, RetryConfig } from './retry-strategy';

export interface WebhookHandlerResult {
  success: boolean;
  statusCode: number;
  durationMs: number;
  errorMessage?: string;
  responseBody?: any;
}

export interface WebhookEventPayload {
  [key: string]: any;
}

export interface WebhookConfig<T = WebhookEventPayload> {
  webhookType: string;
  secret: string;
  requireAuth: boolean;
  handler: (payload: T) => Promise<any>;
}

export async function handleWebhook<T = WebhookEventPayload>(req: any, config: WebhookConfig<T>): Promise<Response> {
  return new Response(JSON.stringify({
    success: false,
    error: 'Not implemented'
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

export abstract class BaseWebhookHandler {
  abstract webhookType: string;
  abstract handle(payload: WebhookEventPayload, organizationId: string): Promise<WebhookHandlerResult>;

  protected async processEvent(
    eventId: string,
    organizationId: string,
    payload: WebhookEventPayload,
    retryConfig?: RetryConfig
  ): Promise<WebhookHandlerResult> {
    const startTime = Date.now();
    let attemptNumber = 1;

    try {
      const ctx: WebhookLogContext = {
        eventId,
        webhookType: this.webhookType,
        organizationId,
        attemptNumber,
      };

      webhookLogger.logStart(ctx);

      const isDuplicate = await idempotency.checkExists(eventId);
      if (isDuplicate) {
        const durationMs = Date.now() - startTime;
        webhookLogger.logSuccess(ctx, durationMs);
        return {
          success: true,
          statusCode: 200,
          durationMs,
        };
      }

      const result = await this.handle(payload, organizationId);
      const durationMs = Date.now() - startTime;

      if (result.success) {
        webhookLogger.logSuccess(ctx, durationMs);

        await prisma.webhookEvent.create({
          data: {
            eventId,
            organizationId,
            webhookType: this.webhookType,
            payload,
            status: 'COMPLETED',
            processingStartAt: new Date(startTime),
            processingEndAt: new Date(),
            executionTimeMs: durationMs,
          },
        });

        await prisma.webhookLog.create({
          data: {
            webhookEventId: eventId,
            attemptNumber,
            status: 'SUCCESS',
            statusCode: result.statusCode,
            durationMs,
            handlerName: this.constructor.name,
            responseBody: JSON.stringify(result.responseBody),
          },
        });

        return {
          ...result,
          durationMs,
        };
      } else {
        throw new Error(result.errorMessage || 'Handler returned failure');
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      const ctx: WebhookLogContext = {
        eventId,
        webhookType: this.webhookType,
        organizationId,
        attemptNumber,
      };

      const shouldRetry = retryStrategy.isRetryableError(err);

      if (shouldRetry && retryStrategy.shouldRetry(attemptNumber, retryConfig)) {
        const nextRetryAt = retryStrategy.calculateNextRetryAt(attemptNumber, retryConfig);
        webhookLogger.logRetry(ctx, nextRetryAt, err.message);

        await prisma.retryQueue.create({
          data: {
            webhookEventId: eventId,
            scheduledFor: nextRetryAt,
            backoffFactor: retryConfig?.backoffFactor || 2.0,
            baseDelayMs: retryConfig?.baseDelayMs || 1000,
            status: 'QUEUED',
          },
        });
      } else {
        webhookLogger.logDeadLetterQueue(ctx, err.message);
      }

      return {
        success: false,
        statusCode: 500,
        durationMs,
        errorMessage: err.message,
      };
    }
  }
}
