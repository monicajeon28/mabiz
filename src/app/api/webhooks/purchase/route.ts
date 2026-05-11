export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { triggerGroupFunnel } from '@/lib/funnel-trigger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';

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
  const {
    phone, name, productName, departureDate, orderId, organizationId,
    // WO-28B: 어필리에이트 추적
    affiliateCode,
    saleAmount,
    commissionRate,
    commissionAmount,
    // 크루즈닷몰 신규 필드 (CRM-WO-PURCHASE-REFUND-SYNC)
    saleId,
    amount,
    customerEmail,
    productCode,
    headcount,
    eventId,
  } = body;

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  // eventId 멱등성 체크 (중복 수신 방지)
  if (eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[PurchaseWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  try {
    // ── organizationId 결정 (크루즈닷몰은 organizationId를 보내지 않음) ──
    // 1순위: payload에 직접 포함된 경우
    // 2순위: affiliateCode → AffiliateSale에서 역추적
    // 3순위: affiliateCode → Contact에서 역추적
    // 4순위: DEFAULT_ORGANIZATION_ID 환경변수
    let resolvedOrgId = organizationId as string | undefined;

    if (!resolvedOrgId && affiliateCode) {
      const existingSale = await prisma.affiliateSale.findFirst({
        where: { affiliateCode },
        select: { organizationId: true },
        orderBy: { createdAt: 'desc' },
      });
      resolvedOrgId = existingSale?.organizationId ?? undefined;

      if (!resolvedOrgId) {
        const existingContact = await prisma.contact.findFirst({
          where: { affiliateCode },
          select: { organizationId: true },
          orderBy: { createdAt: 'desc' },
        });
        resolvedOrgId = existingContact?.organizationId ?? undefined;
      }
    }

    if (!resolvedOrgId) {
      resolvedOrgId = process.env.DEFAULT_ORGANIZATION_ID;
    }

    if (!resolvedOrgId) {
      logger.error('[PurchaseWebhook] 조직 특정 불가', {
        affiliateCode: affiliateCode ?? '없음',
        orderId: orderId ?? '없음',
      });
      return NextResponse.json({ ok: false, message: '조직 특정 불가 (affiliateCode 없음, DEFAULT_ORGANIZATION_ID 미설정)' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    logger.log('[PurchaseWebhook] 수신', {
      phone: normalizedPhone.slice(0, 4) + '***',
      productName,
      organizationId: resolvedOrgId,
      affiliateCode: affiliateCode ?? '없음',
    });

    // affiliateSale용 멤버 조회
    const finalSaleAmount = parseInt(String(saleAmount ?? amount)) || 0;
    let affiliateMember: { userId: string } | null = null;
    if (affiliateCode && finalSaleAmount > 0) {
      affiliateMember = await prisma.organizationMember.findFirst({
        where: { organizationId: resolvedOrgId, isActive: true },
        select: { userId: true },
      });
    }

    const contact = await prisma.$transaction(async (tx) => {
      // Contact upsert (전화번호 + 조직 기준)
      const upsertedContact = await tx.contact.upsert({
        where: { phone_organizationId: { phone: normalizedPhone, organizationId: resolvedOrgId } },
        create: {
          phone: normalizedPhone,
          name,
          organizationId: resolvedOrgId,
          email:          customerEmail ?? null,
          productName:    productName   ?? null,
          departureDate:  departureDate ? new Date(departureDate) : null,
          bookingRef:     orderId       ?? null,
          affiliateCode:  affiliateCode ?? null,
          purchasedAt:    new Date(),
        },
        update: {
          name,
          productName:   productName   ?? undefined,
          departureDate: departureDate ? new Date(departureDate) : undefined,
          bookingRef:    orderId       ?? undefined,
          // email: 기존 값이 있으면 유지, 없을 때만 저장
          ...(customerEmail ? { email: customerEmail } : {}),
          // purchasedAt은 update에서 제거 — 첫 구매일 보존
          ...(affiliateCode ? { affiliateCode } : {}),
        },
        select: { id: true, departureDate: true },
      });

      // 어필리에이트 판매 이력 기록 (조건부)
      if (affiliateCode && finalSaleAmount > 0) {
        await tx.affiliateSale.upsert({
          where: { orderId: orderId ?? `manual-${Date.now()}` },
          create: {
            organizationId: resolvedOrgId,
            affiliateCode,
            affiliateUserId: affiliateMember?.userId ?? null,
            productName:     productName ?? "크루즈 상품",
            saleAmount:      finalSaleAmount,
            commissionRate:  parseInt(String(commissionRate)) || 0,
            commissionAmount: parseInt(String(commissionAmount)) || 0,
            status:          "PENDING",
            customerPhone:   normalizedPhone.substring(0, 4) + "****",
            orderId:         orderId ?? null,
            sourceWebhook:   "purchase",
          },
          update: {
            status: "PENDING",
          },
        });
      }

      // processedWebhookEvent를 트랜잭션 안에서 기록 (멱등성 보장)
      if (eventId) {
        await tx.processedWebhookEvent.create({
          data: { eventId, webhookType: 'purchase' },
        });
      }

      return upsertedContact;
    });

    // "구매고객 VIP 케어" 그룹 찾기
    const vipGroup = await prisma.contactGroup.findFirst({
      where: {
        organizationId: resolvedOrgId,
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
        organizationId: resolvedOrgId,
      });
    }

    logger.log('[PurchaseWebhook] 처리 완료', {
      contactId: contact.id,
      organizationId: resolvedOrgId,
      vipGroup: vipGroup?.name ?? '없음',
      funnelStarted,
      affiliateCode: affiliateCode ?? '없음',
    });

    return NextResponse.json({ ok: true, contactId: contact.id, funnelStarted });
  } catch (err) {
    logger.error('[PurchaseWebhook] 처리 실패', { err });
    await enqueueDLQ('purchase', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
