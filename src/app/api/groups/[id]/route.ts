export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

// 조직 ID 해석 (GLOBAL_ADMIN 지원 — 목록 API와 동일 정책)
// GLOBAL_ADMIN은 organizationId가 null이므로 첫 조직을 사용한다.
async function resolveOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): Promise<string | null> {
  if (ctx.organizationId) return ctx.organizationId;
  if (ctx.role === 'GLOBAL_ADMIN') {
    const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
    return firstOrg?.id ?? null;
  }
  return null;
}

// GET /api/groups/[id] - 그룹 상세 정보 조회 (L10 렌즈: 즉시구매 클로징)
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = await resolveOrgId(ctx);
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '조직 정보가 없습니다.' },
        { status: 403 }
      );
    }
    const { id: groupId } = await params;

    // IDOR 보안: organizationId 체크
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        color: true,
        parentGroupId: true,
        funnelId: true,
        funnelEmailId: true,
        funnelIds: true,
        funnelSmsIds: true,
        funnelEmailIds: true,
        reEntryPolicy: true,
        autoMoveEnabled: true,
        autoMoveDays: true,
        autoMoveTargetGroupId: true,
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 퍼널 정보 추가 조회
    const funnelInfo = group.funnelId
      ? await prisma.funnel.findUnique({
          where: { id: group.funnelId },
          select: { id: true, name: true },
        })
      : null;

    return NextResponse.json({
      ok: true,
      group: {
        ...group,
        funnelName: funnelInfo?.name ?? null,
      },
    });
  } catch (err) {
    logger.error('[GET /api/groups/[id]]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

// PATCH /api/groups/[id] - 그룹 정보 수정
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = await resolveOrgId(ctx);
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '조직 정보가 없습니다.' },
        { status: 403 }
      );
    }
    const { id: groupId } = await params;
    const body = await req.json();
    const { name, description, funnelId } = body;

    // IDOR 보안: organizationId 체크
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, ownerId: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // AGENT는 자신이 소유한 그룹만 수정 가능
    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '자신이 소유한 그룹만 수정 가능합니다.' },
        { status: 403 }
      );
    }

    // SEC-004: 화이트리스트 검증
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name === 'string' && name.trim().length > 0) {
        updateData.name = name.trim();
      } else if (name !== null) {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '그룹명은 공백이 아닌 문자열이어야 합니다.' },
          { status: 400 }
        );
      }
    }

    if (description !== undefined) {
      if (description === null || (typeof description === 'string' && description.length <= 500)) {
        updateData.description = description;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '설명은 500자 이하여야 합니다.' },
          { status: 400 }
        );
      }
    }

    if (funnelId !== undefined) {
      if (funnelId === null) {
        updateData.funnelId = null;
      } else if (typeof funnelId === 'string') {
        // TYPE-001: 펀널 소유권 검증 추가
        const funnel = await prisma.funnel.findFirst({
          where: { id: funnelId, organizationId: orgId },
          select: { id: true },
        });
        if (!funnel) {
          return NextResponse.json(
            { ok: false, error: 'INVALID_FUNNEL', message: '펀널을 찾을 수 없거나 접근 권한이 없습니다.' },
            { status: 400 }
          );
        }
        updateData.funnelId = funnelId;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '펀넬ID는 문자열 또는 null이어야 합니다.' },
          { status: 400 }
        );
      }
    }

    if (body.category !== undefined) updateData.category = body.category;

    // parentGroupId 순환참조 방지 (POST hasCircularAncestor와 동일 패턴)
    if (body.parentGroupId !== undefined) {
      if (body.parentGroupId !== null) {
        if (body.parentGroupId === groupId) {
          return NextResponse.json(
            { ok: false, error: 'CIRCULAR_PARENT', message: '자기 자신을 부모 그룹으로 설정할 수 없습니다.' },
            { status: 400 }
          );
        }
        // groupId가 body.parentGroupId의 조상 체인에 있으면 → 순환
        async function isAncestor(startId: string, targetId: string): Promise<boolean> {
          let cur: string | null = startId;
          const visited = new Set<string>();
          while (cur) {
            if (cur === targetId) return true;
            if (visited.has(cur)) break;
            visited.add(cur);
            const node: { parentGroupId: string | null } | null =
              await prisma.contactGroup.findUnique({
                where: { id: cur },
                select: { parentGroupId: true },
              });
            cur = node?.parentGroupId ?? null;
          }
          return false;
        }
        if (await isAncestor(body.parentGroupId, groupId)) {
          return NextResponse.json(
            { ok: false, error: 'CIRCULAR_PARENT', message: '순환 참조가 발생하는 부모 그룹은 지정할 수 없습니다.' },
            { status: 400 }
          );
        }
      }
      updateData.parentGroupId = body.parentGroupId;
    }

    if (body.funnelIds !== undefined) updateData.funnelIds = body.funnelIds;

    // funnelSmsIds IDOR 검증
    if (body.funnelSmsIds !== undefined) {
      if (Array.isArray(body.funnelSmsIds) && body.funnelSmsIds.length > 0) {
        const validCount = await prisma.funnelSms.count({
          where: { id: { in: body.funnelSmsIds }, organizationId: orgId },
        });
        if (validCount !== body.funnelSmsIds.length) {
          return NextResponse.json(
            { ok: false, error: 'INVALID_FUNNEL_SMS', message: '유효하지 않은 퍼널 문자 ID가 포함되어 있습니다.' },
            { status: 400 }
          );
        }
      }
      updateData.funnelSmsIds = body.funnelSmsIds;
    }

    // funnelEmailId (단수) IDOR 검증 — FunnelEmail Day 0-3 시퀀스
    if (body.funnelEmailId !== undefined) {
      if (body.funnelEmailId === null) {
        updateData.funnelEmailId = null;
      } else if (typeof body.funnelEmailId === 'string') {
        const fe = await prisma.funnelEmail.findFirst({
          where: { id: body.funnelEmailId, organizationId: orgId },
          select: { id: true },
        });
        if (!fe) {
          return NextResponse.json(
            { ok: false, error: 'INVALID_FUNNEL_EMAIL', message: '유효하지 않은 퍼널 이메일 ID입니다.' },
            { status: 400 }
          );
        }
        updateData.funnelEmailId = body.funnelEmailId;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '퍼널 이메일 ID는 문자열 또는 null이어야 합니다.' },
          { status: 400 }
        );
      }
    }

    // funnelEmailIds IDOR 검증
    if (body.funnelEmailIds !== undefined) {
      if (Array.isArray(body.funnelEmailIds) && body.funnelEmailIds.length > 0) {
        const validCount = await prisma.groupEmailFunnel.count({
          where: { id: { in: body.funnelEmailIds }, organizationId: orgId },
        });
        if (validCount !== body.funnelEmailIds.length) {
          return NextResponse.json(
            { ok: false, error: 'INVALID_FUNNEL_EMAIL', message: '유효하지 않은 퍼널 이메일 ID가 포함되어 있습니다.' },
            { status: 400 }
          );
        }
      }
      updateData.funnelEmailIds = body.funnelEmailIds;
    }
    if (body.reEntryPolicy !== undefined) updateData.reEntryPolicy = body.reEntryPolicy;
    if (body.autoMoveEnabled !== undefined) updateData.autoMoveEnabled = body.autoMoveEnabled;
    if (body.autoMoveDays !== undefined) updateData.autoMoveDays = body.autoMoveDays;
    if (body.autoMoveTargetGroupId !== undefined) updateData.autoMoveTargetGroupId = body.autoMoveTargetGroupId;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'NO_UPDATE', message: '변경할 필드가 없습니다.' },
        { status: 400 }
      );
    }

    const updated = await prisma.contactGroup.update({
      where: { id: groupId },
      data: updateData,
      select: { id: true, name: true, description: true, funnelId: true, updatedAt: true },
    });

    logger.log('[GroupUpdate]', { groupId, updated: Object.keys(updateData) });

    return NextResponse.json({ ok: true, group: updated });
  } catch (err) {
    logger.error('[PATCH /api/groups/[id]]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

// DELETE /api/groups/[id] - 그룹 삭제
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = await resolveOrgId(ctx);
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '조직 정보가 없습니다.' },
        { status: 403 }
      );
    }
    const { id: groupId } = await params;

    // IDOR 보안: organizationId 체크
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, ownerId: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // AGENT는 자신이 소유한 그룹만 삭제 가능
    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '자신이 소유한 그룹만 삭제 가능합니다.' },
        { status: 403 }
      );
    }

    // P1-3: 자식 그룹 존재 여부 확인 (부모 그룹 삭제 시 자식 고아화 방지)
    const childGroups = await prisma.contactGroup.findMany({
      where: { parentGroupId: groupId },
      select: { id: true },
    });

    if (childGroups.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'HAS_CHILDREN', message: 'Cannot delete group with children. Please delete children first.' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 원자적 삭제
    await prisma.$transaction([
      prisma.contactGroupMember.deleteMany({ where: { groupId } }),
      prisma.groupToken.deleteMany({ where: { groupId } }),
      prisma.contactGroup.deleteMany({ where: { id: groupId, organizationId: orgId } }),
    ]);

    logger.log('[GroupDelete]', { groupId });

    return NextResponse.json({ ok: true, message: '그룹이 삭제되었습니다.' });
  } catch (err) {
    logger.error('[DELETE /api/groups/[id]]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
