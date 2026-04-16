import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ userId: string }> };

// PATCH /api/org/members/[userId] — 비활성화/재활성화
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { userId } = await params;

    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // 본인 비활성화 방어
    if (ctx.userId === userId) {
      return NextResponse.json(
        { ok: false, message: '본인 계정은 변경할 수 없습니다' },
        { status: 400 }
      );
    }

    const { isActive } = await req.json() as { isActive: boolean };

    // 소유권 검증 — IDOR 방지
    const member = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
      select: { role: true, isActive: true },
    });
    if (!member) {
      return NextResponse.json({ ok: false, message: '팀원을 찾을 수 없습니다' }, { status: 404 });
    }

    // 마지막 OWNER 비활성화 방어
    if (member.role === 'OWNER' && !isActive) {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: 'OWNER', isActive: true },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { ok: false, message: '조직의 마지막 대리점장은 비활성화할 수 없습니다' },
          { status: 400 }
        );
      }
    }

    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { isActive },
    });

    logger.log('[OrgMember PATCH]', { orgId, userId: userId.substring(0, 8), isActive });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[OrgMember PATCH]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/org/members/[userId] — 완전 삭제
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { userId } = await params;

    // 삭제는 OWNER만 (GLOBAL_ADMIN도 타 조직 삭제 방지)
    if (ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // 본인 삭제 방어
    if (ctx.userId === userId) {
      return NextResponse.json(
        { ok: false, message: '본인 계정은 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    // 소유권 검증 (IDOR 방지) — organizationId 조건 필수
    const member = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
      select: { role: true },
    });
    if (!member) {
      return NextResponse.json({ ok: false, message: '팀원을 찾을 수 없습니다' }, { status: 404 });
    }

    // 마지막 OWNER 삭제 방어
    if (member.role === 'OWNER') {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: 'OWNER', isActive: true },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { ok: false, message: '조직의 마지막 대리점장은 삭제할 수 없습니다' },
          { status: 400 }
        );
      }
    }

    // organizationId 조건 포함 삭제 (IDOR 방지)
    await prisma.organizationMember.deleteMany({
      where: { userId, organizationId: orgId },
    });

    logger.log('[OrgMember DELETE]', { orgId, userId: userId.substring(0, 8) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[OrgMember DELETE]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
