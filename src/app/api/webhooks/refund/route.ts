export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';

/**
 * POST /api/webhooks/refund
 * GMcruise(크루즈닷몰/웰컴페이먼츠 B2C) 환불 완료 후 호출
 * Authorization: Bearer MABIZ_REFUND_WEBHOOK_SECRET
 *
 * ⚠️ CRM은 "환불 알림"만 받음 — Contact 상태 변경 + 메모 기록
 *    AffiliateSale 등 크루즈닷몰 공유 테이블은 절대 수정하지 않음
 *    (환불 처리 자체는 크루즈닷몰에서 수행)
 *
 * 페이앱(B2B) 환불은 /api/payapp/* 에서 별도 처리
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_REFUND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[RefundWebhook] MABIZ_REFUND_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[RefundWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const {
    orderId,
    buyerPhone,
    buyerName,
    amount,
    refundAmount,
    reason,
    saleId,
    refundedAt,
    organizationId: bodyOrgId,
    eventId,
  } = body as {
    orderId: string;
    buyerPhone?: string | null;
    buyerName?: string;
    amount?: number;
    refundAmount?: number;
    reason?: string;
    saleId?: number | null;
    refundedAt: string;
    organizationId?: string;
    eventId?: string;
  };

  // orderId만 필수 (buyerPhone은 마스킹되어 올 수 있으므로 선택)
  if (!orderId) {
    return NextResponse.json({ ok: false, message: 'orderId 필수' }, { status: 400 });
  }

  // amount / refundAmount 둘 다 허용 (하위호환)
  const finalAmount = amount ?? refundAmount ?? 0;

  // eventId 멱등성 체크 (중복 수신 방지)
  if (eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[RefundWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  logger.log('[RefundWebhook] 수신', {
    orderId,
    buyerPhone: buyerPhone ? String(buyerPhone).slice(0, 4) + '***' : '없음',
    amount: finalAmount,
  });

  try {
    // orderId로 CRM AffiliateSale 찾기 → Contact 역추적
    const sale = await prisma.affiliateSale.findUnique({
      where: { orderId },
      select: { organizationId: true, customerPhone: true },
    });

    const organizationId = bodyOrgId ?? sale?.organizationId ?? process.env.DEFAULT_ORGANIZATION_ID;

    if (!organizationId) {
      logger.error('[RefundWebhook] 조직 특정 불가', { orderId });
      return NextResponse.json({ ok: false, message: '조직 특정 불가' }, { status: 422 });
    }

    // orderId(bookingRef)로 Contact 찾기
    const contact = await prisma.contact.findFirst({
      where: { bookingRef: orderId, organizationId },
      select: { id: true, phone: true, name: true },
    });

    await prisma.$transaction(async (tx) => {
      // Contact 상태 → REFUNDED
      if (contact) {
        await tx.contact.update({
          where: { id: contact.id },
          data: { type: 'REFUNDED' },
        });

        // 환불 내역 메모 기록
        const memoLines = [
          `[환불완료] ${finalAmount > 0 ? finalAmount.toLocaleString() + '원' : '금액 미상'}`,
          reason ? `사유: ${reason}` : null,
          `주문번호: ${orderId}`,
          buyerPhone ? `구매자: ${buyerPhone}` : null,
          `처리일시: ${refundedAt ?? new Date().toISOString()}`,
        ].filter(Boolean).join('\n');

        await tx.contactMemo.create({
          data: {
            contactId: contact.id,
            userId: 'system-webhook',
            content: memoLines,
          },
        });
      }

      // eventId 처리 완료 기록 (트랜잭션 안에서 — TOCTOU 방지)
      if (eventId) {
        await tx.processedWebhookEvent.create({
          data: { eventId, webhookType: 'refund' },
        });
      }
    });

    logger.log('[RefundWebhook] 완료', {
      contactFound: !!contact,
      contactId: contact?.id ?? null,
      orderId,
      amount: finalAmount,
    });

    return NextResponse.json({ ok: true, contactFound: !!contact });
  } catch (err) {
    logger.error('[RefundWebhook] 처리 실패', { err, orderId });
    await enqueueDLQ('refund', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
