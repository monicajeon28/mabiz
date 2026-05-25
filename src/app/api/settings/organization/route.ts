import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/settings/organization — 조직 정보 조회 (name, slug, plan, externalAffiliateProfileId)
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
    logger.error('[GET /api/settings/organization]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/settings/organization — 조직명 수정 (OWNER만 가능, slug는 immutable, plan은 읽기전용)
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // OWNER 또는 GLOBAL_ADMIN만 수정 가능
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '대리점장 또는 관리자만 수정할 수 있습니다.' },
        { status: 403 }
      );
    }

    const body = await req.json() as { name?: string };
    const { name } = body;

    // name만 수정 가능 (slug 변경 불가, plan은 읽기전용)
    if (!name) {
      return NextResponse.json(
        { ok: false, message: '조직명을 입력해주세요.' },
        { status: 400 }
      );
    }

    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      return NextResponse.json(
        { ok: false, message: '조직명은 2~50자여야 합니다.' },
        { status: 400 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { name: trimmed },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        externalAffiliateProfileId: true,
        createdAt: true,
      },
    });

    logger.log('[PATCH /api/settings/organization]', { orgId, name: trimmed });
    return NextResponse.json({ ok: true, org: updated });
  } catch (err) {
    logger.error('[PATCH /api/settings/organization]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
