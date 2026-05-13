export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/contacts/assign-stats
 * 담당자별 고객 수 통계 (OWNER/GLOBAL_ADMIN 전용)
 *
 * Response: { ok, stats: [{ userId, displayName, role, count }], unassigned }
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '권한 없음' }, { status: 403 });
    }
    const orgId = requireOrgId(ctx);

    // 병렬: 담당자별 groupBy + 조직 멤버 목록 + 미배정 수
    const [grouped, members, unassigned] = await Promise.all([
      prisma.contact.groupBy({
        by: ['assignedUserId'],
        where: { organizationId: orgId, deletedAt: null, assignedUserId: { not: null } },
        _count: { id: true },
      }),
      prisma.organizationMember.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { userId: true, displayName: true, role: true },
      }),
      prisma.contact.count({
        where: { organizationId: orgId, deletedAt: null, assignedUserId: null },
      }),
    ]);

    // 멤버 맵
    const memberMap = new Map(members.map((m) => [m.userId, m]));

    const stats = grouped
      .filter((g) => g.assignedUserId)
      .map((g) => {
        const member = memberMap.get(g.assignedUserId!);
        return {
          userId: g.assignedUserId!,
          displayName: member?.displayName ?? '알 수 없음',
          role: member?.role ?? 'AGENT',
          count: g._count.id,
        };
      })
      .sort((a, b) => b.count - a.count);

    // 할당 안 된 멤버도 count=0으로 추가
    for (const m of members) {
      if (!stats.find((s) => s.userId === m.userId)) {
        stats.push({ userId: m.userId, displayName: m.displayName ?? m.userId, role: m.role, count: 0 });
      }
    }

    const total = stats.reduce((a, b) => a + b.count, 0) + unassigned;

    logger.log('[GET /api/contacts/assign-stats]', { orgId, total, unassigned });

    return NextResponse.json({ ok: true, stats, unassigned, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    if (msg === 'ORGANIZATION_REQUIRED') return NextResponse.json({ ok: false, message: '조직 정보 필수' }, { status: 400 });
    logger.error('[GET /api/contacts/assign-stats]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
