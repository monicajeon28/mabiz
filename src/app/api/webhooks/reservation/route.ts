export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';

/**
 * POST /api/webhooks/reservation
 * GMcruise에서 예약 생성 시 → CRM Contact의 출발일/상품명 자동 업데이트
 * Authorization: Bearer MABIZ_RESERVATION_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  // [보안] Bearer 시크릿 검증 (timingSafeEqual)
  const secret = process.env.MABIZ_RESERVATION_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[ReservationWebhook] MABIZ_RESERVATION_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[ReservationWebhook] 인증 실패');
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
    cabinType,
    totalPeople,
    phone,
    eventId,
  } = body as {
    reservationId?: number;
    productCode?: string;
    shipName?: string;
    departureDate?: string;
    cabinType?: string;
    totalPeople?: number;
    phone?: string;
    eventId?: string;
  };

  // 필수 파라미터 검증
  if (!phone) {
    return NextResponse.json({ ok: false, message: 'phone 필수' }, { status: 400 });
  }
  if (!eventId) {
    return NextResponse.json({ ok: false, message: 'eventId 필수' }, { status: 400 });
  }

  logger.log('[ReservationWebhook] 수신', {
    phone: phone.substring(0, 4) + '***',
    reservationId,
    productCode,
    eventId,
  });

  try {
    // ── 멱등성 체크 (eventId 기반) ─────────────────────────────────
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });

    if (alreadyProcessed) {
      logger.log('[ReservationWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // ── phone으로 모든 조직의 Contact 조회 ────────────────────────
    const contacts = await prisma.contact.findMany({
      where: { phone },
      select: { id: true, organizationId: true },
    });

    if (contacts.length === 0) {
      logger.log('[ReservationWebhook] 매칭된 Contact 없음 — 정상 처리', {
        phone: phone.substring(0, 4) + '***',
        reservationId,
      });
      // Contact가 없어도 200 반환 (데이터가 없을 수 있음, 정상)
      return NextResponse.json({ ok: true, updatedCount: 0 });
    }

    // ── 매칭된 Contact 업데이트 ────────────────────────────────────
    const productName = shipName && productCode ? `${shipName} ${productCode}` : undefined;
    const memoContent = `[예약확정] ${shipName ?? ''} / ${cabinType ?? ''} / ${totalPeople ?? 0}명 / 출발 ${departureDate ?? ''}`;

    await prisma.$transaction(async (tx) => {
      // ── 처리 완료 기록 (트랜잭션 안에서 → TOCTOU 방지) ────────────
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'reservation' },
      });

      for (const contact of contacts) {
        // Contact 필드 업데이트
        await tx.contact.update({
          where: { id: contact.id },
          data: {
            ...(departureDate ? { departureDate: new Date(departureDate) } : {}),
            ...(productName ? { productName } : {}),
            ...(reservationId ? { bookingRef: String(reservationId) } : {}),
          },
        });

        // ContactMemo 자동 생성
        await tx.contactMemo.create({
          data: {
            contactId: contact.id,
            userId: 'system-webhook',
            content: memoContent,
          },
        });
      }
    });

    logger.log('[ReservationWebhook] 처리 완료', {
      updatedCount: contacts.length,
      reservationId,
      eventId,
    });

    return NextResponse.json({ ok: true, updatedCount: contacts.length });

  } catch (err) {
    logger.error('[ReservationWebhook] 처리 실패', { err, reservationId, eventId });
    await enqueueDLQ('reservation', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
