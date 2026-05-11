export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';

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

  // eventId 멱등성 체크 (중복 수신 방지)
  if (eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });
    if (alreadyProcessed) {
      logger.log('[InquiryWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  logger.log('[InquiryWebhook] 수신', { phone: phone.slice(0, 4) + '***', inquiryType });

  // 1. organizationId 결정
  let organizationId = bodyOrgId;
  if (!organizationId) {
    const defaultOrg = await prisma.organization.findFirst();
    if (!defaultOrg) {
      logger.error('[InquiryWebhook] 기본 Organization 없음');
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    organizationId = defaultOrg.id;
  }

  // 2. Contact upsert
  let contactId: string;
  let created = false;
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
          leadScore: (existing.leadScore ?? 0) + 15,
        },
      });
      contactId = existing.id;
    } else {
      const c = await prisma.contact.create({
        data: { phone, name, organizationId, ...(email ? { email } : {}), ...(affiliateCode ? { affiliateCode } : {}), type: 'LEAD', leadScore: 15 },
        select: { id: true },
      });
      contactId = c.id;
      created = true;
    }
  } catch (err) {
    logger.error('[InquiryWebhook] Contact upsert 실패', { err });
    await enqueueDLQ('inquiry', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 3. ContactMemo 생성
  try {
    await prisma.contactMemo.create({
      data: { contactId, userId: 'webhook-inquiry', content: `[문의] ${inquiryType ?? '상담신청'}: ${message ?? '내용 없음'}` },
    });
  } catch (err) {
    logger.error('[InquiryWebhook] ContactMemo 실패', { err });
  }

  // 4. 상담 그룹 자동 배정
  try {
    const group = await prisma.contactGroup.findFirst({
      where: { organizationId, name: { contains: '상담' } },
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
    logger.error('[InquiryWebhook] 그룹 배정 실패', { err });
  }

  logger.log('[InquiryWebhook] 완료', { contactId, created });

  // eventId 처리 완료 기록
  if (eventId) {
    await prisma.processedWebhookEvent.create({
      data: { eventId, webhookType: 'inquiry' },
    }).catch(() => {}); // 실패해도 웹훅 처리에 영향 없음
  }

  return NextResponse.json({ ok: true, contactId, created });
}
