export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createRefundNotifications } from '@/lib/notification-service';

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

  if (!secret) {
    logger.error('[CruisedotWebhook] CRUISEDOT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== secret) {
    logger.warn('[CruisedotWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 요청 본문 읽기
  const body = await req.text();

  // HMAC-SHA256 서명 검증
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
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

    // Contact 찾기 (bookingRef로)
    const contact = await prisma.contact.findFirst({
      where: { bookingRef },
      select: { id: true, organizationId: true, phone: true },
    });

    // AffiliateSale 찾기 (bookingRef = orderId)
    const affiliateSale = await prisma.affiliateSale.findUnique({
      where: { orderId: bookingRef },
      select: { id: true, saleAmount: true, commissionAmount: true, organizationId: true },
    });

    // 트랜잭션 처리
    await prisma.$transaction(async (tx) => {
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

        await tx.contact.update({
          where: { id: contact.id },
          data: {
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
          },
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
        }).catch(() => {});

        logger.log('[CruisedotWebhook] AffiliateSale 수당 취소', {
          affiliateSaleId: affiliateSale.id,
          originalCommission: affiliateSale.commissionAmount,
          refundAmount,
        });
      }

      // ProcessedWebhookEvent 기록 (중복 방지)
      await tx.processedWebhookEvent.create({
        data: {
          eventId,
          webhookType: 'cruisedot-payment',
          status: 'SUCCESS',
        },
      });
    });

    logger.log('[CruisedotWebhook] 처리 완료', {
      contactFound: !!contact,
      affiliateSaleFound: !!affiliateSale,
      bookingRef,
      status,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[CruisedotWebhook] 처리 실패', { err, eventId });

    // 실패 기록
    await prisma.processedWebhookEvent
      .create({
        data: {
          eventId,
          webhookType: 'cruisedot-payment',
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
