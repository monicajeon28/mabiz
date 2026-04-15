export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { triggerGroupFunnel } from '@/lib/funnel-trigger';

/**
 * POST /api/webhooks/purchase
 * cruisedot.co.kr 결제 완료 후 호출
 * Authorization: Bearer MABIZ_PURCHASE_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  // [보안] 시크릿 검증
  const secret = process.env.MABIZ_PURCHASE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[PurchaseWebhook] MABIZ_PURCHASE_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[PurchaseWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json();
  const { phone, name, productName, departureDate, orderId, organizationId } = body;

  if (!phone || !name || !organizationId) {
    return NextResponse.json({ ok: false, message: 'phone, name, organizationId 필수' }, { status: 400 });
  }

  logger.log('[PurchaseWebhook] 수신', {
    phone: phone.substring(0, 4) + '***',
    productName,
    organizationId,
  });

  try {
    // Contact upsert (전화번호 + 조직 기준)
    const contact = await prisma.contact.upsert({
      where: { phone_organizationId: { phone, organizationId } },
      create: {
        phone,
        name,
        organizationId,
        productName: productName ?? null,
        departureDate: departureDate ? new Date(departureDate) : null,
        bookingRef: orderId ?? null,
      },
      update: {
        name,
        productName: productName ?? undefined,
        departureDate: departureDate ? new Date(departureDate) : undefined,
        bookingRef: orderId ?? undefined,
      },
      select: { id: true, departureDate: true },
    });

    // "구매고객 VIP 케어" 그룹 찾기
    const vipGroup = await prisma.contactGroup.findFirst({
      where: {
        organizationId,
        OR: [
          { name: { contains: 'VIP' } },
          { name: { contains: '구매' } },
          { name: { contains: '출발' } },
        ],
      },
      select: { id: true, name: true, funnelId: true },
    });

    let funnelStarted = false;
    if (vipGroup) {
      funnelStarted = await triggerGroupFunnel({
        contactId: contact.id,
        groupId: vipGroup.id,
        organizationId,
        sendFirst: true,
      });
    }

    logger.log('[PurchaseWebhook] 처리 완료', {
      contactId: contact.id,
      vipGroup: vipGroup?.name ?? '없음',
      funnelStarted,
    });

    return NextResponse.json({ ok: true, contactId: contact.id, funnelStarted });
  } catch (err) {
    logger.error('[PurchaseWebhook] 처리 실패', { err });
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
