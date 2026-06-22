/**
 * sms-queue.ts
 *
 * Redis 큐 → DB 직접 저장으로 교체
 * addSmsLog() 호출 즉시 SmsLog 테이블에 저장 (fire-and-forget)
 */

import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

interface SmsLogInput {
  organizationId: string;
  createdBy?: string; // P0-4: 발송자 userId
  contactId?: string | null;
  phone: string;
  msg: string;
  status: 'SENT' | 'FAILED' | 'BLOCKED';
  blockReason?: string | null;
  resultCode?: string | null;
  msgId?: string | null;
  channel: string;
}

/**
 * SMS 발송 후 로그 저장 (DB 직접 저장)
 * 실패해도 발송 자체에는 영향 없음
 */
export async function addSmsLog(logData: SmsLogInput): Promise<void> {
  try {
    await prisma.smsLog.create({
      data: {
        organizationId: logData.organizationId,
        createdBy: logData.createdBy,
        contactId: logData.contactId ?? null,
        phone: logData.phone,
        contentPreview: logData.msg.slice(0, 30),
        status: logData.status,
        blockReason: logData.blockReason ?? null,
        resultCode: logData.resultCode ?? null,
        msgId: logData.msgId ?? null,
        channel: logData.channel,
      },
    });
  } catch (err) {
    logger.warn('[SmsLog] DB 저장 실패 (발송에는 영향 없음)', { err });
  }
}

/** 하위 호환: 큐 처리 함수 — DB 직접 저장으로 교체되어 no-op */
export async function processSmsQueue(): Promise<void> {}

/** 하위 호환: 큐 상태 조회 — DB 직접 저장 모드임을 반환 */
export async function getSmsQueueStatus() {
  return { mode: 'direct-db', queueLength: 0, isProcessing: false };
}

/** 하위 호환: 큐 비우기 — no-op */
export async function clearSmsQueue(): Promise<void> {}
