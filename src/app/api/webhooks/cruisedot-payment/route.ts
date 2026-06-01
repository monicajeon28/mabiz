import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createRefundNotifications } from '@/lib/notification-service';
import { handleCabinInventoryRefund } from '@/lib/cabin-inventory-refund';
import { sendDay0Sms, type Segment, type ABVariant } from '@/lib/loop5-sms-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CruisedotPaymentPayload {
  eventId: string;
  eventType: 'payment.created' | 'payment.updated' | 'payment.refunded';
  timestamp: string;
  bookingRef: string;
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

  // [P0-SEC-001] CRUISEDOT_WEBHOOK_SECRET 필수 — 없으면 웹훅 비활성화
  if (!secret) {
    logger.error('[CruisedotWebhook] CRITICAL: CRUISEDOT_WEBHOOK_SECRET 미설정. 웹훅 수신 불가능합니다. DevOps에 연락하세요.');
    return NextResponse.json({ ok: false, error: 'Webhook secret not configured' }, { status: 500 });
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

  // [P0-SEC-003] Timing-safe 비교로 토큰 검증
  if (token.length !== secret.length || !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
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

  if (signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
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

  const { eventId, eventType, timestamp, bookingRef, status, refundAmount, reason } = payload;

  // 필수 필드 검증
  if (!eventId || !eventType || !bookingRef || !status) {
    logger.warn('[CruisedotWebhook] 필수 필드 누락', { eventId, bookingRef });
    return NextResponse.json({ ok: false, message: '필수 필드 누락' }, { status: 400 });
  }

  logger.log('[CruisedotWebhook] 수신', {
    eventId,
    eventType,
    bookingRef,
    status,
    refundAmount: refundAmount ?? null,
  });

  try {
    // eventId 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
    });

    if (alreadyProcessed) {
      logger.log('[CruisedotWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // AffiliateSale 찾기 (bookingRef = orderId) - 먼저 조회하여 organizationId 결정
    const affiliateSale = await prisma.affiliateSale.findUnique({
      where: { orderId: bookingRef },
      select: { id: true, saleAmount: true, commissionAmount: true, organizationId: true },
    });

    // organizationId 미확인 시 조기종료 (테넌트 격리)
    if (!affiliateSale?.organizationId) {
      logger.warn('[CruisedotWebhook] 조직 미확인', { bookingRef });
      return NextResponse.json({ ok: false, message: '조직 미확인' }, { status: 422 });
    }

    // P0-ISS-02: UPSERT 패턴으로 동시 결제 중복 생성 방지 (Race condition 해결)
    type ContactSelect = {
      id: string;
      organizationId: string;
      phone: string;
      userId: number | null;
      name: string;
      smsDay0Sent: boolean;
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
            organizationId: affiliateSale.organizationId,
          },
        },
        create: {
          bookingRef,
          organizationId: affiliateSale.organizationId,
          phone: '', // 필수값 (cruisedot에서 제공되면 나중에 업데이트)
          name: `예약 ${bookingRef}`, // 임시 이름
          type: 'PURCHASED',
          lastPaymentStatus: status === 'CONFIRMED' ? 'paid' : 'pending',
          lastPaymentAt: status === 'CONFIRMED' ? new Date(timestamp) : undefined,
        },
        update: {
          // 업데이트할 필드 (아래에서 별도 처리)
        },
        select: { id: true, organizationId: true, phone: true, userId: true, name: true, smsDay0Sent: true },
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
            variant: 'cruisedot_payment', // 결제 완료 채널 표시
            segment: 'A', // 기본값 (나중에 Contact 정보로 개선)
            completionTimeMs: 0, // 웹훅 처리이므로 시간값 없음
            ageRange: 'unknown', // 크루즈닷몰에서 제공 받을 때까지
            preferenceType: 'cruise_booking', // 크루즈 예약
            affiliateCode: (contact as any).affiliateCode || undefined,
            userAgent: `cruisedot-webhook-${bookingRef}`,
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
        const updateData: any = {
          lastPaymentStatus: paymentStatus,
          lastPaymentAt: status === 'CONFIRMED' ? new Date(timestamp) : undefined,
          lastRefundedAt: status === 'REFUNDED' ? new Date(timestamp) : undefined,
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
            `처리일시: ${new Date(timestamp).toLocaleString('ko-KR')}`,
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

      // AffiliateSale 처리 (환불 시)
      if (status === 'REFUNDED' && affiliateSale && affiliateSale.commissionAmount > 0) {
        await tx.affiliateSale.update({
          where: { id: affiliateSale.id },
          data: {
            refundedAmount: affiliateSale.saleAmount,
            refundedAt: new Date(timestamp),
            commissionAmount: 0,
            status: 'REFUNDED',
            cancelReason: 'CUSTOMER_REFUND_CRUISEDOT',
          },
        });

        // ★ P2: 환불 알림 생성
        await createRefundNotifications({
          organizationId: affiliateSale.organizationId,
          orderId: bookingRef,
          customerName: contact?.name || '고객',
          refundAmount: refundAmount ?? affiliateSale.saleAmount,
          refundReason: reason || '환불 요청',
          type: 'full_refund',
        }).catch((err) => {
          logger.warn('[CruisedotWebhook] 환불 알림 생성 실패', {
            bookingRef,
            error: err instanceof Error ? err.message : String(err),
          });
        });

        logger.log('[CruisedotWebhook] AffiliateSale 수당 취소', {
          affiliateSaleId: affiliateSale.id,
          originalCommission: affiliateSale.commissionAmount,
          refundAmount,
        });
      }

      // ★ 객실 재고 감소 처리 (환불 시)
      if (status === 'REFUNDED' && contact?.userId && affiliateSale) {
        const result = await handleCabinInventoryRefund(contact.userId, affiliateSale.organizationId, tx);
        if (!result.success) {
          logger.warn('[CruisedotWebhook] 객실 재고 감소 실패', { userId: contact.userId, reason: result.reason });
        }
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
      bookingRef,
      status,
      day0SmsSent: shouldSendSms,
    });

    // Loop 6 Agent A: Day 0 SMS 발송 (트랜잭션 후 비동기 처리)
    if (shouldSendSms && contact && contact.phone && contact.organizationId) {
      try {
        // 세그먼트 자동 결정 (기본값: A, 나중에 Contact 정보로 개선)
        const segment: Segment = 'A';
        const variant: ABVariant = Math.random() > 0.5 ? 'a' : 'b';

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
    }, { status: 500 });
  }
}
