import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * SMS 스케줄링 서비스
 * L3 렌즈 및 기타 자동화된 SMS 발송을 관리합니다.
 */

export interface ScheduledSmsInput {
  organizationId: string;
  contactId: string;
  phoneNumber: string;
  body: string;
  sendAt: Date;
  campaignType: 'L3_DIFFERENTIATION' | 'L0_REACTIVATION' | 'L1_PRICE' | 'L2_ANXIETY' | string;
  day: 0 | 1 | 2 | 3 | 7;
  metadata?: Record<string, any>;
}

/**
 * SMS를 ScheduledSms 테이블에 저장하고 스케줄 설정
 */
export async function sendScheduledSms(input: ScheduledSmsInput): Promise<string> {
  try {
    const scheduledSms = await prisma.scheduledSms.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        phoneNumber: input.phoneNumber,
        body: input.body,
        sendAt: input.sendAt,
        status: 'PENDING',
        campaignType: input.campaignType,
        metadata: {
          day: input.day,
          ...input.metadata,
        },
      },
      select: { id: true },
    });

    logger.log('[SMSSchedule] SMS 스케줄 생성', {
      smsId: scheduledSms.id,
      organizationId: input.organizationId,
      contactId: input.contactId,
      campaignType: input.campaignType,
      day: input.day,
      sendAt: input.sendAt.toISOString(),
    });

    return scheduledSms.id;
  } catch (e) {
    logger.error('[SMSSchedule] 오류', {
      error: e instanceof Error ? e.message : String(e),
      organizationId: input.organizationId,
      campaignType: input.campaignType,
    });
    throw e;
  }
}

/**
 * L3 렌즈 차별성 메시지를 고객에게 발송하는 헬퍼
 * 실제 SMS 발송은 cron job (sms-sender.ts)에서 처리
 */
export async function scheduleL3DifferentiationSequence(
  organizationId: string,
  contactId: string,
  phoneNumber: string,
  customerName: string,
  baseDelay: number = 0 // 분 단위
): Promise<string[]> {
  const now = new Date();
  const baseTime = new Date(now.getTime() + baseDelay * 60 * 1000);

  const smsIds: string[] = [];

  // Day 0: 경쟁사 비교 메시지 (즉시 + 30분 지연)
  smsIds.push(
    await sendScheduledSms({
      organizationId,
      contactId,
      phoneNumber,
      body: `안녕하세요! ${customerName}님이 경쟁사 크루즈와 비교해주셨군요.
호텔 여행과 크루즈의 구조적 차이를 명확히 설명해드릴게요.
[비교 자료 보기] 링크`,
      sendAt: new Date(baseTime.getTime() + 30 * 60 * 1000),
      campaignType: 'L3_DIFFERENTIATION',
      day: 0,
    })
  );

  // Day 1: 호텔 vs 크루즈 구조 설명
  smsIds.push(
    await sendScheduledSms({
      organizationId,
      contactId,
      phoneNumber,
      body: `${customerName}님, 호텔과 크루즈의 핵심 차이 아세요?

호텔: 매일 같은 로비 + 짐 싸기 + 새 호텔 체크인 = 번거로움 ❌
크루즈: 한 번만 짐 싸기 + 배가 당신을 옮김 + 7박 = 자유 ✅

더 자세한 설명이 필요하신가요? 짧은 전화로 말씀드릴게요.`,
      sendAt: new Date(baseTime.getTime() + 1 * 24 * 60 * 60 * 1000),
      campaignType: 'L3_DIFFERENTIATION',
      day: 1,
    })
  );

  // Day 2: 라이프스타일 가치 강조
  smsIds.push(
    await sendScheduledSms({
      organizationId,
      contactId,
      phoneNumber,
      body: `${customerName}님의 가족을 위한 맞춤 크루즈를 준비했어요.

🏖️ 호텔 풀장 vs 우리 배 워터파크 (무료 액티비티 10+가지)
🍽️ 호텔 1가지 음식 vs 우리 10가지 레스토랑 (전부 포함)
👨‍👩‍👧‍👦 매일 함께하는 가족 프로그램 (키즈클럽 전문가)

지금 예약하면 20% 할인!`,
      sendAt: new Date(baseTime.getTime() + 2 * 24 * 60 * 60 * 1000),
      campaignType: 'L3_DIFFERENTIATION',
      day: 2,
    })
  );

  // Day 3: 최종 클로징 메시지
  smsIds.push(
    await sendScheduledSms({
      organizationId,
      contactId,
      phoneNumber,
      body: `${customerName}님, 결정하세요.

Royal Caribbean $3,000 x 1박 = 1박당 $3,000
우리 크루즈 $1,500 x 7박 = 1박당 $214 (가족 모두 포함)

호텔에서 쉬실까요? 아니면 리조트처럼 편한 배에서 여행할까요?

[지금 예약하기]`,
      sendAt: new Date(baseTime.getTime() + 3 * 24 * 60 * 60 * 1000),
      campaignType: 'L3_DIFFERENTIATION',
      day: 3,
    })
  );

  logger.log('[L3SequenceScheduled] 차별성 시퀀스 스케줄됨', {
    organizationId,
    contactId,
    smsCount: smsIds.length,
  });

  return smsIds;
}
