/**
 * POST /api/webhooks/crm/refund
 * 크루즈닷 → CRM 환불 단일 경로 (2026-06-07 신규 스펙)
 *
 * 인증: x-signature: HMAC-SHA256(body, CRUISEDOT_WEBHOOK_SECRET)  — Bearer 없음
 * 페이로드: { eventId, bookingRef, refundAmount, reason, status: "PENDING|COMPLETED|FAILED" }
 *
 * 이 경로만 실제 환불 처리를 수행한다.
 * /api/webhooks/cruisedot-payment 의 payment.refunded 는 acknowledged만 반환.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createRefundNotifications } from '@/lib/notification-service';
import { handleCabinInventoryRefund } from '@/lib/cabin-inventory-refund';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CruisedotRefundWebhookPayload {
  eventId: string;
  bookingRef: string;
  refundAmount: number;
  reason?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[CrmRefundWebhook] CRUISEDOT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const body = await req.text();

  // x-signature: HMAC-SHA256(body, secret) — raw hex, Bearer 없음
  const incoming = req.headers.get('x-signature') ?? '';
  const expected = createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');

  if (
    incoming.length !== expected.length ||
    !timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))
  ) {
    logger.warn('[CrmRefundWebhook] 서명 검증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: CruisedotRefundWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { eventId, bookingRef, refundAmount, reason, status } = payload;

  if (!eventId || !bookingRef || refundAmount === undefined || !status) {
    return NextResponse.json({ ok: false, message: '필수 필드 누락' }, { status: 400 });
  }

  logger.log('[CrmRefundWebhook] 수신', { eventId, bookingRef, refundAmount, status });

  try {
    // 멱등성 체크
    const already = await prisma.processedWebhookEvent.findUnique({
      where: { eventId_webhookType: { eventId, webhookType: 'crm-refund' } },
    });
    if (already) {
      logger.log('[CrmRefundWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // AffiliateSale → organizationId 확인
    const affiliateSale = await prisma.affiliateSale.findFirst({
      where: { orderId: bookingRef },
      select: { id: true, saleAmount: true, commissionAmount: true, organizationId: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!affiliateSale?.organizationId) {
      logger.warn('[CrmRefundWebhook] AffiliateSale 없음 — 기록만 남김', { bookingRef });
    }

    const organizationId = affiliateSale?.organizationId ?? null;

    let pendingNotification: Parameters<typeof createRefundNotifications>[0] | null = null;

    await prisma.$transaction(async (tx) => {
      // COMPLETED일 때만 실제 처리
      if (status === 'COMPLETED' && affiliateSale && organizationId) {
        // 1. AffiliateSale REFUNDED
        await tx.affiliateSale.update({
          where: { id: affiliateSale.id },
          data: {
            refundedAmount: refundAmount,
            refundedAt: new Date(),
            status: 'REFUNDED',
            cancelReason: 'CUSTOMER_REFUND_CRUISEDOT',
          },
        });

        // 2. CommissionLedger REVERSAL
        if (affiliateSale.commissionAmount > 0) {
          const ledger = await tx.commissionLedger.findFirst({
            where: { saleId: affiliateSale.id, organizationId, entryType: 'COMMISSION_AUTO' },
            select: { amount: true, profileId: true },
          });
          await tx.commissionLedger.create({
            data: {
              saleId: affiliateSale.id,
              organizationId,
              profileId: ledger?.profileId ?? null,
              entryType: 'REVERSAL',
              amount: ledger ? -ledger.amount : -affiliateSale.commissionAmount,
              currency: 'KRW',
              isSettled: false,
              notes: [`환불 역분개 | ${bookingRef}`, reason ? `사유: ${reason}` : null, `eventId: ${eventId}`]
                .filter(Boolean)
                .join(' | '),
            },
          });
        }

        // 3. Contact 업데이트 + SMS 플래그 초기화 + 메모
        const contact = await tx.contact.findFirst({ where: { bookingRef } });
        if (contact) {
          await tx.contact.update({
            where: { id: contact.id },
            data: {
              lastRefundedAt: new Date(),
              lastPaymentStatus: 'REFUNDED',
              paymentStatusNote: `환불완료: ${refundAmount.toLocaleString()}원${reason ? ` (${reason})` : ''}`,
              smsDay0Sent: false,
              smsDay1Sent: false,
              smsDay2Sent: false,
              smsDay3Sent: false,
              smsDay7Sent: false,
            },
          });
          await tx.contactMemo.create({
            data: {
              contactId: contact.id,
              userId: 'system-webhook-crm-refund',
              content: [
                '[환불완료] 크루즈닷 웹훅',
                `금액: ${refundAmount.toLocaleString()}원`,
                reason ? `사유: ${reason}` : null,
                `이벤트ID: ${eventId}`,
                `처리일시: ${new Date().toLocaleString('ko-KR')}`,
              ].filter(Boolean).join('\n'),
            },
          });

          // 객실 재고 반환
          if (contact.userId) {
            const inv = await handleCabinInventoryRefund(contact.userId, organizationId, tx);
            if (!inv.success) {
              logger.warn('[CrmRefundWebhook] 객실 재고 반환 실패', { reason: inv.reason });
            }
          }

          // 환불 알림 파라미터 캡처 (트랜잭션 커밋 후 실행)
          pendingNotification = {
            organizationId,
            orderId: bookingRef,
            customerName: contact.name,
            refundAmount,
            refundReason: reason || '환불 요청',
            type: 'full_refund',
          };
        }
      }

      // 멱등 키 기록
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'crm-refund', status: 'SUCCESS' },
      });
    });

    // 트랜잭션 커밋 후 알림 발송 (실패해도 무관)
    if (pendingNotification) {
      void createRefundNotifications(pendingNotification)
        .catch((e) => logger.warn('[CrmRefundWebhook] 알림 생성 실패', { e }));
    }

    logger.log('[CrmRefundWebhook] 처리 완료', { eventId, bookingRef, status });
    return NextResponse.json({ ok: true, eventId, bookingRef, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('P2002')) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    logger.error('[CrmRefundWebhook] 처리 실패', { eventId, err: message });
    await prisma.processedWebhookEvent
      .create({ data: { eventId, webhookType: 'crm-refund', status: 'FAILED', errorMessage: message } })
      .catch((recordErr) => logger.error('[CrmRefundWebhook] FAILED 기록 실패', {
        eventId,
        error: recordErr instanceof Error ? recordErr.message : String(recordErr),
      }));
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
