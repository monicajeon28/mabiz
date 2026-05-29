import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendDay0Sms } from '@/lib/loop5-sms-service';
import { sendDay0Email } from '@/lib/loop5-email-service';
import { maskPhone, maskName, generateErrorId, logSafeError } from '@/lib/pii-masker';

/**
 * Loop 5: Contact Form 제출 → Contact 자동 생성 + Day 0 자동화
 *
 * POST /api/webhook/loop5-contact-form
 * body: {
 *   name: string,
 *   phone: string,
 *   email?: string,
 *   ageRange?: string (20-30, 40-50, 50-60, 60+, 70+),
 *   preferenceType?: string (romance, family, culture, luxury, health),
 *   variant?: 'a' | 'b',
 *   organizationId: string,
 *   timestamp?: string,
 *   userAgent?: string,
 *   abVariant?: string
 * }
 */

type Segment = 'A' | 'B' | 'C' | 'D' | 'E';
type ABVariant = 'a' | 'b';

interface ContactFormPayload {
  name: string;
  phone: string;
  email?: string;
  ageRange?: string;
  preferenceType?: string;
  variant?: ABVariant;
  organizationId: string;
  timestamp?: string;
  userAgent?: string;
  abVariant?: ABVariant;
}

/**
 * 폰 번호 정규화: "01012341234" → "010-1234-1234"
 */
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Segment 자동 분류 (ageRange × preferenceType)
 */
function classifySegment(ageRange?: string, preferenceType?: string): Segment {
  // 나이 우선
  if (ageRange === '70+') return 'E';
  if (ageRange === '60+') return 'D';
  if (ageRange === '50-60') return 'C';
  if (ageRange === '40-50') return 'B';
  if (ageRange === '20-30') {
    // 선호도 고려
    if (preferenceType === 'romance') return 'A';
    return 'B';
  }

  // 기본값: 선호도 기반
  if (preferenceType === 'romance') return 'A';
  if (preferenceType === 'family') return 'B';
  if (preferenceType === 'culture') return 'C';
  if (preferenceType === 'luxury') return 'D';
  if (preferenceType === 'health') return 'E';

  // 최종 기본값
  return 'B';
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ContactFormPayload;

    // 필수 필드 검증
    if (!payload.name || !payload.phone || !payload.organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone, organizationId' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    const segment = classifySegment(payload.ageRange, payload.preferenceType);
    const variant = (payload.variant || payload.abVariant || 'a') as ABVariant;

    logger.log('[Loop5 Contact Form] 신청 접수', {
      name: maskName(payload.name),
      phone: maskPhone(normalizedPhone),
      segment,
      variant,
    });

    // 중복 확인
    let existingContact = await prisma.contact.findFirst({
      where: {
        phone: normalizedPhone,
        organizationId: payload.organizationId,
      },
    });

    let contact;

    if (existingContact) {
      // 기존 Contact 업데이트
      contact = await prisma.contact.update({
        where: { id: existingContact.id },
        data: {
          name: payload.name,
          email: payload.email || existingContact.email,
          segment,
          autoSegment: segment.toLowerCase(),
          ageInYears: payload.ageRange ? parseInt(payload.ageRange) : existingContact.ageInYears,
          tags: [
            ...new Set([
              ...existingContact.tags,
              'loop5',
              segment,
              'form-submission',
              variant,
            ]),
          ],
          updatedAt: new Date(),
        },
      });

      logger.log('[Loop5] 기존 Contact 업데이트', {
        contactId: contact.id,
        segment,
      });
    } else {
      // 신규 Contact 생성
      contact = await prisma.contact.create({
        data: {
          organizationId: payload.organizationId,
          phone: normalizedPhone,
          name: payload.name,
          email: payload.email,
          segment,
          autoSegment: segment.toLowerCase(),
          ageInYears: payload.ageRange ? parseInt(payload.ageRange) : undefined,
          type: 'LEAD',
          channel: 'loop5-form',
          tags: ['loop5', segment, 'form-submission', variant],
          lensMetadata: {
            decisionLevel: 0,
            readinessScore: 0,
            segment,
            variant,
            formSubmittedAt: new Date().toISOString(),
          },
        },
      });

      logger.log('[Loop5] 신규 Contact 생성', {
        contactId: contact.id,
        segment,
      });
    }

    // Day 0 SMS 자동 발송
    let smsSendResult = { success: false, smsId: undefined };
    if (normalizedPhone) {
      smsSendResult = await sendDay0Sms(
        payload.organizationId,
        contact.id,
        segment,
        normalizedPhone,
        payload.name,
        variant
      );

      if (smsSendResult.success) {
        logger.log('[Loop5] Day 0 SMS 발송 성공', {
          contactId: contact.id,
          smsId: smsSendResult.smsId,
        });
      } else {
        logger.warn('[Loop5] Day 0 SMS 발송 실패', {
          contactId: contact.id,
          error: smsSendResult.error,
        });
      }
    }

    // Day 0 Email 자동 발송
    let emailSendResult = { success: false };
    if (payload.email) {
      emailSendResult = await sendDay0Email(
        payload.organizationId,
        contact.id,
        payload.email,
        segment,
        payload.name,
        variant
      );

      if (emailSendResult.success) {
        logger.log('[Loop5] Day 0 Email 발송 성공', {
          contactId: contact.id,
          email: payload.email,
        });
      } else {
        logger.warn('[Loop5] Day 0 Email 발송 실패', {
          contactId: contact.id,
          email: payload.email,
        });
      }
    }

    // 응답
    return NextResponse.json(
      {
        ok: true,
        contactId: contact.id,
        segment,
        variant,
        smsId: smsSendResult.smsId,
        emailSent: emailSendResult.success,
        message: '신청 완료! 1시간 내 SMS와 이메일을 받으실 겁니다.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorId = generateErrorId();
    logSafeError(logger, error, '[Loop5 Contact Form] 오류');

    return NextResponse.json(
      {
        error: '신청을 처리할 수 없습니다',
        errorId,
        contactSupport: true,
      },
      { status: 500 }
    );
  }
}
