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
import { z } from 'zod';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { renderMessage, extractVariables, MessageContext } from '@/lib/message-template-engine';
import { sendScheduledSms } from '@/lib/sms-service';
import { sendKakaoMessage, logKakaoMessage } from '@/lib/messages/kakao-service';
import { sendEmail, getPasonaEmailTemplate, logEmailMessage } from '@/lib/messages/email-service';
import { getSpinQuestion, appendSpinQuestion } from '@/lib/messages/spin-integration';
import { trackShortLinkImpressions } from '@/lib/link-tracking';

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
        optOutAt: true,
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

    // 수신 거부 여부 확인
    if (contact.optOutAt) {
      logger.warn('[messages] 수신 거부 연락처 발송 차단', { contactId, messageType });
      return NextResponse.json(
        { ok: false, message: '수신 거부 등록된 연락처입니다' },
        { status: 400 }
      );
    }

    // SMS/Kakao 발송 시 phone 필드 검증
    if ((messageType === 'SMS' || messageType === 'KAKAO') && !contact.phone) {
      logger.warn('[messages] Phone number missing', { contactId, messageType });
      return NextResponse.json(
        { ok: false, message: 'Contact phone number is required for SMS/KAKAO message type' },
        { status: 400 }
      );
    }

    // PASONA 템플릿 로드
    const dayMatch = messageKey.match(/day(\d)/i);
    const dayNumber = dayMatch ? dayMatch[1] : '0';
    const parsedDay = parseInt(dayNumber, 10);
    if (isNaN(parsedDay)) {
      logger.warn('[messages] Invalid day number', { messageKey, dayNumber });
      return NextResponse.json(
        { ok: false, message: 'Invalid messageKey format' },
        { status: 400 }
      );
    }
    const dayKey = `day${dayNumber}` as keyof typeof PASONA_TEMPLATES;

    // 렌즈 기반 템플릿 키 결정 (L0-L10 + 메시지 타입)
    let templateKey = 'default';
    if (lens) {
      const upperLens = lens.toUpperCase();
      const messageTypePart = messageKey.includes('urgent') ? 'URGENT' :
                             messageKey.includes('immediate') ? 'IMMEDIATE' :
                             messageKey.includes('anxiety') ? 'ANXIETY' :
                             messageKey.includes('trust') ? 'TRUST' :
                             messageKey.includes('habit') ? 'HABIT' :
                             messageKey.includes('companion') ? 'COMPANION' :
                             messageKey.includes('closing') ? 'CLOSING' :
                             messageKey.includes('scarcity') ? 'SCARCITY' : 'default';
      const compositeKey = messageTypePart !== 'default' ? `${upperLens}_${messageTypePart}` : `${upperLens}_IMMEDIATE`;
      templateKey = PASONA_TEMPLATES[dayKey]?.[compositeKey] ? compositeKey : 'default';
    }

    const templateContent =
      PASONA_TEMPLATES[dayKey]?.[templateKey] ||
      PASONA_TEMPLATES[dayKey]?.['default'] ||
      `{{name}}님, {{messageKey}} 메시지입니다.`;

    // 메시지 렌더링
    const renderContext: MessageContext = {
      contactId,
      contactName: contact.name || 'Guest',
      contactPhone: contact.phone ?? undefined,
      contactEmail: contact.email ?? undefined,
      segment: lens,
      lens: lens,
      customVariables: templateVars,
    };

    let renderedMessage = renderMessage(templateContent, renderContext);

    // Day 1/2: SPIN 질문 추가 (고객 자기설득 유도)
    if ((parsedDay === 1 || parsedDay === 2) && messageType !== 'EMAIL') {
      // SMS/Kakao만 SPIN 추가 (Email은 이미 복잡함)
      const spinQuestion = getSpinQuestion(parsedDay as 1 | 2, lens);
      if (spinQuestion) {
        renderedMessage = appendSpinQuestion(renderedMessage, spinQuestion);
      }
    }

    // 발송 시간 결정
    let sendTime = new Date();
    if (scheduleAt) {
      sendTime = new Date(scheduleAt);
    } else if (parsedDay !== 0) {
      // 현재 시간 기준으로 Day N 자동 계산
      sendTime = new Date(
        sendTime.getTime() + parsedDay * 24 * 60 * 60 * 1000
      );
    }

    // CrmMarketingMessage 생성 (SmsLog는 발송 후 로깅만)
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trackingId = `track_${Math.random().toString(36).substr(2, 12)}`;
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${trackingId}`;

    // Template ID 생성 (segment_variant 형식)
    const templateId = `${lens || 'default'}_${abTestGroup || 'default'}`;

    const marketingMessage = await prisma.crmMarketingMessage.create({
      data: {
        organizationId: session.organizationId,
        contactId,
        templateId,
        segment: lens || 'general',
        variant: abTestGroup || 'default',
        day: parsedDay,
        content: renderedMessage,
        psychologyLenses: lens ? [lens] : [],
        status: scheduleAt ? 'PENDING' : 'SENT',
        scheduledTime: scheduleAt ? new Date(scheduleAt) : new Date(),
        sentTime: scheduleAt ? undefined : new Date(),
        abTestGroup: abTestGroup || undefined,
        metadata: {
          messageKey,
          trackingId,
          trackingUrl,
          channel: 'API',
        },
      },
    });

    // SMS 또는 Kakao 메시지 발송
    let scheduledSmsId: string | null = null;
    let kakaoMessageId: string | null = null;
    let usedFallback = false;

    if (messageType === 'SMS') {
      try {
        // ✅ ShortLink Impression 추적
        const impressions = await trackShortLinkImpressions(
          renderedMessage,
          'sms',
          contactId,
          session.organizationId
        );

        scheduledSmsId = await sendScheduledSms({
          organizationId: session.organizationId,
          contactId,
          phoneNumber: contact.phone || '',
          body: renderedMessage,
          sendAt: sendTime,
          campaignType: `PASONA_${lens || 'DEFAULT'}`,
          day: (parsedDay as 0 | 1 | 2 | 3 | 7) || 0,
          metadata: {
            messageKey,
            abTestGroup,
            trackingId: trackingId,
          },
        });

        logger.log('[messages] SMS 스케줄 완료', {
          marketingMessageId: marketingMessage.id,
          contactId,
          scheduledSmsId,
          sendAt: sendTime.toISOString(),
          lens,
          impressionCount: impressions.length,
        });
      } catch (err) {
        logger.error('[messages] SMS 스케줄 실패', {
          marketingMessageId: marketingMessage.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (messageType === 'KAKAO') {
      try {
        // Kakao 메시지 즉시 발송 (예약 발송은 Kakao가 미지원)
        const kakaoResult = await sendKakaoMessage({
          organizationId: session.organizationId,
          phoneNumber: contact.phone || '',
          templateId: `pasona_${dayKey}_${lens || 'default'}`,
          templateArgs: [
            contact.name || 'Guest',
            templateVars.price || '',
            templateVars.discount || '',
            templateVars.link || '',
          ],
        });

        if (!kakaoResult.fallbackToSms) {
          kakaoMessageId = kakaoResult.messageId;

          // Kakao 로그 기록
          await logKakaoMessage(
            session.organizationId,
            contactId,
            contact.phone,
            kakaoMessageId,
            renderedMessage,
            'SENT'
          );

          logger.log('[messages] Kakao 메시지 발송 완료', {
            marketingMessageId: marketingMessage.id,
            contactId,
            kakaoMessageId,
            lens,
          });
        } else {
          // Kakao 실패 시 SMS로 자동 fallback
          usedFallback = true;
          logger.warn('[messages] Kakao 발송 실패, SMS로 Fallback', {
            marketingMessageId: marketingMessage.id,
            contactId,
          });
        }
      } catch (err) {
        logger.error('[messages] Kakao 발송 오류', {
          marketingMessageId: marketingMessage.id,
          error: err instanceof Error ? err.message : String(err),
        });
        usedFallback = true;
      }
    } else if (messageType === 'EMAIL') {
      // EMAIL 발송 시 email 필드 검증
      if (!contact.email) {
        logger.warn('[messages] Email address missing', { contactId, messageType });
        return NextResponse.json(
          { ok: false, message: 'Contact email address is required for EMAIL message type' },
          { status: 400 }
        );
      }

      try {
        // EMAIL 템플릿 생성
        const emailTemplate = getPasonaEmailTemplate(
          (parsedDay as 0 | 1 | 2 | 3) || 0,
          lens || 'default',
          contact.name,
          templateVars
        );

        // Email 발송
        const emailResult = await sendEmail({
          organizationId: session.organizationId,
          contactId,
          recipientEmail: contact.email,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.html,
          textContent: emailTemplate.text,
          templateKey: messageKey,
          lens,
          abTestGroup,
          trackingId: trackingId,
          scheduleAt: scheduleAt ? new Date(scheduleAt) : undefined,
        });

        if (emailResult.status !== 'FAILED') {
          // Email 로그 기록
          await logEmailMessage(
            session.organizationId,
            contactId,
            contact.email,
            emailResult.messageId,
            emailTemplate.subject,
            emailResult.status === 'PENDING' ? 'SENT' : emailResult.status
          );

          logger.log('[messages] Email 발송 완료', {
            marketingMessageId: marketingMessage.id,
            contactId,
            emailMessageId: emailResult.messageId,
            provider: emailResult.provider,
            lens,
          });
        } else {
          logger.error('[messages] Email 발송 실패', {
            marketingMessageId: marketingMessage.id,
            contactId,
            provider: emailResult.provider,
          });
        }
      } catch (err) {
        logger.error('[messages] Email 발송 오류', {
          marketingMessageId: marketingMessage.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 응답 상태 결정: scheduleAt이 있으면 PENDING (예약), 없으면 SENT (즉시 발송)
    const responseStatus = scheduleAt ? 'PENDING' : 'SENT';

    return NextResponse.json({
      ok: true,
      messageId: marketingMessage.id,
      trackingId: trackingId,
      trackingUrl,
      status: responseStatus,
      sentAt: new Date(),
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      },
      ...(kakaoMessageId && { kakaoMessageId }),
      ...(usedFallback && { fallbackToSms: true, note: 'Kakao failed, SMS scheduled instead' }),
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

/**
 * GET /api/messages
 * Message 목록 조회 (페이지네이션, 필터)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const skip = (page - 1) * limit;

    // 메시지 목록 조회
    const messages = await prisma.crmMarketingMessage.findMany({
      where: {
        organizationId: session.organizationId,
        ...(contactId && { contactId }),
        status: { not: 'DELETED' }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        contactId: true,
        content: true,
        status: true,
        scheduledTime: true,
        sentTime: true,
        lastClickTime: true,
        contact: {
          select: {
            id: true,
            email: true,
            phone: true,
            name: true
          }
        }
      }
    });

    // 전체 개수 조회
    const total = await prisma.crmMarketingMessage.count({
      where: {
        organizationId: session.organizationId,
        ...(contactId && { contactId }),
        status: { not: 'DELETED' }
      }
    });

    logger.log('[Message] GET 목록 조회 완료', {
      organizationId: session.organizationId,
      contactId,
      page,
      limit,
      total,
      returned: messages.length
    });

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('[Message] GET 목록 조회 실패', {
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/messages/:id
 * Message 업데이트 (상태, 콘텐츠 등)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, status, content, segment, variant } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, message: 'Missing message ID' },
        { status: 400 }
      );
    }

    // 메시지 존재 및 권한 확인
    const existingMessage = await prisma.crmMarketingMessage.findUnique({
      where: { id },
      select: { organizationId: true }
    });

    if (!existingMessage) {
      return NextResponse.json(
        { ok: false, message: 'Message not found' },
        { status: 404 }
      );
    }

    if (existingMessage.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Schema validation for message update
    const MessageUpdateSchema = z.object({
      status: z.enum(['SENT', 'PENDING', 'DELETED']).optional(),
      content: z.string().optional(),
      segment: z.string().optional(),
      variant: z.string().optional()
    }).strict(); // Reject any additional fields

    let updateData: z.infer<typeof MessageUpdateSchema>;
    try {
      updateData = MessageUpdateSchema.parse({ status, content, segment, variant });
    } catch (error) {
      const errorMessage = error instanceof z.ZodError ? error.message : String(error);
      logger.warn('[Message] PUT 유효하지 않은 필드', { error: errorMessage });
      return NextResponse.json(
        { ok: false, message: 'Invalid update fields' },
        { status: 400 }
      );
    }

    const updateResult = await prisma.crmMarketingMessage.updateMany({
      where: { id, organizationId: session.organizationId },
      data: updateData
    });
    if (updateResult.count === 0) {
      return NextResponse.json({ ok: false, message: 'Message not found' }, { status: 404 });
    }
    const updatedMessage = await prisma.crmMarketingMessage.findUnique({ where: { id } });

    logger.log('[Message] PUT 업데이트 완료', {
      messageId: id,
      organizationId: session.organizationId,
      updatedFields: Object.keys(updateData)
    });

    return NextResponse.json({
      ok: true,
      message: updatedMessage
    });
  } catch (err) {
    logger.error('[Message] PUT 업데이트 실패', {
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/:id
 * Message 삭제 (소프트 삭제)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, message: 'Missing message ID' },
        { status: 400 }
      );
    }

    // 메시지 존재 및 권한 확인
    const existingMessage = await prisma.crmMarketingMessage.findUnique({
      where: { id },
      select: { organizationId: true }
    });

    if (!existingMessage) {
      return NextResponse.json(
        { ok: false, message: 'Message not found' },
        { status: 404 }
      );
    }

    if (existingMessage.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 소프트 삭제 (status = 'DELETED')
    await prisma.crmMarketingMessage.updateMany({
      where: { id, organizationId: session.organizationId },
      data: { status: 'DELETED' }
    });
    const deletedMessage = await prisma.crmMarketingMessage.findUnique({ where: { id } });

    logger.log('[Message] DELETE 소프트 삭제 완료', {
      messageId: id,
      organizationId: session.organizationId
    });

    return NextResponse.json({
      ok: true,
      message: 'Message deleted successfully'
    });
  } catch (err) {
    logger.error('[Message] DELETE 삭제 실패', {
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
