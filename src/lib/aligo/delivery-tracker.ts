/**
 * SMS 배송 추적 및 자동 재시도
 *
 * 기능:
 * - Aligo API를 통해 배송 상태 주기적 확인
 * - 실패한 SMS 자동 재시도 (최대 3회)
 * - ScheduledSms 상태 업데이트
 * - SmsLog 기록 (배송 결과)
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AligoClient, createAligoClient } from './client';
import { getAligoMessageType } from './batch-sender';
import type { ScheduledSms, Contact } from '@prisma/client';

export interface DeliveryTrackerResult {
  checked: number;
  updated: number;
  retried: number;
  errors: number;
}

type ScheduledSmsWithContact = ScheduledSms & {
  contact: Contact | null;
};

/**
 * 배송 상태 추적 워커
 * - 매시간 실행
 * - SENT 상태의 SMS 배송 상태 확인
 * - 실패한 경우 재시도
 */
export async function trackSmsDelivery(organizationId: string): Promise<DeliveryTrackerResult> {
  const result: DeliveryTrackerResult = {
    checked: 0,
    updated: 0,
    retried: 0,
    errors: 0,
  };

  try {
    // SMS 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      logger.warn('[DeliveryTracker] SMS 설정 없음 또는 비활성', { organizationId });
      return result;
    }

    const aligoClient = createAligoClient({
      apiKey: smsConfig.aligoKey,
      userId: smsConfig.aligoUserId,
      senderPhone: smsConfig.senderPhone,
    });

    // SENT 상태이며 sentAt이 1시간 이상 ~ 7일 이내인 SMS 조회
    const oneHourAgo  = new Date(Date.now() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sentSms = await prisma.scheduledSms.findMany({
      where: {
        organizationId,
        status: 'SENT',
        sentAt: { gte: sevenDaysAgo, lte: oneHourAgo },
      },
      take: 100, // 배치 처리
    });

    result.checked = sentSms.length;

    // 각 SMS의 배송 상태 확인
    for (const sms of sentSms) {
      try {
        // P1-18: sentAt 정확 일치 대신 ±30초 범위 조회 — createdAt 오차로 msgId가 항상 null이던 문제 수정
        const sentAt = sms.sentAt;
        if (!sentAt) {
          logger.warn('[DeliveryTracker] sentAt 없음 — 건너뜀', { smsId: sms.id });
          continue;
        }
        const from = new Date(sentAt.getTime() - 30_000); // 30초 전
        const to   = new Date(sentAt.getTime() + 30_000); // 30초 후
        const smsLog = await prisma.smsLog.findFirst({
          where: {
            organizationId,
            contactId: sms.contactId,
            sentAt: { gte: from, lte: to },
            msgId: { not: null },
          },
          orderBy: { sentAt: 'desc' },
          select: { msgId: true, phone: true },
        });

        if (!smsLog || !smsLog.msgId) {
          logger.warn('[DeliveryTracker] msgId 없음', { smsId: sms.id });
          continue;
        }

        // Aligo API로 배송 상태 조회
        const deliveryStatus = await aligoClient.getDeliveryStatus({
          msgId: smsLog.msgId,
          receiver: smsLog.phone,
        });

        if (!deliveryStatus) {
          logger.warn('[DeliveryTracker] 배송 상태 조회 실패', { msgId: smsLog.msgId });
          continue;
        }

        // ScheduledSms 상태 업데이트
        let newStatus = 'SENT';
        if (deliveryStatus.status === 'DELIVERED') {
          newStatus = 'DELIVERED';
        } else if (deliveryStatus.status === 'FAILED' || deliveryStatus.status === 'BOUNCED') {
          newStatus = 'FAILED';
        }

        await prisma.scheduledSms.update({
          where: { id: sms.id },
          data: {
            status: newStatus,
            updatedAt: new Date(),
          },
        });

        result.updated++;

        // 실패한 경우 재시도 고려
        if (newStatus === 'FAILED') {
          const retried = await retryFailedSms(sms.id, organizationId);
          if (retried) {
            result.retried++;
          }
        }

        logger.log('[DeliveryTracker] 배송 상태 업데이트', {
          smsId: sms.id,
          msgId: smsLog.msgId,
          status: newStatus,
        });
      } catch (error) {
        logger.error('[DeliveryTracker] 배송 상태 확인 오류', {
          smsId: sms.id,
          error: error instanceof Error ? error.message : String(error),
        });
        result.errors++;
      }
    }

    logger.log('[DeliveryTracker] 작업 완료', result);
    return result;
  } catch (error) {
    logger.error('[DeliveryTracker] 전체 오류', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    result.errors++;
    return result;
  }
}

/**
 * 실패한 SMS 자동 재시도
 */
async function retryFailedSms(smsId: string, organizationId: string): Promise<boolean> {
  try {
    const scheduledSms = await prisma.scheduledSms.findUnique({
      where: { id: smsId },
    });

    if (!scheduledSms) {
      logger.warn('[RetryFailedSms] SMS 정보 없음', { smsId });
      return false;
    }

    // Contact 정보 별도 로드
    const contact = scheduledSms.contactId
      ? await prisma.contact.findUnique({
          where: { id: scheduledSms.contactId },
          select: { phone: true },
        })
      : null;

    if (!contact?.phone) {
      logger.warn('[RetryFailedSms] 연락처 정보 없음', { smsId });
      return false;
    }

    // 재시도 횟수 확인 (최대 3회)
    const retryCount = scheduledSms.failedCount || 0;
    if (retryCount >= 3) {
      logger.warn('[RetryFailedSms] 최대 재시도 횟수 초과', { smsId, retryCount });
      return false;
    }

    // SMS 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      logger.warn('[RetryFailedSms] SMS 설정 없음', { organizationId });
      return false;
    }

    const aligoClient = createAligoClient({
      apiKey: smsConfig.aligoKey,
      userId: smsConfig.aligoUserId,
      senderPhone: smsConfig.senderPhone,
    });

    // 재발송
    const response = await aligoClient.sendSms({
      receiver: scheduledSms.contact.phone,
      message: scheduledSms.message,
      messageType: getAligoMessageType(scheduledSms.message),
    });

    if (response.resultCode === 1) {
      // 성공 — P1-19: failedCount를 0으로 리셋하지 않고 시도 횟수 누적 유지
      // (리셋 시 3회 제한이 우회되어 무한 재시도 가능)
      await prisma.scheduledSms.update({
        where: { id: smsId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          failedCount: retryCount + 1, // 성공해도 시도 횟수 보존
          updatedAt: new Date(),
        },
      });

      // SmsLog 기록
      await prisma.smsLog.create({
        data: {
          organizationId,
          contactId: scheduledSms.contactId,
          phone: scheduledSms.contact.phone,
          contentPreview: scheduledSms.message.slice(0, 100),
          msg: scheduledSms.message,
          status: 'SENT',
          msgId: response.msgId,
          channel: `RETRY_${retryCount + 1}`,
        },
      });

      logger.log('[RetryFailedSms] 재시도 성공', {
        smsId,
        retryCount: retryCount + 1,
        msgId: response.msgId,
      });

      return true;
    } else {
      // 실패 - failedCount 증가
      await prisma.scheduledSms.update({
        where: { id: smsId },
        data: {
          failedCount: retryCount + 1,
          updatedAt: new Date(),
        },
      });

      logger.warn('[RetryFailedSms] 재시도 실패', {
        smsId,
        retryCount: retryCount + 1,
        resultCode: response.resultCode,
        message: response.message,
      });

      return false;
    }
  } catch (error) {
    logger.error('[RetryFailedSms] 오류', {
      smsId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * 모든 조직의 배송 상태 추적
 * (Cron Job에서 호출)
 */
export async function trackAllSmsDelivery(): Promise<Record<string, DeliveryTrackerResult>> {
  const organizations = await prisma.organization.findMany({
    select: { id: true },
  });

  const results: Record<string, DeliveryTrackerResult> = {};

  for (const org of organizations) {
    try {
      results[org.id] = await trackSmsDelivery(org.id);
    } catch (error) {
      logger.error('[trackAllSmsDelivery] 조직 처리 실패', {
        organizationId: org.id,
        error: error instanceof Error ? error.message : String(error),
      });
      results[org.id] = { checked: 0, updated: 0, retried: 0, errors: 1 };
    }
  }

  logger.log('[trackAllSmsDelivery] 완료', results);
  return results;
}
