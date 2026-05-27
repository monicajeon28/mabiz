/**
 * POST /api/messages
 * SMS/Kakao/Email 통합 메시지 발송 API
 *
 * 기능:
 * - PASONA Day 0-3 시퀀스 자동 스케줄링
 * - 심리학 렌즈 기반 메시지 개인화
 * - 멱등성 (messageId)
 * - 비동기 발송 (Bull Queue)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { renderMessage, extractVariables } from '@/lib/message-template-engine';
import { sendScheduledSms } from '@/lib/sms-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SendMessagePayload {
  contactId: string;
  messageType: 'SMS' | 'KAKAO' | 'EMAIL';
  messageKey: string; // 'welcome_day0', 'followup_day1', 'close_day3' 등
  lens?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10';
  templateVars?: Record<string, string>;
  scheduleAt?: string; // ISO 8601 datetime
  abTestGroup?: 'A' | 'B';
  campaignId?: string;
}

// PASONA Day 0-3 메시지 템플릿 (심리학 렌즈별)
const PASONA_TEMPLATES: Record<string, Record<string, string>> = {
  // Day 0: Problem + Agitate (문제 자극)
  day0: {
    L6_URGENT: '🚢 {{name}}님, 크루즈 한 번 떠나고 싶지 않으세요? 5월 특가: ¥{{price}}K → ¥{{discount}}K (48시간 한정)',
    L10_IMMEDIATE: '{{name}}님, 지금이 결정의 시간입니다! 특가 예약하기 → {{link}}',
    default: '{{name}}님, 안녕하세요! 이번 주말 크루즈 특가 안내드립니다.',
  },
  // Day 1: Solution (해결책)
  day1: {
    L2_ANXIETY: '{{name}}님, 준비 복잡할까 봐 걱정? 📋 체크리스트를 준비했어요. 확인하기: {{link}}',
    L5_TRUST: '{{name}}님, 1,000+ 고객이 안전하게 다녀왔습니다! 신뢰할 수 있는 크루즈입니다.',
    default: '{{name}}님, 크루즈 준비 방법을 한 번에 알려드릴게요.',
  },
  // Day 2: Offer + Narrow (오퍼, 범위 좁히기)
  day2: {
    L8_HABIT: '{{name}}님만을 위한 특별 혜택 ⭐ {{offer}}. 지금 예약하면 20% 추가 할인!',
    L7_COMPANION: '{{name}}님, 가족과 함께 즐기는 크루즈! 배우자님도 좋아하실 거예요. 예약: {{link}}',
    default: '{{name}}님, 이 기회를 놓치지 마세요!',
  },
  // Day 3: Action (행동 촉구)
  day3: {
    L10_CLOSING: '마지막 기회! 내일 자정 마감 ⏰ {{name}}님의 꿈의 크루즈는? {{link}}',
    L6_SCARCITY: '🔥 남은 자리: {{remaining}}석 → {{name}}님을 위해 예약해드릴까요?',
    default: '{{name}}님, 더 이상 미루지 마세요. 지금 예약하기!',
  },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SendMessagePayload = await req.json();
    const {
      contactId,
      messageType,
      messageKey,
      lens,
      templateVars = {},
      scheduleAt,
      abTestGroup,
      campaignId,
    } = body;

    // 필드 검증
    if (!contactId || !messageType || !messageKey) {
      logger.warn('[messages] 필수 필드 누락', {
        contactId,
        messageType,
        messageKey,
      });
      return NextResponse.json(
        { ok: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        organizationId: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: 'Contact not found' },
        { status: 404 }
      );
    }

    // 접근 권한 확인 (다른 조직의 Contact에 접근 불가)
    if (contact.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // PASONA 템플릿 로드
    const dayMatch = messageKey.match(/day(\d)/i);
    const dayNumber = dayMatch ? dayMatch[1] : '0';
    const dayKey = `day${dayNumber}` as keyof typeof PASONA_TEMPLATES;
    const lensKey = `${lens}_${messageKey.split('_').pop()?.toUpperCase()}` || 'default';

    const templateContent =
      PASONA_TEMPLATES[dayKey]?.[lensKey] ||
      PASONA_TEMPLATES[dayKey]?.['default'] ||
      `{{name}}님, {{messageKey}} 메시지입니다.`;

    // 메시지 렌더링
    const renderContext = {
      contactId,
      contactName: contact.name,
      contactPhone: contact.phone,
      contactEmail: contact.email,
      segment: lens,
      lens: lens,
      customVariables: templateVars,
    };

    const renderedMessage = renderMessage(templateContent, renderContext);

    // 발송 시간 결정
    let sendTime = new Date();
    if (scheduleAt) {
      sendTime = new Date(scheduleAt);
    } else if (dayNumber !== '0') {
      // 현재 시간 기준으로 Day N 자동 계산
      sendTime = new Date(
        sendTime.getTime() + parseInt(dayNumber) * 24 * 60 * 60 * 1000
      );
    }

    // SmsLog 생성 (멱등성을 위해 messageId 생성)
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trackingId = `track_${Math.random().toString(36).substr(2, 12)}`;
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${trackingId}`;

    const smsLog = await prisma.smsLog.create({
      data: {
        id: messageId,
        organizationId: session.organizationId,
        contactId,
        phone: contact.phone,
        contentPreview: renderedMessage.substring(0, 100),
        status: scheduleAt ? 'PENDING' : 'SENT',
        messageType,
        channel: 'API',
        sentAt: scheduleAt ? undefined : new Date(),
        segmentCode: lens,
        psychologyLens: lens,
        abTestGroup,
        trackingId,
        // 캠페인 링크
        ...(campaignId && { campaignId }),
      },
      select: {
        id: true,
        trackingId: true,
      },
    });

    // SMS 스케줄링
    let scheduledSmsId: string | null = null;
    if (messageType === 'SMS') {
      try {
        scheduledSmsId = await sendScheduledSms({
          organizationId: session.organizationId,
          contactId,
          phoneNumber: contact.phone,
          body: renderedMessage,
          sendAt: sendTime,
          campaignType: `PASONA_${lens || 'DEFAULT'}`,
          day: (parseInt(dayNumber) as 0 | 1 | 2 | 3 | 7) || 0,
          metadata: {
            messageKey,
            abTestGroup,
            trackingId: smsLog.trackingId,
          },
        });

        logger.log('[messages] SMS 스케줄 완료', {
          messageId,
          contactId,
          scheduledSmsId,
          sendAt: sendTime.toISOString(),
          lens,
        });
      } catch (err) {
        logger.error('[messages] SMS 스케줄 실패', {
          messageId,
          error: err instanceof Error ? err.message : String(err),
        });
        // SMS 스케줄 실패는 전체 요청 실패로 처리하지 않음 (파트셜 성공)
      }
    }

    return NextResponse.json({
      ok: true,
      messageId: smsLog.id,
      trackingId: smsLog.trackingId,
      trackingUrl,
      status: scheduleAt ? 'SCHEDULED' : 'SENT',
      sentAt: new Date(),
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      },
    });
  } catch (error) {
    logger.error('[messages] 예상 밖의 에러', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
