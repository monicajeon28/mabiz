/**
 * email-queue.ts
 *
 * Redis 큐 → DB 직접 저장으로 교체
 * addEmailLog() 호출 즉시 EmailLog 테이블에 저장 (fire-and-forget)
 */

import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

interface EmailLogInput {
  organizationId: string;
  contactId?: string | null;
  email: string;
  subject: string;
  status: 'SENT' | 'FAILED' | 'BLOCKED';
  blockReason?: string | null;
  channel: string;
}

/**
 * 이메일 발송 후 로그 저장 (DB 직접 저장)
 * 실패해도 발송 자체에는 영향 없음
 */
export async function addEmailLog(logData: EmailLogInput): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        organizationId: logData.organizationId,
        contactId: logData.contactId ?? null,
        email: (logData.email.slice(0, 5) + '***').slice(0, 100),
        subjectPreview: logData.subject.slice(0, 50),
        status: logData.status,
        blockReason: logData.blockReason ?? null,
        channel: logData.channel,
      },
    });
  } catch (err) {
    logger.warn('[EmailLog] DB 저장 실패 (발송에는 영향 없음)', { err });
  }
}

/** 하위 호환: 큐 처리 함수 — DB 직접 저장으로 교체되어 no-op */
export async function processEmailQueue(): Promise<void> {}

/** 하위 호환: 큐 상태 조회 — DB 직접 저장 모드임을 반환 */
export async function getEmailQueueStatus() {
  return { mode: 'direct-db', queueLength: 0, isProcessing: false };
}

/** 하위 호환: 큐 비우기 — no-op */
export async function clearEmailQueue(): Promise<void> {}
