export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId, type AuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { UpdateFunnelEmailSchema } from '@/lib/schemas/funnel-email';

type Params = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// 퍼널이메일 단건 소유권 격리 (route.ts funnelEmailOwnershipWhere와 동일 규칙)
//  - GLOBAL_ADMIN / OWNER : organizationId 범위 전체
//  - AGENT/FREE_SALES : 본인 작성 + 공유 + 공개 + 공용템플릿 + createdByUserId IS NULL
// findFirst where에 spread하여 사용.
// ─────────────────────────────────────────────────────────────────────────────
function funnelEmailOwnershipWhere(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role !== 'AGENT' && ctx.role !== 'FREE_SALES') return {};
  return {
    OR: [
      { createdByUserId: ctx.userId },
      { createdByUserId: null },
      { sharedWith: { has: ctx.userId } },
      { visibility: { in: ['TEAM', 'PUBLIC'] } }, // 팀/전체 공개 (funnel-sms와 가시성 일치)
      { isTemplate: true },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 편집/삭제용 격리 (조회보다 엄격) — AGENT는 "본인이 만든" 퍼널만 수정 가능.
// 공유/공개/공용(null·template) 퍼널은 볼 수는 있어도 임의 변경 금지.
//  - GLOBAL_ADMIN / OWNER : organizationId 범위 전체
//  - AGENT/FREE_SALES : createdByUserId === userId 만
// ─────────────────────────────────────────────────────────────────────────────
function funnelEmailMutateWhere(ctx: AuthContext): Record<string, unknown> {
  if (ctx.role !== 'AGENT' && ctx.role !== 'FREE_SALES') return {};
  return { createdByUserId: ctx.userId };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/funnel-email/[id] — 단건 조회 (messages[] 포함)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const item = await prisma.funnelEmail.findFirst({
      // per-user 격리: AGENT는 본인/공유/공개/공용만 조회
      where: { id, organizationId: orgId, ...funnelEmailOwnershipWhere(ctx) },
      select: {
        id: true,
        title: true,
        senderName: true,
        senderEmail: true,
        description: true,
        sendHour: true,
        sendMinute: true,
        isActive: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          select: {
            id: true,
            order: true,
            daysAfter: true,
            subject: true,
            bodyHtml: true,
            previewText: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { order: 'asc' },
        },
        groups: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '자동이메일 퍼널을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // sentCount: 연결된 그룹 기준으로 발송 완료 건수 조회
    const groupIds = item.groups.map((g) => g.id);
    const sentCount =
      groupIds.length > 0
        ? await prisma.scheduledEmailMessage.count({
            where: {
              organizationId: orgId,
              groupId: { in: groupIds },
              status: 'SENT',
            },
          })
        : 0;

    return NextResponse.json({ ok: true, data: { ...item, sentCount } });
  } catch (err) {
    logger.error('[GET /api/funnel-email/[id]]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/funnel-email/[id] — 기본정보 수정 (messages 제외)
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // IDOR 방어 + per-user 격리: AGENT는 본인이 만든 퍼널만 수정 가능
    const existing = await prisma.funnelEmail.findFirst({
      where: { id, organizationId: orgId, ...funnelEmailMutateWhere(ctx) },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '자동이메일 퍼널을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validation = UpdateFunnelEmailSchema.safeParse(body);

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

    const updateData = validation.data;

    // nullish 값 처리: undefined는 건너뜀, null/값은 저장
    const updated = await prisma.funnelEmail.update({
      where: { id },
      data: {
        ...(updateData.title !== undefined && { title: updateData.title }),
        ...(updateData.senderName !== undefined && { senderName: updateData.senderName }),
        ...(updateData.senderEmail !== undefined && { senderEmail: updateData.senderEmail }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.sendHour !== undefined && { sendHour: updateData.sendHour }),
        ...(updateData.sendMinute !== undefined && { sendMinute: updateData.sendMinute }),
        ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
      },
      select: {
        id: true,
        title: true,
        senderName: true,
        senderEmail: true,
        description: true,
        sendHour: true,
        sendMinute: true,
        isActive: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        groups: { select: { id: true, name: true } },
      },
    });

    logger.info('[PATCH /api/funnel-email/[id]]', { orgId, id });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    logger.error('[PATCH /api/funnel-email/[id]]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/funnel-email/[id] — cascade 삭제 (FunnelEmailMessage 포함)
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // IDOR 방어 + per-user 격리 (AGENT/FREE_SALES는 본인 것만)
    const existing = await prisma.funnelEmail.findFirst({
      where: { id, organizationId: orgId, ...funnelEmailMutateWhere(ctx) },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '자동이메일 퍼널을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // AGENT 역할은 삭제 불가
    if (ctx.role === 'AGENT') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // cascade: onDelete: Cascade 설정으로 FunnelEmailMessage도 자동 삭제
    // ContactGroup.funnelEmailId: onDelete: SetNull — 그룹 연결은 null로 처리
    await prisma.funnelEmail.deleteMany({ where: { id, organizationId: orgId } });

    logger.info('[DELETE /api/funnel-email/[id]]', { orgId, id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/funnel-email/[id]]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
