/**
 * Menu #38 Phase 4 Step 5-3: SMS 스케줄러 (메인)
 * 렌즈별 SMS 시퀀스를 자동으로 Day 0-3에 정확한 시간에 발송 스케줄링
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  LensType,
  ContactData,
  SmsScheduleStatus,
  ScheduleContactLensSequenceResult,
  ScheduledJob,
  SmsFailureReason,
  MessageBuildContext,
} from './types';
import { buildSmsMessage } from './message-builder';
import { LENS_SEQUENCE_MAP } from './sms-templates';

/**
 * 콜 종료 후 자동으로 SMS 시퀀스 스케줄링
 * Step 5-2의 자동분류 결과를 받아서 SMS 자동발송 일정을 생성
 *
 * @param contactId - 고객 ID
 * @param lensType - 렌즈 타입 (L1-L10)
 * @param organizationId - 조직 ID
 * @param startTime - 시작 시간 (기본: 현재 + 10분)
 * @param contactData - 고객 정보 (변수 치환용)
 * @returns 스케줄링 결과
 */
export async function scheduleContactLensSequence(
  contactId: string,
  lensType: LensType,
  organizationId: string,
  startTime?: Date,
  contactData?: Partial<ContactData>
): Promise<ScheduleContactLensSequenceResult> {
  const createdAt = new Date();

  try {
    // Step 1: 고객 정보 확인
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        age: true,
        type: true,
        departureDate: true,
        adminMemo: true,
      },
    });

    if (!contact) {
      return {
        contactId,
        lensType,
        status: 'SKIPPED',
        reason: '고객 정보를 찾을 수 없습니다.',
        scheduledJobs: [],
        totalMessages: 0,
        createdAt,
      };
    }

    // Step 2: 옵트아웃 확인
    const smsOptOut = await prisma.smsOptOut.findUnique({
      where: { phone: contact.phone },
    });

    if (smsOptOut) {
      return {
        contactId,
        lensType,
        status: 'SKIPPED',
        reason: 'SMS 수신거부 고객입니다.',
        scheduledJobs: [],
        totalMessages: 0,
        createdAt,
      };
    }

    // Step 3: 렌즈 시퀀스 확인
    const lensSequence = LENS_SEQUENCE_MAP[lensType as string];
    if (!lensSequence) {
      logger.warn(`[SMS Scheduler] 렌즈 시퀀스 없음: ${lensType}`);
      // 렌즈 시퀀스가 없어도 실패로 처리하지 않음 (나중에 플레이스홀더 사용)
    }

    // Step 4: 시작 시간 결정
    const baseTime = startTime || new Date(Date.now() + 10 * 60 * 1000); // 기본: 10분 후

    // Step 5: 고객 데이터 구성
    const builtContactData: ContactData = {
      contactId,
      name: contact.name,
      phone: contact.phone,
      age: contact.age === null ? undefined : contact.age,
      lensType,
      ...contactData,
    };

    // Step 6: 각 Day별 메시지 생성 및 스케줄 생성
    const scheduledJobs: ScheduledJob[] = [];
    const dayOffsets = lensSequence?.templates ? Object.keys(lensSequence.templates).length : 1;

    // 렌즈 시퀀스의 Day 정보 추출
    const dayNumbers: (0 | 1 | 2 | 3)[] = [];
    if (lensSequence) {
      lensSequence.templates.day_0 && dayNumbers.push(0);
      lensSequence.templates.day_1 && dayNumbers.push(1);
      lensSequence.templates.day_2 && dayNumbers.push(2);
      lensSequence.templates.day_3 && dayNumbers.push(3);
    } else {
      dayNumbers.push(0); // 기본값
    }

    for (const day of dayNumbers) {
      // 스케줄 시간 계산
      let scheduledAt: Date;
      if (day === 0) {
        // Day 0: 시작 시간 + 지연값
        const delayMinutes = lensSequence?.day0_delay_minutes || 10;
        scheduledAt = new Date(baseTime.getTime() + delayMinutes * 60 * 1000);
      } else {
        // Day 1-3: 24시간 간격
        scheduledAt = new Date(baseTime.getTime() + day * 24 * 60 * 60 * 1000);
      }

      try {
        // 메시지 생성
        const context: MessageBuildContext = {
          lensType,
          day,
          contactData: builtContactData,
        };

        const messageResult = await buildSmsMessage(context);

        if (!messageResult.success) {
          logger.warn(`[SMS Scheduler] 메시지 생성 실패: ${contactId} Day ${day}`, {
            error: messageResult.error,
            message: messageResult.errorMessage,
          });
          continue;
        }

        // SendingHistory에 레코드 생성
        const sendingHistory = await prisma.sendingHistory.create({
          data: {
            organizationId,
            sendingType: 'AUTOMATION', // 자동화 규칙
            sourceId: `lens:${lensType}:day${day}`,
            contactId,
            phone: contact.phone,
            email: contact.email || null,
            channel: 'SMS',
            body: messageResult.messageContent!,
            status: 'PENDING',
            scheduledAt,
            retryCount: 0,
            maxRetries: 3,
            metadata: {
              lensType,
              day,
              psychologyTag: lensSequence?.templates?.[`day_${day}` as keyof typeof lensSequence.templates]?.psychologyTag,
              messageLength: messageResult.messageLength,
              warnings: messageResult.warnings,
            },
          },
        });

        scheduledJobs.push({
          day,
          scheduledAt,
          status: SmsScheduleStatus.SCHEDULED,
        });

        logger.log(`[SMS Scheduler] 메시지 스케줄됨: ${contactId} Day ${day}`, {
          sendingHistoryId: sendingHistory.id,
          scheduledAt: scheduledAt.toISOString(),
          messageLength: messageResult.messageLength,
        });
      } catch (error) {
        logger.error(`[SMS Scheduler] Day ${day} 스케줄 생성 실패: ${contactId}`, { error });
        continue;
      }
    }

    // Step 7: 결과 반환
    if (scheduledJobs.length === 0) {
      return {
        contactId,
        lensType,
        status: 'FAILED',
        reason: '스케줄할 메시지가 없습니다.',
        scheduledJobs: [],
        totalMessages: 0,
        createdAt,
      };
    }

    return {
      contactId,
      lensType,
      status: 'SCHEDULED',
      scheduledJobs,
      totalMessages: scheduledJobs.length,
      createdAt,
    };
  } catch (error) {
    logger.error(`[SMS Scheduler] 예상치 못한 오류: ${contactId}`, { error });
    return {
      contactId,
      lensType,
      status: 'FAILED',
      reason: `시스템 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      scheduledJobs: [],
      totalMessages: 0,
      createdAt,
    };
  }
}

/**
 * 렌즈 타입 변경 시 기존 스케줄 취소 및 새로 생성
 * (고객이 특정 렌즈로 재분류될 경우)
 */
export async function rescheduleContactLensSequence(
  contactId: string,
  newLensType: LensType,
  organizationId: string
): Promise<ScheduleContactLensSequenceResult> {
  try {
    // Step 1: 기존 SendingHistory의 스케줄 취소 (PENDING만 취소)
    await prisma.sendingHistory.updateMany({
      where: {
        contactId,
        organizationId,
        status: 'PENDING',
        sourceId: {
          startsWith: 'lens:',
        },
      },
      data: {
        status: 'SKIPPED',
        failureReason: 'OPT_OUT',
      },
    });

    logger.log(`[SMS Scheduler] 기존 스케줄 취소: ${contactId}`, {
      newLensType,
    });

    // Step 2: 새로운 렌즈로 스케줄 생성
    return await scheduleContactLensSequence(contactId, newLensType, organizationId);
  } catch (error) {
    logger.error(`[SMS Scheduler] 렌즈 변경 스케줄 실패: ${contactId}`, { error });
    return {
      contactId,
      lensType: newLensType,
      status: 'FAILED',
      reason: `렌즈 변경 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      scheduledJobs: [],
      totalMessages: 0,
      createdAt: new Date(),
    };
  }
}

/**
 * 고객 예약 후 SMS 스케줄 중단
 * (고객이 예약을 완료하면 남은 스케줄 취소)
 */
export async function cancelLensSequenceSchedule(
  contactId: string,
  organizationId: string,
  reason: string = 'CUSTOMER_CONVERSION'
): Promise<{ cancelled: number }> {
  try {
    const result = await prisma.sendingHistory.updateMany({
      where: {
        contactId,
        organizationId,
        status: 'PENDING',
        sourceId: {
          startsWith: 'lens:',
        },
      },
      data: {
        status: 'SKIPPED',
        failureReason: 'OPT_OUT',
        metadata: {
          skipReason: reason,
        },
      },
    });

    logger.log(`[SMS Scheduler] SMS 스케줄 취소: ${contactId}`, {
      cancelled: result.count,
      reason,
    });

    return { cancelled: result.count };
  } catch (error) {
    logger.error(`[SMS Scheduler] SMS 취소 실패: ${contactId}`, { error });
    return { cancelled: 0 };
  }
}

/**
 * Cron 작업: 스케줄된 SMS 발송
 * 정해진 시간이 되면 실제 발송 수행
 */
export async function processPendingSmsSchedules(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  try {
    const now = new Date();

    // PENDING 상태 + 스케줄 시간 도달한 메시지 조회
    const pendingMessages = await prisma.sendingHistory.findMany({
      where: {
        status: 'PENDING',
        channel: 'SMS',
        scheduledAt: {
          lte: now,
        },
        sourceId: {
          startsWith: 'lens:',
        },
      },
      take: 100, // 배치 처리
    });

    let sent = 0;
    let failed = 0;

    for (const msg of pendingMessages) {
      try {
        // 실제 SMS 발송 로직 (알리고 API 호출)
        // 향후 Step 5-3-B에서 구현
        const result = await sendSmsViaAligo(msg);

        if (result.success) {
          await prisma.sendingHistory.update({
            where: { id: msg.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              messageId: result.messageId,
            },
          });
          sent++;
        } else {
          // 재시도 스케줄
          const nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000); // 5분 후
          const mappedReason = result.failureReason ? mapSmsToSendingFailureReason(result.failureReason) : undefined;
          await prisma.sendingHistory.update({
            where: { id: msg.id },
            data: {
              status: 'RETRY_SCHEDULED',
              retryCount: msg.retryCount + 1,
              nextRetryAt,
              failureReason: mappedReason,
            },
          });
          failed++;
        }
      } catch (error) {
        logger.error(`[SMS Cron] 개별 발송 실패: ${msg.id}`, { error });
        failed++;
      }
    }

    logger.log('[SMS Cron] SMS 발송 배치 완료', {
      processed: pendingMessages.length,
      sent,
      failed,
    });

    return { processed: pendingMessages.length, sent, failed };
  } catch (error) {
    logger.error('[SMS Cron] Cron 작업 실패', { error });
    return { processed: 0, sent: 0, failed: 0 };
  }
}

/**
 * 알리고 API를 통한 SMS 발송 (스텁)
 * 실제 구현은 Step 5-3-B에서
 */
async function sendSmsViaAligo(message: any): Promise<{
  success: boolean;
  messageId?: string;
  failureReason?: SmsFailureReason;
}> {
  // TODO: Step 5-3-B에서 실제 알리고 API 호출 구현
  logger.log('[SMS Aligo] SMS 발송 시뮬레이션', {
    phone: message.phone,
    length: message.body.length,
  });

  // 시뮬레이션용 성공 반환
  return {
    success: true,
    messageId: `msg_${Date.now()}`,
  };
}

function mapSmsToSendingFailureReason(smsReason: SmsFailureReason): import('@prisma/client').SendingFailureReason {
  switch (smsReason) {
    case SmsFailureReason.INVALID_PHONE:
      return 'INVALID_PHONE';
    case SmsFailureReason.OPT_OUT:
    case SmsFailureReason.CONTACT_OPT_OUT:
      return 'OPT_OUT';
    case SmsFailureReason.QUOTA_EXCEEDED:
      return 'QUOTA_EXCEEDED';
    case SmsFailureReason.SYSTEM_ERROR:
    case SmsFailureReason.CONTACT_DELETED:
    case SmsFailureReason.MESSAGE_BUILD_FAILED:
    case SmsFailureReason.TEMPLATE_NOT_FOUND:
    case SmsFailureReason.INVALID_VARIABLES:
      return 'SYSTEM_ERROR';
    case SmsFailureReason.PROVIDER_ERROR:
      return 'PROVIDER_ERROR';
    case SmsFailureReason.NETWORK_ERROR:
      return 'NETWORK_ERROR';
    default:
      return 'SYSTEM_ERROR';
  }
}
