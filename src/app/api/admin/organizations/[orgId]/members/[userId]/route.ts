import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ orgId: string; userId: string }> };

// PATCH /api/admin/organizations/[orgId]/members/[userId] — 활성화/정지
export async function PATCH(req: Request, { params }: Params) {
  let ctx: Awaited<ReturnType<typeof getAuthContext>> | null = null;
  try {
    ctx = await getAuthContext();
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }
    logger.error('[Admin PATCH member] auth error', { e });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { orgId, userId } = await params;
    if (!orgId?.trim() || !userId?.trim()) {
      return NextResponse.json({ ok: false, message: '필수 파라미터가 없습니다.' }, { status: 400 });
    }

    let body: { isActive?: boolean };
    try {
      body = await req.json() as { isActive?: boolean };
    } catch {
      return NextResponse.json({ ok: false, message: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
    }
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ ok: false, message: 'isActive(boolean) 필수입니다.' }, { status: 400 });
    }
    const { isActive } = body;

    const member = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
      select: { role: true, isActive: true },
    });
    if (!member) {
      return NextResponse.json({ ok: false, message: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 마지막 활성 OWNER 비활성화 방어
    if (member.role === 'OWNER' && !isActive) {
      const activeOwnerCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: 'OWNER', isActive: true },
      });
      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          { ok: false, message: '조직의 마지막 대리점장은 정지할 수 없습니다.' },
          { status: 400 },
        );
      }
    }

    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { isActive },
    });

    logger.info('[Admin PATCH member]', {
      adminId: ctx.userId,
      orgId,
      targetUserId: userId.substring(0, 8),
      isActive,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[Admin PATCH member]', { e });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/admin/organizations/[orgId]/members/[userId] — 계정 삭제
export async function DELETE(_req: Request, { params }: Params) {
  let ctx: Awaited<ReturnType<typeof getAuthContext>> | null = null;
  try {
    ctx = await getAuthContext();
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }
    logger.error('[Admin DELETE member] auth error', { e });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { orgId, userId } = await params;
    if (!orgId?.trim() || !userId?.trim()) {
      return NextResponse.json({ ok: false, message: '필수 파라미터가 없습니다.' }, { status: 400 });
    }

    const member = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
      select: { role: true, isActive: true },
    });
    if (!member) {
      return NextResponse.json({ ok: false, message: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 활성 OWNER 삭제 방어: 활성 OWNER가 1명 이하이면 삭제 불가
    if (member.role === 'OWNER' && member.isActive) {
      const activeOwnerCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: 'OWNER', isActive: true },
      });
      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          { ok: false, message: '조직의 마지막 대리점장은 삭제할 수 없습니다.' },
          { status: 400 },
        );
      }
    }

    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    logger.info('[Admin DELETE member]', {
      adminId: ctx.userId,
      orgId,
      targetUserId: userId.substring(0, 8),
      role: member.role,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[Admin DELETE member]', { e });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
