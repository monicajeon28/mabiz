import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/org/info — 조직 기본 정보 조회
export async function GET() {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        externalAffiliateProfileId: true,
        createdAt: true,
      },
    });

    if (!org) {
      return NextResponse.json({ ok: false, message: '조직을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, org });
  } catch (err) {
    logger.error('[GET /api/org/info]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/org/info — 조직명 수정 (OWNER만)
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '대리점장 또는 관리자만 수정할 수 있습니다.' }, { status: 403 });
    }

    const { name } = await req.json() as { name?: string };
    const trimmed = name?.trim();
    if (!trimmed) {
      return NextResponse.json({ ok: false, message: '조직명을 입력해주세요.' }, { status: 400 });
    }
    if (trimmed.length < 2 || trimmed.length > 50) {
      return NextResponse.json({ ok: false, message: '조직명은 2~50자여야 합니다.' }, { status: 400 });
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { name: trimmed },
      select: { id: true, name: true },
    });

    logger.log('[PATCH /api/org/info]', { orgId, name: trimmed });
    return NextResponse.json({ ok: true, org });
  } catch (err) {
    logger.error('[PATCH /api/org/info]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
