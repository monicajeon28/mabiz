export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

    // GLOBAL_ADMIN은 organizationId가 없을 수 있음
    let orgId: string;
    try {
      orgId = requireOrgId(ctx);
    } catch (err) {
      if (ctx.role === 'GLOBAL_ADMIN') {
        // GLOBAL_ADMIN이 organizationId 없으면 빈 통계 반환
        return NextResponse.json({ ok: true, stats: [], unassigned: 0, total: 0 });
      }
      throw err;
    }

    // 단일 쿼리: LEFT JOIN으로 담당자별 고객 수 + 미배정 카운트 + 전체 카운트
    const [memberStats, unassignedCount, totalCountResult] = await Promise.all([
      prisma.$queryRaw<{ userId: string; displayName: string | null; role: string; count: bigint }[]>(
        Prisma.sql`
          SELECT
            om."userId",
            om."displayName",
            om.role,
            COALESCE(COUNT(c.id), 0)::bigint as count
          FROM "OrganizationMember" om
          LEFT JOIN "Contact" c ON c."assignedUserId" = om."userId"
            AND c."organizationId" = ${orgId}
            AND c."deletedAt" IS NULL
          WHERE om."organizationId" = ${orgId}
            AND om."isActive" = true
          GROUP BY om."userId", om."displayName", om.role
          ORDER BY count DESC
        `
      ),
      prisma.contact.count({
        where: { organizationId: orgId, deletedAt: null, assignedUserId: null },
      }),
      prisma.contact.count({
        where: { organizationId: orgId, deletedAt: null },
      }),
    ]);

    const stats = memberStats.map((row) => ({
      userId: row.userId,
      displayName: row.displayName ?? '알 수 없음',
      role: row.role,
      count: Number(row.count),
    }));

    const unassigned = unassignedCount;

    // 비활성 멤버에게 배정된 고객도 포함한 실제 전체 수 사용
    const total = totalCountResult;

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
