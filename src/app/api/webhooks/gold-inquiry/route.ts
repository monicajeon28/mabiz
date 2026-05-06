export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/webhooks/gold-inquiry
 * GMcruise(크루즈닷몰) 골드 회원 문의 수신
 * Authorization: Bearer MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[GoldInquiryWebhook] MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.error('[GoldInquiryWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json() as {
    phone: string;
    name: string;
    email?: string;
    tier?: number;
    message?: string;
    affiliateCode?: string;
    organizationId?: string;
    agentId?: number;
    managerId?: number;
    submittedAt?: string;
  };

  const { phone, name, email, tier, message, affiliateCode, organizationId: bodyOrgId } = body;

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  logger.log('[GoldInquiryWebhook] 수신', { phone: phone.slice(0, 4) + '***', tier });

  // 1. Organization 결정
  let organizationId = bodyOrgId;
  if (!organizationId) {
    const defaultOrg = await prisma.organization.findFirst({ select: { id: true } });
    if (!defaultOrg) {
      logger.error('[GoldInquiryWebhook] 기본 Organization 없음');
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    organizationId = defaultOrg.id;
  }

  let contactId: string;
  let created = false;

  // 2. Contact upsert — leadScore +50
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
          leadScore: (existing.leadScore ?? 0) + 50,
        },
      });
      contactId = existing.id;
    } else {
      const c = await prisma.contact.create({
        data: {
          phone, name, organizationId,
          ...(email ? { email } : {}),
          ...(affiliateCode ? { affiliateCode } : {}),
          type: 'LEAD', leadScore: 50,
        },
        select: { id: true },
      });
      contactId = c.id;
      created = true;
    }
  } catch (err) {
    logger.error('[GoldInquiryWebhook] Contact upsert 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 3. ContactMemo
  try {
    await prisma.contactMemo.create({
      data: {
        contactId,
        userId: 'webhook-gold-inquiry',
        content: `[골드문의] 희망등급: ${tier ? tier.toLocaleString() : '미입력'}원, ${message ?? '내용 없음'}`,
      },
    });
  } catch (err) {
    logger.error('[GoldInquiryWebhook] ContactMemo 실패', { err });
  }

  // 4. 골드 그룹 자동 배정
  try {
    const group = await prisma.contactGroup.findFirst({
      where: { organizationId, name: { contains: '골드' } },
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
    logger.error('[GoldInquiryWebhook] 그룹 배정 실패', { err });
  }

  logger.log('[GoldInquiryWebhook] 완료', { contactId, created });
  return NextResponse.json({ ok: true, contactId, created });
}
