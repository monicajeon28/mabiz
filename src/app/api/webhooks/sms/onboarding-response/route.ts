export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizePhone } from '@/lib/phone-normalize';
import {
  parseOnboardingResponse,
  decideOnboardingAction,
} from '@/lib/contact/sms-onboarding-parser';
import { classifySegment } from '@/lib/contact/segment-classifier';
import { sendSms } from '@/lib/aligo';

/**
 * POST /api/webhooks/sms/onboarding-response
 *
 * 목적:
 * - 고객의 SMS 온보딩 응답 수신
 * - NLP 파싱 (신뢰도 계산)
 * - 신뢰도별 액션 결정:
 *   - confidence >= 80: auto_save (자동 저장 후 Day N+1 발송)
 *   - confidence >= 50: manual_review (상담사 검토 큐)
 *   - confidence >= 20: retry_sms (재질문)
 *   - confidence < 20: call_required (전화 상담)
 *
 * 요청 바디:
 * {
 *   "phoneNumber": "010-1234-5678",
 *   "message": "신혼 2년이에요, 자녀 없음",
 *   "smsId": "sms-123-abc",
 *   "organizationId": "org-xyz",
 *   "currentDay": 0
 * }
 */

export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_ONBOARDING_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[OnboardingWebhook] MABIZ_ONBOARDING_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (
    Buffer.byteLength(token, 'utf8') !== Buffer.byteLength(secret, 'utf8') ||
    !timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(secret, 'utf8'))
  ) {
    logger.error('[OnboardingWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json() as {
    phoneNumber: string;
    message: string;
    smsId: string;
    organizationId: string;
    currentDay: 0 | 1 | 2 | 3;
  };

  const {
    phoneNumber,
    message,
    smsId,
    organizationId,
    currentDay,
  } = body;

  if (!phoneNumber || !message || currentDay === undefined) {
    return NextResponse.json(
      { ok: false, message: 'phoneNumber, message, currentDay 필수' },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizePhone(phoneNumber);

  logger.log('[OnboardingWebhook] 수신', {
    phone: normalizedPhone.slice(0, 4) + '***',
    currentDay,
  });

  try {
    // 1. Contact 조회
    const contact = await prisma.contact.findFirst({
      where: {
        phone: normalizedPhone,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        organizationId: true,
        marriageStatus: true,
        marriageDate: true,
        childrenCount: true,
        childrenAges: true,
        ageInYears: true,
        autoSegment: true,
      },
    });

    if (!contact) {
      logger.warn('[OnboardingWebhook] Contact 없음', {
        phone: normalizedPhone.slice(0, 4) + '***',
      });
      return NextResponse.json(
        { ok: false, message: 'Contact 없음' },
        { status: 404 }
      );
    }

    // 2. NLP 파싱
    const parseResult = parseOnboardingResponse(currentDay, message);
    const action = decideOnboardingAction(parseResult);

    logger.log('[OnboardingWebhook] 파싱 완료', {
      contactId: contact.id,
      currentDay,
      confidence: parseResult.confidence,
      action,
      parseMethod: parseResult.parseMethod,
    });

    // 3. 신뢰도별 액션 처리
    let smsConfig: { key: string; userId: string; sender: string } | null =
      null;

    // SMS Config 조회
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        smsConfig: {
          select: {
            aligoKey: true,
            aligoUserId: true,
            senderPhone: true,
          },
        },
      },
    });

    if (org?.smsConfig) {
      smsConfig = {
        key: org.smsConfig.aligoKey,
        userId: org.smsConfig.aligoUserId,
        sender: org.smsConfig.senderPhone,
      };
    }

    // 3-1. auto_save (신뢰도 >= 80%)
    if (action === 'auto_save' && parseResult.success) {
      const updateData: Record<string, any> = {};

      if (currentDay === 0 && parseResult.marriageStatus) {
        updateData.marriageStatus = parseResult.marriageStatus;
      }

      if (currentDay === 1) {
        if (parseResult.marriageDate) {
          updateData.marriageDate = parseResult.marriageDate;
        }
        if (parseResult.childrenCount !== undefined) {
          updateData.childrenCount = parseResult.childrenCount;
        }
        if (parseResult.childrenAges) {
          updateData.childrenAges = parseResult.childrenAges;
        }
      }

      if (currentDay === 2 && parseResult.ageInYears) {
        updateData.ageInYears = parseResult.ageInYears;
      }

      // Contact 업데이트
      const updatedContact = await prisma.contact.update({
        where: { id: contact.id },
        data: updateData,
      });

      // 현재 Day 완료 → 다음 Day 준비
      // (ContactLensSequence는 Cron에서 관리)

      // 모든 4단계 완료 시 세그먼트 분류
      if (
        currentDay === 3 &&
        updatedContact.marriageStatus &&
        updatedContact.ageInYears
      ) {
        const segment = classifySegment({
          marriageStatus: updatedContact.marriageStatus,
          marriageDate: updatedContact.marriageDate,
          childrenCount: updatedContact.childrenCount,
          childrenAges: updatedContact.childrenAges,
          ageInYears: updatedContact.ageInYears,
        });

        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            autoSegment: segment,
            segmentUpdatedAt: new Date(),
          },
        });

        logger.log('[OnboardingWebhook] 세그먼트 분류 완료', {
          contactId: contact.id,
          segment,
        });

        // 완성 축하 메시지 발송
        if (smsConfig) {
          const congrats =
            currentDay === 3
              ? `감사해요! 당신은 [${segment}] 세그먼트 고객입니다. 맞춤형 여행 패키지가 준비되어 있습니다!`
              : '';

          if (congrats) {
            await sendSms({
              config: smsConfig,
              receiver: normalizedPhone,
              msg: congrats,
              msgType: 'SMS',
              organizationId,
              contactId: contact.id,
            });
          }
        }
      }

      logger.info('[OnboardingWebhook] auto_save 완료', {
        contactId: contact.id,
        currentDay,
        updatedFields: Object.keys(updateData),
      });

      return NextResponse.json({
        ok: true,
        action: 'auto_save',
        confidence: parseResult.confidence,
        contactId: contact.id,
      });
    }

    // 3-2. manual_review (신뢰도 50-80%)
    if (action === 'manual_review') {
      // ManualReviewQueue에 추가 (별도 스키마 필요 또는 AdminMessage 재사용)
      // 여기서는 로그로 대체
      logger.info('[OnboardingWebhook] manual_review 필요', {
        contactId: contact.id,
        currentDay,
        confidence: parseResult.confidence,
        message,
      });

      return NextResponse.json({
        ok: true,
        action: 'manual_review',
        confidence: parseResult.confidence,
        contactId: contact.id,
      });
    }

    // 3-3. retry_sms (신뢰도 20-50%)
    if (action === 'retry_sms') {
      if (smsConfig) {
        const retryTemplate =
          currentDay === 0
            ? '죄송해요! "신혼/3년/10년" 형식으로 다시 답변 부탁드려요'
            : currentDay === 1
              ? '죄송해요! "결혼 5년, 아이 2명 10살 8살" 형식으로 답변 부탁드려요'
              : currentDay === 2
                ? '죄송해요! "45" 또는 "45살" 형식으로 답변 부탁드려요'
                : '죄송해요! "1" (휴식) ~ "4" (문화) 중 선택해주세요';

        await sendSms({
          config: smsConfig,
          receiver: normalizedPhone,
          msg: retryTemplate,
          msgType: 'SMS',
          organizationId,
          contactId: contact.id,
        });
      }

      logger.info('[OnboardingWebhook] retry_sms 발송', {
        contactId: contact.id,
        currentDay,
        confidence: parseResult.confidence,
      });

      return NextResponse.json({
        ok: true,
        action: 'retry_sms',
        confidence: parseResult.confidence,
        contactId: contact.id,
      });
    }

    // 3-4. call_required (신뢰도 < 20%)
    logger.warn('[OnboardingWebhook] call_required (상담사 개입 필요)', {
      contactId: contact.id,
      currentDay,
      confidence: parseResult.confidence,
      message,
    });

    return NextResponse.json({
      ok: true,
      action: 'call_required',
      confidence: parseResult.confidence,
      contactId: contact.id,
    });
  } catch (error) {
    logger.error('[OnboardingWebhook] 오류', { error });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}
