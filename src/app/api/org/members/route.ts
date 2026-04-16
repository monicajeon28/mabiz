import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/org/members
// 조직 전체 팀원 목록 (OWNER+GLOBAL_ADMIN만 조회 가능)
export async function GET() {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }],
      select: {
        userId: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });

    logger.log('[OrgMembers] 목록 조회', { orgId, count: members.length });
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    logger.error('[OrgMembers GET]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
