export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/groups/[id] - 그룹 정보 수정
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
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

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (funnelId !== undefined) updateData.funnelId = funnelId || null;

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
    const orgId = requireOrgId(ctx);
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

    // 트랜잭션으로 원자적 삭제
    await prisma.$transaction([
      prisma.contactGroupMember.deleteMany({ where: { groupId } }),
      prisma.groupToken.deleteMany({ where: { groupId } }),
      prisma.contactGroup.delete({ where: { id: groupId } }),
    ]);

    logger.log('[GroupDelete]', { groupId });

    return NextResponse.json({ ok: true, message: '그룹이 삭제되었습니다.' });
  } catch (err) {
    logger.error('[DELETE /api/groups/[id]]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
