export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizePhone } from '@/lib/phone-normalize';

/**
 * POST /api/webhooks/refund
 * GMcruise(크루즈닷몰/웰컴페이먼츠 B2C) 환불 완료 후 호출
 * Authorization: Bearer MABIZ_REFUND_WEBHOOK_SECRET
 *
 * ⚠️ CRM은 "환불 알림"만 받음 — Contact 상태 변경 + 확인용
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

  const body = await req.json() as {
    orderId: string;
    buyerPhone: string;
    buyerName?: string;
    refundAmount: number;
    refundedAt: string;
    organizationId?: string;
    eventId?: string;
  };

  const { orderId, buyerPhone, organizationId: bodyOrgId, eventId } = body;

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

  // Contact 상태 → REFUNDED (크루즈닷몰에서 환불 처리된 사실만 반영)
  let contactUpdated = false;
  try {
    let organizationId = bodyOrgId;
    if (!organizationId) {
      organizationId = process.env.DEFAULT_ORGANIZATION_ID;
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

  // eventId 처리 완료 기록 (Contact 업데이트 성공 시에만)
  if (eventId && contactUpdated) {
    await prisma.processedWebhookEvent.create({
      data: { eventId, webhookType: 'refund' },
    }).catch(() => {});
  }

  logger.log('[RefundWebhook] 완료', { contactUpdated, orderId });
  return NextResponse.json({ ok: true });
}
