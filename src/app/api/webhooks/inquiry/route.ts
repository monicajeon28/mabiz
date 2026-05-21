export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';

/**
 * POST /api/webhooks/inquiry
 * GMcruise(크루즈닷몰) 고객 문의/상담신청 시 호출
 * Authorization: Bearer MABIZ_INQUIRY_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_INQUIRY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[InquiryWebhook] MABIZ_INQUIRY_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[InquiryWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json() as {
    phone: string;
    name: string;
    email?: string;
    inquiryType?: string;
    message?: string;
    productCode?: string;
    affiliateCode?: string;
    organizationId?: string;
    submittedAt?: string;
    eventId?: string;
  };

  const { phone, name, email, inquiryType, message, affiliateCode, organizationId: bodyOrgId, eventId } = body;

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  logger.log('[InquiryWebhook] 수신', { phone: phone.slice(0, 4) + '***', inquiryType });

  // 1. organizationId 결정 (findFirst 제거 — 비결정적 배정 방지)
  let organizationId = bodyOrgId;
  if (!organizationId) {
    organizationId = process.env.DEFAULT_ORGANIZATION_ID;
    if (!organizationId) {
      logger.error('[InquiryWebhook] organizationId 미제공 + DEFAULT_ORGANIZATION_ID 미설정');
      return NextResponse.json({ ok: false, message: 'organizationId 필수' }, { status: 400 });
    }
  }

  // 2~4. Contact upsert + Memo + 그룹 배정을 트랜잭션으로 통합
  const normalizedPhone = normalizePhone(phone);

  // GmUser 조회 (phone 기반)
  const gmUser = await prisma.gmUser.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // eventId 멱등성 체크 (Transaction 내부 — TOCTOU 방지)
      if (eventId) {
        const alreadyProcessed = await tx.processedWebhookEvent.findUnique({
          where: { eventId },
          select: { eventId: true },
        });
        if (alreadyProcessed) {
          logger.log('[InquiryWebhook] 중복 이벤트 무시', { eventId });
          return { duplicate: true, contactId: '', created: false };
        }
      }

      const existing = await tx.contact.findUnique({
        where: { phone_organizationId: { phone: normalizedPhone, organizationId } },
        select: { id: true, type: true, leadScore: true },
      });

      let contactId: string;
      let created = false;

      if (existing) {
        await tx.contact.update({
          where: { id: existing.id },
          data: {
            name,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            type: existing.type === 'PURCHASED' ? 'PURCHASED' : 'LEAD',
            leadScore: (existing.leadScore ?? 0) + 15,
            ...(gmUser ? { userId: gmUser.id } : {}),
          },
        });
        contactId = existing.id;
      } else {
        const c = await tx.contact.create({
          data: { phone: normalizedPhone, name, organizationId, ...(email ? { email } : {}), ...(affiliateCode ? { affiliateCode } : {}), type: 'LEAD', leadScore: 15, userId: gmUser?.id ?? null },
          select: { id: true },
        });
        contactId = c.id;
        created = true;
      }

      // ContactMemo
      await tx.contactMemo.create({
        data: { contactId, userId: 'webhook-inquiry', content: `[문의] ${inquiryType ?? '상담신청'}: ${message ?? '내용 없음'}` },
      });

      // 상담 그룹 자동 배정
      const group = await tx.contactGroup.findFirst({
        where: { organizationId, name: { contains: '상담' } },
        select: { id: true },
      });
      if (group) {
        await tx.contactGroupMember.upsert({
          where: { groupId_contactId: { groupId: group.id, contactId } },
          create: { groupId: group.id, contactId },
          update: {},
        });
      }

      // processedWebhookEvent를 트랜잭션 안에서 기록
      if (eventId) {
        await tx.processedWebhookEvent.create({
          data: { eventId, webhookType: 'inquiry' },
        });
      }

      return { contactId, created };
    }, {
      isolationLevel: 'Serializable',
      timeout: 30000,
    });

    if (result.duplicate) {
      logger.log('[InquiryWebhook] 중복 처리됨');
      return NextResponse.json({ ok: true, duplicate: true });
    }

    logger.log('[InquiryWebhook] 완료', { contactId: result.contactId, created: result.created });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[InquiryWebhook] 처리 실패', { err });
    await enqueueDLQ('inquiry', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
