import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// DLQ 재시도 대기 시간 (분): 5m → 15m → 60m
const RETRY_DELAYS_MIN = [5, 15, 60];

/**
 * 실패한 webhook을 DLQ에 저장
 */
export async function enqueueDLQ(
  webhookType: string,
  payload: unknown,
  failureReason: string,
  format: 'json' | 'form-data' = 'json',
): Promise<string> {
  const entry = await prisma.mabizSyncDLQ.create({
    data: {
      webhookType,
      payload: payload as object,
      failureReason,
      format,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MIN[0] * 60_000),
    },
  });
  logger.warn('[DLQ] 엔큐', { id: entry.id, webhookType, format, failureReason });
  return entry.id;
}

/**
 * 재시도 성공 시 resolved 처리
 */
export async function resolveDLQ(id: string): Promise<void> {
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: { resolvedAt: new Date() },
  });
  logger.log('[DLQ] 해결됨', { id });
}

/**
 * 재시도 실패 시 다음 시도 예약
 */
export async function failDLQ(id: string, retryCount: number, reason: string): Promise<void> {
  const nextDelay = RETRY_DELAYS_MIN[retryCount] ?? null;
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      retryCount: retryCount + 1,
      failureReason: reason,
      nextRetryAt: nextDelay ? new Date(Date.now() + nextDelay * 60_000) : null,
    },
  });
  logger.warn('[DLQ] 재시도 실패', { id, retryCount: retryCount + 1, nextDelay });
}

/**
 * 재시도 대상 조회 (cron에서 사용)
 */
export async function getPendingDLQEntries(limit = 20) {
  return prisma.mabizSyncDLQ.findMany({
    where: {
      resolvedAt: null,
      retryCount: { lt: 3 },
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: limit,
  });
}
