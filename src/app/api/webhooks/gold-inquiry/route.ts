export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueDLQ } from '@/lib/mabiz-dlq';
import { normalizePhone } from '@/lib/phone-normalize';
import { maskPhone } from '@/lib/pii-masker';

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
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (
    Buffer.byteLength(token, 'utf8') !== Buffer.byteLength(secret, 'utf8') ||
    !timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(secret, 'utf8'))
  ) {
    logger.error('[GoldInquiryWebhook] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: {
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
  try {
    body = await req.json() as typeof body;
  } catch {
    logger.error('[GoldInquiryWebhook] JSON 파싱 실패');
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const { phone, name, email, courseType, message, affiliateCode, organizationId: bodyOrgId, eventId, agentId, managerId } = body;

  // productCode 결정: 직접 전달 > courseType 매핑 > 기본값
  const productCode = body.productCode
    ?? (courseType ? `GOLD_MEMBERSHIP_${courseType}` : 'GOLD_MEMBERSHIP');

  if (!phone || !name) {
    return NextResponse.json({ ok: false, message: 'phone, name 필수' }, { status: 400 });
  }

  logger.log('[GoldInquiryWebhook] 수신', { phone: maskPhone(phone), courseType, productCode });

  // 1. Organization 결정 (findFirst 제거 — 비결정적 배정 방지)
  let organizationId = bodyOrgId;
  if (!organizationId) {
    organizationId = process.env.DEFAULT_ORGANIZATION_ID;
    if (!organizationId) {
      logger.error('[GoldInquiryWebhook] organizationId 미제공 + DEFAULT_ORGANIZATION_ID 미설정');
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
          where: {
            eventId_webhookType: {
              eventId,
              webhookType: 'gold-inquiry',
            },
          },
          select: { eventId: true },
        });
        if (alreadyProcessed) {
          logger.log('[GoldInquiryWebhook] 중복 이벤트 무시', { eventId });
          return { duplicate: true, contactId: '', created: false };
        }
      }

      let contactId: string;
      let created = false;

      const existing = await tx.contact.findUnique({
        where: { phone_organizationId: { phone: normalizedPhone, organizationId } },
        select: { id: true, type: true, leadScore: true, affiliateAgentId: true, affiliateManagerId: true },
      });

      if (existing) {
        await tx.contact.update({
          where: { id: existing.id },
          data: {
            name,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            type: existing.type === 'PURCHASED' ? 'PURCHASED' : 'LEAD',
            leadScore: (existing.leadScore ?? 0) + 50,
            ...(gmUser ? { userId: gmUser.id } : {}),
            // 기존값 없을 때만 설정 (첫 귀속 후 덮어쓰기 방지)
            ...(agentId != null && !existing.affiliateAgentId ? { affiliateAgentId: String(agentId) } : {}),
            ...(managerId != null && !existing.affiliateManagerId ? { affiliateManagerId: String(managerId) } : {}),
          },
        });
        contactId = existing.id;
      } else {
        const c = await tx.contact.create({
          data: {
            phone: normalizedPhone, name, organizationId,
            ...(email ? { email } : {}),
            ...(affiliateCode ? { affiliateCode } : {}),
            type: 'LEAD', leadScore: 50,
            userId: gmUser?.id ?? null,
            ...(agentId != null ? { affiliateAgentId: String(agentId) } : {}),
            ...(managerId != null ? { affiliateManagerId: String(managerId) } : {}),
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
          userId: 'webhook-gold-inquiry',
          content: `[골드문의] 코스: ${courseType ? `${courseType}코스` : '미입력'}, ${message ?? '내용 없음'}`,
        },
      });

      // 골드 그룹 자동 배정
      const group = await tx.contactGroup.findFirst({
        where: { organizationId, name: { contains: '골드' } },
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
          data: { eventId, webhookType: 'gold-inquiry' },
        });
      }

      return { contactId, created };
    }, {
      isolationLevel: 'Serializable',
      timeout: 30000,
    });

    if (result.duplicate) {
      logger.log('[GoldInquiryWebhook] 중복 처리됨');
      return NextResponse.json({ ok: true, duplicate: true });
    }

    logger.log('[GoldInquiryWebhook] 완료', { contactId: result.contactId, created: result.created });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[GoldInquiryWebhook] 처리 실패', { err });
    await enqueueDLQ('gold-inquiry', body, err instanceof Error ? err.message : String(err)).catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
