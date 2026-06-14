export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { createRefundNotifications } from '@/lib/notification-service';
import { handleCabinInventoryRefund } from '@/lib/cabin-inventory-refund';
import { recordProcessedWebhookEvent } from '@/lib/webhook-execution';

/**
 * POST /api/webhooks/refund
 * GMcruise(크루즈닷몰) 환불 Webhook — 확정 스펙 2026-06-02
 *
 * 인증: Authorization: Bearer {MABIZ_REFUND_WEBHOOK_SECRET}
 *      x-signature: HMAC-SHA256(rawBody, secret)
 *
 * 페이로드 필드 (스펙 확정본 기준):
 *   bookingRef  (= orderId 하위호환)
 *   eventType   refund.requested | refund.approved | refund.completed | refund.rejected
 *   status      PENDING | APPROVED | COMPLETED | REJECTED
 *   refundAmount, refundReason, customerPhone, customerName, eventId, timestamp
 *
 * 상태 전이:
 *   PENDING  → 수신 기록만, 커미션 역분개 없음
 *   APPROVED → Contact 상태 REFUND_APPROVED 로 업데이트
 *   COMPLETED → Contact REFUNDED + CommissionLedger REVERSAL + 알림
 *   REJECTED → Contact 상태 원복(PURCHASED) + 메모만
 *
 * ⚠️ AffiliateSale 등 크루즈닷몰 공유 테이블은 COMPLETED 시에만 수정
 */

type RefundStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';

export async function POST(req: NextRequest) {
  // ── 1. Secret 확인 ────────────────────────────────────────────────────────
  const secret = process.env.MABIZ_REFUND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[RefundWebhook] MABIZ_REFUND_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // ── 2. Bearer 토큰 검증 ───────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const secretStr: string = secret;
  if (
    token.length !== secretStr.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secretStr))
  ) {
    logger.warn('[RefundWebhook] Bearer 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // ── 3. raw body 읽기 + HMAC-SHA256 검증 ──────────────────────────────────
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature') ?? '';
  if (!signature) {
    return NextResponse.json({ ok: false, error: 'Missing x-signature' }, { status: 401 });
  }
  const expectedSig = createHmac('sha256', secretStr).update(rawBody).digest('hex');
  if (
    signature.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  ) {
    logger.warn('[RefundWebhook] HMAC 서명 검증 실패');
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // ── 4. JSON 파싱 ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  // ── 5. 필드 추출 (스펙 확정: bookingRef, 하위호환: orderId) ──────────────
  const bookingRef   = (body.bookingRef ?? body.orderId) as string | undefined;
  const eventId      = body.eventId as string | undefined;
  const eventType    = body.eventType as string | undefined;
  const status       = (body.status as RefundStatus | undefined) ?? 'COMPLETED'; // 구버전 호환
  const refundAmount = body.refundAmount as number | undefined;
  const refundReason = (body.refundReason ?? body.reason) as string | undefined;
  const customerPhone= (body.customerPhone ?? body.buyerPhone) as string | undefined;
  const customerName = (body.customerName  ?? body.buyerName)  as string | undefined;
  const organizationId_body = body.organizationId as string | undefined;
  const timestamp    = body.timestamp as string | undefined;

  if (!bookingRef) {
    return NextResponse.json({ ok: false, message: 'bookingRef(또는 orderId) 필수' }, { status: 400 });
  }

  // 허용된 상태값 검증
  const VALID_STATUSES: RefundStatus[] = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'];
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, message: `유효하지 않은 status: ${status}` }, { status: 400 });
  }

  // ── 6. 멱등성 체크 ───────────────────────────────────────────────────────
  const webhookType = `refund_${status.toLowerCase()}`; // refund_pending / refund_completed ...
  if (eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId_webhookType: { eventId, webhookType } },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[RefundWebhook] 중복 이벤트 무시', { eventId, status });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  logger.log('[RefundWebhook] 수신', {
    bookingRef,
    status,
    eventType,
    phone: customerPhone ? String(customerPhone).slice(0, 4) + '***' : '없음',
    amount: refundAmount,
  });

  // ── 7. PENDING — 수신 기록만 (커미션 역분개 없음) ─────────────────────────
  if (status === 'PENDING') {
    if (eventId) {
      await recordProcessedWebhookEvent(prisma, {
        eventId,
        webhookType,
        context: '[RefundWebhook] PENDING 기록 실패',
      });
    }
    logger.log('[RefundWebhook] PENDING 수신 기록', { bookingRef, eventId });
    return NextResponse.json({ ok: true, status: 'recorded' });
  }

  // ── 8. APPROVED — Contact 상태만 업데이트 ────────────────────────────────
  if (status === 'APPROVED') {
    try {
      const sale = await prisma.affiliateSale.findUnique({
        where: { orderId: bookingRef },
        select: { organizationId: true },
      });
      const orgId = organizationId_body ?? sale?.organizationId ?? process.env.DEFAULT_ORGANIZATION_ID;

      if (orgId) {
        const contact = await prisma.contact.findFirst({
          where: { bookingRef, organizationId: orgId },
          select: { id: true },
        });
        if (contact) {
          await prisma.$transaction(async (tx) => {
            await tx.contact.update({
              where: { id: contact.id },
              data: { lastPaymentStatus: 'refund_approved', paymentStatusNote: '환불 승인됨 (처리 중)' },
            });
            await tx.contactMemo.create({
              data: {
                contactId: contact.id,
                userId: 'system-webhook',
                content: `[환불승인] ${refundAmount ? refundAmount.toLocaleString() + '원' : ''}\n사유: ${refundReason ?? '-'}`,
              },
            });
            if (eventId) {
              await recordProcessedWebhookEvent(tx, {
                eventId,
                webhookType,
                context: '[RefundWebhook] APPROVED 기록 실패',
              });
            }
          });
        }
      }
      logger.log('[RefundWebhook] APPROVED 처리 완료', { bookingRef });
      return NextResponse.json({ ok: true, status: 'approved' });
    } catch (err) {
      logger.error('[RefundWebhook] APPROVED 처리 실패', { err, bookingRef });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  // ── 9. REJECTED — Contact 상태 메모만 ────────────────────────────────────
  if (status === 'REJECTED') {
    try {
      const sale = await prisma.affiliateSale.findUnique({
        where: { orderId: bookingRef },
        select: { organizationId: true },
      });
      const orgId = organizationId_body ?? sale?.organizationId ?? process.env.DEFAULT_ORGANIZATION_ID;

      if (orgId) {
        const contact = await prisma.contact.findFirst({
          where: { bookingRef, organizationId: orgId },
          select: { id: true },
        });
        if (contact) {
          await prisma.$transaction(async (tx) => {
            await tx.contact.update({
              where: { id: contact.id },
              data: { lastPaymentStatus: 'refund_rejected', paymentStatusNote: '환불 거절' },
            });
            const rejectionReason = (body.metadata as Record<string, unknown> | undefined)?.rejectionReason as string | undefined;
            await tx.contactMemo.create({
              data: {
                contactId: contact.id,
                userId: 'system-webhook',
                content: `[환불거절] 사유: ${rejectionReason ?? refundReason ?? '정보 없음'}`,
              },
            });
            if (eventId) {
              await recordProcessedWebhookEvent(tx, {
                eventId,
                webhookType,
                context: '[RefundWebhook] REJECTED 기록 실패',
              });
            }
          });
        }
      }
      logger.log('[RefundWebhook] REJECTED 처리 완료', { bookingRef });
      return NextResponse.json({ ok: true, status: 'rejected' });
    } catch (err) {
      logger.error('[RefundWebhook] REJECTED 처리 실패', { err, bookingRef });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  // ── 10. COMPLETED — 전체 환불 처리 ───────────────────────────────────────
  try {
    const sale = await prisma.affiliateSale.findUnique({
      where: { orderId: bookingRef },
      select: { organizationId: true, customerPhone: true },
    });
    const organizationId = organizationId_body ?? sale?.organizationId ?? process.env.DEFAULT_ORGANIZATION_ID;

    if (!organizationId) {
      logger.error('[RefundWebhook] 조직 특정 불가', { bookingRef });
      return NextResponse.json({ ok: false, message: '조직 특정 불가' }, { status: 422 });
    }

    const contact = await prisma.contact.findFirst({
      where: { bookingRef, organizationId },
      select: { id: true, phone: true, name: true, userId: true },
    });

    const affiliateSale = await prisma.affiliateSale.findUnique({
      where: { orderId: bookingRef },
      select: { id: true, saleAmount: true, commissionAmount: true, commissionRate: true, organizationId: true },
    });

    const refundedAt = timestamp ?? new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      // Contact → REFUNDED
      if (contact) {
        await tx.contact.update({
          where: { id: contact.id },
          data: {
            type: 'REFUNDED',
            lastPaymentStatus: 'refunded',
            lastRefundedAt: new Date(refundedAt),
            paymentStatusNote: `환불완료: ${refundAmount ? refundAmount.toLocaleString() + '원' : '금액미상'}`,
          },
        });
        const memoLines = [
          `[환불완료] ${refundAmount ? refundAmount.toLocaleString() + '원' : '금액 미상'}`,
          refundReason ? `사유: ${refundReason}` : null,
          `주문번호: ${bookingRef}`,
          customerPhone ? `연락처: ${customerPhone.slice(0, 4)}***` : null,
          `처리일시: ${refundedAt}`,
        ].filter(Boolean).join('\n');

        await tx.contactMemo.create({
          data: { contactId: contact.id, userId: 'system-webhook', content: memoLines },
        });
      }

      // AffiliateSale + CommissionLedger REVERSAL
      let refundNotificationData: Parameters<typeof createRefundNotifications>[0] | null = null;
      if (affiliateSale && affiliateSale.commissionAmount > 0) {
        await tx.affiliateSale.update({
          where: { id: affiliateSale.id },
          data: {
            refundedAmount: refundAmount ?? affiliateSale.saleAmount,
            refundedAt: new Date(refundedAt),
            status: 'REFUNDED',
            cancelReason: 'CUSTOMER_REFUND_REQUEST',
          },
        });

        const existingLedger = await tx.commissionLedger.findFirst({
          where: { saleId: affiliateSale.id, organizationId: affiliateSale.organizationId, entryType: 'COMMISSION_AUTO' },
          select: { id: true, amount: true, profileId: true },
          orderBy: { createdAt: 'desc' },
        });

        // 음수 보장: existingLedger.amount가 양수인 경우만 반전
        const reversalAmount = existingLedger
          ? -(Math.abs(existingLedger.amount))
          : -(Math.abs(affiliateSale.commissionAmount));

        await tx.commissionLedger.create({
          data: {
            saleId: affiliateSale.id,
            organizationId: affiliateSale.organizationId,
            profileId: existingLedger?.profileId ?? null,
            entryType: 'REVERSAL',
            amount: reversalAmount,
            currency: 'KRW',
            isSettled: false,
            notes: [
              `환불 역분개 | ${bookingRef}`,
              refundReason ? `사유: ${refundReason}` : null,
              eventId ? `eventId: ${eventId}` : null,
            ].filter(Boolean).join(' | '),
          },
        });

        refundNotificationData = {
          organizationId: affiliateSale.organizationId,
          orderId: bookingRef,
          customerName: contact?.name ?? customerName ?? '고객',
          refundAmount: refundAmount ?? affiliateSale.saleAmount,
          refundReason: refundReason ?? '환불 요청',
          type: 'full_refund',
        };

        logger.log('[RefundWebhook] CommissionLedger REVERSAL 생성', {
          affiliateSaleId: affiliateSale.id,
          reversalAmount,
          bookingRef,
        });
      }

      // 객실 재고 감소
      if (contact?.userId && affiliateSale && affiliateSale.organizationId === organizationId) {
        const result = await handleCabinInventoryRefund(contact.userId, organizationId, tx);
        if (!result.success) {
          logger.warn('[RefundWebhook] 객실 재고 감소 실패', { userId: contact.userId, reason: result.reason });
        }
      }

      // eventId 처리 완료 기록 (트랜잭션 내 — TOCTOU 방지)
      if (eventId) {
        await recordProcessedWebhookEvent(tx, {
          eventId,
          webhookType,
          context: '[RefundWebhook] COMPLETED 기록 실패',
        });
      }

      // 트랜잭션 후 알림 (fire-and-forget)
      if (refundNotificationData) {
        createRefundNotifications(refundNotificationData).catch((err) => {
          logger.warn('[RefundWebhook] 환불 알림 실패', {
            bookingRef,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    });

    logger.log('[RefundWebhook] COMPLETED 완료', { contactFound: !!contact, bookingRef, amount: refundAmount });
    return NextResponse.json({ ok: true, contactFound: !!contact });
  } catch (err) {
    logger.error('[RefundWebhook] 처리 실패', { err, bookingRef });
    await enqueueDLQ('refund', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
