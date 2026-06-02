export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import {
  CreateFunnelSmsSchema,
  ListFunnelSmsQuerySchema,
} from '@/lib/schemas/funnel-sms';
import { validateSenderPhone } from '@/lib/funnel-sms-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼: sentCount 조회 (FUNNEL_SMS:* 채널 발송 완료 건수)
// ─────────────────────────────────────────────────────────────────────────────
async function getSentCount(organizationId: string, funnelSmsId?: string): Promise<number> {
  const channelFilter = funnelSmsId
    ? { startsWith: `FUNNEL_SMS:${funnelSmsId}:` }
    : { startsWith: 'FUNNEL_SMS:' };

  return prisma.scheduledSms.count({
    where: {
      organizationId,
      channel: channelFilter,
      status: 'SENT',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/funnel-sms?groupId=&q=&page=0&pageSize=100
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const queryValidation = ListFunnelSmsQuerySchema.safeParse({
      groupId: searchParams.get('groupId') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      page: searchParams.get('page') ?? 0,
      pageSize: searchParams.get('pageSize') ?? 100,
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_QUERY',
          errors: queryValidation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { groupId, q, page, pageSize } = queryValidation.data;

    // groupId 필터: 해당 그룹에 연결된 FunnelSms만 조회
    const where: Record<string, unknown> = { organizationId: orgId };

    if (groupId) {
      where.groups = { some: { id: groupId, organizationId: orgId } };
    }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { category: { contains: q } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.funnelSms.count({ where }),
      prisma.funnelSms.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          senderPhone: true,
          sendHour: true,
          sendMinute: true,
          arsNum: true,
          isActive: true,
          createdAt: true,
          _count: { select: { messages: true } },
          groups: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: page * pageSize,
        take: pageSize,
      }),
    ]);

    // sentCount: groupBy 단일 쿼리로 N+1 방지 (100건 개별 count → 쿼리 1개)
    const funnelSmsIds = items.map(item => item.id);
    const sentCountRows = funnelSmsIds.length > 0
      ? await prisma.scheduledSms.findMany({
          where: {
            organizationId: orgId,
            channel: { startsWith: 'FUNNEL_SMS:' },
            status: 'SENT',
          },
          select: { channel: true },
        })
      : [];

    const sentCountMap = new Map<string, number>();
    for (const row of sentCountRows) {
      // channel 형식: FUNNEL_SMS:{funnelSmsId}:{step}
      const parts = row.channel.split(':');
      const funnelSmsId = parts[1];
      if (funnelSmsId && funnelSmsIds.includes(funnelSmsId)) {
        sentCountMap.set(funnelSmsId, (sentCountMap.get(funnelSmsId) ?? 0) + 1);
      }
    }

    const data = items.map((item) => ({
      ...item,
      sentCount: sentCountMap.get(item.id) ?? 0,
    }));

    logger.info('[GET /api/funnel-sms]', { orgId, total, returned: data.length });

    return NextResponse.json({ ok: true, data, total, page, pageSize });
  } catch (err) {
    logger.error('[GET /api/funnel-sms]', { err });
    const message = err instanceof Error && err.message === 'UNAUTHORIZED'
      ? '인증이 필요합니다.'
      : '서버 오류가 발생했습니다.';
    const status = err instanceof Error && err.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR', message }, { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/funnel-sms — 새 퍼널문자 생성 (메시지 포함)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await req.json();
    const validation = CreateFunnelSmsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_INPUT',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { title, senderPhone, category, description, sendHour, sendMinute, arsNum, messages } =
      validation.data;

    // [P0 보안] 발신번호 검증 — 조직이 등록·검증한 번호만 허용(발신번호 변작 방지)
    if (senderPhone) {
      const phoneValidation = await validateSenderPhone(orgId, senderPhone);
      if (!phoneValidation.valid) {
        return NextResponse.json(
          {
            ok: false,
            error: 'INVALID_SENDER_PHONE',
            message: '등록·검증된 발신번호가 아닙니다. 조직 설정에서 발신번호를 등록·인증한 뒤 다시 시도하세요.',
          },
          { status: 400 }
        );
      }
    }

    const created = await prisma.funnelSms.create({
      data: {
        organizationId: orgId,
        title,
        senderPhone: senderPhone ?? null,
        category: category ?? null,
        description: description ?? null,
        sendHour,
        sendMinute,
        arsNum: arsNum ?? null,
        createdByUserId: ctx.userId,
        messages: {
          create: messages.map((m) => ({
            order: m.order,
            daysAfter: m.daysAfter,
            content: m.content,
            msgType: m.msgType,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        category: true,
        senderPhone: true,
        sendHour: true,
        sendMinute: true,
        arsNum: true,
        isActive: true,
        createdAt: true,
        _count: { select: { messages: true } },
        groups: { select: { id: true, name: true } },
      },
    });

    logger.info('[POST /api/funnel-sms] created', { orgId, id: created.id });

    return NextResponse.json(
      { ok: true, data: { ...created, sentCount: 0 } },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/funnel-sms]', { err });
    const message = err instanceof Error && err.message === 'UNAUTHORIZED'
      ? '인증이 필요합니다.'
      : '서버 오류가 발생했습니다.';
    const status = err instanceof Error && err.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR', message }, { status });
  }
}
