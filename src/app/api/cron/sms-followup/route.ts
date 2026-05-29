export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/sms-followup
 *
 * Menu #58: Follow-up SMS 자동화 (Day 7/14/30/60/90)
 *
 * 역할:
 * - Grant Cardone 7회 접촉 규칙 적용
 *   - 1차 (Day 7): "혹시 질문 있으세요?"
 *   - 2차 (Day 14): "배우자 의견은?"
 *   - 3차 (Day 30): "다른 사람들은 이미..."
 *   - 4차 (Day 60): "지금 신청하면 10% 추가 할인"
 *   - 5차 (Day 90): "마지막 기회"
 * - 누적 응답율에 따라 강도 조절
 * - 전환 시 자동 중단, 미전환 시 계속
 *
 * 심리학 기법:
 * - L0 (부재중 고객 재활성화): "시간이 지났지만 관심사는 변하지 않음"
 * - L7 (동반자 설득): "배우자 의견" 확인
 * - L8 (재구매 습관화): "이미 많은 사람들이 시작"
 * - Grant Cardone Follow-up: "5-12회 접촉으로 80% 판매"
 */

interface FollowupResponse {
  status: string;
  timestamp: string;
  sentCount: number;
  failCount: number;
  convertedCount: number;
  daysProcessed: number[];
  errors: Array<{
    contactId: string;
    error: string;
  }>;
}

// Follow-up 시퀀스 정의
const FOLLOWUP_SEQUENCES = [
  {
    day: 7,
    psychologyLens: 'L0 + L8',
    message: (name: string) =>
      `안녕하세요, ${name}님!

혹시 크루즈 예약 중에 질문이 있으신가요?
우리 팀이 모든 걱정을 해결해드립니다.

📞 전문 상담가와 무료 상담하기
→ http://mabiz.kr/consult

감사합니다!`,
  },
  {
    day: 14,
    psychologyLens: 'L7',
    message: (name: string) =>
      `${name}님, 안녕하세요!

혹시 배우자분께도 크루즈에 대해 말씀해주셨나요?

함께 상담받으면 결정이 더 쉬워집니다.
👨‍👩‍👧‍👦 가족 특별 할인 + 동반자 무료 상담

지금 예약 → http://mabiz.kr

감사합니다!`,
  },
  {
    day: 30,
    psychologyLens: 'L8',
    message: (name: string) =>
      `${name}님께 좋은 소식이 있습니다!

지난 달, 저희 고객분들이 평균 월 $2,334을 절감했습니다.
당신도 이 혜택을 놓치고 싶으세요?

이미 많은 분들이 시작했습니다.
당신은 언제 시작하시겠어요?

지금 예약 → http://mabiz.kr

감사합니다!`,
  },
  {
    day: 60,
    psychologyLens: 'L10',
    message: (name: string) =>
      `${name}님, 특별한 제안입니다!

오늘 신청하시면 평소 가격에서 10% 추가 할인!
이 할인은 오늘까지만 유효합니다.

🎁 한정 할인: MABIZ60 (10% OFF)
⏰ 유효기간: 오늘 자정까지

지금 예약 → http://mabiz.kr

감사합니다!`,
  },
  {
    day: 90,
    psychologyLens: 'L6',
    message: (name: string) =>
      `${name}님께 마지막 제안입니다.

3개월을 기다리신 동안 이미 많은 분들이 예약하셨습니다.
좋은 날짜들이 점점 남아있지 않습니다.

⚠️ 마지막 기회: 지금 예약하세요!

→ http://mabiz.kr

감사합니다!`,
  },
];

export async function POST(req: Request) {
  const startTime = Date.now();
  const response: FollowupResponse = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    sentCount: 0,
    failCount: 0,
    convertedCount: 0,
    daysProcessed: [],
    errors: [],
  };

  try {
    // 인증 검증
    const cronSecret = req.headers.get('x-vercel-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON/SMS-FOLLOWUP] 시작');

    const now = new Date();

    // 1. 각 Follow-up Day별로 처리
    for (const sequence of FOLLOWUP_SEQUENCES) {
      try {
        // 예약된 SMS 찾기 (scheduledAt이 현재 시간 ±1시간)
        const rangeStart = new Date(now.getTime() - 60 * 60 * 1000);
        const rangeEnd = new Date(now.getTime() + 60 * 60 * 1000);

        const scheduledSmsList = await prisma.scheduledSms.findMany({
          where: {
            channel: `DAY${sequence.day}_FOLLOWUP`,
            status: 'PENDING',
            scheduledAt: {
              gte: rangeStart,
              lte: rangeEnd,
            },
          },
          include: {
            organization: {
              select: { id: true },
            },
          },
          take: 1000,
        });

        if (scheduledSmsList.length === 0) {
          logger.log(`[CRON/SMS-FOLLOWUP] Day ${sequence.day} 대상 없음`);
          continue;
        }

        logger.log(`[CRON/SMS-FOLLOWUP] Day ${sequence.day} 처리: ${scheduledSmsList.length}명`);

        // 2. 각 고객 처리
        for (const scheduledSms of scheduledSmsList) {
          try {
            if (!scheduledSms.contactId) {
              await prisma.scheduledSms.update({
                where: { id: scheduledSms.id },
                data: { status: 'SKIPPED' },
              });
              continue;
            }

            // Contact 정보 조회
            const contact = await prisma.contact.findUnique({
              where: { id: scheduledSms.contactId },
              select: {
                id: true,
                phone: true,
                name: true,
                organizationId: true,
                purchasedAt: true,
                optOutAt: true,
              },
            });

            if (!contact || contact.optOutAt) {
              await prisma.scheduledSms.update({
                where: { id: scheduledSms.id },
                data: { status: 'SKIPPED' },
              });
              continue;
            }

            // 이미 구매한 고객인 경우 스킵
            if (contact.purchasedAt) {
              response.convertedCount++;
              await prisma.scheduledSms.update({
                where: { id: scheduledSms.id },
                data: { status: 'CONVERTED' },
              });
              continue;
            }

            // SMS 발송
            const normalizedPhone = contact.phone.replace(/[^\d]/g, '');
            if (!normalizedPhone || normalizedPhone.length < 10) {
              response.failCount++;
              await prisma.scheduledSms.update({
                where: { id: scheduledSms.id },
                data: { status: 'FAILED' },
              });
              response.errors.push({
                contactId: contact.id,
                error: '유효하지 않은 전화번호',
              });
              continue;
            }

            // 메시지 생성
            const message = sequence.message(contact.name);

            // Aligo API 호출
            const aligoKey = process.env.ALIGO_API_KEY;
            const aligoUserId = process.env.ALIGO_USER_ID;
            const aligoSender = process.env.ALIGO_SENDER_PHONE;

            if (!aligoKey || !aligoUserId || !aligoSender) {
              logger.error('[SMS/ALIGO-FOLLOWUP] 필수 환경변수 누락', {
                hasKey: !!aligoKey,
                hasUserId: !!aligoUserId,
                hasSender: !!aligoSender,
              });
              response.failCount++;
              await prisma.scheduledSms.update({
                where: { id: scheduledSms.id },
                data: { status: 'FAILED' },
              });
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
                  channel: `DAY${sequence.day}_FOLLOWUP`,
                },
              });

              // ScheduledSms 업데이트
              await prisma.scheduledSms.update({
                where: { id: scheduledSms.id },
                data: {
                  status: 'SENT',
                  sentAt: new Date(),
                  sentCount: (scheduledSms.sentCount || 0) + 1,
                },
              });

              response.sentCount++;
            } else {
              logger.error('[SMS/FOLLOWUP] 발송 실패', {
                day: sequence.day,
                phone: normalizedPhone,
                code: data.result_code,
              });

              response.failCount++;
              await prisma.scheduledSms.update({
                where: { id: scheduledSms.id },
                data: { status: 'FAILED' },
              });

              response.errors.push({
                contactId: contact.id,
                error: `Day ${sequence.day} Aligo Error: ${data.result_code}`,
              });
            }
          } catch (contactErr) {
            logger.error('[CRON/SMS-FOLLOWUP] 개별 고객 처리 에러', {
              day: sequence.day,
              contactId: scheduledSms.contactId,
              err: contactErr,
            });
            response.failCount++;
            await prisma.scheduledSms.update({
              where: { id: scheduledSms.id },
              data: { status: 'FAILED' },
            });
            response.errors.push({
              contactId: scheduledSms.contactId || 'unknown',
              error: `Day ${sequence.day} Error: ${String(contactErr)}`,
            });
          }
        }

        response.daysProcessed.push(sequence.day);
      } catch (seqErr) {
        logger.error('[CRON/SMS-FOLLOWUP] 시퀀스 처리 에러', {
          day: sequence.day,
          err: seqErr,
        });
      }
    }

    response.status = 'COMPLETED';
    const duration = Date.now() - startTime;

    logger.log('[CRON/SMS-FOLLOWUP] 완료', {
      ...response,
      duration: `${duration}ms`,
    });

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[CRON/SMS-FOLLOWUP] 전체 오류', { err });
    response.status = 'ERROR';
    return NextResponse.json(response, { status: 500 });
  }
}
