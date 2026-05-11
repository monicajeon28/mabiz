export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';

/**
 * POST /api/webhooks/refund
 * GMcruise(크루즈닷몰) 환불 완료 후 호출
 * Authorization: Bearer MABIZ_REFUND_WEBHOOK_SECRET
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

  const body = await req.json() as {
    orderId: string;
    buyerPhone: string;
    buyerName?: string;
    refundAmount: number;
    refundedAt: string;
    affiliateCode?: string;
    organizationId?: string;
    eventId?: string;
  };

  const { orderId, buyerPhone, refundedAt, organizationId: bodyOrgId, eventId } = body;

  if (!orderId || !buyerPhone) {
    return NextResponse.json({ ok: false, message: 'orderId, buyerPhone 필수' }, { status: 400 });
  }

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

  const normalizedPhone = normalizePhone(buyerPhone);
  logger.log('[RefundWebhook] 수신', { orderId, buyerPhone: normalizedPhone.slice(0, 4) + '***' });

  let saleUpdated = false;
  let agentSuspended = false;
  let contactUpdated = false;

  // Step 1: AffiliateSale → REFUNDED
  let gmAgentId: string | null = null;
  try {
    const refundedAtDate = new Date(refundedAt);
    const rows = await prisma.$queryRaw<{ id: number; affiliateUserId: string | null }[]>(
      Prisma.sql`
        UPDATE "AffiliateSale"
        SET    status = 'REFUNDED',
               "refundedAt" = ${refundedAtDate}
        WHERE  "orderId" = ${orderId}
          AND  status NOT IN ('REFUNDED', 'CANCELLED')
        RETURNING id, "affiliateUserId"
      `
    );
    if (rows.length > 0) {
      saleUpdated = true;
      gmAgentId = rows[0].affiliateUserId ?? null;
    }
    logger.log('[RefundWebhook] AffiliateSale 업데이트', { saleUpdated, gmAgentId });
  } catch (err) {
    logger.error('[RefundWebhook] AffiliateSale 업데이트 실패', { err });
    await enqueueDLQ('refund', body, err instanceof Error ? err.message : String(err)).catch(() => {});
  }

  // Step 2: 환불율 >= 30% → 에이전트 링크 SUSPEND
  if (gmAgentId !== null) {
    try {
      const stats = await prisma.$queryRaw<{ totalAmount: bigint; refundAmount: bigint }[]>(
        Prisma.sql`
          SELECT
            COALESCE(SUM(CASE WHEN status IN ('APPROVED','CONFIRMED','REFUNDED') THEN "saleAmount" ELSE 0 END), 0)::bigint AS "totalAmount",
            COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN "saleAmount" ELSE 0 END), 0)::bigint                           AS "refundAmount"
          FROM "AffiliateSale"
          WHERE "agentId" = ${gmAgentId}
        `
      );
      const total = Number(stats[0]?.totalAmount ?? 0);
      const refund = Number(stats[0]?.refundAmount ?? 0);
      const refundRate = total > 0 ? refund / total : 0;

      if (refundRate >= 0.3) {
        await prisma.$queryRaw(
          Prisma.sql`
            UPDATE "AffiliateLink"
            SET    status = 'SUSPENDED'
            WHERE  "agentId" = ${gmAgentId}
              AND  status <> 'SUSPENDED'
          `
        );
        agentSuspended = true;
        logger.log('[RefundWebhook] 에이전트 링크 SUSPEND', { gmAgentId, refundRate });
      }
    } catch (err) {
      logger.error('[RefundWebhook] 환불율 계산/링크 정지 실패', { err });
    }
  }

  // Step 3: Contact 타입 → REFUNDED
  try {
    let organizationId = bodyOrgId;
    if (!organizationId) {
      const defaultOrg = await prisma.organization.findFirst({ select: { id: true } });
      organizationId = defaultOrg?.id;
    }
    if (organizationId) {
      const result = await prisma.contact.updateMany({
        where: { phone: normalizedPhone, organizationId },
        data: { type: 'REFUNDED' },
      });
      contactUpdated = result.count > 0;
    }
  } catch (err) {
    logger.error('[RefundWebhook] Contact 업데이트 실패', { err });
  }

  logger.log('[RefundWebhook] 완료', { saleUpdated, agentSuspended, contactUpdated });

  // eventId 처리 완료 기록
  if (eventId) {
    await prisma.processedWebhookEvent.create({
      data: { eventId, webhookType: 'refund' },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
