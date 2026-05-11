export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';

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
    courseType?: 'A' | 'B' | 'C';   // A코스 / B코스 / C코스
    productCode?: string;             // 직접 전달 시 우선 사용
    message?: string;
    affiliateCode?: string;
    organizationId?: string;
    agentId?: number;
    managerId?: number;
    submittedAt?: string;
    eventId?: string;
  };

  const { phone, name, email, courseType, message, affiliateCode, organizationId: bodyOrgId, eventId } = body;

  // productCode 결정: 직접 전달 > courseType 매핑 > 기본값
  const productCode = body.productCode
    ?? (courseType ? `GOLD_MEMBERSHIP_${courseType}` : 'GOLD_MEMBERSHIP');

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  // eventId 멱등성 체크 (중복 수신 방지)
  if (eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[GoldInquiryWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  logger.log('[GoldInquiryWebhook] 수신', { phone: phone.slice(0, 4) + '***', courseType, productCode });

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
    await enqueueDLQ('gold-inquiry', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 3. ContactMemo
  try {
    await prisma.contactMemo.create({
      data: {
        contactId,
        userId: 'webhook-gold-inquiry',
        content: `[골드문의] 코스: ${courseType ? `${courseType}코스` : '미입력'}, ${message ?? '내용 없음'}`,
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

  // eventId 처리 완료 기록
  if (eventId) {
    await prisma.processedWebhookEvent.create({
      data: { eventId, webhookType: 'gold-inquiry' },
    }).catch(() => {}); // 실패해도 웹훅 처리에 영향 없음
  }

  return NextResponse.json({ ok: true, contactId, created });
}
