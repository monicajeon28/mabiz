import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// DLQ 상태
type DLQStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'FAILED';

const DLQ_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  RESOLVED: 'RESOLVED',
  FAILED: 'FAILED',
} as const;

// DLQ 재시도 정책: 최대 3회
const MAX_RETRIES = 3;
// DLQ 재시도 대기 시간 (분): [0]=5m → [1]=15m → [2]=60m
const RETRY_DELAYS_MIN = [5, 15, 60];
// 필드 길이 제한
const MAX_FAILURE_REASON_LENGTH = 5000;
const MAX_WEBHOOK_TYPE_LENGTH = 100;

/**
 * 실패한 webhook을 DLQ에 저장
 */
export async function enqueueDLQ(
  webhookType: string,
  payload: unknown,
  failureReason: string,
  format: 'json' | 'form-data' = 'json',
): Promise<string> {
  const truncatedType = truncateString(webhookType, MAX_WEBHOOK_TYPE_LENGTH);
  const truncatedReason = truncateString(failureReason, MAX_FAILURE_REASON_LENGTH);

  const entry = await prisma.mabizSyncDLQ.create({
    data: {
      webhookType: truncatedType,
      payload: payload as object,
      failureReason: truncatedReason,
      format,
      status: DLQ_STATUS.PENDING,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MIN[0] * 60_000),
    },
  });
  logger.warn('[DLQ] 엔큐', { id: entry.id, webhookType: truncatedType, format });
  return entry.id;
}

/**
 * 재시도 성공 시 resolved 처리
 */
export async function resolveDLQ(id: string): Promise<void> {
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      status: DLQ_STATUS.RESOLVED,
      resolvedAt: new Date(),
    },
  });
  logger.log('[DLQ] 해결됨', { id });
}

/**
 * 재시도 실패 시 다음 시도 예약
 */
export async function failDLQ(id: string, retryCount: number, reason: string): Promise<void> {
  const truncatedReason = truncateString(reason, MAX_FAILURE_REASON_LENGTH);

  // 최대 재시도 도달 → 정지 (영구 정체 방지)
  if (retryCount >= MAX_RETRIES) {
    await prisma.mabizSyncDLQ.update({
      where: { id },
      data: {
        status: DLQ_STATUS.FAILED,
        retryCount: retryCount + 1,
        failureReason: truncatedReason,
        resolvedAt: new Date(),
        nextRetryAt: null,
      },
    });
    logger.warn('[DLQ] 최대 재시도 도달', { id, maxRetries: MAX_RETRIES });
    return;
  }

  // 다음 재시도 예약
  const nextDelay = RETRY_DELAYS_MIN[retryCount];
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      status: DLQ_STATUS.PENDING,
      retryCount: retryCount + 1,
      failureReason: truncatedReason,
      nextRetryAt: new Date(Date.now() + nextDelay * 60_000),
    },
  });
  logger.warn('[DLQ] 재시도 예약', { id, retryCount: retryCount + 1, nextDelayMin: nextDelay });
}

/**
 * 재시도 대상 조회 및 PROCESSING 상태 변경 (원자적)
 * - 트랜잭션 내에서 항목 조회 → PROCESSING 상태 변경
 * - P1-2 Race Condition 방지: SELECT...FOR UPDATE 동등 (Postgres RepeatableRead)
 * - 다른 Cron 인스턴스가 같은 항목을 동시 처리할 수 없음
 */
export async function getPendingDLQEntries(limit = 20) {
  return prisma.$transaction(
    async (tx) => {
      // 1. 재시도 대상 항목 조회
      const entries = await tx.mabizSyncDLQ.findMany({
        where: {
          status: DLQ_STATUS.PENDING,
          nextRetryAt: { lte: new Date() },
        },
        orderBy: { nextRetryAt: 'asc' },
        take: limit,
      });

      if (entries.length === 0) {
        return [];
      }

      // 2. 조회한 항목들을 PROCESSING으로 변경 (트랜잭션 내에서 원자적)
      // 이렇게 하면 다른 Cron이 같은 항목을 동시 처리할 수 없음
      const entryIds = entries.map((e) => e.id);
      await tx.mabizSyncDLQ.updateMany({
        where: { id: { in: entryIds } },
        data: { status: DLQ_STATUS.PROCESSING },
      });

      return entries;
    },
    {
      // RepeatableRead: 트랜잭션 시작 후 다른 트랜잭션의 변경을 읽지 않음
      // Race Condition 방지 + 성능 균형
      isolationLevel: 'RepeatableRead',
      timeout: 35_000, // 웹훅 재시도(최대 30s) + 여유 5s
    },
  );
}

/**
 * [성능] DLQ 항목을 배치 단위로 병렬 처리
 *
 * 왜? 순차 처리 대신 5개씩 동시 처리하면 50초→4초로 단축
 *
 * @param entries - 재시도 대상 항목들
 * @param concurrency - 동시 처리 개수 (기본값 5)
 * @returns { resolved, failed } - 성공/실패 개수
 *
 * 예시:
 * - 20개 항목, concurrency=5
 * - Batch 1: entries[0-4] 동시 처리
 * - Batch 2: entries[5-9] 동시 처리 (Batch 1 완료 후)
 * - ...
 * - 예상 시간: 4초 (각 배치 1초, 총 4개 배치)
 */
export async function retryDLQEntriesBatch(
  entries: Awaited<ReturnType<typeof getPendingDLQEntries>>,
  concurrency = 5,
): Promise<{ resolved: number; failed: number }> {
  let resolved = 0;
  let failed = 0;

  // concurrency개씩 배치로 나누기
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);

    // 배치 내 모든 항목을 동시에 처리
    const promises = batch.map(entry => retryDLQEntry(entry));

    // 모든 Promise 완료 대기 (하나라도 실패해도 계속)
    const results = await Promise.allSettled(promises);

    // 결과 집계
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        if (r.value.success) {
          resolved++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    });
  }

  return { resolved, failed };
}

/**
 * [내부] 단일 DLQ 항목 재시도 (배치에서 호출됨)
 *
 * retryDLQEntriesBatch()의 내부 헬퍼 함수
 * 각 항목별로 fetch() 실행 후 상태 업데이트
 */
async function retryDLQEntry(entry: Awaited<ReturnType<typeof getPendingDLQEntries>>[number]): Promise<{ success: boolean }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const webhookUrl = `${baseUrl}/api/webhooks/${entry.webhookType}`;
    const webhookSecret = getWebhookSecret(entry.webhookType);

    if (!webhookSecret) {
      await failDLQ(entry.id, entry.retryCount, `시크릿 미설정: ${entry.webhookType}`);
      return { success: false };
    }

    let res: Response;

    if ((entry as unknown as { format?: string }).format === 'form-data') {
      // form-data 복원 (PayApp 전용)
      const formData = new URLSearchParams();
      const payloadObj = entry.payload as Record<string, string | number | boolean>;
      Object.entries(payloadObj).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${webhookSecret}`,
        },
        body: formData.toString(),
      });
    } else {
      // JSON (기본)
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`,
        },
        body: JSON.stringify(entry.payload),
      });
    }

    if (res.ok) {
      await resolveDLQ(entry.id);
      return { success: true };
    } else {
      const text = await res.text().catch(() => 'unknown');
      await failDLQ(entry.id, entry.retryCount, `HTTP ${res.status}: ${text.slice(0, 200)}`);
      return { success: false };
    }
  } catch (err) {
    await failDLQ(entry.id, entry.retryCount, String(err));
    return { success: false };
  }
}

/**
 * 웹훅 타입별 시크릿 조회 (내부 헬퍼)
 */
function getWebhookSecret(webhookType: string): string | undefined {
  const map: Record<string, string | undefined> = {
    'purchase': process.env.MABIZ_PURCHASE_WEBHOOK_SECRET,
    'refund': process.env.MABIZ_REFUND_WEBHOOK_SECRET,
    'inquiry': process.env.MABIZ_INQUIRY_WEBHOOK_SECRET,
    'gold-inquiry': process.env.MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET,
    'partner-signup': process.env.MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET,
    'cruise-purchase': process.env.MABIZ_PURCHASE_WEBHOOK_SECRET,
    'payapp': process.env.MABIZ_PAYAPP_WEBHOOK_SECRET,
  };
  return map[webhookType];
}

/**
 * 문자열 길이 제한 (초과 시 truncate)
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '... (truncated)';
}
