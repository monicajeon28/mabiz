import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { webhookLogger, WebhookLogContext } from './webhook-logger';
import { idempotency } from './idempotency';
import { retryStrategy, RetryConfig } from './retry-strategy';
import crypto from 'crypto';

export interface WebhookHandlerResult {
  success: boolean;
  statusCode: number;
  durationMs: number;
  errorMessage?: string;
  responseBody?: any;
}

export interface WebhookEventPayload {
  eventId?: string;
  [key: string]: any;
}

export interface WebhookHandlerOptions<T extends WebhookEventPayload = WebhookEventPayload> {
  webhookType: string;
  secret: string;
  requireAuth?: boolean;
  handler: (payload: T, organizationId: string) => Promise<any>;
}

/**
 * Verifies HMAC-SHA256 signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generic webhook handler
 * Extracts payload from NextRequest, verifies signature, routes to handler
 */
export async function handleWebhook<T extends WebhookEventPayload = WebhookEventPayload>(
  req: NextRequest,
  options: WebhookHandlerOptions<T>
): Promise<NextResponse> {
  const startTime = Date.now();
  const { webhookType, secret, requireAuth = true, handler } = options;

  try {
    // 1. Read request body
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody) as T;
    const eventId = payload.eventId || crypto.randomUUID();

    // 2. Verify signature if required
    if (requireAuth) {
      const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-signature');
      if (!signature) {
        return NextResponse.json(
          { ok: false, error: 'Missing webhook signature' },
          { status: 401 }
        );
      }

      try {
        if (!verifySignature(rawBody, signature, secret)) {
          return NextResponse.json(
            { ok: false, error: 'Invalid webhook signature' },
            { status: 401 }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: 'Signature verification failed' },
          { status: 401 }
        );
      }
    }

    // 3. Check idempotency
    const isDuplicate = await idempotency.checkExists(eventId);
    if (isDuplicate) {
      return NextResponse.json(
        { ok: true, message: 'Event already processed' },
        { status: 200 }
      );
    }

    // 4. Determine organizationId (from payload, header, or environment)
    let organizationId: string;

    if ('organizationId' in payload && typeof payload.organizationId === 'string') {
      organizationId = payload.organizationId;
    } else {
      const headerOrgId = req.headers.get('x-organization-id');
      const envOrgId = process.env.MABIZ_ORGANIZATION_ID;

      if (!headerOrgId && !envOrgId) {
        return NextResponse.json(
          { ok: false, error: 'Cannot determine organization ID' },
          { status: 400 }
        );
      }

      organizationId = headerOrgId || envOrgId!;
    }

    // 5. Call handler
    const result = await handler(payload, organizationId);
    const durationMs = Date.now() - startTime;

    // 6. Log success
    await idempotency.markProcessed(eventId);
    await prisma.webhookEvent.create({
      data: {
        eventId,
        organizationId,
        webhookType,
        payload,
        status: 'COMPLETED',
        processingStartAt: new Date(startTime),
        processingEndAt: new Date(),
        executionTimeMs: durationMs,
      },
    }).catch(() => {
      // Silently fail if webhook logging fails
    });

    return NextResponse.json(
      { ok: true, eventId, ...result },
      { status: 200 }
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));

    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        webhookType,
      },
      { status: 500 }
    );
  }
}

export abstract class BaseWebhookHandler {
  abstract webhookType: string;
  abstract handle(payload: WebhookEventPayload, organizationId: string): Promise<WebhookHandlerResult>;

  /**
   * Public method to process webhook events
   * Delegates to processEvent which handles idempotency, retry logic, and logging
   */
  public async process(
    eventId: string,
    organizationId: string,
    payload: WebhookEventPayload,
    retryConfig?: RetryConfig
  ): Promise<WebhookHandlerResult> {
    return this.processEvent(eventId, organizationId, payload, retryConfig);
  }

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
