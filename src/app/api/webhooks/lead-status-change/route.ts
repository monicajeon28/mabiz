export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';

/**
 * POST /api/webhooks/lead-status-change
 * GMcruise에서 리드 상태 변경 시 → CRM Contact 메모 자동 기록 + 구매 전환 처리
 * Authorization: Bearer MABIZ_LEAD_STATUS_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  // [보안] Bearer 시크릿 검증 (timingSafeEqual)
  const secret = process.env.MABIZ_LEAD_STATUS_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[LeadStatusWebhook] MABIZ_LEAD_STATUS_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[LeadStatusWebhook] 인증 실패');
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
    leadId,
    prevStatus,
    newStatus,
    customerPhone,
    customerName,
    productCode,
    affiliateCode,
    managerId,
    agentId,
    changedAt,
    eventId,
  } = body as {
    leadId?: number;
    prevStatus?: string;
    newStatus?: string;
    customerPhone?: string | null;
    customerName?: string | null;
    productCode?: string | null;
    affiliateCode?: string | null;
    managerId?: number | null;
    agentId?: number | null;
    changedAt?: string;
    eventId?: string;
  };

  // 필수 파라미터 검증
  if (!eventId) {
    return NextResponse.json({ ok: false, message: 'eventId 필수' }, { status: 400 });
  }

  logger.log('[LeadStatusWebhook] 수신', {
    leadId,
    prevStatus,
    newStatus,
    phone: customerPhone ? customerPhone.slice(0, 4) + '***' : null,
    affiliateCode,
    eventId,
  });

  try {
    // ── 멱등성 체크 (eventId 기반) ─────────────────────────────────
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });

    if (alreadyProcessed) {
      logger.log('[LeadStatusWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // ── affiliateCode → organizationId 역추적 ────────────────────
    let organizationId: string | null = null;

    if (affiliateCode) {
      // 1순위: AffiliateSale에서 찾기
      const affiliateSale = await prisma.affiliateSale.findFirst({
        where: { affiliateCode },
        orderBy: { createdAt: 'desc' },
        select: { organizationId: true },
      });

      if (affiliateSale) {
        organizationId = affiliateSale.organizationId;
      } else {
        // 2순위: Contact에서 찾기
        const contactByAffiliate = await prisma.contact.findFirst({
          where: { affiliateCode },
          select: { organizationId: true },
          orderBy: { createdAt: 'desc' },
        });

        if (contactByAffiliate) {
          organizationId = contactByAffiliate.organizationId;
        }
      }
    }

    // 3순위: DEFAULT_ORGANIZATION_ID 환경변수
    if (!organizationId) {
      organizationId = process.env.DEFAULT_ORGANIZATION_ID ?? null;
    }

    if (!organizationId) {
      logger.log('[LeadStatusWebhook] 조직 매핑 실패 — 정상 처리 (조직 없음)', {
        affiliateCode,
        leadId,
        eventId,
      });
      // 조직 없어도 멱등성 기록 후 200 반환
      await prisma.processedWebhookEvent.create({
        data: { eventId, webhookType: 'lead-status-change' },
      });
      return NextResponse.json({ ok: true, matched: false });
    }

    // ── phone 마스킹 여부 확인 + Contact 조회 ────────────────────
    let contact: { id: string; organizationId: string } | null = null;

    if (
      customerPhone &&
      customerPhone.startsWith('010') &&
      !customerPhone.includes('*')
    ) {
      const normalizedPhone = normalizePhone(customerPhone);
      contact = await prisma.contact.findFirst({
        where: { phone: normalizedPhone, organizationId },
        select: { id: true, organizationId: true },
      });
    }

    // ── 트랜잭션으로 묶기 ────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      // 처리 완료 기록 (TOCTOU 방지)
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'lead-status-change' },
      });

      if (contact) {
        // ContactMemo 생성
        const memoContent = `[리드상태변경] ${prevStatus ?? '?'} → ${newStatus ?? '?'} / 리드#${leadId ?? '?'}`;
        await tx.contactMemo.create({
          data: {
            contactId: contact.id,
            userId: 'system-webhook',
            content: memoContent,
          },
        });

        // 구매 전환 처리
        if (newStatus === 'PURCHASED') {
          await tx.contact.update({
            where: { id: contact.id },
            data: { type: 'PURCHASED' },
          });
        }
      }
    });

    logger.log('[LeadStatusWebhook] 처리 완료', {
      leadId,
      eventId,
      contactFound: !!contact,
      newStatus,
    });

    return NextResponse.json({ ok: true, matched: !!contact });

  } catch (err) {
    logger.error('[LeadStatusWebhook] 처리 실패', { err, leadId, eventId });
    await enqueueDLQ('lead-status-change', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
