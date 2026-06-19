export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { resolveGmcruiseWebhookContext } from '@/lib/gmcruise-webhook';

/**
 * POST /api/webhooks/gmcruise/passport-approved
 * 크루즈닷몰 여권 확인 완료(COMPLETED) 시 → CRM ContactMemo 자동 기록
 * Authorization: Bearer MABIZ_PASSPORT_APPROVED_WEBHOOK_SECRET
 *
 * Payload: reservationId, affiliateCode, completedAt, eventId
 * ⚠️ 크루즈닷몰은 shipName/departureDate/phone을 보내지 않음 — affiliateCode로만 Contact 역추적
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_PASSPORT_APPROVED_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[PassportApprovedWebhook] MABIZ_PASSPORT_APPROVED_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    logger.error('[PassportApprovedWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const tokenBuf = Buffer.from(token, 'utf8');
  const secretBuf = Buffer.from(secret, 'utf8');
  if (
    tokenBuf.byteLength !== secretBuf.byteLength ||
    !timingSafeEqual(tokenBuf, secretBuf)
  ) {
    logger.error('[PassportApprovedWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const {
    reservationId,
    affiliateCode,
    completedAt,
    eventId,
  } = body as {
    reservationId?: number;
    affiliateCode?: string | null;
    completedAt?: string;
    eventId?: string;
  };

  if (!eventId) {
    return NextResponse.json({ ok: false, message: 'eventId 필수' }, { status: 400 });
  }

  logger.log('[PassportApprovedWebhook] 수신', { reservationId, affiliateCode, eventId });

  try {
    // 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId_webhookType: {
          eventId,
          webhookType: 'gmcruise-passport-approved',
        },
      },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[PassportApprovedWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const { organizationId: resolvedOrgId, affiliateContact } = await resolveGmcruiseWebhookContext(
      prisma,
      affiliateCode,
      process.env.DEFAULT_ORGANIZATION_ID
    );

    if (!resolvedOrgId) {
      logger.log('[PassportApprovedWebhook] 조직 특정 불가 — 로그만 기록', { affiliateCode, reservationId });
      await prisma.processedWebhookEvent.create({
        data: { eventId, webhookType: 'gmcruise-passport-approved' },
      });
      return NextResponse.json({ ok: true, matched: false });
    }

    // bookingRef(reservationId)로 Contact 찾기, 없으면 affiliateCode로 찾기
    let contact: { id: string } | null = null;

    if (reservationId) {
      contact = await prisma.contact.findFirst({
        where: { bookingRef: String(reservationId), organizationId: resolvedOrgId },
        select: { id: true },
      });
    }

    if (!contact && affiliateContact) {
      contact = affiliateContact;
    }

    // 트랜잭션
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'gmcruise-passport-approved' },
      });

      if (contact) {
        await tx.contactMemo.create({
          data: {
            contactId: contact.id,
            userId: 'system-webhook',
            content: `[여권확인완료] 예약#${reservationId ?? '?'} 여권 확인 완료 (${completedAt ?? ''})`,
          },
        });
      }
    });

    logger.log('[PassportApprovedWebhook] 완료', {
      reservationId,
      contactFound: !!contact,
      eventId,
    });

    return NextResponse.json({ ok: true, matched: !!contact });
  } catch (err) {
    logger.error('[PassportApprovedWebhook] 처리 실패', { err, reservationId, eventId });
    await enqueueDLQ('passport-approved', body, err instanceof Error ? err.message : String(err)).catch((dlqErr) => {
      logger.error('[PassportApprovedWebhook] DLQ 저장 실패', {
        reservationId,
        eventId,
        error: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    });
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
