import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Loop 5: Contact Form 유입 → Day 0-3 자동화 SMS/Email
 *
 * Segment별 심리학 기반 메시지 생성 및 자동 발송
 * PASONA Framework + Grant Cardone 10렌즈 통합
 */

// Segment 정의 (age × preference)
export type Segment = 'A' | 'B' | 'C' | 'D' | 'E';
export type Day = 'day0' | 'day1' | 'day2' | 'day3';
export type DayNumber = 0 | 1 | 2 | 3;
export type ABVariant = 'a' | 'b';

interface SMSTemplateInput {
  segment: Segment;
  day: DayNumber;
  variant?: ABVariant;
  contactData?: {
    name: string;
    ageRange?: string;
    preferenceType?: string;
  };
}

export interface SmsSendResult {
  success: boolean;
  smsId?: string;
  error?: string;
  retryable: boolean;
}

/**
 * Aligo REST API를 통한 SMS 발송
 * @see https://aligo.in/api/send/
 *
 * P0-1: 환경변수 검증 강화
 */
async function sendSmsWithAligo(
  aligoUserId: string,
  aligoKey: string,
  senderPhone: string,
  recipientPhone: string,
  message: string
): Promise<SmsSendResult> {
  try {
    // P0-1: 필수 매개변수 검증
    if (!aligoUserId || !aligoKey) {
      logger.error('[Loop5 SMS] 필수 인증 정보 누락', {
        hasUserId: !!aligoUserId,
        hasKey: !!aligoKey,
      });
      return {
        success: false,
        error: 'Loop5 SMS: Aligo 인증 정보 누락 (user_id 또는 key 없음)',
        retryable: false,
      };
    }

    if (!senderPhone || !recipientPhone) {
      logger.error('[Loop5 SMS] 전화번호 누락', {
        hasSenderPhone: !!senderPhone,
        hasRecipientPhone: !!recipientPhone,
      });
      return {
        success: false,
        error: 'Loop5 SMS: 송신자 또는 수신자 전화번호 없음',
        retryable: false,
      };
    }

    if (!message || message.trim().length === 0) {
      logger.error('[Loop5 SMS] 메시지 내용 없음');
      return {
        success: false,
        error: 'Loop5 SMS: 메시지 내용 필수',
        retryable: false,
      };
    }

    const formData = new URLSearchParams();
    formData.append('user_id', aligoUserId);
    formData.append('key', aligoKey);
    formData.append('sender', senderPhone);
    formData.append('receiver', recipientPhone);
    formData.append('msg', message);
    formData.append('msg_type', 'SMS');

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000), // 30초 타임아웃
    });

    const data = await response.json() as { success?: boolean; msg_id?: string; error?: string; code?: string };

    if (!data.success) {
      logger.warn('[Loop5 SMS] 발송 실패', {
        recipientPhone,
        error: data.error || 'Unknown error',
        code: data.code,
      });

      const retryable =
        !data.code || // 네트워크 오류
        data.code === '10' || // 일시적 오류
        data.code === '11'; // 서버 오류

      return {
        success: false,
        error: data.error || 'Unknown error',
        retryable,
      };
    }

    logger.log('[Loop5 SMS] 발송 성공', {
      recipientPhone,
      smsId: data.msg_id,
    });

    return {
      success: true,
      smsId: data.msg_id,
      retryable: false,
    };
  } catch (error: unknown) {
    logger.error('[Loop5 SMS] 네트워크 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      retryable: true,
    };
  }
}

/**
 * Segment별 Day N 메시지 생성
 * PASONA + 심리학 렌즈 통합
 */
export function generateDayNMessage(
  segment: Segment,
  day: DayNumber,
  variant: ABVariant = 'a',
  contactName?: string
): string {
  const name = contactName ? contactName.split(' ')[0] : '고객님';

  // Segment별 특성
  const segmentProfiles: Record<Segment, { title: string; tension: string; offer: string }> = {
    A: {
      title: '20-30대 신혼 로맨틱',
      tension: '배우자와의 특별한 추억',
      offer: '프리미엄 허니문 패키지 -50%',
    },
    B: {
      title: '40-50대 가족 단란',
      tension: '자녀와의 소중한 추억',
      offer: '패밀리 크루즈 4인 정가 패키지',
    },
    C: {
      title: '50-60대 문화 여행',
      tension: '세계 문화 경험의 기회',
      offer: '유럽 16개 항구 탐방 패키지',
    },
    D: {
      title: '60세+ 럭셀리 경험',
      tension: '인생 마지막 우아한 경험',
      offer: '소수정원 VIP 크루즈 -30%',
    },
    E: {
      title: '70세+ 특별 케어',
      tension: '건강하고 안전한 휴식',
      offer: '시니어 맞춤 의료 동반 크루즈',
    },
  };

  const profile = segmentProfiles[segment];

  // Day별 PASONA 단계 메시지
  const templates: Record<DayNumber, Record<ABVariant, string>> = {
    // Day 0: P(Problem) + A(Agitate) — 공감 + 자극
    0: {
      a: `${name}님, 크루즈닷이에요.\n${profile.tension}를 원하시나요? 🚢\n내일 오후 한정, ${profile.offer} 안내드립니다.\n링크: [shorturl]\n\n24시간 내 신청하시면 추가 선물까지! ✨`,
      b: `${name}님을 위한 특별한 제안입니다.\n${profile.title}을 위해 준비했어요.\n\n${profile.offer}\n한정 기간: 내일까지\n신청: [shorturl]`,
    },
    // Day 1: S(Solution) — 해결책 제시
    1: {
      a: `${name}님!\n어제 제안을 보지 못하셨나요?\n\n저희 고객 93% 만족도의 비결 🌟\n- 세계 50개 항구\n- 미슐랭 쉐프 다이닝\n- VIP 스파 무료 이용\n\n다시 한번: [shorturl]`,
      b: `${name}님께 좋은 소식입니다.\n어제 메시지를 놓치셨다면, 지금이 마지막 기회예요.\n\n왜 96% 재예약율인지 확인해보세요 👉\n[shorturl]`,
    },
    // Day 2: O(Offer) + N(Narrow) — 오퍼 강조 + 범위 좁히기
    2: {
      a: `${name}님, 시간이 얼마 남지 않았어요 ⏰\n\n${profile.offer}\n지금까지 ${segment === 'A' ? '1,243명' : segment === 'B' ? '2,156명' : '847명'}이 선택했습니다.\n\n48시간 후 일반가 적용됩니다.\n예약: [shorturl]`,
      b: `${name}님!\n오늘 자정까지만 ${profile.offer} 유효합니다.\n\n- 한정 객실 7개 남음\n- 선금 0원 (여행 1주일 전)\n- 취소 수수료 무료\n\n지금 예약하기: [shorturl]`,
    },
    // Day 3: A(Action) — 최종 행동 촉구
    3: {
      a: `${name}님!\n마지막 기회입니다 🎁\n\n✅ 남은 객실: 1개\n✅ 가격: ${profile.offer}\n✅ 출발: 다음달 10일\n\n지금 예약하지 않으시면, 다음 시즌 정가로 올라갑니다.\n예약: [shorturl]`,
      b: `${name}님께 마지막 연락드립니다.\n\n이번 패키지는 내일 자정 마감입니다.\n선택의 여지가 없습니다.\n\n당신을 위한 객실을 예약할까요? 아니면 포기할까요?\n[shorturl]`,
    },
  };

  return templates[day]?.[variant] || templates[day]?.a || '메시지 생성 오류';
}

/**
 * Day 0 SMS 발송
 */
export async function sendDay0Sms(
  organizationId: string,
  contactId: string,
  segment: Segment,
  phoneNumber: string,
  contactName?: string,
  variant: ABVariant = 'a'
): Promise<SmsSendResult> {
  try {
    // SMS 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      return {
        success: false,
        error: 'SMS configuration not found or inactive',
        retryable: false,
      };
    }

    // 메시지 생성
    const messageContent = generateDayNMessage(segment, 0, variant, contactName);

    // Aligo 발송
    const result = await sendSmsWithAligo(
      smsConfig.aligoUserId,
      smsConfig.aligoKey,
      smsConfig.senderPhone,
      phoneNumber,
      messageContent
    );

    // 로그 기록
    const logStatus = result.success ? 'SENT' : result.retryable ? 'PENDING' : 'FAILED';

    await prisma.partnerSmsLog.create({
      data: {
        organizationId,
        contactId,
        day: 'day0',
        segment,
        variant,
        messageType: 'LOOP5_DAY0_PROBLEM_AGITATE',
        messageContent,
        phoneNumber,
        status: logStatus,
        smsId: result.smsId,
        failureReason: result.error,
        triggeredBy: 'AUTO_FORM_SUBMISSION',
        sentAt: result.success ? new Date() : null,
        metadata: {
          psych_lens: 'L6_TIMING_LOSS_AVERSION',
          pasona_stage: 'P_PROBLEM',
        },
      },
    });

    // Contact 업데이트
    if (result.success) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          smsDay0Sent: true,
          smsDay0SentAt: new Date(),
        },
      });
    }

    return result;
  } catch (error: unknown) {
    logger.error('[sendDay0Sms] 오류', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

/**
 * Day 1 SMS 발송 (24시간 후)
 */
export async function sendDay1Sms(
  organizationId: string,
  contactId: string,
  segment: Segment,
  phoneNumber: string,
  contactName?: string,
  variant: ABVariant = 'a'
): Promise<SmsSendResult> {
  try {
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      return {
        success: false,
        error: 'SMS configuration not found or inactive',
        retryable: false,
      };
    }

    const messageContent = generateDayNMessage(segment, 1, variant, contactName);

    const result = await sendSmsWithAligo(
      smsConfig.aligoUserId,
      smsConfig.aligoKey,
      smsConfig.senderPhone,
      phoneNumber,
      messageContent
    );

    const logStatus = result.success ? 'SENT' : result.retryable ? 'PENDING' : 'FAILED';

    await prisma.partnerSmsLog.create({
      data: {
        organizationId,
        contactId,
        day: 'day1',
        segment,
        variant,
        messageType: 'LOOP5_DAY1_SOLUTION',
        messageContent,
        phoneNumber,
        status: logStatus,
        smsId: result.smsId,
        failureReason: result.error,
        triggeredBy: 'CRON_JOB',
        sentAt: result.success ? new Date() : null,
        metadata: {
          psych_lens: 'L8_SOCIAL_PROOF',
          pasona_stage: 'S_SOLUTION',
        },
      },
    });

    if (result.success) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          smsDay1Sent: true,
          smsDay1SentAt: new Date(),
        },
      });
    }

    return result;
  } catch (error: unknown) {
    logger.error('[sendDay1Sms] 오류', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

/**
 * Day 2 SMS 발송 (48시간 후)
 */
export async function sendDay2Sms(
  organizationId: string,
  contactId: string,
  segment: Segment,
  phoneNumber: string,
  contactName?: string,
  variant: ABVariant = 'a'
): Promise<SmsSendResult> {
  try {
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      return {
        success: false,
        error: 'SMS configuration not found or inactive',
        retryable: false,
      };
    }

    const messageContent = generateDayNMessage(segment, 2, variant, contactName);

    const result = await sendSmsWithAligo(
      smsConfig.aligoUserId,
      smsConfig.aligoKey,
      smsConfig.senderPhone,
      phoneNumber,
      messageContent
    );

    const logStatus = result.success ? 'SENT' : result.retryable ? 'PENDING' : 'FAILED';

    await prisma.partnerSmsLog.create({
      data: {
        organizationId,
        contactId,
        day: 'day2',
        segment,
        variant,
        messageType: 'LOOP5_DAY2_OFFER_SCARCITY',
        messageContent,
        phoneNumber,
        status: logStatus,
        smsId: result.smsId,
        failureReason: result.error,
        triggeredBy: 'CRON_JOB',
        sentAt: result.success ? new Date() : null,
        metadata: {
          psych_lens: 'L10_SCARCITY_URGENCY',
          pasona_stage: 'O_OFFER',
        },
      },
    });

    if (result.success) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          smsDay2Sent: true,
          smsDay2SentAt: new Date(),
        },
      });
    }

    return result;
  } catch (error: unknown) {
    logger.error('[sendDay2Sms] 오류', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

/**
 * Day 3 SMS 발송 (72시간 후)
 */
export async function sendDay3Sms(
  organizationId: string,
  contactId: string,
  segment: Segment,
  phoneNumber: string,
  contactName?: string,
  variant: ABVariant = 'a'
): Promise<SmsSendResult> {
  try {
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      return {
        success: false,
        error: 'SMS configuration not found or inactive',
        retryable: false,
      };
    }

    const messageContent = generateDayNMessage(segment, 3, variant, contactName);

    const result = await sendSmsWithAligo(
      smsConfig.aligoUserId,
      smsConfig.aligoKey,
      smsConfig.senderPhone,
      phoneNumber,
      messageContent
    );

    const logStatus = result.success ? 'SENT' : result.retryable ? 'PENDING' : 'FAILED';

    await prisma.partnerSmsLog.create({
      data: {
        organizationId,
        contactId,
        day: 'day3',
        segment,
        variant,
        messageType: 'LOOP5_DAY3_ACTION_CLOSE',
        messageContent,
        phoneNumber,
        status: logStatus,
        smsId: result.smsId,
        failureReason: result.error,
        triggeredBy: 'CRON_JOB',
        sentAt: result.success ? new Date() : null,
        metadata: {
          psych_lens: 'L10_IMMEDIATE_PURCHASE',
          pasona_stage: 'A_ACTION',
        },
      },
    });

    if (result.success) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          smsDay3Sent: true,
          smsDay3SentAt: new Date(),
        },
      });
    }

    return result;
  } catch (error: unknown) {
    logger.error('[sendDay3Sms] 오류', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

/**
 * 실패한 SMS 재시도
 */
export async function retryFailedLoop5Sms(
  smsLogId: string
): Promise<SmsSendResult> {
  try {
    const smsLog = await prisma.partnerSmsLog.findUnique({
      where: { id: smsLogId },
    });

    if (!smsLog) {
      return {
        success: false,
        error: 'SMS log not found',
        retryable: false,
      };
    }

    if (smsLog.retryCount >= smsLog.maxRetries) {
      return {
        success: false,
        error: 'Max retries exceeded',
        retryable: false,
      };
    }

    // 재발송
    const dayStr = smsLog.day;
    const segment = smsLog.segment as Segment;
    const variant = (smsLog.variant as ABVariant) || 'a';

    let result: SmsSendResult;

    switch (dayStr) {
      case 'day0':
        result = await sendDay0Sms(
          smsLog.organizationId,
          smsLog.contactId || '',
          segment,
          smsLog.phoneNumber,
          undefined,
          variant
        );
        break;
      case 'day1':
        result = await sendDay1Sms(
          smsLog.organizationId,
          smsLog.contactId || '',
          segment,
          smsLog.phoneNumber,
          undefined,
          variant
        );
        break;
      case 'day2':
        result = await sendDay2Sms(
          smsLog.organizationId,
          smsLog.contactId || '',
          segment,
          smsLog.phoneNumber,
          undefined,
          variant
        );
        break;
      case 'day3':
        result = await sendDay3Sms(
          smsLog.organizationId,
          smsLog.contactId || '',
          segment,
          smsLog.phoneNumber,
          undefined,
          variant
        );
        break;
      default:
        return {
          success: false,
          error: 'Unknown day',
          retryable: false,
        };
    }

    // 재시도 횟수 업데이트
    if (!result.success) {
      await prisma.partnerSmsLog.update({
        where: { id: smsLogId },
        data: { retryCount: smsLog.retryCount + 1 },
      });
    }

    return result;
  } catch (error: unknown) {
    logger.error('[retryFailedLoop5Sms] 오류', {
      smsLogId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}
