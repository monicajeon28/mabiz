import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { forbidden, notFound, serverError, unauthorized } from '@/lib/response';

// GET /api/settings/organization — 조직 정보 조회 (name, slug, plan, externalAffiliateProfileId)
export async function GET() {
  try {
    const ctx = await getAuthContext();

    // 인증된 사용자의 조직 ID 결정:
    // GLOBAL_ADMIN: BONSA_ORG_ID (본사)
    // 나머지: 자신의 organizationId
    const orgId = resolveOrgId(ctx);

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
      logger.warn('[GET /api/settings/organization] Organization not found', { orgId });
      return notFound('조직을 찾을 수 없습니다.');
    }

    logger.info('[GET /api/settings/organization] Success', { orgId });
    return NextResponse.json({ ok: true, org });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return unauthorized('인증이 필요합니다.');
    }
    logger.error('[GET /api/settings/organization] Error', { err });
    return serverError();
  }
}

// PATCH /api/settings/organization — 조직명 수정 (OWNER 또는 GLOBAL_ADMIN만 가능)
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();

    // OWNER 또는 GLOBAL_ADMIN만 수정 가능
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      logger.warn('[PATCH /api/settings/organization] Insufficient permission', {
        userId: ctx.userId,
        role: ctx.role
      });
      return forbidden('대리점장 또는 관리자만 수정할 수 있습니다.');
    }

    const orgId = resolveOrgId(ctx);

    const body = await req.json() as Record<string, unknown>;
    const { name } = body;

    // name만 수정 가능 (slug 변경 불가, plan은 읽기전용)
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_INPUT',
          message: '조직명을 입력해주세요.'
        },
        { status: 400 }
      );
    }

    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 255) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_INPUT',
          message: '조직명은 1~255자여야 합니다.'
        },
        { status: 400 }
      );
    }

    // 조직 존재 여부 확인
    const existingOrg = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!existingOrg) {
      logger.warn('[PATCH /api/settings/organization] Organization not found', { orgId });
      return notFound('조직을 찾을 수 없습니다.');
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

    logger.info('[PATCH /api/settings/organization] Updated', {
      orgId,
      name: trimmed,
      userId: ctx.userId
    });
    return NextResponse.json({ ok: true, org: updated });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return unauthorized('인증이 필요합니다.');
    }
    logger.error('[PATCH /api/settings/organization] Error', { err });
    return serverError();
  }
}
