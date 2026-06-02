/**
 * Webhook 재시도 큐 관리
 *
 * Webhook 처리 실패 시 자동으로 재시도 스케줄링
 * - DB 기반 지속성 (프로세스 재시작 후에도 유지)
 * - 지수 백오프 (5분 → 10분 → 20분 → ...)
 * - 최대 5회 재시도
 * - Cron으로 매분 처리
 *
 * 사용 예:
 * ```typescript
 * try {
 *   await processWebhookEvent(eventId, eventType, payload);
 * } catch (error) {
 *   await scheduleWebhookRetry(eventId, eventType, payload, error);
 * }
 * ```
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface WebhookRetryRecord {
  id: string;
  eventId: string;
  eventType: string;
  payload: Record<string, any>;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook 재시도 스케줄링
 *
 * 지수 백오프 시간표:
 * - 시도 1 실패 → 5분 후 시도 2
 * - 시도 2 실패 → 10분 후 시도 3
 * - 시도 3 실패 → 20분 후 시도 4
 * - 시도 4 실패 → 40분 후 시도 5
 * - 시도 5 실패 → 포기 (로그만 기록)
 */
export async function scheduleWebhookRetry(
  eventId: string,
  eventType: string,
  payload: Record<string, any>,
  error: Error,
  options: {
    attempt?: number;
    maxAttempts?: number;
    initialDelayMs?: number;
  } = {}
) {
  const { attempt = 1, maxAttempts = 5, initialDelayMs = 300000 } = options;

  // 최대 재시도 횟수 초과
  if (attempt >= maxAttempts) {
    logger.error(`[WEBHOOK_RETRY] 최대 재시도 횟수 초과`, {
      eventId,
      eventType,
      attempt,
      maxAttempts,
      error: error.message,
    });

    // 최종 실패 기록 (DLQ - Dead Letter Queue)
    await prisma.webhookRetryQueue.deleteMany({
      where: { eventId },
    });

    return;
  }

  // 지수 백오프: 5분, 10분, 20분, 40분, ...
  const nextRetryMs = initialDelayMs * Math.pow(2, attempt - 1);
  const nextRetryAt = new Date(Date.now() + nextRetryMs);

  try {
    // Upsert: 기존 레코드가 있으면 업데이트, 없으면 생성
    const record = await prisma.webhookRetryQueue.upsert({
      where: { eventId },
      update: {
        attempt: attempt + 1,
        nextRetryAt,
        lastError: error.message,
        updatedAt: new Date(),
      },
      create: {
        eventId,
        eventType,
        payload,
        attempt: attempt + 1,
        maxAttempts,
        nextRetryAt,
        lastError: error.message,
      },
    });

    logger.log(`[WEBHOOK_RETRY] 재시도 예약`, {
      recordId: record.id,
      eventId,
      eventType,
      attempt: attempt + 1,
      maxAttempts,
      nextRetryAt: nextRetryAt.toISOString(),
      delayMinutes: Math.round(nextRetryMs / 60000),
    });
  } catch (dbError) {
    logger.error(`[WEBHOOK_RETRY] DB 오류`, {
      eventId,
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
  }
}

/**
 * 재시도 큐 처리 (Cron 작업)
 *
 * 매분 실행:
 * 1. nextRetryAt <= NOW 인 항목 조회 (최대 100건)
 * 2. 각 항목마다:
 *    - processWebhookEvent() 호출
 *    - 성공: 레코드 삭제
 *    - 실패: scheduleWebhookRetry() 호출 (다음 재시도 예약)
 *
 * @returns 처리된 항목 수
 */
export async function processWebhookRetryQueue(): Promise<number> {
  try {
    // 재시도 대기 중인 항목 조회
    const pendingRetries = await prisma.webhookRetryQueue.findMany({
      where: {
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { nextRetryAt: 'asc' },
      take: 100, // 한 번에 최대 100개
    });

    if (pendingRetries.length === 0) {
      return 0;
    }

    logger.log(`[WEBHOOK_RETRY_QUEUE] ${pendingRetries.length}건 처리 시작`);

    let successCount = 0;
    let failureCount = 0;

    for (const retry of pendingRetries) {
      try {
        // ──────────────────────────────────────────────────────────
        // 실제 Webhook 이벤트 처리
        // ──────────────────────────────────────────────────────────
        // 이 함수는 각 웹훅 타입별로 구현 필요
        // 예: processPaymentWebhook, processInquiryWebhook 등
        await processWebhookEventHandler(
          retry.eventId,
          retry.eventType,
          retry.payload
        );

        // 성공: 레코드 삭제
        await prisma.webhookRetryQueue.delete({
          where: { id: retry.id },
        });

        logger.log(`[WEBHOOK_RETRY_QUEUE] 성공`, {
          recordId: retry.id,
          eventId: retry.eventId,
          eventType: retry.eventType,
          attempt: retry.attempt,
        });

        successCount++;
      } catch (error) {
        failureCount++;

        // 실패: 다음 재시도 예약
        await scheduleWebhookRetry(
          retry.eventId,
          retry.eventType,
          retry.payload,
          error instanceof Error ? error : new Error(String(error)),
          {
            attempt: retry.attempt,
            maxAttempts: retry.maxAttempts,
          }
        );

        logger.warn(`[WEBHOOK_RETRY_QUEUE] 실패, 다음 재시도 예약`, {
          recordId: retry.id,
          eventId: retry.eventId,
          eventType: retry.eventType,
          attempt: retry.attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.log(`[WEBHOOK_RETRY_QUEUE] 처리 완료`, {
      total: pendingRetries.length,
      successCount,
      failureCount,
    });

    return successCount;
  } catch (error) {
    logger.error(`[WEBHOOK_RETRY_QUEUE] 처리 중 오류`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * 웹훅 이벤트 처리기
 *
 * 실제 구현은 이벤트 타입별로 분기
 * 예를 들어:
 * - payment.created → processPaymentCreated()
 * - inquiry.created → processInquiryCreated()
 * - settlement.created → processSettlementCreated()
 */
async function processWebhookEventHandler(
  eventId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  // 임시 구현: 실제 프로젝트에서는 웹훅 타입별 핸들러 import
  // import { handlers } from '@/lib/webhook-handlers';
  // const handler = handlers[eventType];
  // if (!handler) throw new Error(`Unknown event type: ${eventType}`);
  // await handler(eventId, payload);

  logger.log(`[WEBHOOK_HANDLER] ${eventType} 처리`, {
    eventId,
    payloadKeys: Object.keys(payload),
  });

  // 실제 구현으로 대체 필요
  throw new Error(
    `[processWebhookEventHandler] Not implemented for event type: ${eventType}`
  );
}

/**
 * 재시도 큐 상태 조회 (모니터링용)
 */
export async function getRetryQueueStatus(): Promise<{
  pendingCount: number;
  oldestRetryAt?: Date;
  eventTypeBreakdown: Record<string, number>;
  attemptBreakdown: Record<number, number>;
}> {
  const [pendingRetries, allRetries] = await Promise.all([
    prisma.webhookRetryQueue.findMany({
      where: { nextRetryAt: { lte: new Date() } },
      select: { id: true },
    }),
    prisma.webhookRetryQueue.findMany({
      select: { eventType: true, attempt: true, nextRetryAt: true },
      orderBy: { nextRetryAt: 'asc' },
    }),
  ]);

  const eventTypeBreakdown: Record<string, number> = {};
  const attemptBreakdown: Record<number, number> = {};

  for (const retry of allRetries) {
    eventTypeBreakdown[retry.eventType] = (eventTypeBreakdown[retry.eventType] || 0) + 1;
    attemptBreakdown[retry.attempt] = (attemptBreakdown[retry.attempt] || 0) + 1;
  }

  return {
    pendingCount: pendingRetries.length,
    oldestRetryAt: allRetries[0]?.nextRetryAt,
    eventTypeBreakdown,
    attemptBreakdown,
  };
}

/**
 * 특정 이벤트의 재시도 기록 조회 (디버깅용)
 */
export async function getRetryHistory(eventId: string): Promise<WebhookRetryRecord | null> {
  return prisma.webhookRetryQueue.findUnique({
    where: { eventId },
  });
}

/**
 * 재시도 큐 초기화 (관리자용, 주의!)
 */
export async function clearRetryQueue(options?: { olderThan?: Date }) {
  const deleted = await prisma.webhookRetryQueue.deleteMany({
    where: olderThan ? { createdAt: { lt: options.olderThan } } : {},
  });

  logger.warn(`[WEBHOOK_RETRY_QUEUE] 초기화`, {
    deletedCount: deleted.count,
  });

  return deleted.count;
}
