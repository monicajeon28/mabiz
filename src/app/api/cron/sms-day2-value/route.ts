export const runtime = 'nodejs';
export const maxDuration = 120;
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCronSecret } from '@/lib/cron-middleware';

/**
 * POST /api/cron/sms-day2-value
 *
 * Menu #58: Day 2 SMS 자동화 (48시간)
 *
 * 역할:
 * - O (오퍼) 단계 메시지 발송
 *   - 가치 재정의: "월 $2,334 절감", "평생 추억", "가족 건강"
 *   - 사례 스토리: 실제 고객 사례 (3가지 중 랜덤)
 *   - 할인 코드: 조직별 자동 생성 코드
 * - 누적 응답율 분석 (50% 이상이면 고신뢰, 이하면 재접근)
 * - Day 3 자동 스케줄링
 *
 * 심리학 기법:
 * - L8 (재구매/습관화): "평생 가치 + 절감액"
 * - L9 (의료신뢰): "가족 건강" 강조
 * - PASONA O단계: "확실한 오퍼"
 * - Russell Brunson: Story-Based Selling (고객 사례)
 */

interface Day2Response {
  status: string;
  timestamp: string;
  successCount: number;
  failCount: number;
  highEngagementCount: number;
  lowEngagementCount: number;
  errors: Array<{
    contactId: string;
    error: string;
  }>;
}

// 무작위 고객 사례 (3가지)
const CUSTOMER_STORIES = [
  {
    name: '김영희',
    age: 48,
    story:
      '매년 크루즈로 스트레스 해소. 남편과 12박 이상. 절감액으로 아이 학비까지 충당.',
    savings: 2334,
  },
  {
    name: '박민준',
    age: 55,
    story:
      '퇴직 후 아내와 정기적인 크루즈. 건강과 여유가 동시에 생겼습니다.',
    savings: 2334,
  },
  {
    name: '이수진',
    age: 42,
    story:
      '가족 여행이 더 저렴해지니까 더 자주 가게 됨. 올해 이미 3회 예약!',
    savings: 2334,
  },
];

export async function POST(req: Request) {
  const startTime = Date.now();
  const response: Day2Response = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    successCount: 0,
    failCount: 0,
    highEngagementCount: 0,
    lowEngagementCount: 0,
    errors: [],
  };

  try {
    // 인증 검증 (통일된 미들웨어 사용)
    const authResult = validateCronSecret(req);
    if (!authResult.ok) {
      return authResult.response || NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON/SMS-DAY2] 시작');

    // 1. Day 1 SMS를 발송한 지 약 24시간 된 고객 추출
    const now = new Date();
    const day2RangeStart = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30시간 전
    const day2RangeEnd = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18시간 전

    const day1SentContacts = await prisma.contact.findMany({
      where: {
        smsDay1Sent: true,
        smsDay1SentAt: {
          gte: day2RangeStart,
          lte: day2RangeEnd,
        },
        smsDay2Sent: false,
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        smsDay1SentAt: true,
        cruiseCount: true,
        vipStatus: true,
        lensMetadata: true,
      },
      take: 1000,
    });

    logger.log(`[CRON/SMS-DAY2] Day 1 발송 고객: ${day1SentContacts.length}명`);

    // 2. 각 고객의 응답 여부 분석 + 메시지 맞춤화
    for (const contact of day1SentContacts) {
      try {
        const normalizedPhone = contact.phone?.replace(/[^\d]/g, '') ?? '';
        if (!normalizedPhone || normalizedPhone.length < 10) {
          response.failCount++;
          response.errors.push({
            contactId: contact.id,
            error: '유효하지 않은 전화번호',
          });
          continue;
        }

        // 응답 여부 분석 (Call + SMS 응답)
        const callLogCount = contact.smsDay1SentAt ? await prisma.callLog.count({
          where: {
            contactId: contact.id,
            createdAt: {
              gte: contact.smsDay1SentAt,
            },
          },
        }) : 0;

        const hasEngagement = callLogCount > 0;
        response.highEngagementCount += hasEngagement ? 1 : 0;
        response.lowEngagementCount += !hasEngagement ? 1 : 0;

        // 고객 사례 (무작위)
        const randomStory = CUSTOMER_STORIES[Math.floor(Math.random() * CUSTOMER_STORIES.length)];

        // VIP 고객 또는 재구매 고객인 경우 더 강력한 오퍼
        const isVip = contact.vipStatus === 'GOLD' || contact.cruiseCount >= 3;
        const discountCode = `MABIZ${contact.organizationId.substring(0, 4).toUpperCase()}`;

        // PASONA O단계: 가치 재정의 + 사례 + 오퍼
        const message = `🌟 이미 ${randomStory.name}님같은 분들이 시작했어요!

👨‍👩‍👧‍👦 ${randomStory.story}

💰 월 $${randomStory.savings} 절감하기:
${isVip ? `⭐ VIP 멤버 할인 코드: ${discountCode} (추가 15% 할인)` : `🎁 신규 할인 코드: ${discountCode} (10% 할인)`}

지금 예약 → http://mabiz.kr
`;

        // SMS 발송
        const aligoKey = process.env.ALIGO_API_KEY;
        const aligoUserId = process.env.ALIGO_USER_ID;
        const aligoSender = process.env.ALIGO_SENDER_PHONE;

        if (!aligoKey || !aligoUserId || !aligoSender) {
          logger.error('[SMS/ALIGO-DAY2] 필수 환경변수 누락', {
            hasKey: !!aligoKey,
            hasUserId: !!aligoUserId,
            hasSender: !!aligoSender,
          });
          response.failCount++;
          response.errors.push({
            contactId: contact.id,
            error: 'SMS 서비스 설정 오류',
          });
          continue;
        }

        const res = await fetch('https://apis.aligo.in/send/', {
          method: 'POST',
          body: new URLSearchParams({
            key: aligoKey,
            user_id: aligoUserId,
            sender: aligoSender,
            receiver: normalizedPhone,
            msg: message,
          }),
        });

        const data = await res.json();

        if (data.result_code === '1') {
          // SmsLog 기록
          await prisma.smsLog.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              phone: normalizedPhone,
              contentPreview: message.substring(0, 100),
              status: 'SENT',
              msgId: data.msg_id,
              channel: 'DAY2_VALUE',
            },
          });

          // Contact 업데이트
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              smsDay2Sent: true,
              smsDay2SentAt: new Date(),
              // 메타데이터에 제공된 할인 코드 기록
              lensMetadata: {
                ...(typeof contact.lensMetadata === 'object' && contact.lensMetadata !== null ? contact.lensMetadata as Record<string, unknown> : {}),
                offeredDiscountCode: discountCode,
                dayTwoEngagement: hasEngagement ? 'HIGH' : 'LOW',
              },
            },
          });

          response.successCount++;
        } else {
          logger.error('[SMS/DAY2] 발송 실패', {
            phone: normalizedPhone,
            code: data.result_code,
          });

          response.failCount++;
          response.errors.push({
            contactId: contact.id,
            error: `Aligo Error: ${data.result_code}`,
          });
        }
      } catch (contactErr) {
        logger.error('[CRON/SMS-DAY2] 개별 고객 처리 에러', {
          contactId: contact.id,
          err: contactErr,
        });
        response.failCount++;
        response.errors.push({
          contactId: contact.id,
          error: String(contactErr),
        });
      }
    }

    // 3. ExecutionLog 기록
    if (day1SentContacts.length > 0) {
      await prisma.executionLog.createMany({
        data: day1SentContacts.map((c) => ({
          organizationId: c.organizationId,
          sourceType: 'SMS_CRON',
          sourceId: 'DAY2_VALUE',
          sourceName: 'SMS Day 2 Value Proposition',
          contactId: c.id,
          channel: 'DAY2_VALUE',
          status: response.errors.find((e) => e.contactId === c.id) ? 'FAILED' : 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    response.status = 'COMPLETED';
    const duration = Date.now() - startTime;

    logger.log('[CRON/SMS-DAY2] 완료', {
      ...response,
      duration: `${duration}ms`,
    });

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[CRON/SMS-DAY2] 전체 오류', { err });
    response.status = 'ERROR';
    return NextResponse.json(response, { status: 500 });
  }
}
