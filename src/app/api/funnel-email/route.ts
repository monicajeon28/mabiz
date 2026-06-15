export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import {
  CreateFunnelEmailSchema,
  ListFunnelEmailQuerySchema,
} from '@/lib/schemas/funnel-email';

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼: sentCount 조회 (groupId 기준, channel 없음)
// ScheduledEmailMessage에는 channel 컬럼이 없으므로 groupId + status='SENT' 카운트
// ─────────────────────────────────────────────────────────────────────────────
async function getSentCountByGroups(
  organizationId: string,
  groupIds: string[]
): Promise<number> {
  if (groupIds.length === 0) return 0;
  return prisma.scheduledEmailMessage.count({
    where: {
      organizationId,
      groupId: { in: groupIds },
      status: 'SENT',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/funnel-email?groupId=&q=&page=0&pageSize=100
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const queryValidation = ListFunnelEmailQuerySchema.safeParse({
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

    // groupId 필터: ContactGroup.funnelEmailId로 연결된 퍼널만 조회
    const where: Record<string, unknown> = { organizationId: orgId };

    if (groupId) {
      where.groups = { some: { id: groupId, organizationId: orgId } };
    }

    if (q) {
      where.title = { contains: q };
    }

    const [total, items] = await Promise.all([
      prisma.funnelEmail.count({ where }),
      prisma.funnelEmail.findMany({
        where,
        select: {
          id: true,
          title: true,
          senderName: true,
          senderEmail: true,
          sendHour: true,
          sendMinute: true,
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

    // sentCount: N+1 방지 — 퍼널별 그룹 ID 수집 후 단일 배치 쿼리
    const allGroupIds = items.flatMap((item) => item.groups.map((g) => g.id));
    const sentCountRows =
      allGroupIds.length > 0
        ? await prisma.scheduledEmailMessage.findMany({
            where: {
              organizationId: orgId,
              groupId: { in: allGroupIds },
              status: 'SENT',
            },
            select: { groupId: true },
          })
        : [];

    // groupId → funnelEmailId 역매핑
    const groupToFunnelMap = new Map<string, string>();
    for (const item of items) {
      for (const g of item.groups) {
        groupToFunnelMap.set(g.id, item.id);
      }
    }

    const sentCountMap = new Map<string, number>();
    for (const row of sentCountRows) {
      if (!row.groupId) continue;
      const funnelEmailId = groupToFunnelMap.get(row.groupId);
      if (funnelEmailId) {
        sentCountMap.set(funnelEmailId, (sentCountMap.get(funnelEmailId) ?? 0) + 1);
      }
    }

    const data = items.map((item) => ({
      ...item,
      sentCount: sentCountMap.get(item.id) ?? 0,
    }));

    logger.info('[GET /api/funnel-email]', { orgId, total, returned: data.length });

    return NextResponse.json({ ok: true, data, total, page, pageSize });
  } catch (err) {
    logger.error('[GET /api/funnel-email]', { err });
    const message =
      err instanceof Error && err.message === 'UNAUTHORIZED'
        ? '인증이 필요합니다.'
        : '서버 오류가 발생했습니다.';
    const status =
      err instanceof Error && err.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR', message }, { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/funnel-email — 새 자동이메일 퍼널 생성 (메시지 포함)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await req.json();
    const validation = CreateFunnelEmailSchema.safeParse(body);

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

    const {
      title,
      senderName,
      senderEmail,
      description,
      sendHour,
      sendMinute,
      messages,
    } = validation.data;

    // 이메일 발신자 주소는 별도 검증 없이 그대로 저장
    // (SMS 발신번호와 달리 이메일 주소는 SMTP 설정에서 검증됨)

    const created = await prisma.funnelEmail.create({
      data: {
        organizationId: orgId,
        title,
        senderName: senderName ?? null,
        senderEmail: senderEmail ?? null,
        description: description ?? null,
        sendHour,
        sendMinute,
        createdByUserId: ctx.userId,
        messages: {
          create: messages.map((m) => ({
            order: m.order,
            daysAfter: m.daysAfter,
            subject: m.subject,
            bodyHtml: m.bodyHtml,
            previewText: m.previewText ?? null,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        senderName: true,
        senderEmail: true,
        sendHour: true,
        sendMinute: true,
        isActive: true,
        createdAt: true,
        _count: { select: { messages: true } },
        groups: { select: { id: true, name: true } },
      },
    });

    logger.info('[POST /api/funnel-email] created', { orgId, id: created.id });

    return NextResponse.json(
      { ok: true, data: { ...created, sentCount: 0 } },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/funnel-email]', { err });
    const message =
      err instanceof Error && err.message === 'UNAUTHORIZED'
        ? '인증이 필요합니다.'
        : '서버 오류가 발생했습니다.';
    const status =
      err instanceof Error && err.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR', message }, { status });
  }
}

// 사용되지 않는 헬퍼 — 향후 단건 sentCount 조회용으로 보존
void getSentCountByGroups;
