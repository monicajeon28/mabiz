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
 *
 * 2단계 웹훅 구조:
 *   1단계 — 결제 즉시 (commissionRate: null 가능)
 *   2단계 — 관리자 승인 후 (commissionRate 확정값)
 *   같은 orderId로 2번 올 수 있음 → upsert 처리
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
    affiliateCode, saleAmount, commissionRate, commissionAmount,
    saleId, amount, customerEmail, productCode, headcount, cabinType,
    eventId,
  } = body;

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  // eventId 멱등성 체크 (1단계와 2단계는 다른 eventId를 보내야 함)
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
    // ── organizationId 결정 ──
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

    // 2단계 웹훅: affiliateCode 없이 orderId만 올 수 있음 → 기존 판매에서 org 찾기
    if (!resolvedOrgId && orderId) {
      const existingSale = await prisma.affiliateSale.findUnique({
        where: { orderId },
        select: { organizationId: true, affiliateCode: true },
      });
      resolvedOrgId = existingSale?.organizationId ?? undefined;
    }

    if (!resolvedOrgId) {
      resolvedOrgId = process.env.DEFAULT_ORGANIZATION_ID;
    }

    if (!resolvedOrgId) {
      logger.error('[PurchaseWebhook] 조직 특정 불가', {
        affiliateCode: affiliateCode ?? '없음',
        orderId: orderId ?? '없음',
      });
      return NextResponse.json({ ok: false, message: '조직 특정 불가' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const finalSaleAmount = parseInt(String(saleAmount ?? amount)) || 0;

    // commissionRate: null 허용 (크루즈닷몰 관리자 승인 전)
    const parsedCommissionRate = commissionRate != null ? parseFloat(String(commissionRate)) : null;
    const parsedCommissionAmount = parseInt(String(commissionAmount)) || 0;
    const parsedCruiseSaleId = saleId != null ? parseInt(String(saleId)) : null;
    const parsedHeadcount = headcount != null ? parseInt(String(headcount)) : null;

    logger.log('[PurchaseWebhook] 수신', {
      phone: normalizedPhone.slice(0, 4) + '***',
      productName, orderId, affiliateCode: affiliateCode ?? '없음',
      commissionRate: parsedCommissionRate, stage: parsedCommissionRate != null ? '2단계(확정)' : '1단계(대기)',
    });

    // affiliateSale용 멤버 조회
    let affiliateMember: { userId: string } | null = null;
    if (affiliateCode) {
      affiliateMember = await prisma.organizationMember.findFirst({
        where: { organizationId: resolvedOrgId, isActive: true },
        select: { userId: true },
      });
    }

    const contact = await prisma.$transaction(async (tx) => {
      // Contact upsert
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
          channel:        "b2c",
        },
        update: {
          name,
          productName:   productName   ?? undefined,
          departureDate: departureDate ? new Date(departureDate) : undefined,
          bookingRef:    orderId       ?? undefined,
          ...(customerEmail ? { email: customerEmail } : {}),
          ...(affiliateCode ? { affiliateCode } : {}),
        },
        select: { id: true, departureDate: true },
      });

      // ── 판매 기록 upsert (orderId 기준) ──
      // 1단계: 신규 생성 (commissionRate: null 가능)
      // 2단계: 기존 레코드 업데이트 (commissionRate/commissionAmount 갱신)
      if (orderId && finalSaleAmount > 0) {
        await tx.affiliateSale.upsert({
          where: { orderId },
          create: {
            organizationId: resolvedOrgId,
            affiliateCode:   affiliateCode ?? '',
            affiliateUserId: affiliateMember?.userId ?? null,
            productName:     productName ?? "크루즈 상품",
            saleAmount:      finalSaleAmount,
            commissionRate:  parsedCommissionRate ?? undefined,
            commissionAmount: parsedCommissionAmount,
            status:          "PENDING",
            customerPhone:   normalizedPhone.substring(0, 4) + "****",
            orderId,
            sourceWebhook:   "purchase",
            cruiseSaleId:    parsedCruiseSaleId ?? undefined,
            cabinType:       cabinType ?? null,
            headcount:       parsedHeadcount ?? undefined,
          },
          update: {
            // 2단계 웹훅: commission 필드 갱신 (핵심!)
            commissionRate:   parsedCommissionRate ?? undefined,
            commissionAmount: parsedCommissionAmount,
            ...(productName ? { productName } : {}),
            ...(finalSaleAmount > 0 ? { saleAmount: finalSaleAmount } : {}),
            ...(parsedCruiseSaleId ? { cruiseSaleId: parsedCruiseSaleId } : {}),
            ...(cabinType ? { cabinType } : {}),
            ...(parsedHeadcount ? { headcount: parsedHeadcount } : {}),
          },
        });
      }

      if (eventId) {
        await tx.processedWebhookEvent.create({
          data: { eventId, webhookType: 'purchase' },
        });
      }

      return upsertedContact;
    });

    // VIP 그룹 자동 배정 + 퍼널 트리거
    const vipGroup = await prisma.contactGroup.findFirst({
      where: {
        organizationId: resolvedOrgId,
        OR: [
          { name: { contains: 'VIP' } },
          { name: { contains: '구매' } },
          { name: { contains: '출발' } },
        ],
      },
      select: { id: true, name: true },
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
      contactId: contact.id, orderId, funnelStarted,
      commissionStage: parsedCommissionRate != null ? '확정' : '대기',
    });

    return NextResponse.json({ ok: true, contactId: contact.id, funnelStarted });
  } catch (err) {
    logger.error('[PurchaseWebhook] 처리 실패', { err });
    await enqueueDLQ('purchase', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
