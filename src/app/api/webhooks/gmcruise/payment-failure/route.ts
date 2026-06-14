export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';
import { resolveGmcruiseWebhookContext } from '@/lib/gmcruise-webhook';

/**
 * POST /api/webhooks/gmcruise/payment-failure
 * 크루즈닷몰 결제 실패(status !== 'paid') 시 → CRM ContactMemo 기록
 * Authorization: Bearer MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET
 *
 * ⚠️ Contact.type은 절대 변경하지 않음 — 결제 실패는 일시적일 수 있음
 * ⚠️ customerPhone은 평문 전송 (마스킹 없음) — CRM에서 후속 연락 목적
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
    amount,
    reason,
    customerName,
    customerPhone,
    affiliateCode,
    failedAt,
    eventId,
  } = body as {
    orderId: string;
    amount?: number | null;
    reason?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    affiliateCode?: string | null;
    failedAt: string;
    eventId: string;
  };

  if (!orderId || !eventId) {
    return NextResponse.json({ ok: false, message: 'orderId, eventId 필수' }, { status: 400 });
  }

  logger.log('[PaymentFailureWebhook] 수신', {
    orderId,
    reason,
    phone: customerPhone ? customerPhone.slice(0, 4) + '***' : '없음',
    amount: amount ?? 0,
  });

  try {
    // 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId_webhookType: {
          eventId,
          webhookType: 'gmcruise-payment-failure',
        },
      },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[PaymentFailureWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const { organizationId, affiliateContact } = await resolveGmcruiseWebhookContext(
      prisma,
      affiliateCode,
      process.env.DEFAULT_ORGANIZATION_ID
    );

    if (!organizationId) {
      logger.log('[PaymentFailureWebhook] 조직 특정 불가 — 로그만 기록', { orderId, affiliateCode });
      await prisma.processedWebhookEvent.create({
        data: { eventId, webhookType: 'gmcruise-payment-failure' },
      });
      return NextResponse.json({ ok: true, matched: false });
    }

    // Contact 찾기
    // 1순위: bookingRef === orderId
    let matchedContact: { id: string } | null = await prisma.contact.findFirst({
      where: { bookingRef: orderId, organizationId },
      select: { id: true },
    });

    // 2순위: customerPhone (평문 — 마스킹 없음)
    if (!matchedContact && customerPhone) {
      const normalizedPhone = normalizePhone(customerPhone);
      matchedContact = await prisma.contact.findFirst({
        where: { phone: normalizedPhone, organizationId },
        select: { id: true },
      });
    }

    // 3순위: affiliateCode로 최근 Contact
    if (!matchedContact && affiliateContact) {
      matchedContact = affiliateContact;
    }

    // 트랜잭션
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'payment-failure' },
      });

      if (matchedContact) {
        const displayAmount = amount && amount > 0 ? amount.toLocaleString() + '원' : '금액 미상';
        const memoLines = [
          `[결제실패] ${displayAmount}`,
          `상태: ${reason ?? '알 수 없음'}`,
          `주문: ${orderId}`,
          customerName ? `고객: ${customerName}` : null,
          `발생일시: ${failedAt}`,
        ].filter(Boolean).join(' / ');

        await tx.contactMemo.create({
          data: {
            contactId: matchedContact.id,
            userId: 'system-webhook',
            content: memoLines,
          },
        });
      }
    });

    logger.log('[PaymentFailureWebhook] 완료', {
      contactFound: !!matchedContact,
      orderId,
      reason,
      eventId,
    });

    return NextResponse.json({ ok: true, matched: !!matchedContact });
  } catch (err) {
    logger.error('[PaymentFailureWebhook] 처리 실패', { err, orderId, eventId });
    await enqueueDLQ('payment-failure', body, err instanceof Error ? err.message : String(err)).catch((dlqErr) => {
      logger.error('[PaymentFailureWebhook] DLQ 저장 실패', {
        orderId,
        eventId,
        error: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    });
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
