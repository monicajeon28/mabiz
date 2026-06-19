export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';
import { maskPhone } from '@/lib/pii-masker';

/**
 * POST /api/webhooks/partner-signup
 * GMcruise(크루즈닷몰) 파트너(판매원) 가입 완료 후 호출
 * Authorization: Bearer MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[PartnerSignupWebhook] MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (
    Buffer.byteLength(token, 'utf8') !== Buffer.byteLength(secret, 'utf8') ||
    !timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(secret, 'utf8'))
  ) {
    logger.error('[PartnerSignupWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: {
    mallUserId: string;
    name: string;
    phone: string;
    email?: string;
    affiliateType?: string;
    affiliateCode?: string;
    affiliateProfileId?: number;
    managerId?: number;
    organizationId?: string;
    joinedAt?: string;
    eventId?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    logger.error('[PartnerSignupWebhook] JSON 파싱 실패');
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const { mallUserId, name, phone, email, affiliateType, affiliateCode, organizationId: bodyOrgId, eventId } = body;

  if (!mallUserId || !name || !phone) {
    return NextResponse.json({ ok: false, message: 'mallUserId, name, phone 필수' }, { status: 400 });
  }

  if (eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId_webhookType: {
          eventId,
          webhookType: 'partner-signup',
        },
      },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[PartnerSignupWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  logger.log('[PartnerSignupWebhook] 수신', { mallUserId, affiliateType, phone: maskPhone(phone) });

  // 1. Organization 결정 (findFirst 제거 — 비결정적 배정 방지)
  let organizationId = bodyOrgId;
  if (!organizationId) {
    organizationId = process.env.DEFAULT_ORGANIZATION_ID;
    if (!organizationId) {
      logger.error('[PartnerSignupWebhook] organizationId 미제공 + DEFAULT_ORGANIZATION_ID 미설정');
      return NextResponse.json({ ok: false, message: 'organizationId 필수' }, { status: 400 });
    }
  }

  // 2~4. Contact upsert + Memo + 그룹 배정을 트랜잭션으로 통합
  const normalizedPhone = normalizePhone(phone);
  try {
    const result = await prisma.$transaction(async (tx) => {
      let contactId: string;
      let created = false;

      const existing = await tx.contact.findUnique({
        where: { phone_organizationId: { phone: normalizedPhone, organizationId } },
        select: { id: true, type: true, leadScore: true },
      });

      if (existing) {
        await tx.contact.update({
          where: { id: existing.id },
          data: {
            name,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            type: existing.type === 'PURCHASED' ? 'PURCHASED' : 'LEAD',
            leadScore: (existing.leadScore ?? 0) + 30,
          },
        });
        contactId = existing.id;
      } else {
        const c = await tx.contact.create({
          data: {
            phone: normalizedPhone, name, organizationId,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            type: 'LEAD', leadScore: 30,
          },
          select: { id: true },
        });
        contactId = c.id;
        created = true;
      }

      // ContactMemo
      await tx.contactMemo.create({
        data: {
          contactId,
          userId: 'webhook-partner-signup',
          content: `[파트너가입] ${affiliateType ?? 'SALES_AGENT'}: ${name} (${mallUserId})`,
        },
      });

      // 그룹 자동 배정
      const groupKeyword = affiliateType === 'BRANCH_MANAGER' ? '대리점' : '판매원';
      const group = await tx.contactGroup.findFirst({
        where: { organizationId, name: { contains: groupKeyword } },
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
          data: { eventId, webhookType: 'partner-signup' },
        });
      }

      return { contactId, created };
    });

    logger.log('[PartnerSignupWebhook] 완료', { contactId: result.contactId, created: result.created, mallUserId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PartnerSignupWebhook] 처리 실패', { err });
    await enqueueDLQ('partner-signup', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
