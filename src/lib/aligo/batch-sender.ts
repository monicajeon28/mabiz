/**
 * Aligo 배치 SMS 발송
 *
 * 기능:
 * - 대량 SMS 발송 (최대 1000건/회)
 * - PENDING 상태 SMS 처리
 * - 야간 발송 차단 (21:00 ~ 08:00 KST)
 * - SmsLog 기록
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AligoClient, createAligoClient } from './client';

export interface BatchSenderResult {
  processed: number;
  sent: number;
  failed: number;
  nightBlocked: boolean;
  errors: number;
}

/**
 * PENDING 상태 SMS 배치 발송
 * - Cron Job (scheduled-sms)에서 호출
 * - 최대 50건 처리 (제한 내)
 */
export async function processPendingSms(
  organizationId: string,
  maxItems: number = 50
): Promise<BatchSenderResult> {
  const result: BatchSenderResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    nightBlocked: false,
    errors: 0,
  };

  try {
    // 야간 발송 차단 확인 (21:00 ~ 08:00 KST)
    const isNightTime = isNightSmsBlocked();

    // PENDING 상태 SMS 조회
    const pendingSms = await prisma.scheduledSms.findMany({
      where: {
        organizationId,
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
      },
      include: {
        contact: { select: { id: true, phone: true, name: true, optOutAt: true } },
        organization: { select: { id: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: maxItems,
    });

    if (pendingSms.length === 0) {
      return result;
    }

    // SMS 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      logger.warn('[BatchSender] SMS 설정 없음', { organizationId });
      result.errors++;
      return result;
    }

    const aligoClient = createAligoClient({
      apiKey: smsConfig.aligoKey,
      userId: smsConfig.aligoUserId,
      senderPhone: smsConfig.senderPhone,
    });

    // 배치 그룹 생성 (수신거부 및 야간 차단 제외)
    const validSms: typeof pendingSms = [];
    const blockedSms: typeof pendingSms = [];

    for (const sms of pendingSms) {
      // 수신거부 확인
      if (sms.contact?.optOutAt) {
        blockedSms.push(sms);
        continue;
      }

      // 야간 발송 차단
      if (isNightTime) {
        blockedSms.push(sms);
        result.nightBlocked = true;
        continue;
      }

      validSms.push(sms);
    }

    result.processed = pendingSms.length;

    // 차단된 SMS 상태 업데이트
    if (blockedSms.length > 0) {
      const blockStatus = isNightTime ? 'NIGHT_BLOCKED' : 'BLOCKED';
      await Promise.all(
        blockedSms.map(sms =>
          prisma.scheduledSms.update({
            where: { id: sms.id },
            data: {
              status: blockStatus,
              updatedAt: new Date(),
            },
          })
        )
      );
    }

    if (validSms.length === 0) {
      return result;
    }

    // 배치 발송 준비
    const batchRequests = validSms.map(sms => ({
      receiver: sms.contact?.phone || '',
      message: sms.message
        .replace(/\[고객명\]/g, sms.contact?.name || '고객님')
        .replace(/\[이름\]/g, sms.contact?.name || '고객님'),
      messageType: sms.message.length > 80 ? ('LMS' as const) : ('SMS' as const),
    }));

    // Aligo 배치 발송
    const sendResponse = await aligoClient.sendSmsBatch(batchRequests);

    if (sendResponse.resultCode === 1) {
      // 배치 전체 성공
      result.sent = validSms.length;

      // ScheduledSms 상태 업데이트
      await Promise.all(
        validSms.map(sms =>
          prisma.scheduledSms.update({
            where: { id: sms.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              sentCount: 1,
              updatedAt: new Date(),
            },
          })
        )
      );

      logger.log('[BatchSender] 배치 발송 완료', {
        organizationId,
        count: validSms.length,
        msgId: sendResponse.msgId,
      });
    } else {
      // 부분 실패 또는 전체 실패
      result.failed = (sendResponse.failCount || validSms.length);
      result.sent = validSms.length - result.failed;

      // 개별 발송으로 재처리
      logger.warn('[BatchSender] 배치 발송 실패 → 개별 발송 재시도', {
        organizationId,
        failCount: result.failed,
      });

      const individualResults = await processIndividualSms(
        validSms,
        aligoClient,
        organizationId
      );

      result.sent = individualResults.sent;
      result.failed = individualResults.failed;
    }

    return result;
  } catch (error) {
    logger.error('[BatchSender] 전체 오류', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    result.errors++;
    return result;
  }
}

/**
 * 개별 SMS 발송 (배치 실패 시)
 */
async function processIndividualSms(
  smsList: any[],
  aligoClient: AligoClient,
  organizationId: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const sms of smsList) {
    try {
      const response = await aligoClient.sendSms({
        receiver: sms.contact?.phone || '',
        message: sms.message
          .replace(/\[고객명\]/g, sms.contact?.name || '고객님')
          .replace(/\[이름\]/g, sms.contact?.name || '고객님'),
        messageType: sms.message.length > 80 ? 'LMS' : 'SMS',
      });

      if (response.resultCode === 1) {
        // 성공
        await prisma.scheduledSms.update({
          where: { id: sms.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            sentCount: 1,
            updatedAt: new Date(),
          },
        });

        // SmsLog 기록
        await prisma.smsLog.create({
          data: {
            organizationId,
            contactId: sms.contactId,
            phone: sms.contact?.phone || '',
            msg: sms.message,
            status: 'SENT',
            msgId: response.msgId,
            channel: 'INDIVIDUAL_RETRY',
          },
        });

        sent++;
      } else {
        // 실패
        await prisma.scheduledSms.update({
          where: { id: sms.id },
          data: {
            status: 'FAILED',
            failureReason: response.message,
            failedCount: 1,
            updatedAt: new Date(),
          },
        });

        // SmsLog 기록
        await prisma.smsLog.create({
          data: {
            organizationId,
            contactId: sms.contactId,
            phone: sms.contact?.phone || '',
            msg: sms.message,
            status: 'FAILED',
            blockReason: response.message,
            channel: 'INDIVIDUAL_RETRY',
          },
        });

        failed++;
      }
    } catch (error) {
      logger.error('[processIndividualSms] 오류', {
        smsId: sms.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * 야간 발송 차단 확인 (21:00 ~ 08:00 KST)
 */
function isNightSmsBlocked(): boolean {
  // 서버가 UTC인 경우 KST = UTC + 9
  const kstHour = (new Date().getUTCHours() + 9) % 24;
  return kstHour >= 21 || kstHour < 8;
}

/**
 * 모든 조직의 PENDING SMS 처리
 * (Cron Job에서 호출)
 */
export async function processAllPendingSms(): Promise<Record<string, BatchSenderResult>> {
  const organizations = await prisma.organization.findMany({
    select: { id: true },
  });

  const results: Record<string, BatchSenderResult> = {};

  for (const org of organizations) {
    try {
      results[org.id] = await processPendingSms(org.id);
    } catch (error) {
      logger.error('[processAllPendingSms] 조직 처리 실패', {
        organizationId: org.id,
        error: error instanceof Error ? error.message : String(error),
      });
      results[org.id] = {
        processed: 0,
        sent: 0,
        failed: 0,
        nightBlocked: false,
        errors: 1,
      };
    }
  }

  logger.log('[processAllPendingSms] 완료', results);
  return results;
}
