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

/**
 * Aligo EUC-KR 바이트 기준 LMS/SMS 분류
 * 한글 1자 = 2바이트, ASCII 1자 = 1바이트
 * 80바이트 초과 시 LMS
 */
export function getAligoMessageType(msg: string): 'SMS' | 'LMS' {
  let bytes = 0;
  for (const ch of msg) {
    bytes += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return bytes > 80 ? 'LMS' : 'SMS';
}

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
      orderBy: { scheduledAt: 'asc' },
      take: maxItems,
    });

    // 연락처 정보 배치 로드 (contactId가 있는 경우만)
    const contactIds = pendingSms
      .filter((sms): sms is typeof pendingSms[0] & { contactId: string } => !!sms.contactId)
      .map(sms => sms.contactId);

    const contacts = contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, phone: true, name: true, optOutAt: true },
        })
      : [];

    const contactMap = new Map(contacts.map(c => [c.id, c]));

    // SMS 객체에 연락처 정보 추가 (타입 호환성을 위해 contact 필드 추가)
    const pendingSmsWithContact = pendingSms.map(sms => ({
      ...sms,
      contact: sms.contactId ? contactMap.get(sms.contactId) ?? null : null,
    }));

    if (pendingSmsWithContact.length === 0) {
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

    // 배치 그룹 생성 (수신거부 및 야간 차단 분리)
    const validSms: typeof pendingSmsWithContact = [];
    const optOutBlocked: typeof pendingSmsWithContact = [];
    const nightBlocked: typeof pendingSmsWithContact = [];

    for (const sms of pendingSmsWithContact) {
      // 수신거부 확인 — 야간 여부와 무관하게 항상 BLOCKED
      if (sms.contact?.optOutAt) {
        optOutBlocked.push(sms);
        continue;
      }

      // 야간 발송 차단
      if (isNightTime) {
        nightBlocked.push(sms);
        result.nightBlocked = true;
        continue;
      }

      validSms.push(sms);
    }

    result.processed = pendingSmsWithContact.length;

    // 수신거부 SMS → BLOCKED
    if (optOutBlocked.length > 0) {
      await Promise.all(
        optOutBlocked.map(sms =>
          prisma.scheduledSms.update({
            where: { id: sms.id },
            data: { status: 'BLOCKED', updatedAt: new Date() },
          })
        )
      );
    }

    // 야간 차단 SMS → NIGHT_BLOCKED
    if (nightBlocked.length > 0) {
      await Promise.all(
        nightBlocked.map(sms =>
          prisma.scheduledSms.update({
            where: { id: sms.id },
            data: { status: 'NIGHT_BLOCKED', updatedAt: new Date() },
          })
        )
      );
    }

    if (validSms.length === 0) {
      return result;
    }

    // P1-17: 전화번호 없는 연락처 사전 필터링 — receiver 빈값으로 Aligo 전송 방지
    const phonelessSms = validSms.filter(sms => !sms.contact?.phone?.trim());
    if (phonelessSms.length > 0) {
      await Promise.allSettled(
        phonelessSms.map(sms =>
          prisma.scheduledSms.update({
            where: { id: sms.id },
            data: { status: 'FAILED', failureReason: '전화번호 없음', updatedAt: new Date() },
          })
        )
      );
      result.failed += phonelessSms.length;
      logger.warn('[BatchSender] 전화번호 없음 — 일괄 FAILED 처리', {
        organizationId,
        count: phonelessSms.length,
        ids: phonelessSms.map(s => s.id),
      });
    }
    const smsToSend = validSms.filter(sms => !!sms.contact?.phone?.trim());

    if (smsToSend.length === 0) {
      return result;
    }

    // 배치 발송 준비
    const batchRequests = smsToSend.map(sms => ({
      receiver: sms.contact?.phone || '',
      message: sms.message
        .replace(/\[고객명\]/g, sms.contact?.name || '고객님')
        .replace(/\[이름\]/g, sms.contact?.name || '고객님'),
      messageType: getAligoMessageType(
        sms.message
          .replace(/\[고객명\]/g, sms.contact?.name || '고객님')
          .replace(/\[이름\]/g, sms.contact?.name || '고객님')
      ),
    }));

    // Aligo 배치 발송
    const sendResponse = await aligoClient.sendSmsBatch(batchRequests);

    if (sendResponse.resultCode === 1) {
      // 배치 전체 성공
      result.sent = smsToSend.length;

      // P1-15 + P1-16: Promise.allSettled — 일부 DB 실패해도 전체 롤백하지 않고 개별 오류 집계
      const sentAt = new Date();
      const updateResults = await Promise.allSettled(
        smsToSend.map(sms =>
          prisma.scheduledSms.update({
            where: { id: sms.id, status: 'PENDING' },
            data: {
              status: 'SENT',
              sentAt,
              sentCount: 1,
              updatedAt: sentAt,
            },
          })
        )
      );

      // 개별 업데이트 실패 집계 — SENT로 처리됐지만 DB 기록 실패한 건 errors로 카운트
      const dbFailCount = updateResults.filter(r => r.status === 'rejected').length;
      if (dbFailCount > 0) {
        result.errors += dbFailCount;
        result.sent -= dbFailCount;
        logger.warn(`[BatchSender] DB 업데이트 실패: ${dbFailCount}건`);
        updateResults.forEach((r, i) => {
          if (r.status === 'rejected') {
            logger.error('[BatchSender] SENT 상태 업데이트 실패', {
              smsId: smsToSend[i].id,
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
          }
        });
      }

      logger.log('[BatchSender] 배치 발송 완료', {
        organizationId,
        count: smsToSend.length,
        msgId: sendResponse.msgId,
      });
    } else {
      // 부분 실패 또는 전체 실패
      result.failed += (sendResponse.failCount || smsToSend.length);
      result.sent = smsToSend.length - (sendResponse.failCount || smsToSend.length);

      // 개별 발송으로 재처리
      logger.warn('[BatchSender] 배치 발송 실패 → 개별 발송 재시도', {
        organizationId,
        failCount: result.failed,
      });

      const individualResults = await processIndividualSms(
        smsToSend,
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
      const resolvedMessage = sms.message
        .replace(/\[고객명\]/g, sms.contact?.name || '고객님')
        .replace(/\[이름\]/g, sms.contact?.name || '고객님');
      const response = await aligoClient.sendSms({
        receiver: sms.contact?.phone || '',
        message: resolvedMessage,
        messageType: getAligoMessageType(resolvedMessage),
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
            contentPreview: sms.message.slice(0, 100),
            msg: sms.message,
            status: 'SENT',
            msgId: response.msgId,
            channel: 'INDIVIDUAL_RETRY',
          },
        });

        // Aligo 개별 발송 rate limit 방지 (1건/초 기준 + 안전 마진)
        await new Promise<void>(r => setTimeout(r, 1200));
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
            contentPreview: sms.message.slice(0, 100),
            msg: sms.message,
            status: 'FAILED',
            blockReason: response.message,
            channel: 'INDIVIDUAL_RETRY',
          },
        });

        // Aligo 개별 발송 rate limit 방지 (1건/초 기준 + 안전 마진)
        await new Promise<void>(r => setTimeout(r, 1200));
        failed++;
      }
    } catch (error) {
      logger.error('[processIndividualSms] 오류', {
        smsId: sms.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Aligo 개별 발송 rate limit 방지 (1건/초 기준 + 안전 마진)
      await new Promise<void>(r => setTimeout(r, 1200));
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
