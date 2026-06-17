export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { resolveGmcruiseWebhookContext } from '@/lib/gmcruise-webhook';
import { isStaffPhone } from '@/lib/contact-guard';

/**
 * POST /api/webhooks/gmcruise/lead-status
 * 크루즈닷몰 리드 상태 변경 시 → CRM ContactMemo 자동 기록
 * Authorization: Bearer MABIZ_LEAD_STATUS_WEBHOOK_SECRET
 *
 * 전송 조건: IN_PROGRESS | CLOSED | TEST_GUIDE 상태 변경 시만 전송
 * ⚠️ PURCHASED/REFUNDED는 별도 webhook(결제/환불)으로 처리 → 이 webhook에서 type 변경 없음
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_LEAD_STATUS_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[LeadStatusWebhook] MABIZ_LEAD_STATUS_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[LeadStatusWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const {
    leadId,
    status,
    previousStatus,
    customerName,
    affiliateCode,
    changedAt,
    eventId,
    phone,
    email,
  } = body as {
    leadId?: number;
    status?: string;
    previousStatus?: string | null;
    customerName?: string | null;
    affiliateCode?: string | null;
    changedAt?: string;
    eventId?: string;
    phone?: string | null;
    email?: string | null;
  };

  if (!eventId) {
    return NextResponse.json({ ok: false, message: 'eventId 필수' }, { status: 400 });
  }

  logger.log('[LeadStatusWebhook] 수신', {
    leadId,
    previousStatus,
    status,
    affiliateCode,
    eventId,
  });

  try {
    // 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId_webhookType: {
          eventId,
          webhookType: 'gmcruise-lead-status',
        },
      },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[LeadStatusWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const { organizationId, contact } = await resolveGmcruiseWebhookContext(
      prisma,
      affiliateCode,
      process.env.DEFAULT_ORGANIZATION_ID
    );

    // 조직 없어도 멱등성 기록 후 200 반환
    if (!organizationId) {
      logger.log('[LeadStatusWebhook] 조직 특정 불가 — 로그만 기록', { affiliateCode, leadId });
      await prisma.processedWebhookEvent.create({
        data: { eventId, webhookType: 'gmcruise-lead-status' },
      });
      return NextResponse.json({ ok: true, matched: false });
    }

    // 신규 리드: Contact 없으면 생성
    let resolvedContact = contact;
    if (!resolvedContact && phone) {
      const staffCheck = await isStaffPhone(phone, organizationId);
      if (!staffCheck) {
        resolvedContact = await prisma.contact.create({
          data: {
            name: customerName || phone || '이름없음',
            phone: phone || '',
            email: email || null,
            organizationId: organizationId,
            type: 'INQUIRY',
            sourceType: 'affiliate',
            visibility: 'ADMIN_ONLY',
          },
          select: { id: true },
        });
        logger.log('[LeadStatusWebhook] 신규 Contact 생성', {
          contactId: resolvedContact.id,
          phone,
          email,
          leadId,
        });
      } else {
        logger.warn('[LeadStatusWebhook] 직원 번호 건너뜀', { phone: phone.slice(0, 6) + '****' });
      }
    } else if (!resolvedContact && email) {
      resolvedContact = await prisma.contact.create({
        data: {
          name: customerName || email || '이름없음',
          phone: '',
          email: email,
          organizationId: organizationId,
          type: 'INQUIRY',
          sourceType: 'affiliate',
          visibility: 'ADMIN_ONLY',
        },
        select: { id: true },
      });
      logger.log('[LeadStatusWebhook] 신규 Contact 생성 (이메일만)', {
        contactId: resolvedContact.id,
        email,
        leadId,
      });
    }

    // 트랜잭션
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'gmcruise-lead-status' },
      });

      if (resolvedContact) {
        const memoContent = [
          `[리드상태변경] ${previousStatus ?? '?'} → ${status ?? '?'}`,
          `리드#${leadId ?? '?'}`,
          customerName ? `고객: ${customerName}` : null,
          changedAt ? `변경일시: ${changedAt}` : null,
        ].filter(Boolean).join(' / ');

        await tx.contactMemo.create({
          data: {
            contactId: resolvedContact.id,
            userId: 'system-webhook',
            content: memoContent,
          },
        });
      }
    });

    logger.log('[LeadStatusWebhook] 완료', {
      leadId,
      contactFound: !!resolvedContact,
      status,
      eventId,
    });

    return NextResponse.json({ ok: true, matched: !!resolvedContact });
  } catch (err) {
    logger.error('[LeadStatusWebhook] 처리 실패', { err, leadId, eventId });
    await enqueueDLQ('lead-status', body, err instanceof Error ? err.message : String(err)).catch((dlqErr) => {
      logger.error('[LeadStatusWebhook] DLQ 저장 실패', {
        leadId,
        eventId,
        error: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    });
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
