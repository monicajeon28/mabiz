export const runtime = 'nodejs';
export const maxDuration = 120;
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCronSecret } from '@/lib/cron-middleware';
import { normalizePhone } from '@/lib/import-utils';
// 조직>env 폴백 config 해석으로 발신 (멀티조직 OrgSmsConfig 지원)
import { resolveUserSmsConfig } from '@/lib/aligo';

/**
 * POST /api/cron/sms-day0-init
 *
 * Menu #58: Day 0 SMS 자동화 (발송 30분 후)
 *
 * 역할:
 * - Contact.lastCruiseEndDate ±24시간 조건으로 자격 고객 추출
 * - PASONA P (문제) + A (자극) 단계 메시지 발송
 *   - "크루즈 끝나고도 피로가 남아 있나요?"
 *   - "다음 여행은 이미 정해져 있나요?"
 * - SMS 발송 로그 기록 (SmsLog)
 * - ScheduledSms 테이블에 Day 1-3 자동 스케줄링
 *
 * 심리학 기법:
 * - L6 (타이밍 손실회피): "지금이 좋은 시점인가?"
 * - L10 (즉시 구매 클로징): 긴박감 ("비용이 오를 예정")
 * - PASONA P단계: 크루즈 피로 상태 문제 제시
 * - PASONA A단계: "다음 여행을 지금 결정해야 하는 이유"
 *
 * 반환: { successCount, failCount, scheduledCount, errors[] }
 */

interface SmsDay0Response {
  status: string;
  timestamp: string;
  successCount: number;
  failCount: number;
  scheduledCount: number;
  errors: Array<{
    contactId: string;
    error: string;
  }>;
}

async function sendSmsViaAligo(
  organizationId: string,
  phone: string,
  message: string
): Promise<{ success: boolean; msgId?: string; errorCode?: string }> {
  try {
    // 조직별 알리고 설정 해석 (UserSmsConfig 미해당 → 조직 OrgSmsConfig > env 폴백)
    const config = await resolveUserSmsConfig(organizationId);

    if (!config) {
      logger.error('[SMS/ALIGO-DAY0] 발신 설정 없음 (OrgSmsConfig/env 모두 미설정)', {
        organizationId,
      });
      return { success: false, errorCode: 'MISSING_CONFIG' };
    }

    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: config.key,
        user_id: config.userId,
        sender: config.sender,
        receiver: phone,
        msg: message,
      }),
    });

    const data = await res.json();

    if (Number(data.result_code) === 1) {
      return { success: true, msgId: data.msg_id };
    } else {
      logger.error('[SMS/ALIGO] 발송 실패', {
        phone,
        code: data.result_code,
        message: data.message,
      });
      return { success: false, errorCode: data.result_code };
    }
  } catch (err) {
    logger.error('[SMS/ALIGO] 네트워크 오류', { phone, err });
    return { success: false, errorCode: 'NETWORK_ERROR' };
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const response: SmsDay0Response = {
    status: 'PROCESSING',
    timestamp: new Date().toISOString(),
    successCount: 0,
    failCount: 0,
    scheduledCount: 0,
    errors: [],
  };

  try {
    // 인증 검증 (통일된 미들웨어 사용)
    const authResult = validateCronSecret(req);
    if (!authResult.ok) {
      return authResult.response || NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON/SMS-DAY0] 시작');

    // 1. 자격 고객 추출 (lastCruiseEndDate ±24시간)
    const now = new Date();
    const day0Start = new Date(now.getTime() - 30 * 60 * 1000); // 30분 전
    const day0End = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // +1일

    const qualifiedContacts = await prisma.contact.findMany({
      where: {
        // Day 0 조건: lastCruiseEndDate ±24시간
        lastCruiseDate: {
          gte: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000), // 지난 36시간
          lte: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000), // 지난 12시간
        },
        // SMS Day 0 미발송
        smsDay0Sent: false,
        // 선택 해제 아님
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        lastCruiseDate: true,
        cruiseCount: true,
        vipStatus: true,
      },
      take: 1000, // 배치 처리 (대량 발송 시 분산)
    });

    logger.log(`[CRON/SMS-DAY0] 자격 고객: ${qualifiedContacts.length}명`);

    // 2. 각 고객에게 Day 0 SMS 발송
    for (const contact of qualifiedContacts) {
      try {
        // 정규화된 전화번호
        const normalizedPhone = contact.phone?.replace(/[^\d]/g, '') ?? '';
        if (!normalizedPhone || normalizedPhone.length < 10) {
          response.failCount++;
          response.errors.push({
            contactId: contact.id,
            error: '유효하지 않은 전화번호',
          });
          continue;
        }

        // PASONA P + A 단계 메시지 (L6 + L10 심리학)
        // 변형 A: 문제 + 자극 (기본)
        const message = `크루즈 여행 후에도 피로와 스트레스가 남아 있나요?

🌊 다음 여행으로 완벽한 회복을 경험해보세요!
비용이 오를 예정이므로 지금이 좋은 시점입니다.

자세한 정보 보기 → http://mabiz.kr`;

        // Aligo API 호출
        const smsResult = await sendSmsViaAligo(contact.organizationId, normalizedPhone, message);

        if (smsResult.success) {
          // SmsLog 기록
          await prisma.smsLog.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              phone: normalizedPhone,
              contentPreview: message.substring(0, 100),
              status: 'SENT',
              msgId: smsResult.msgId,
              channel: 'DAY0_SEQUENCE',
            },
          });

          // Contact 업데이트
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              smsDay0Sent: true,
              smsDay0SentAt: new Date(),
            },
          });

          // Day 1-3 자동 스케줄링 (SMS 발송 성공 시에만)
          // Day 1: +24시간
          const day1Time = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          await prisma.scheduledSms.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              message: `[Day 1] 크루즈에 관심이 있으신가요? 더 알아보기 → http://mabiz.kr`,
              scheduledAt: day1Time,
              status: 'PENDING',
              channel: 'DAY1_OBJECTION',
            },
          });

          // Day 2: +48시간
          const day2Time = new Date(now.getTime() + 48 * 60 * 60 * 1000);
          await prisma.scheduledSms.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              message: `[Day 2] 월 $2,334 절감 + 가족 건강! 지금 예약하기 → http://mabiz.kr`,
              scheduledAt: day2Time,
              status: 'PENDING',
              channel: 'DAY2_VALUE',
            },
          });

          // Day 3: +72시간
          const day3Time = new Date(now.getTime() + 72 * 60 * 60 * 1000);
          await prisma.scheduledSms.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              message: `[Day 3] ⏰ 마지막 기회! 오늘 예약하면 10% 할인 적용 → http://mabiz.kr`,
              scheduledAt: day3Time,
              status: 'PENDING',
              channel: 'DAY3_ACTION',
            },
          });

          response.scheduledCount += 3;
          response.successCount++;
        } else {
          // 실패 로그
          await prisma.smsLog.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              phone: normalizedPhone,
              contentPreview: message.substring(0, 100),
              status: 'FAILED',
              blockReason: smsResult.errorCode || 'UNKNOWN_ERROR',
              channel: 'DAY0_SEQUENCE',
            },
          });

          response.failCount++;
          response.errors.push({
            contactId: contact.id,
            error: `Aligo Error: ${smsResult.errorCode}`,
          });
        }
      } catch (contactErr) {
        logger.error('[CRON/SMS-DAY0] 개별 고객 처리 에러', {
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

    // 3. ExecutionLog 기록 (추적용)
    if (qualifiedContacts.length > 0) {
      await prisma.executionLog.createMany({
        data: qualifiedContacts.map((c) => ({
          organizationId: c.organizationId,
          sourceType: 'SMS_CRON',
          sourceId: 'DAY0_INIT',
          sourceName: 'SMS Day 0 Initialization',
          contactId: c.id,
          channel: 'DAY0_SEQUENCE',
          status: response.errors.find((e) => e.contactId === c.id) ? 'FAILED' : 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    response.status = 'COMPLETED';
    const duration = Date.now() - startTime;

    logger.log('[CRON/SMS-DAY0] 완료', {
      ...response,
      duration: `${duration}ms`,
    });

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[CRON/SMS-DAY0] 전체 오류', { err });
    response.status = 'ERROR';
    return NextResponse.json(response, { status: 500 });
  }
}
