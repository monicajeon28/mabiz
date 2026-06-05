/**
 * Live Stream Automation Cron
 * POST /api/cron/live-stream-automation
 *
 * Day 0-3 자동 SMS + 콜 스케줄링
 * 매일 오전 9:00 실행 (Vercel Cron)
 *
 * PASONA Framework:
 * - Day 0: P (Problem) + A (Agitate) - 문제 인식 + 자극
 * - Day 1: S (Solution) - 해결책 제시 + 콜 시작
 * - Day 2: O (Offer) - 특별 제안 (추가 할인)
 * - Day 3: A (Action) - 행동 유도 (긴급성)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSmsViaAligo } from '@/lib/sms-service';
import { logLiveStreamEvent } from '@/lib/live-stream/tracking';
import { logger } from '@/lib/logger';

// Cron 인증 토큰 (미설정 시 fail-closed)
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // 인증 (CRON_SECRET 미설정 시 fail-closed)
    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'MISCONFIGURED' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 경과일 기준 날짜 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Day 1: 신청 1일 경과 (어제 신청)
    const day1Start = new Date(today);
    day1Start.setDate(day1Start.getDate() - 1);
    const day1End = new Date(today);

    // Day 2: 신청 2일 경과 (그제 신청)
    const day2Start = new Date(today);
    day2Start.setDate(day2Start.getDate() - 2);
    const day2End = new Date(today);
    day2End.setDate(day2End.getDate() - 1);

    // Day 3: 신청 3일 경과 (3일 전 신청)
    const day3Start = new Date(today);
    day3Start.setDate(day3Start.getDate() - 3);
    const day3End = new Date(today);
    day3End.setDate(day3End.getDate() - 2);

    const baseWhere = { status: 'LIVE_STREAM' as const };
    const selectFields = {
      id: true,
      name: true,
      phone: true,
      email: true,
      tags: true,
    };

    // Day 1 대상: 신청 1일 경과자
    const day1Registrations = await prisma.contact.findMany({
      where: { ...baseWhere, createdAt: { gte: day1Start, lt: day1End } },
      select: selectFields,
    });

    // Day 2 대상: 신청 2일 경과자
    const day2Registrations = await prisma.contact.findMany({
      where: { ...baseWhere, createdAt: { gte: day2Start, lt: day2End } },
      select: selectFields,
    });

    // Day 3 대상: 신청 3일 경과자
    const day3Registrations = await prisma.contact.findMany({
      where: { ...baseWhere, createdAt: { gte: day3Start, lt: day3End } },
      select: selectFields,
    });

    const totalRegistrations = day1Registrations.length + day2Registrations.length + day3Registrations.length;

    // Day 0 처리 (신청 당일) - 이미 register API에서 처리됨
    // Day 1 처리 (신청 1일 경과자) — 콜 스케줄링 + SMS
    const day1Results = await handleDay1(day1Registrations);

    // Day 2 처리 (신청 2일 경과자) - 추가 제안
    const day2Results = await handleDay2(day2Registrations);

    // Day 3 처리 (신청 3일 경과자) - 긴급성
    const day3Results = await handleDay3(day3Registrations);

    return NextResponse.json({
      success: true,
      summary: {
        total: totalRegistrations,
        day1: day1Results,
        day2: day2Results,
        day3: day3Results,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[LIVE_STREAM_CRON]', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Day 1: 콜 + PASONA S (Solution)
 */
async function handleDay1(
  registrations: any[]
): Promise<{ sms: number; scheduled: number; failed: number }> {
  let sms = 0;
  let scheduled = 0;
  let failed = 0;

  for (const contact of registrations) {
    try {
      const segment = ((contact.tags as string[]).find((t) => t.startsWith('SEGMENT_'))?.replace('SEGMENT_', '') || 'HONEYMOON') as 'LOW_PRICE' | 'FILIAL' | 'HONEYMOON';

      // SMS 발송 (PASONA S: Solution)
      const smsMessage = getDay1SMS(segment, contact.name);
      await sendSmsViaAligo(contact.phone, smsMessage);

      // 이벤트 로깅
      await logLiveStreamEvent({
        contactId: contact.id,
        eventType: 'DAY1_CALL',
        segment,
        metadata: { reason: 'scheduled_day1' },
      });

      sms++;
      scheduled++;
    } catch (error) {
      logger.error(`[DAY1_ERROR] Contact: ${contact.id}`, { error: String(error) });
      failed++;
    }
  }

  return { sms, scheduled, failed };
}

/**
 * Day 2: SMS + 추가 제안 (PASONA O: Offer)
 */
async function handleDay2(
  registrations: any[]
): Promise<{ sms: number; sent: number; failed: number }> {
  let sms = 0;
  let sent = 0;
  let failed = 0;

  for (const contact of registrations) {
    try {
      const segment = ((contact.tags as string[]).find((t) => t.startsWith('SEGMENT_'))?.replace('SEGMENT_', '') || 'HONEYMOON') as 'LOW_PRICE' | 'FILIAL' | 'HONEYMOON';

      // SMS 발송 (PASONA O: Offer)
      const smsMessage = getDay2SMS(segment, contact.name);
      await sendSmsViaAligo(contact.phone, smsMessage);

      // 이벤트 로깅
      await logLiveStreamEvent({
        contactId: contact.id,
        eventType: 'DAY2_SMS_SENT',
        segment,
        metadata: { reason: 'special_offer' },
      });

      sms++;
      sent++;
    } catch (error) {
      logger.error(`[DAY2_ERROR] Contact: ${contact.id}`, { error: String(error) });
      failed++;
    }
  }

  return { sms, sent, failed };
}

/**
 * Day 3: SMS + 긴급성 (PASONA A: Action)
 */
async function handleDay3(
  registrations: any[]
): Promise<{ sms: number; sent: number; failed: number }> {
  let sms = 0;
  let sent = 0;
  let failed = 0;

  for (const contact of registrations) {
    try {
      const segment = ((contact.tags as string[]).find((t) => t.startsWith('SEGMENT_'))?.replace('SEGMENT_', '') || 'HONEYMOON') as 'LOW_PRICE' | 'FILIAL' | 'HONEYMOON';

      // SMS 발송 (PASONA A: Action)
      const smsMessage = getDay3SMS(segment, contact.name);
      await sendSmsViaAligo(contact.phone, smsMessage);

      // 이벤트 로깅
      await logLiveStreamEvent({
        contactId: contact.id,
        eventType: 'DAY3_SMS_SENT',
        segment,
        metadata: { reason: 'final_urgency' },
      });

      sms++;
      sent++;
    } catch (error) {
      logger.error(`[DAY3_ERROR] Contact: ${contact.id}`, { error: String(error) });
      failed++;
    }
  }

  return { sms, sent, failed };
}

/**
 * Day 1 SMS: Solution (해결책)
 */
function getDay1SMS(segment: string, name: string): string {
  const templates: Record<string, string> = {
    'LOW_PRICE': `${name}님! 마비즈입니다.
어제 신청해주셔서 감사합니다. 🙏

우리 담당자가 당신을 위해
**맞춤 여행 패키지**를 준비했어요.

✅ 350만 원에 4명 여행 (항공+호텔+식사+가이드)
✅ 카드 무이자 6개월 가능
✅ 여행보험 무료

[상세보기] → https://bit.ly/mabiz-day1

곧 담당자가 전화드릴게요!`,

    'FILIAL': `${name}님! 마비즈입니다.
어제 신청해주셔서 감사합니다. 🙏

부모님 동반 효도여행의 가장 큰 고민?
'병 나면 어쩌지?' 이죠.

**우리가 해결해드립니다.**
✅ 현역 의사 동반 (24시간)
✅ 의료비 100% 마비즈 부담
✅ 응급 상황 15분 내 병원 이송

[상담받기] → https://bit.ly/mabiz-day1

곧 담당자가 전화드릴게요!`,

    'HONEYMOON': `${name}님! 축하합니다! 💕 마비즈입니다.
어제 신청해주셔서 감사합니다.

신혼은 단 한 번입니다.
우리가 평생 간직할 추억을 만들어드릴게요.

✅ 전문 사진작가 동반 (120만 원 상당 무료)
✅ 부부 스파 + 마사지 (무료)
✅ 영상 촬영 + 편집 (무료)

[신청하기] → https://bit.ly/mabiz-day1

곧 담당자가 전화드릴게요!`,
  };

  return templates[segment] || templates['HONEYMOON'];
}

/**
 * Day 2 SMS: Offer (특별 제안)
 */
function getDay2SMS(segment: string, name: string): string {
  const templates: Record<string, string> = {
    'LOW_PRICE': `${name}님! 특별 소식입니다! 🎉

어제 말씀드린 350만 원 패키지.
**지금 신청하면 추가 10% 할인!**

350만 원 → **315만 원**

[지금 신청] → https://bit.ly/mabiz-day2

*이 혜택은 오늘까지만 유효합니다.*`,

    'FILIAL': `${name}님! 부모님을 위한 특별 혜택! 🎁

효도여행 패키지를 준비했습니다.
**지금 신청하면 의료진 비용 무료!**

[상담받기] → https://bit.ly/mabiz-day2

*이 혜택은 오늘까지만 유효합니다.*`,

    'HONEYMOON': `${name}님! 신혼 부부를 위한 특별 제안! 💕

신혼사진 전문가 + 스파 + 영상까지?
**지금 신청하면 추가 10% 할인!**

[지금 신청] → https://bit.ly/mabiz-day2

*이 혜택은 오늘까지만 유효합니다.*`,
  };

  return templates[segment] || templates['HONEYMOON'];
}

/**
 * Day 3 SMS: Action (행동 유도)
 */
function getDay3SMS(segment: string, name: string): string {
  const templates: Record<string, string> = {
    'LOW_PRICE': `${name}님! 마지막 기회입니다! ⏰

"다음에 할래요" → 이 말씀,
5년 뒤에도 같은 말씀이 될 거에요.

**지금이 마지막입니다.**
- 남은 자리: 단 10명
- 추가 할인: 오늘까지만
- 할부 무이자: 지금 신청자만

[지금 신청] → https://bit.ly/mabiz-day3

담당자: 01012341234 (카톡 가능)`,

    'FILIAL': `${name}님! 부모님을 위해 지금 결정하세요! ⏰

'내년에 해야겠다' → 내년은 오지 않습니다.

**지금이 정말 마지막입니다.**
- 남은 자리: 단 10명
- 의료비 보증: 지금 신청자만
- 의사 동반: 개인별 배정

[지금 신청] → https://bit.ly/mabiz-day3

담당자: 01012341234 (카톡 가능)`,

    'HONEYMOON': `${name}님! 신혼의 황금기는 지금입니다! 💕 ⏰

"나중에 할래요" → 나중은 영원히 오지 않습니다.

**지금 신청하면:**
- 전문 사진작가 동반 (무료, 120만 원 상당)
- 신혼 스파 풀 + 마사지 (무료)
- 인생샷 영상까지 (무료, 200만 원 상당)

[지금 신청] → https://bit.ly/mabiz-day3

담당자: 01012341234 (카톡 가능)`,
  };

  return templates[segment] || templates['HONEYMOON'];
}
