export const runtime = 'nodejs';
export const maxDuration = 120;
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCronSecret } from '@/lib/cron-middleware';
// 조직>env 폴백 config 해석으로 발신 (멀티조직 OrgSmsConfig 지원)
import { resolveUserSmsConfig } from '@/lib/aligo';
import { resolveSenderUserId } from '@/lib/aligo/sender-resolver';

/**
 * POST /api/cron/sms-day3-action
 *
 * Menu #58: Day 3 SMS 자동화 (72시간)
 *
 * 역할:
 * - N (좁혀진 범위) + A (행동 요청) 단계 메시지 발송
 *   - 긴박감: "오늘 마감", "48시간만", "마지막 2자리"
 *   - 삼중선택: A안/B안/C안 (모두 구매)
 *   - 강력한 CTA: "지금 예약하기"
 * - 최종 의사결정 유도
 * - Day 7 재접근 자동 스케줄링
 *
 * 심리학 기법:
 * - L6 (타이밍 손실회피): "시간이 모자란다", "가격 인상 예정"
 * - L10 (즉시 구매 클로징): "삼중선택 + 감정적 마무리"
 * - PASONA N+A단계: "좁혀진 선택지 + 즉시 행동"
 * - Russell Brunson: Urgency + Scarcity (한정된 시간/자리)
 */

interface Day3Response {
  status: string;
  timestamp: string;
  successCount: number;
  failCount: number;
  totalEngagementRate: number;
  errors: Array<{
    contactId: string;
    error: string;
  }>;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const response: Day3Response = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    successCount: 0,
    failCount: 0,
    totalEngagementRate: 0,
    errors: [],
  };

  try {
    // 인증 검증 (통일된 미들웨어 사용)
    const authResult = validateCronSecret(req);
    if (!authResult.ok) {
      return authResult.response || NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON/SMS-DAY3] 시작');

    // 1. Day 2 SMS를 발송한 지 약 24시간 된 고객 추출
    const now = new Date();
    const day3RangeStart = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30시간 전
    const day3RangeEnd = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18시간 전

    const day2SentContacts = await prisma.contact.findMany({
      where: {
        smsDay2Sent: true,
        smsDay2SentAt: {
          gte: day3RangeStart,
          lte: day3RangeEnd,
        },
        smsDay3Sent: false,
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        assignedUserId: true, // 담당자 개인 알리고 발송
        smsDay0SentAt: true,
        smsDay1SentAt: true,
        smsDay2SentAt: true,
        vipStatus: true,
        lensMetadata: true,
      },
      take: 1000,
    });

    logger.log(`[CRON/SMS-DAY3] Day 2 발송 고객: ${day2SentContacts.length}명`);

    let totalEngaged = 0;

    // 2. 각 고객의 누적 응답 분석 + 최종 결정 메시지
    for (const contact of day2SentContacts) {
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

        // 누적 응답 여부 분석 (Day 0-2)
        const totalCallLogs = contact.smsDay0SentAt ? await prisma.callLog.count({
          where: {
            contactId: contact.id,
            createdAt: {
              gte: contact.smsDay0SentAt,
            },
          },
        }) : 0;

        const hasEngagement = totalCallLogs > 0;
        if (hasEngagement) {
          totalEngaged++;
        }

        // L10 렌즈: 삼중선택 (모두 예약 유도)
        // A안: 프리미엄 (비싼 선택)
        // B안: 스탠다드 (중간 선택)
        // C안: 기본 (저렴한 선택 - 하지만 여전히 구매)

        const isVip = contact.vipStatus === 'GOLD';

        // PASONA N+A: 긴박감 + 삼중선택 + 강력한 CTA
        const message = `⏰ 마지막 기회! 이 가격은 오늘까지만 유효합니다.

🎯 당신의 선택은?

A) 프리미엄 경험 (5성급 선실)
   → 최고의 편안함 + VIP 서비스 포함

B) 스탠다드 경험 (3성급 선실)
   → 완벽한 가성비 + 모든 시설 이용

C) 기본 경험 (내부 선실)
   → 경제적 선택 + 핵심 즐거움은 100%

💳 무이자 할부로 시작 가능!

지금 바로 예약하기 (링크 선택)
→ http://mabiz.kr/premium
→ http://mabiz.kr/standard
→ http://mabiz.kr/basic

${isVip ? '⭐ VIP 멤버님께 감사드립니다!' : '🎁 처음 고객님은 추가 5% 할인!'}

예약 문의: [전화번호]`;

        // SMS 발송 — 조직별 알리고 설정 해석 (OrgSmsConfig > env 폴백)
        const config = await resolveUserSmsConfig(contact.organizationId, resolveSenderUserId({ contactAssignedUserId: contact.assignedUserId }));

        if (!config) {
          logger.error('[SMS/ALIGO-DAY3] 발신 설정 없음 (OrgSmsConfig/env 모두 미설정)', {
            organizationId: contact.organizationId,
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
          signal: AbortSignal.timeout(10_000),
          body: new URLSearchParams({
            key: config.key,
            user_id: config.userId,
            sender: config.sender,
            receiver: normalizedPhone,
            msg: message,
          }),
        });

        const data = await res.json();

        if (Number(data.result_code) === 1) {
          // SmsLog 기록
          await prisma.smsLog.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              phone: normalizedPhone,
              contentPreview: message.substring(0, 100),
              status: 'SENT',
              msgId: data.msg_id,
              channel: 'DAY3_ACTION',
            },
          });

          // Contact 업데이트
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              smsDay3Sent: true,
              smsDay3SentAt: new Date(),
            },
          });

          response.successCount++;
        } else {
          logger.error('[SMS/DAY3] 발송 실패', {
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
        logger.error('[CRON/SMS-DAY3] 개별 고객 처리 에러', {
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

    // 3. Day 7 Follow-up 자동 스케줄링
    const day7Time = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    for (const contact of day2SentContacts) {
      if (!response.errors.find((e) => e.contactId === contact.id)) {
        await prisma.scheduledSms.create({
          data: {
            organizationId: contact.organizationId,
            contactId: contact.id,
            message: `[Day 7] 혹시 예약하셨나요? 아직이라면 지금 시작하세요! → http://mabiz.kr`,
            scheduledAt: day7Time,
            status: 'PENDING',
            channel: 'DAY7_FOLLOWUP',
          },
        });
      }
    }

    // 4. ExecutionLog 기록
    if (day2SentContacts.length > 0) {
      await prisma.executionLog.createMany({
        data: day2SentContacts.map((c) => ({
          organizationId: c.organizationId,
          sourceType: 'SMS_CRON',
          sourceId: 'DAY3_ACTION',
          sourceName: 'SMS Day 3 Action & Decision',
          contactId: c.id,
          channel: 'DAY3_ACTION',
          status: response.errors.find((e) => e.contactId === c.id) ? 'FAILED' : 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    // 5. 응답율 계산
    response.totalEngagementRate =
      day2SentContacts.length > 0 ? (totalEngaged / day2SentContacts.length) * 100 : 0;

    response.status = 'COMPLETED';
    const duration = Date.now() - startTime;

    logger.log('[CRON/SMS-DAY3] 완료', {
      ...response,
      duration: `${duration}ms`,
    });

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[CRON/SMS-DAY3] 전체 오류', { err });
    response.status = 'ERROR';
    return NextResponse.json(response, { status: 500 });
  }
}
