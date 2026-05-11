export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';

/**
 * POST /api/webhooks/passport-approved
 * 크루즈닷몰에서 여권 승인 완료 시 → CRM ContactMemo 자동 기록
 * Authorization: Bearer MABIZ_PASSPORT_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  // [보안] Bearer 시크릿 검증 (timingSafeEqual)
  const secret = process.env.MABIZ_PASSPORT_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[PassportApprovedWebhook] MABIZ_PASSPORT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[PassportApprovedWebhook] 인증 실패');
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
    reservationId,
    productCode,
    shipName,
    departureDate,
    passportStatus,
    customerPhone,
    affiliateCode,
    approvedAt,
    eventId,
  } = body as {
    reservationId?: number;
    productCode?: string | null;
    shipName?: string | null;
    departureDate?: string | null;
    passportStatus?: string;
    customerPhone?: string | null;
    affiliateCode?: string | null;
    approvedAt?: string;
    eventId?: string;
  };

  // 필수 파라미터 검증
  if (!eventId) {
    return NextResponse.json({ ok: false, message: 'eventId 필수' }, { status: 400 });
  }

  logger.log('[PassportApprovedWebhook] 수신', {
    phone: customerPhone ? customerPhone.substring(0, 4) + '***' : '없음',
    reservationId,
    passportStatus,
    eventId,
  });

  try {
    // ── 멱등성 체크 (eventId 기반) ─────────────────────────────────
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });

    if (alreadyProcessed) {
      logger.log('[PassportApprovedWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // ── affiliateCode → organizationId 역추적 ──────────────────────
    let resolvedOrgId: string | undefined;

    if (affiliateCode) {
      // 1순위: AffiliateSale에서 찾기
      const existingSale = await prisma.affiliateSale.findFirst({
        where: { affiliateCode },
        select: { organizationId: true },
        orderBy: { createdAt: 'desc' },
      });
      resolvedOrgId = existingSale?.organizationId ?? undefined;

      // 2순위: Contact에서 찾기
      if (!resolvedOrgId) {
        const existingContact = await prisma.contact.findFirst({
          where: { affiliateCode },
          select: { organizationId: true },
          orderBy: { createdAt: 'desc' },
        });
        resolvedOrgId = existingContact?.organizationId ?? undefined;
      }
    }

    // 3순위: DEFAULT_ORGANIZATION_ID 환경변수
    if (!resolvedOrgId) {
      resolvedOrgId = process.env.DEFAULT_ORGANIZATION_ID;
    }

    if (!resolvedOrgId) {
      logger.log('[PassportApprovedWebhook] 조직 특정 불가 — 로그만 기록하고 200 반환', {
        affiliateCode: affiliateCode ?? '없음',
        reservationId,
        eventId,
      });
      return NextResponse.json({ ok: true, message: '조직 특정 불가, 무시' });
    }

    // ── Contact 찾기 (2가지 시도) ───────────────────────────────────
    let contact: { id: string } | null = null;

    // 1순위: customerPhone이 마스킹 안 됐으면 phone + organizationId로 찾기
    if (customerPhone && !customerPhone.includes('*')) {
      const normalizedPhone = normalizePhone(customerPhone);
      contact = await prisma.contact.findUnique({
        where: { phone_organizationId: { phone: normalizedPhone, organizationId: resolvedOrgId } },
        select: { id: true },
      });
    }

    // 2순위: bookingRef에 reservationId가 저장된 Contact 찾기
    if (!contact && reservationId) {
      contact = await prisma.contact.findFirst({
        where: {
          bookingRef: String(reservationId),
          organizationId: resolvedOrgId,
        },
        select: { id: true },
      });
    }

    if (!contact) {
      logger.log('[PassportApprovedWebhook] 매칭된 Contact 없음 — 정상 처리', {
        phone: customerPhone ? customerPhone.substring(0, 4) + '***' : '없음',
        reservationId,
        eventId,
      });

      // Contact 없어도 processedWebhookEvent는 기록
      await prisma.processedWebhookEvent.create({
        data: { eventId, webhookType: 'passport-approved' },
      });

      return NextResponse.json({ ok: true, contactFound: false });
    }

    // ── Contact가 있으면: ContactMemo 생성 (트랜잭션) ────────────────
    const memoContent = `[여권승인] ${shipName ?? ''} / 출발 ${departureDate ?? ''} / 예약#${reservationId ?? ''} 여권 승인 완료`;

    await prisma.$transaction(async (tx) => {
      // 처리 완료 기록 (트랜잭션 안에서 → TOCTOU 방지)
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'passport-approved' },
      });

      // ContactMemo 자동 생성
      await tx.contactMemo.create({
        data: {
          contactId: contact!.id,
          userId: 'system-webhook',
          content: memoContent,
        },
      });
    });

    logger.log('[PassportApprovedWebhook] 처리 완료', {
      contactId: contact.id,
      organizationId: resolvedOrgId,
      reservationId,
      eventId,
    });

    return NextResponse.json({ ok: true, contactId: contact.id });

  } catch (err) {
    logger.error('[PassportApprovedWebhook] 처리 실패', { err, reservationId, eventId });
    await enqueueDLQ('passport-approved', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
