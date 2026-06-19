import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendDay0Sms, type Segment, type ABVariant } from '@/lib/loop5-sms-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 크루즈닷몰 아키텍처: 링크 기반 구매(affiliateCode 있음) + HQ 직접구매(affiliateCode null) 모두 지원
// CRM은 affiliateCode → Partner 조회 → tier → 수당 계산 (commissionRate는 CRM이 결정)
// affiliateCode가 null인 경우 → HQ 직접구매로 처리 (담당자 미배정)
interface CruisedotPaymentPayload {
  eventId: string;
  eventType: 'payment.created' | 'payment.updated' | 'payment.refunded';
  timestamp: string;
  bookingRef: string;
  affiliateCode?: string | null;   // 어필리에이트(있음) 또는 HQ 직접구매(null)
  saleAmount?: number;     // 판매금액 (수당 계산용)
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED';
  refundAmount?: number;
  reason?: string;
  refundPolicy?: {
    daysBeforeDeparture: number;
    penaltyRate: number;
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  let eventId = '';

  // [P0-SEC-001] CRUISEDOT_WEBHOOK_SECRET 필수 — 없으면 웹훅 비활성화
  if (!secret) {
    logger.error('[CruisedotWebhook] CRITICAL: CRUISEDOT_WEBHOOK_SECRET 미설정. 웹훅 수신 불가능합니다. DevOps에 연락하세요.');
    return NextResponse.json({ ok: false, error: 'Webhook secret not configured' }, { status: 503 });
  }

  // [P0-SEC-002] Bearer Token 검증 (필수)
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('[CruisedotWebhook] Bearer token 미제공 — 요청 차단');
    return NextResponse.json({ ok: false, error: 'Missing Bearer token' }, { status: 401 });
  }

  const token = authHeader.slice(7); // "Bearer " 제거
  if (token.length === 0) {
    logger.warn('[CruisedotWebhook] Bearer token 값 비어있음 — 요청 차단');
    return NextResponse.json({ ok: false, error: 'Empty Bearer token' }, { status: 401 });
  }

  // [P0-SEC-003] Timing-safe 비교로 토큰 검증 (byteLength 가드)
  const tokenBuf = Buffer.from(token, 'utf8');
  const secretBuf = Buffer.from(secret, 'utf8');
  if (tokenBuf.byteLength !== secretBuf.byteLength || !timingSafeEqual(tokenBuf, secretBuf)) {
    logger.warn('[CruisedotWebhook] Bearer token 불일치 — 인증 실패');
    return NextResponse.json({ ok: false, error: 'Authentication failed' }, { status: 401 });
  }

  // 요청 본문 읽기
  const body = await req.text();

  // HMAC-SHA256 서명 검증
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSignature, 'utf8');
  if (sigBuf.byteLength !== expBuf.byteLength || !timingSafeEqual(sigBuf, expBuf)) {
    logger.warn('[CruisedotWebhook] 서명 검증 실패');
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // JSON 파싱
  let payload: CruisedotPaymentPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  eventId = payload.eventId;
  const { eventType, timestamp, bookingRef, affiliateCode, saleAmount, status, refundAmount, reason } = payload;
  const parsedTs = timestamp ? Date.parse(String(timestamp)) : NaN;
  const safeTimestamp = !isNaN(parsedTs) ? new Date(parsedTs) : new Date();

  // 필수 필드 검증 (affiliateCode는 선택 — null이면 HQ 직접구매)
  if (!eventId || !eventType || !bookingRef || !status) {
    logger.warn('[CruisedotWebhook] 필수 필드 누락', { eventId, bookingRef, affiliateCode });
    return NextResponse.json({ ok: false, message: '필수 필드 누락 (eventId, eventType, bookingRef, status)' }, { status: 400 });
  }

  // affiliateCode 검증: 어필리에이트는 필수, 직접구매(null)도 허용
  const isDirectPurchase = !affiliateCode;

  logger.log('[CruisedotWebhook] 수신', {
    eventId,
    eventType,
    bookingRef,
    affiliateCode,
    status,
    saleAmount: saleAmount ?? null,
    refundAmount: refundAmount ?? null,
  });

  try {
    // eventId 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId_webhookType: {
          eventId,
          webhookType: 'cruisedot-payment',
        },
      },
    });

    if (alreadyProcessed) {
      logger.log('[CruisedotWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // organizationId 결정: affiliateSale 또는 기본값
    let affiliateSale: { id: string; saleAmount: number; commissionAmount: number; organizationId: string } | null = null;
    let organizationId: string | undefined;

    if (isDirectPurchase) {
      // HQ 직접구매: affiliateSale 없음, DEFAULT_ORGANIZATION_ID 사용
      organizationId = process.env.DEFAULT_ORGANIZATION_ID;
      logger.log('[CruisedotWebhook] HQ 직접구매 감지', { bookingRef, organizationId });
    } else {
      // 어필리에이트: AffiliateSale 조회 (bookingRef = orderId)
      affiliateSale = await prisma.affiliateSale.findUnique({
        where: { orderId: bookingRef },
        select: { id: true, saleAmount: true, commissionAmount: true, organizationId: true },
      });
      organizationId = affiliateSale?.organizationId;
      logger.log('[CruisedotWebhook] 어필리에이트 구매 감지', { bookingRef, affiliateCode, organizationId });

      // AffiliateSale 미존재 시: affiliateCode → GmAffiliateProfile → OrganizationMember 자동 매핑
      if (!organizationId && affiliateCode) {
        const profile = await prisma.gmAffiliateProfile.findFirst({
          where: { affiliateCode },
          select: { userId: true },
        });
        if (profile?.userId) {
          const member = await prisma.organizationMember.findFirst({
            where: { userId: `gm-${profile.userId}`, isActive: true, role: 'OWNER' },
            select: { organizationId: true },
          });
          if (member?.organizationId) {
            organizationId = member.organizationId;
            logger.log('[CruisedotWebhook] affiliateCode → organizationId 자동 매핑', { affiliateCode, organizationId });
          }
        }
      }
    }

    // organizationId 미확인 시 DB fallback (DEFAULT_ORGANIZATION_ID 미설정 대응)
    if (!organizationId) {
      const defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID
        || (await prisma.organization.findFirst({ select: { id: true } }))?.id;
      if (!defaultOrgId) {
        logger.warn('[CruisedotWebhook] 조직 미확인', { bookingRef, isDirectPurchase, organizationId });
        return NextResponse.json({ ok: false, message: 'organization not found' }, { status: 422 });
      }
      organizationId = defaultOrgId;
      logger.log('[CruisedotWebhook] DB fallback으로 organizationId 결정', { bookingRef, organizationId });
    }

    // P0-ISS-02: UPSERT 패턴으로 동시 결제 중복 생성 방지 (Race condition 해결)
    type ContactSelect = {
      id: string;
      organizationId: string;
      phone: string;
      userId: number | null;
      name: string;
      smsDay0Sent: boolean;
      affiliateCode: string | null;
    };

    let transactionResult: { contact: ContactSelect | null; shouldSendDay0Sms: boolean } = {
      contact: null,
      shouldSendDay0Sms: false,
    };

    // 트랜잭션 처리
    transactionResult = await prisma.$transaction(async (tx) => {
      let contact: ContactSelect | null = null;
      let shouldSendDay0Sms = false;

      // UPSERT: bookingRef + organizationId 기준 (unique constraint 필수)
      contact = await tx.contact.upsert({
        where: {
          bookingRef_organizationId: {
            bookingRef,
            organizationId,
          },
        },
        create: {
          bookingRef,
          organizationId,
          phone: '', // 필수값 (cruisedot에서 제공되면 나중에 업데이트)
          name: `예약 ${bookingRef}`, // 임시 이름
          type: 'PURCHASED',
          affiliateCode: affiliateCode || null,
          lastPaymentStatus: status === 'CONFIRMED' ? 'paid' : 'pending',
          lastPaymentAt: status === 'CONFIRMED' ? safeTimestamp : undefined,
          // 출처 분류: 어필리에이트 구매면 'affiliate', HQ 직접구매면 'user'
          sourceType: isDirectPurchase ? 'user' : 'affiliate',
          channel: 'b2c',
          // HQ 직접구매인 경우 담당자 미배정 (userId = null) — 기본값이므로 명시 불필요
        },
        update: {
          affiliateCode: affiliateCode === undefined ? undefined : affiliateCode,
        },
        select: {
          id: true,
          organizationId: true,
          phone: true,
          userId: true,
          name: true,
          smsDay0Sent: true,
          affiliateCode: true,
        },
      });

      const isNewContact = !contact.id || (contact.phone === '' && !contact.userId);
      logger.log('[CruisedotWebhook] Contact upsert', {
        contactId: contact.id,
        bookingRef,
        isNew: isNewContact ? '신규' : '기존',
      });

      // Loop 6 Agent A: FormSubmission 기록 (A/B 테스트 추적용)
        if (isNewContact && contact.id) {
          await tx.formSubmission.create({
            data: {
              variant: isDirectPurchase ? 'cruisedot_direct' : 'cruisedot_payment', // 채널 구분
              segment: 'A', // 기본값 (나중에 Contact 정보로 개선)
              completionTimeMs: 0, // 웹훅 처리이므로 시간값 없음
              ageRange: 'unknown', // 크루즈닷몰에서 제공 받을 때까지
              preferenceType: 'cruise_booking', // 크루즈 예약
              affiliateCode: contact.affiliateCode || undefined,
              userAgent: `cruisedot-webhook-${isDirectPurchase ? 'direct' : 'affiliate'}-${bookingRef}`,
            },
          });
        }

      // Contact 상태 업데이트
      if (contact) {
        const paymentStatus =
          status === 'REFUNDED'
            ? 'refunded'
            : status === 'CONFIRMED'
              ? 'paid'
              : status === 'CANCELLED'
                ? 'cancelled'
                : 'pending';

        // P0-ISS-04: 환불 시 SMS flag 초기화 (재구매 시 Day0-3 자동화 재실행)
        const updateData: {
          lastPaymentStatus: string;
          lastPaymentAt?: Date;
          lastRefundedAt?: Date;
          paymentStatusNote?: string;
          smsDay0Sent?: boolean;
          smsDay1Sent?: boolean;
          smsDay2Sent?: boolean;
          smsDay3Sent?: boolean;
          smsDay7Sent?: boolean;
        } = {
          lastPaymentStatus: paymentStatus,
          lastPaymentAt: status === 'CONFIRMED' ? safeTimestamp : undefined,
          lastRefundedAt: status === 'REFUNDED' ? safeTimestamp : undefined,
          paymentStatusNote:
            status === 'REFUNDED'
              ? `환불완료: ${refundAmount ? refundAmount.toLocaleString() + '원' : '금액미상'}`
              : status === 'CONFIRMED'
                ? '결제완료'
                : status === 'CANCELLED'
                  ? `취소됨: ${reason || '사유 미기재'}`
                  : undefined,
        };

        // Loop 6: 결제완료 시 Day 0 SMS 발송 플래그 설정
        if (status === 'CONFIRMED' && !contact.smsDay0Sent) {
          shouldSendDay0Sms = true;
        }

        // 환불 시 SMS Day0-3 플래그 초기화 (재구매 가능성 대비)
        if (status === 'REFUNDED') {
          updateData.smsDay0Sent = false;
          updateData.smsDay1Sent = false;
          updateData.smsDay2Sent = false;
          updateData.smsDay3Sent = false;
          updateData.smsDay7Sent = false;
        }

        await tx.contact.update({
          where: { id: contact.id },
          data: updateData,
        });

        // Contact 메모 기록
        if (status === 'REFUNDED' || status === 'CANCELLED') {
          const memoContent = [
            `[${status === 'REFUNDED' ? '환불' : '취소'}] 크루즈닷몰 웹훅`,
            refundAmount ? `금액: ${refundAmount.toLocaleString()}원` : null,
            reason ? `사유: ${reason}` : null,
            `이벤트ID: ${eventId}`,
            `처리일시: ${safeTimestamp.toLocaleString('ko-KR')}`,
          ]
            .filter(Boolean)
            .join('\n');

          await tx.contactMemo.create({
            data: {
              contactId: contact.id,
              userId: 'system-webhook-cruisedot',
              content: memoContent,
            },
          });
        }
      }

      // payment.refunded: /api/webhooks/crm/refund 경로에서 처리 (중복 방지)
      // 이 경로는 acknowledge만 반환하고 환불 처리를 하지 않음
      if (status === 'REFUNDED') {
        logger.log('[CruisedotWebhook] payment.refunded acknowledged — 실제 처리는 /api/webhooks/crm/refund 경로', { eventId, bookingRef });
      }

      // ProcessedWebhookEvent 기록 (중복 방지)
      await tx.processedWebhookEvent.create({
        data: {
          eventId,
          webhookType: 'cruisedot-payment',
          status: 'SUCCESS',
        },
      });

      return { contact, shouldSendDay0Sms };
    });

    const { contact, shouldSendDay0Sms: shouldSendSms } = transactionResult;

    logger.log('[CruisedotWebhook] 처리 완료', {
      contactFound: !!contact,
      affiliateSaleFound: !!affiliateSale,
      isDirectPurchase,
      bookingRef,
      status,
      day0SmsSent: shouldSendSms,
    });

    // Loop 6 Agent A: Day 0 SMS 발송 (트랜잭션 후 비동기 처리)
    if (shouldSendSms && contact && contact.phone && contact.organizationId) {
      try {
        // 세그먼트 자동 결정 (기본값: A, 나중에 Contact 정보로 개선)
        const segment: Segment = 'A';
        // contactId 기반 결정론적 A/B 분기 — 같은 고객은 항상 동일 variant
        const hashByte = contact.id.charCodeAt(contact.id.length - 1);
        const variant: ABVariant = hashByte % 2 === 0 ? 'a' : 'b';

        const smsResult = await sendDay0Sms(
          contact.organizationId,
          contact.id,
          segment,
          contact.phone,
          contact.name,
          variant
        );

        logger.log('[CruisedotWebhook] Day 0 SMS 발송', {
          contactId: contact.id,
          bookingRef,
          segment,
          variant,
          success: smsResult.success,
          smsId: smsResult.smsId,
          error: smsResult.error,
        });
      } catch (smsError: unknown) {
        logger.warn('[CruisedotWebhook] Day 0 SMS 발송 실패', {
          contactId: contact.id,
          error: smsError instanceof Error ? smsError.message : String(smsError),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      contactId: contact?.id,
      orderId: bookingRef,
      affiliateType: isDirectPurchase ? 'DIRECT' : 'AFFILIATE',
      day0SmsSent: shouldSendSms,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('[CruisedotWebhook] 처리 실패', {
      err: errorMessage,
      eventId,
      stack: err instanceof Error ? err.stack : undefined,
    });

    // 실패 기록
    await prisma.processedWebhookEvent
      .create({
        data: {
          eventId,
          webhookType: 'cruisedot-payment',
          status: 'FAILED',
          errorMessage: errorMessage,
        },
      })
      .catch((dbErr) => {
        logger.error('[CruisedotWebhook] 실패 기록 저장 불가', {
          eventId,
          originalError: errorMessage,
          dbError: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      });

    return NextResponse.json({
      ok: false,
      error: 'Payment webhook processing failed',
      eventId,
      affiliateType: isDirectPurchase ? 'DIRECT' : 'AFFILIATE',
    }, { status: 500 });
  }
}
