/**
 * Live Stream Registration API
 * POST /api/live-stream/register
 *
 * 라이브방송 신청 처리 (Contact 생성 + Event 로깅 + SMS 발송)
 * 심리학: L5 (자기투영) + L10 (즉시 구매)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { sendSmsViaAligo } from '@/lib/sms-service';
import { validateLiveStreamForm } from '@/lib/live-stream/validation';
import { logLiveStreamEvent } from '@/lib/live-stream/tracking';

const generateShortId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

interface LiveStreamRegisterRequest {
  name: string;
  phone: string;
  email: string;
  segment: 'LOW_PRICE' | 'FILIAL' | 'HONEYMOON'; // 저가 | 효도 | 신혼
  eventDate: string; // '2026-06-02' (라이브방송 날짜)
  note?: string;
  consent: boolean; // SMS 동의
}

export async function POST(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: LiveStreamRegisterRequest = await request.json();

    // 1️⃣ 폼 검증
    const validation = validateLiveStreamForm(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // 2️⃣ 중복 확인 (24시간 내 같은 전화번호 신청 있는지)
    const existingRegistration = await prisma.contact.findFirst({
      where: {
        phone: body.phone,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        status: 'LIVE_STREAM_REGISTRATION',
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        {
          error: 'Already registered',
          message: '24시간 내 이미 신청하신 기록이 있습니다. 곧 담당자가 연락드릴 예정입니다.',
        },
        { status: 409 }
      );
    }

    // 3️⃣ Contact 생성
    const registrationId = generateShortId('LIVE');

    const contact = await prisma.contact.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        status: 'LIVE_STREAM_REGISTRATION', // 라이브방송 신청자
        sourceId: 'LIVE_STREAM',
        organizationId: session.organizationId!,
        lensMetadata: {
          registrationId,
          segment: body.segment, // 세그먼트 저장 (저가/효도/신혼)
          eventDate: body.eventDate,
          liveStreamNote: body.note,
          consentSMS: body.consent,
          registeredAt: new Date().toISOString(),
          appliedLenses: getLiveLenses(body.segment), // L5/L10 적용
        },
      },
    });

    // 4️⃣ Event 로깅 (추적용)
    await logLiveStreamEvent({
      contactId: contact.id,
      eventType: 'REGISTRATION',
      segment: body.segment,
      metadata: {
        registrationId,
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
      },
    });

    // 5️⃣ SMS 발송 (Day 0 PASONA)
    if (body.consent) {
      const smsMessage = getSegmentSMS(body.segment, body.name);
      await sendSmsViaAligo(body.phone, smsMessage);
    }

    // 6️⃣ CRM 자동분류 (태그 생성)
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        tags: {
          push: [
            'LIVE_STREAM',
            `SEGMENT_${body.segment}`,
            'L5_SELF_PROJECTION', // L5: 자기투영 (신혼)
            'L10_IMMEDIATE_PURCHASE', // L10: 즉시 구매
            'DAY0_SMS_SENT',
          ],
        },
      },
    });

    // 7️⃣ 응답
    return NextResponse.json({
      success: true,
      registrationId,
      message: '신청이 완료되었습니다. 24시간 내 담당자가 연락드리겠습니다.',
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        segment: body.segment,
      },
      nextAction: {
        sms: '확인 SMS 발송 완료',
        call: '24시간 내 담당자 연락 예정',
        followUp: 'Day 1 추가 SMS 예정',
      },
    });
  } catch (error) {
    console.error('[LIVE_STREAM_REGISTER]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 세그먼트별 렌즈 자동 적용
 */
function getLiveLenses(segment: string): string[] {
  const lensMap: Record<string, string[]> = {
    'LOW_PRICE': ['L1', 'L6'], // L1: 가격 이의 / L6: 타이밍 손실회피
    'FILIAL': ['L9', 'L7'], // L9: 의료/신뢰 / L7: 동반자 설득
    'HONEYMOON': ['L5', 'L10'], // L5: 자기투영 / L10: 즉시 구매
  };
  return lensMap[segment] || ['L5', 'L10'];
}

/**
 * 세그먼트별 Day 0 SMS 메시지 (PASONA P단계: 공감 + 초기 액션)
 */
function getSegmentSMS(segment: string, name: string): string {
  const templates: Record<string, string> = {
    'LOW_PRICE': `안녕하세요 ${name}님! 마비즈입니다.
오늘 라이브방송 신청 감사합니다. 🙏
350만원으로 4인 가족 해외여행? 지금이 마지막 기회입니다.
20% 추가할인 + 카드 무이자 6개월 혜택 지금 신청자만!
[신청하기] → https://bit.ly/mabiz-live-register
담당자가 30분 내 연락드립니다.`,

    'FILIAL': `안녕하세요 ${name}님! 마비즈입니다.
오늘 라이브방송 신청 감사합니다. 🙏
부모님 동반 효도여행, 의료진과 함께 안심하세요.
현지 의료비 100% 마비즈 부담! (보증)
[상담받기] → https://bit.ly/mabiz-live-register
담당자가 30분 내 연락드립니다.`,

    'HONEYMOON': `축하합니다! ${name}님! 마비즈입니다.
오늘 라이브방송 신청 감사합니다. 💕
신혼의 추억, 우리가 완벽하게 만들어드리겠습니다.
전문 사진작가 + 부부스파 + 영상편집 모두 포함!
[신청하기] → https://bit.ly/mabiz-live-register
담당자가 30분 내 연락드립니다.`,
  };

  return templates[segment] || templates['HONEYMOON'];
}
