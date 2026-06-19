import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { retryStrategy } from '@/lib/webhooks/retry-strategy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CruisedotRefundPayload {
  eventId: string;
  eventType: 'refund.requested' | 'refund.approved' | 'refund.rejected' | 'refund.completed';
  timestamp: string;
  bookingRef: string;
  refundAmount: number;
  refundReason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  departureDate?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[RefundWebhook] CRUISEDOT_WEBHOOK_SECRET 미설정');
    return NextResponse.json(
      { ok: false, message: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }

  // Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (Buffer.byteLength(token, 'utf8') !== Buffer.byteLength(secret, 'utf8') || !timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(secret, 'utf8'))) {
    logger.warn('[RefundWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 요청 본문 읽기
  const body = await req.text();

  // HMAC-SHA256 서명 검증
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (Buffer.byteLength(signature, 'hex') !== Buffer.byteLength(expectedSignature, 'hex') || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
    logger.warn('[RefundWebhook] 서명 검증 실패');
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // JSON 파싱
  let payload: CruisedotRefundPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const {
    eventId,
    eventType,
    timestamp,
    bookingRef,
    refundAmount,
    refundReason,
    status,
    customerPhone,
    customerEmail,
    customerName,
    departureDate,
    organizationId: payloadOrgId,
    metadata,
  } = payload;

  // 필수 필드 검증
  if (!eventId || !eventType || !bookingRef || refundAmount === undefined || !status) {
    logger.warn('[RefundWebhook] 필수 필드 누락', {
      eventId,
      bookingRef,
      refundAmount,
      status,
    });
    return NextResponse.json({ ok: false, message: '필수 필드 누락' }, { status: 400 });
  }

  logger.log('[RefundWebhook] 수신', {
    eventId,
    eventType,
    bookingRef,
    refundAmount,
    status,
  });

  try {
    // 1️⃣ eventId 멱등성 체크
    const existingRefund = await prisma.paymentRefund.findUnique({
      where: { eventId },
    });

    if (existingRefund) {
      logger.log('[RefundWebhook] 중복 이벤트 무시', {
        eventId,
        previousStatus: existingRefund.status,
        currentStatus: status,
      });

      // 상태가 변경되었으면 업데이트 (PENDING → APPROVED 등)
      if (existingRefund.status !== status) {
        const updated = await prisma.paymentRefund.update({
          where: { eventId },
          data: { status },
        });

        // Contact 업데이트 (상태 변경 시)
        if (status === 'COMPLETED') {
          await prisma.contact.updateMany({
            where: { bookingRef },
            data: {
              lastRefundedAt: new Date(),
              lastPaymentStatus: 'REFUNDED',
            },
          });
        }

        return NextResponse.json({ ok: true, updated: true, refundId: updated.id });
      }

      return NextResponse.json({ ok: true, duplicate: true, refundId: existingRefund.id });
    }

    // 2️⃣ 새로운 환불 이벤트 처리
    // Payment 조회 (bookingRef 또는 orderId로)
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ orderId: bookingRef }, { metadata: { path: ['bookingRef'], equals: bookingRef } }],
      },
    });

    if (!payment) {
      logger.warn('[RefundWebhook] Payment 찾을 수 없음', { bookingRef });
      // Payment가 없어도 환불 기록은 생성 (나중에 수동 조회 가능)
    }

    // 3️⃣ PaymentRefund 생성
    const refund = await prisma.paymentRefund.create({
      data: {
        eventId,
        paymentId: payment?.id ?? 0,
        status,
        refundAmount,
        reason: refundReason,
        metadata: {
          eventType,
          bookingRef,
          customerPhone,
          customerEmail,
          customerName,
          departureDate,
          organizationId: payloadOrgId,
          ...metadata,
        },
      },
    });

    logger.log('[RefundWebhook] 환불 기록 생성', {
      refundId: refund.id,
      paymentId: refund.paymentId,
      eventId,
      status,
      refundAmount,
    });

    // 4️⃣ Contact 업데이트 (상태가 COMPLETED일 때)
    if (status === 'COMPLETED' && bookingRef) {
      const contact = await prisma.contact.findFirst({
        where: { bookingRef },
      });

      if (contact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            lastRefundedAt: new Date(),
            lastPaymentStatus: 'REFUNDED',
            paymentStatusNote: `환불 완료: ${refundAmount}원 (사유: ${refundReason})`,
          },
        });

        logger.log('[RefundWebhook] Contact 업데이트', {
          contactId: contact.id,
          bookingRef,
          refundAmount,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      refundId: refund.id,
      status: refund.status,
      refundAmount: refund.refundAmount,
    });
  } catch (err) {
    // 동시성 처리 (같은 eventId 중복 처리)
    if (err instanceof Error && err.message.includes('P2002')) {
      logger.log('[RefundWebhook] 동시 처리로 인한 중복 생성 감지', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const error = err instanceof Error ? err : new Error(String(err));
    const classification = retryStrategy.classifyError(error);

    logger.error('[RefundWebhook] 처리 실패', {
      eventId,
      bookingRef,
      error: error.message,
      stack: error.stack,
      classification,
    });

    const statusCode = classification.dlq ? 400 : 500;

    return NextResponse.json(
      {
        ok: false,
        message: '처리 중 오류 발생',
        error: '처리 중 오류가 발생했습니다.',
        retryable: classification.retryable,
        dlq: classification.dlq,
      },
      { status: statusCode }
    );
  }
}
