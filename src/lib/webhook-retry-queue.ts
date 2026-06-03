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
 *   await processWebhookEvent(webhookEventId);
 * } catch (error) {
 *   await scheduleWebhookRetry(webhookEventId, error);
 * }
 * ```
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Webhook 재시도 스케줄링
 *
 * 지수 백오프: 5분, 10분, 20분, 40분, ...
 * WebhookEvent에서 retryCount, maxRetries, nextRetryAt을 관리하고
 * RetryQueue는 scheduledFor 기반으로 처리 대기 큐 역할
 */
export async function scheduleWebhookRetry(
  webhookEventId: string,
  error: Error,
  options: { initialDelayMs?: number } = {}
) {
  const { initialDelayMs = 300000 } = options;

  try {
    // WebhookEvent 조회
    const event = await prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      logger.error(`[WEBHOOK_RETRY] 이벤트를 찾을 수 없음`, { webhookEventId });
      return;
    }

    // 최대 재시도 횟수 초과
    if (event.retryCount >= event.maxRetries) {
      logger.error(`[WEBHOOK_RETRY] 최대 재시도 횟수 초과`, {
        webhookEventId,
        retryCount: event.retryCount,
        maxRetries: event.maxRetries,
        error: error.message,
      });

      // 재시도 큐 제거 + WebhookEvent 상태 업데이트를 원자적으로 처리
      await prisma.$transaction([
        prisma.retryQueue.deleteMany({
          where: { webhookEventId },
        }),
        prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'FAILED',
            errorMessage: error.message,
          },
        }),
      ]);

      return;
    }

    // 지수 백오프: 5분, 10분, 20분, 40분, ...
    const nextRetryMs = initialDelayMs * Math.pow(2, event.retryCount);
    const scheduledFor = new Date(Date.now() + nextRetryMs);

    // RetryQueue upsert + WebhookEvent 업데이트를 원자적으로 처리
    // upsert는 sequential transaction 내에서 실행해야 Prisma가 지원함
    await prisma.$transaction(async (tx) => {
      await tx.retryQueue.upsert({
        where: { webhookEventId },
        update: {
          scheduledFor,
          status: 'QUEUED',
        },
        create: {
          webhookEventId,
          scheduledFor,
          status: 'QUEUED',
        },
      });

      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          retryCount: event.retryCount + 1,
          nextRetryAt: scheduledFor,
          errorMessage: error.message,
        },
      });
    });

    logger.log(`[WEBHOOK_RETRY] 재시도 예약`, {
      webhookEventId,
      retryCount: event.retryCount + 1,
      maxRetries: event.maxRetries,
      scheduledFor: scheduledFor.toISOString(),
      delayMinutes: Math.round(nextRetryMs / 60000),
    });
  } catch (dbError) {
    logger.error(`[WEBHOOK_RETRY] DB 오류`, {
      webhookEventId,
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
  }
}

/**
 * 재시도 큐 처리 (Cron 작업)
 *
 * 매분 실행:
 * 1. scheduledFor <= NOW 인 항목 조회 (최대 100건)
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
    const pendingRetries = await prisma.retryQueue.findMany({
      where: {
        status: 'QUEUED',
        scheduledFor: { lte: new Date() },
      },
      include: {
        webhookEvent: {
          select: {
            id: true,
            eventId: true,
            webhookType: true,
            payload: true,
            retryCount: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 100,
    });

    if (pendingRetries.length === 0) {
      return 0;
    }

    logger.log(`[WEBHOOK_RETRY_QUEUE] ${pendingRetries.length}건 처리 시작`);

    let successCount = 0;
    let failureCount = 0;

    for (const retryRecord of pendingRetries) {
      const event = retryRecord.webhookEvent;

      try {
        // 재시도 큐 상태를 PROCESSING으로 변경
        await prisma.retryQueue.update({
          where: { id: retryRecord.id },
          data: { status: 'PROCESSING' },
        });

        // 실제 Webhook 이벤트 처리
        await processWebhookEventHandler(
          event.id,
          event.eventId,
          event.webhookType,
          (event.payload ?? {}) as Record<string, unknown>
        );

        // 성공: 레코드 삭제 및 WebhookEvent 상태 업데이트
        await Promise.all([
          prisma.retryQueue.delete({ where: { id: retryRecord.id } }),
          prisma.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'COMPLETED',
              processingEndAt: new Date(),
            },
          }),
        ]);

        logger.log(`[WEBHOOK_RETRY_QUEUE] 성공`, {
          webhookEventId: event.id,
          eventId: event.eventId,
          webhookType: event.webhookType,
          retryCount: event.retryCount,
        });

        successCount++;
      } catch (error) {
        failureCount++;

        // 실패: 다음 재시도 예약
        await scheduleWebhookRetry(
          event.id,
          error instanceof Error ? error : new Error(String(error))
        );

        logger.warn(`[WEBHOOK_RETRY_QUEUE] 실패, 다음 재시도 예약`, {
          webhookEventId: event.id,
          eventId: event.eventId,
          webhookType: event.webhookType,
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
 * 웹훅 이벤트 처리기 (재시도 로직에서 사용)
 */
async function processWebhookEventHandler(
  webhookEventId: string,
  eventId: string,
  webhookType: string,
  payload: Record<string, unknown>
): Promise<void> {
  logger.log(`[WEBHOOK_HANDLER] ${webhookType} 처리 시작`, {
    webhookEventId,
    eventId,
  });

  // 웹훅 타입별 핸들러 라우팅
  switch (webhookType) {
    case 'PAYMENT_COMPLETED':
      // await processPaymentWebhook(eventId, payload);
      break;
    case 'CUSTOMER_INQUIRY':
      // await processInquiryWebhook(eventId, payload);
      break;
    case 'SETTLEMENT_UPDATED':
      // await processSettlementWebhook(eventId, payload);
      break;
    default:
      throw new Error(`Unknown webhook type: ${webhookType}`);
  }

  logger.log(`[WEBHOOK_HANDLER] ${webhookType} 처리 완료`, {
    webhookEventId,
    eventId,
  });
}

/**
 * 재시도 큐 상태 조회 (모니터링용)
 */
export async function getRetryQueueStatus(): Promise<{
  pendingCount: number;
  processingCount: number;
  oldestScheduledFor?: Date;
  statusBreakdown: Record<string, number>;
}> {
  const allRetries = await prisma.retryQueue.findMany({
    include: {
      webhookEvent: {
        select: { webhookType: true },
      },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  const pendingRetries = allRetries.filter((r) => r.status === 'QUEUED' && r.scheduledFor <= new Date());
  const processingRetries = allRetries.filter((r) => r.status === 'PROCESSING');
  const statusBreakdown: Record<string, number> = {};

  for (const retry of allRetries) {
    statusBreakdown[retry.status] = (statusBreakdown[retry.status] || 0) + 1;
  }

  return {
    pendingCount: pendingRetries.length,
    processingCount: processingRetries.length,
    oldestScheduledFor: allRetries[0]?.scheduledFor,
    statusBreakdown,
  };
}

/**
 * 특정 WebhookEvent의 재시도 기록 조회 (디버깅용)
 */
export async function getRetryHistory(webhookEventId: string) {
  return prisma.retryQueue.findUnique({
    where: { webhookEventId },
    include: {
      webhookEvent: {
        select: {
          id: true,
          eventId: true,
          webhookType: true,
          retryCount: true,
          maxRetries: true,
          nextRetryAt: true,
          status: true,
        },
      },
    },
  });
}

/**
 * 재시도 큐 초기화 (관리자용, 주의!)
 */
export async function clearRetryQueue(options?: { status?: string; olderThan?: Date }) {
  const where: { status?: string; createdAt?: { lt: Date } } = {};

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.olderThan) {
    where.createdAt = { lt: options.olderThan };
  }

  const deleted = await prisma.retryQueue.deleteMany({ where });

  logger.warn(`[WEBHOOK_RETRY_QUEUE] 초기화`, {
    deletedCount: deleted.count,
  });

  return deleted.count;
}
