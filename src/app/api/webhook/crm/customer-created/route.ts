/**
 * POST /api/webhook/crm/customer-created
 * 크루즈닷몰 고객 생성 이벤트 수신
 *
 * 트리거: 크루즈닷몰에서 새 고객 가입
 * 액션:
 *  1. Contact 생성/업데이트
 *  2. 심리학 렌즈 자동 분류 (L0)
 *  3. 환영 SMS 발송 (Day 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/webhooks/base';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * L0 렌즈 분류 규칙
 * 신규 고객은 모두 L0_ACTIVE로 분류됨
 * 향후 고객이 부재중이 되면 다른 L0 세그먼트로 자동 재분류됨
 */
type ReactivationSegment = '3-6m' | '6-12m' | '1y+' | null;
type ReactivationTag = '신규활성' | '재활성화-3-6m' | '재활성화-6-12m' | '재활성화-1년이상' | null;

interface L0Classification {
  segment: ReactivationSegment;
  likelihood: number; // 0-100 (신규는 50)
  tag: ReactivationTag;
}

function classifyL0Lens(contactId: string, organizationId: string): L0Classification {
  // 신규 고객은 항상 활성 상태로 시작
  // reactivationSegment는 null (부재중이 될 때만 값 설정)
  return {
    segment: null,
    likelihood: 50, // 신규 고객의 기본 활성도
    tag: '신규활성'
  };
}

async function sendSmsViaAligo(
  organizationId: string,
  phone: string,
  message: string
): Promise<{ success: boolean; msgId?: string; errorCode?: string }> {
  try {
    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: process.env.ALIGO_API_KEY!,
        user_id: process.env.ALIGO_USER_ID!,
        sender: process.env.ALIGO_SENDER_PHONE!,
        receiver: phone,
        msg: message,
      }),
    });

    const data = await res.json();

    if (data.result_code === '1') {
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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CustomerCreatedPayload {
  eventId: string;
  eventType: 'customer.created';
  timestamp: string;
  customerId: string; // GMcruise User ID
  email: string;
  phoneNumber: string;
  name: string;
  affiliateId?: number; // 제휴사 ID
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET || 'test-secret';

  return handleWebhook(req, {
    webhookType: 'customer-created',
    secret,
    requireAuth: true,
    handler: async (payload: CustomerCreatedPayload) => {
      const {
        eventId,
        customerId,
        email,
        phoneNumber,
        name,
        affiliateId
      } = payload;

      // 필드 검증
      if (!customerId || !email || !name) {
        logger.warn('[customer-created] 필수 필드 누락', { customerId, email, name });
        throw new Error('Missing required fields: customerId, email, name');
      }

      // 기본 organizationId (나중에 affiliateId 기반으로 결정)
      // TODO: affiliateId → organizationId 매핑
      const organizationId = 'org_cruisedot'; // 임시

      // Contact 생성/업데이트
      const contact = await prisma.contact.upsert({
        where: {
          email_organizationId: {
            email,
            organizationId
          }
        },
        create: {
          email,
          phone: phoneNumber || '',
          name,
          organizationId,
          type: 'PROSPECT', // 아직 구매 전
          externalId: customerId, // GMcruise User ID
          lastContactedAt: new Date(),
          dataSource: 'cruisedot'
        },
        update: {
          phone: phoneNumber || undefined,
          name,
          externalId: customerId,
          lastContactedAt: new Date()
        },
        select: {
          id: true,
          organizationId: true,
          email: true
        }
      });

      logger.log('[customer-created] Contact 생성/업데이트', {
        contactId: contact.id,
        email,
        customerId
      });

      // L0 렌즈 자동 분류 (부재중 고객 재활성화)
      const l0Classification = classifyL0Lens(contact.id, organizationId);

      // Contact 업데이트: L0 렌즈 + 재활성화 세그먼트
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          reactivationSegment: l0Classification.segment, // "3-6m", "6-12m", "1y+"
          reactivationLikelihood: l0Classification.likelihood, // 0-100
          tags: ['신규가입', l0Classification.tag].filter(Boolean),
        }
      });

      logger.log('[customer-created] L0 렌즈 분류 완료', {
        contactId: contact.id,
        segment: l0Classification.segment,
        likelihood: l0Classification.likelihood
      });

      // Day 0 SMS 발송 (신규 고객 환영 - PASONA P단계)
      // 심리학 기법: L6 (타이밍 손실회피) + 희소성
      const welcomeMessage = `[마비즈] 크루즈 여행을 꿈꾸세요?

환영합니다! 신규 회원 특별 혜택이 준비되어 있습니다.
• 첫 예약 10% 할인
• 무료 컨설팅 (제한된 시간)

지금 예약하기 → http://mabiz.kr/new

답장 불가능한 자동 발송입니다.`;

      try {
        const normalizedPhone = (phoneNumber || '').replace(/[^\d]/g, '');

        if (normalizedPhone && normalizedPhone.length >= 10) {
          const smsResult = await sendSmsViaAligo(
            organizationId,
            normalizedPhone,
            welcomeMessage
          );

          if (smsResult.success) {
            // SmsLog 기록
            await prisma.smsLog.create({
              data: {
                organizationId,
                contactId: contact.id,
                phone: normalizedPhone,
                contentPreview: welcomeMessage.substring(0, 100),
                status: 'SENT',
                msgId: smsResult.msgId,
                channel: 'WEBHOOK_WELCOME',
                segmentCode: 'L0_ACTIVE',
                psychologyLens: 'SCARCITY,TIMING'
              }
            });

            // Contact 업데이트: SMS Day 0 발송 마크
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                smsDay0Sent: true,
                smsDay0SentAt: new Date()
              }
            });

            logger.log('[customer-created] Day 0 SMS 발송 성공', {
              contactId: contact.id,
              phone: normalizedPhone,
              msgId: smsResult.msgId
            });
          } else {
            logger.warn('[customer-created] Day 0 SMS 발송 실패', {
              contactId: contact.id,
              phone: normalizedPhone,
              errorCode: smsResult.errorCode
            });

            // 실패 로그
            await prisma.smsLog.create({
              data: {
                organizationId,
                contactId: contact.id,
                phone: normalizedPhone,
                contentPreview: welcomeMessage.substring(0, 100),
                status: 'FAILED',
                blockReason: smsResult.errorCode || 'UNKNOWN_ERROR',
                channel: 'WEBHOOK_WELCOME'
              }
            });
          }
        }
      } catch (smsErr) {
        logger.error('[customer-created] SMS 발송 중 오류', {
          contactId: contact.id,
          err: smsErr
        });
      }

      return {
        contactId: contact.id,
        email: contact.email,
        status: 'created'
      };
    }
  });
}
