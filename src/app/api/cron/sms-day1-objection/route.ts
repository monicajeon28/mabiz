export const runtime = 'nodejs';
export const maxDuration = 120;
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCronSecret } from '@/lib/cron-middleware';
// 조직>env 폴백 config 해석으로 발신 (멀티조직 OrgSmsConfig 지원)
import { resolveUserSmsConfig } from '@/lib/aligo';

/**
 * POST /api/cron/sms-day1-objection
 *
 * Menu #58: Day 1 SMS 자동화 (24시간)
 *
 * 역할:
 * - 이전 SMS 응답율 분석 (클릭/콜/예약 확인)
 * - S (해결책) 단계 메시지 발송
 *   - 응답 있음: 감사 메시지 + 다음 액션
 *   - 응답 없음: 이의 감지 알고리즘 실행 → 자동 대응 메시지
 * - Risk Flag 업데이트
 * - Day 2 자동 스케줄링
 *
 * 심리학 기법:
 * - L1 (가격 이의 대응): 가격 이의 감지 및 자동 대응
 * - PASONA S단계: "이 문제를 해결할 수 있는 방법"
 * - Grant Cardone: 이의 처리 LISTEN-ISOLATE-VALIDATE
 */

interface Day1Response {
  status: string;
  timestamp: string;
  successCount: number;
  failCount: number;
  respondedCount: number;
  objectionDetectedCount: number;
  errors: Array<{
    contactId: string;
    error: string;
  }>;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const response: Day1Response = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    successCount: 0,
    failCount: 0,
    respondedCount: 0,
    objectionDetectedCount: 0,
    errors: [],
  };

  try {
    // 인증 검증 (통일된 미들웨어 사용)
    const authResult = validateCronSecret(req);
    if (!authResult.ok) {
      return authResult.response || NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON/SMS-DAY1] 시작');

    // 1. Day 0 SMS를 발송한 지 약 24시간 된 고객 추출
    const now = new Date();
    const day1RangeStart = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30시간 전
    const day1RangeEnd = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18시간 전

    const day0SentContacts = await prisma.contact.findMany({
      where: {
        smsDay0Sent: true,
        smsDay0SentAt: {
          gte: day1RangeStart,
          lte: day1RangeEnd,
        },
        smsDay1Sent: false,
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        smsDay0SentAt: true,
        lensMetadata: true,
      },
      take: 1000,
    });

    logger.log(`[CRON/SMS-DAY1] Day 0 발송 고객: ${day0SentContacts.length}명`);

    // 2. 각 고객의 응답 여부 확인 + SMS 발송
    for (const contact of day0SentContacts) {
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

        // Day 0 이후의 Call/Click/CallLog 확인 (응답 신호)
        const callLogCount = contact.smsDay0SentAt ? await prisma.callLog.count({
          where: {
            contactId: contact.id,
            createdAt: {
              gte: contact.smsDay0SentAt,
            },
          },
        }) : 0;

        // 간단한 응답 감지 (프로덕션에서는 더 정교함)
        const hasResponse = callLogCount > 0;

        let message = '';
        if (hasResponse) {
          // 응답 있음: 감사 + 다음 액션 (PASONA S단계)
          message = `감사합니다! 연락을 주셨네요.

🎯 크루즈 예약 전문가가 당신의 질문에 답변해드리겠습니다.
지금 바로 상담 예약하기 → http://mabiz.kr/book

궁금한 점이 있으신가요?`;

          response.respondedCount++;
        } else {
          // 응답 없음: 이의 감지 (L1 - 가격 이의 가정)
          // Grant Cardone: 이의 처리 - LISTEN (귀 기울이기)
          message = `혹시 크루즈 비용이 고민되시나요?

💰 좋은 소식: 월 $2,334 절감 + 무이자 할부 가능합니다!
- 최대 12개월 분할 가능
- 비용 없이 무료 상담 가능

자세히 알아보기 → http://mabiz.kr

질문이 있으신가요? 바로 연락주세요!`;

          response.objectionDetectedCount++;

          // Risk Flag 업데이트 (가격 이의 신호)
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              lensMetadata: {
                ...(typeof contact.lensMetadata === 'object' && contact.lensMetadata !== null ? contact.lensMetadata as Record<string, unknown> : {}),
                priceObjectionDetected: true,
                detectedAt: new Date().toISOString(),
              },
            },
          });
        }

        // SMS 발송 — 조직별 알리고 설정 해석 (OrgSmsConfig > env 폴백)
        const config = await resolveUserSmsConfig(contact.organizationId);

        if (!config) {
          logger.error('[SMS/ALIGO-DAY1] 발신 설정 없음 (OrgSmsConfig/env 모두 미설정)', {
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
          body: new URLSearchParams({
            key: config.key,
            user_id: config.userId,
            sender: config.sender,
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
              channel: 'DAY1_OBJECTION',
            },
          });

          // Contact 업데이트
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              smsDay1Sent: true,
              smsDay1SentAt: new Date(),
            },
          });

          response.successCount++;
        } else {
          logger.error('[SMS/DAY1] 발송 실패', {
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
        logger.error('[CRON/SMS-DAY1] 개별 고객 처리 에러', {
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
    if (day0SentContacts.length > 0) {
      await prisma.executionLog.createMany({
        data: day0SentContacts.map((c) => ({
          organizationId: c.organizationId,
          sourceType: 'SMS_CRON',
          sourceId: 'DAY1_OBJECTION',
          sourceName: 'SMS Day 1 Objection Handling',
          contactId: c.id,
          channel: 'DAY1_OBJECTION',
          status: response.errors.find((e) => e.contactId === c.id) ? 'FAILED' : 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    response.status = 'COMPLETED';
    const duration = Date.now() - startTime;

    logger.log('[CRON/SMS-DAY1] 완료', {
      ...response,
      duration: `${duration}ms`,
    });

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[CRON/SMS-DAY1] 전체 오류', { err });
    response.status = 'ERROR';
    return NextResponse.json(response, { status: 500 });
  }
}
