export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/webhooks/cruise-purchase
 * 크루즈닷몰(cruisedot.co.kr) 결제 완료 시 호출 — VIP 구매자 연동
 *
 * Headers: x-webhook-secret: CRUISE_PURCHASE_WEBHOOK_SECRET
 *
 * Body: {
 *   buyerName:     string,
 *   buyerTel:      string,   // 전화번호 (필수)
 *   productName:   string,
 *   amount:        number,
 *   affiliateCode: string,   // 어느 파트너 조직 소속인지 특정 (필수)
 *   orderId:       string,   // 중복 방지 키 (필수)
 *   paidAt:        string,   // ISO 날짜 (선택)
 * }
 *
 * affiliateCode → organizationId 역추적 방법:
 *   1순위: Contact.affiliateCode 로 이미 등록된 연락처가 있으면 해당 organizationId
 *   2순위: AffiliateSale.affiliateCode 로 기존 판매 기록에서 organizationId 역추적
 *   3순위: 둘 다 없으면 affiliateCode 로 등록된 조직이 없으므로 처리 불가 → 400
 */
export async function POST(req: NextRequest) {
  // [보안] HMAC-like 시크릿 검증 (timingSafeEqual)
  const secret = process.env.CRUISE_PURCHASE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[CruisePurchaseWebhook] CRUISE_PURCHASE_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const incomingSecret = req.headers.get('x-webhook-secret') ?? '';
  let valid = false;
  try {
    // 길이가 다르면 timingSafeEqual이 throw — 미리 방어
    if (incomingSecret.length === secret.length) {
      valid = timingSafeEqual(Buffer.from(incomingSecret), Buffer.from(secret));
    }
  } catch {
    valid = false;
  }
  if (!valid) {
    logger.error('[CruisePurchaseWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // body 파싱
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const {
    buyerName,
    buyerTel,
    productName,
    amount,
    affiliateCode,
    orderId,
    paidAt,
  } = body as {
    buyerName?:     string;
    buyerTel?:      string;
    productName?:   string;
    amount?:        number;
    affiliateCode?: string;
    orderId?:       string;
    paidAt?:        string;
  };

  // 필수 파라미터 검증
  if (!buyerTel || !orderId) {
    return NextResponse.json({ ok: false, message: 'buyerTel, orderId 필수' }, { status: 400 });
  }

  // affiliateCode 없으면 처리 불가 (어느 조직인지 알 수 없어 오염 방지)
  if (!affiliateCode) {
    logger.error('[CruisePurchaseWebhook] affiliateCode 없음 — 조직 특정 불가', {
      orderId,
      phone: buyerTel.substring(0, 4) + '****',
    });
    return NextResponse.json(
      { ok: false, message: 'affiliateCode 필수 — 조직 특정 불가' },
      { status: 400 }
    );
  }

  logger.log('[CruisePurchaseWebhook] 수신', {
    phone:         buyerTel.substring(0, 4) + '****',
    productName,
    affiliateCode,
    orderId,
  });

  try {
    // ── affiliateCode → organizationId 역추적 ──────────────────────
    // 1순위: 기존 AffiliateSale 기록에서 추적
    const existingSale = await prisma.affiliateSale.findFirst({
      where:  { affiliateCode },
      select: { organizationId: true },
      orderBy: { createdAt: 'desc' },
    });
    let organizationId = existingSale?.organizationId ?? null;

    // 2순위: Contact 테이블에서 추적
    if (!organizationId) {
      const existingContact = await prisma.contact.findFirst({
        where:  { affiliateCode },
        select: { organizationId: true },
        orderBy: { createdAt: 'desc' },
      });
      organizationId = existingContact?.organizationId ?? null;
    }

    if (!organizationId) {
      logger.error('[CruisePurchaseWebhook] affiliateCode에 매핑된 조직 없음', {
        affiliateCode,
        orderId,
      });
      return NextResponse.json(
        { ok: false, message: '해당 affiliateCode에 등록된 조직 없음' },
        { status: 422 }
      );
    }

    // 중복 orderId 방어 (TOCTOU)
    const existingDuplicate = await prisma.affiliateSale.findUnique({
      where:  { orderId },
      select: { id: true },
    });
    if (existingDuplicate) {
      logger.log('[CruisePurchaseWebhook] 중복 orderId — 이미 처리됨', { orderId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // ── Contact upsert + AffiliateSale 기록 (트랜잭션) ────────────
    const paidAtDate = paidAt ? new Date(paidAt) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Contact upsert (type: CUSTOMER, purchasedAt 업데이트)
      const contact = await tx.contact.upsert({
        where: {
          phone_organizationId: { phone: buyerTel, organizationId },
        },
        create: {
          organizationId,
          name:          buyerName ?? '크루즈닷 구매자',
          phone:         buyerTel,
          type:          'CUSTOMER',
          affiliateCode,
          productName:   productName ?? null,
          purchasedAt:   paidAtDate,
        },
        update: {
          // 기존 연락처라면 구매 정보만 업데이트
          type:          'CUSTOMER',
          purchasedAt:   paidAtDate,
          productName:   productName ?? undefined,
          affiliateCode,
          ...(buyerName ? { name: buyerName } : {}),
        },
        select: { id: true },
      });

      // AffiliateSale 기록 (수당 계산용)
      const saleRecord = await tx.affiliateSale.create({
        data: {
          organizationId,
          affiliateCode,
          productName:     productName ?? '크루즈 상품',
          saleAmount:      typeof amount === 'number' ? amount : 0,
          commissionRate:  0,    // 크루즈닷몰에서 전달 시 업데이트 가능
          commissionAmount: 0,
          status:          'PENDING',
          customerPhone:   buyerTel.substring(0, 4) + '****',
          orderId,
          sourceWebhook:   'cruise-purchase',
        },
        select: { id: true },
      });

      return { contactId: contact.id, saleId: saleRecord.id };
    });

    logger.log('[CruisePurchaseWebhook] 처리 완료', {
      organizationId,
      affiliateCode,
      contactId: result.contactId,
      saleId:    result.saleId,
      orderId,
    });

    return NextResponse.json({
      ok:         true,
      contactId:  result.contactId,
      saleId:     result.saleId,
    });

  } catch (err) {
    logger.error('[CruisePurchaseWebhook] 처리 실패', { err, orderId });
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
