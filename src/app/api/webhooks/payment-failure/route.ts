export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';

/**
 * POST /api/webhooks/payment-failure
 * 크루즈닷몰 결제 실패/PG취소실패/환불보류 알림
 * Authorization: Bearer MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET
 *
 * ⚠️ Contact.type은 절대 변경하지 않음 — 결제 실패는 일시적일 수 있으므로
 *    메모 기록만 수행
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[PaymentFailureWebhook] MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[PaymentFailureWebhook] 인증 실패');
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
    saleId,
    status,
    amount,
    failureReason,
    customerPhone,
    affiliateCode,
    occurredAt,
    eventId,
  } = body as {
    orderId: string;
    saleId?: number | null;
    status: string;
    amount: number;
    failureReason?: string | null;
    customerPhone?: string | null;
    affiliateCode?: string | null;
    occurredAt: string;
    eventId: string;
  };

  // orderId, eventId 필수
  if (!orderId || !eventId) {
    return NextResponse.json({ ok: false, message: 'orderId, eventId 필수' }, { status: 400 });
  }

  // eventId 멱등성 체크 (중복 수신 방지)
  const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
    where: { eventId },
    select: { eventId: true },
  });
  if (alreadyProcessed) {
    logger.log('[PaymentFailureWebhook] 중복 이벤트 무시', { eventId });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 전화번호 마스킹 여부 판별
  const isPhoneMasked = customerPhone ? customerPhone.includes('*') : true;

  logger.log('[PaymentFailureWebhook] 수신', {
    orderId,
    status,
    customerPhone: customerPhone ? String(customerPhone).slice(0, 4) + '***' : '없음',
    amount: amount ?? 0,
  });

  try {
    // 1) orderId로 CRM AffiliateSale 찾기 → organizationId 역추적
    let sale = await prisma.affiliateSale.findUnique({
      where: { orderId },
      select: { organizationId: true, customerPhone: true },
    });

    // 2) AffiliateSale 못 찾았으면 affiliateCode로 역추적
    if (!sale && affiliateCode) {
      sale = await prisma.affiliateSale.findFirst({
        where: { affiliateCode },
        select: { organizationId: true, customerPhone: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 3) 최종 fallback: DEFAULT_ORGANIZATION_ID
    const organizationId = sale?.organizationId ?? process.env.DEFAULT_ORGANIZATION_ID;

    if (!organizationId) {
      logger.error('[PaymentFailureWebhook] 조직 특정 불가', { orderId });
      return NextResponse.json({ ok: false, message: '조직 특정 불가' }, { status: 422 });
    }

    // Contact 찾기
    // 1순위: bookingRef === orderId
    let contact = await prisma.contact.findFirst({
      where: { bookingRef: orderId, organizationId },
      select: { id: true, phone: true, name: true },
    });

    // 2순위: customerPhone이 마스킹 안 됐으면 phone으로 찾기
    if (!contact && customerPhone && !isPhoneMasked) {
      contact = await prisma.contact.findFirst({
        where: { phone: customerPhone, organizationId },
        select: { id: true, phone: true, name: true },
      });
    }

    await prisma.$transaction(async (tx) => {
      // Contact가 있으면 메모만 기록 (type은 절대 변경하지 않음)
      if (contact) {
        const displayAmount = amount > 0 ? amount.toLocaleString() + '원' : '금액 미상';
        const memoLines = [
          `[결제실패] ${displayAmount} / ${status} / 사유: ${failureReason ?? '없음'} / 주문: ${orderId}`,
        ].join('\n');

        await tx.contactMemo.create({
          data: {
            contactId: contact.id,
            userId: 'system-webhook',
            content: memoLines,
          },
        });
      }

      // eventId 처리 완료 기록 (트랜잭션 안에서 — TOCTOU 방지)
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'payment-failure' },
      });
    });

    logger.log('[PaymentFailureWebhook] 완료', {
      contactFound: !!contact,
      contactId: contact?.id ?? null,
      orderId,
      status,
      amount: amount ?? 0,
    });

    return NextResponse.json({ ok: true, contactFound: !!contact });
  } catch (err) {
    logger.error('[PaymentFailureWebhook] 처리 실패', { err, orderId });
    await enqueueDLQ('payment-failure', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
