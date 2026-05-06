export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

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
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[PartnerSignupWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json() as {
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
  };

  const { mallUserId, name, phone, email, affiliateType, affiliateCode, organizationId: bodyOrgId } = body;

  if (!mallUserId || !name || !phone) {
    return NextResponse.json({ ok: false, message: 'mallUserId, name, phone 필수' }, { status: 400 });
  }

  logger.log('[PartnerSignupWebhook] 수신', { mallUserId, affiliateType, phone: phone.slice(0, 4) + '***' });

  // 1. Organization 결정
  let organizationId = bodyOrgId;
  if (!organizationId) {
    const defaultOrg = await prisma.organization.findFirst({ select: { id: true } });
    if (!defaultOrg) {
      logger.error('[PartnerSignupWebhook] 기본 Organization 없음');
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    organizationId = defaultOrg.id;
  }

  let contactId: string;
  let created = false;

  // 2. Contact upsert (phone + orgId) — leadScore +30
  try {
    const existing = await prisma.contact.findFirst({
      where: { phone, organizationId },
      select: { id: true, type: true, leadScore: true },
    });

    if (existing) {
      await prisma.contact.update({
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
      const c = await prisma.contact.create({
        data: {
          phone, name, organizationId,
          ...(email ? { email } : {}),
          ...(affiliateCode ? { affiliateCode } : {}),
          type: 'LEAD', leadScore: 30,
        },
        select: { id: true },
      });
      contactId = c.id;
      created = true;
    }
  } catch (err) {
    logger.error('[PartnerSignupWebhook] Contact upsert 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 3. ContactMemo
  try {
    await prisma.contactMemo.create({
      data: {
        contactId,
        userId: 'webhook-partner-signup',
        content: `[파트너가입] ${affiliateType ?? 'SALES_AGENT'}: ${name} (${mallUserId})`,
      },
    });
  } catch (err) {
    logger.error('[PartnerSignupWebhook] ContactMemo 실패', { err });
  }

  // 4. 그룹 자동 배정
  try {
    const groupKeyword = affiliateType === 'BRANCH_MANAGER' ? '대리점' : '판매원';
    const group = await prisma.contactGroup.findFirst({
      where: { organizationId, name: { contains: groupKeyword } },
      select: { id: true },
    });
    if (group) {
      await prisma.contactGroupMember.upsert({
        where: { groupId_contactId: { groupId: group.id, contactId } },
        create: { groupId: group.id, contactId },
        update: {},
      });
    }
  } catch (err) {
    logger.error('[PartnerSignupWebhook] 그룹 배정 실패', { err });
  }

  logger.log('[PartnerSignupWebhook] 완료', { contactId, created, mallUserId });
  return NextResponse.json({ ok: true, contactId, created });
}
