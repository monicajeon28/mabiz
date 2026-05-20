export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

/**
 * GET /api/admin/groups-stats
 * GLOBAL_ADMIN 전용 — 전체 그룹 현황 집계 (마케팅 참고용)
 *
 * Query: orgId? (특정 조직 필터), limit? (기본 50)
 *
 * 응답: 그룹명 | 생성자 | 조직 | 고객수 | 생성일
 */
export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'],
    errorMessage: '관리자만 접근 가능합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '관리자만 접근 가능합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orgIdFilter = searchParams.get('orgId') ?? null;
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50') || 50));

    // 그룹 목록 + 멤버 수 + 조직명 조회
    const groups = await prisma.contactGroup.findMany({
      where: orgIdFilter ? { organizationId: orgIdFilter } : {},
      include: {
        _count:       { select: { members: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (groups.length === 0) {
      return NextResponse.json({ ok: true, groups: [], total: 0 });
    }

    // ownerId 이름 batch 조회 (GlobalAdmin + OrganizationMember)
    const ownerIds = [...new Set(groups.map(g => g.ownerId).filter(Boolean))] as string[];

    const [gaList, memberList] = await Promise.all([
      ownerIds.length > 0
        ? prisma.globalAdmin.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, displayName: true },
          })
        : Promise.resolve([]),
      ownerIds.length > 0
        ? prisma.organizationMember.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, displayName: true, phone: true },
          })
        : Promise.resolve([]),
    ]);

    const nameMap = new Map<string, string>();
    for (const ga of gaList)     nameMap.set(ga.id, ga.displayName ?? '관리자');
    for (const m  of memberList) nameMap.set(m.id,  m.displayName  ?? m.phone ?? m.id);

    // 그룹명 빈도 집계 (마케팅 참고용)
    const nameFreq = new Map<string, number>();
    for (const g of groups) {
      nameFreq.set(g.name, (nameFreq.get(g.name) ?? 0) + 1);
    }

    const result = groups.map(g => ({
      id:           g.id,
      name:         g.name,
      description:  g.description,
      color:        g.color,
      memberCount:  g._count.members,
      orgId:        g.organization.id,
      orgName:      g.organization.name,
      ownerName:    g.ownerId ? (nameMap.get(g.ownerId) ?? g.ownerId) : '조직 공유',
      isShared:     g.ownerId === null,
      nameUsedBy:   nameFreq.get(g.name) ?? 1, // 같은 그룹명을 쓰는 수 (마케팅 참고)
      createdAt:    g.createdAt,
    }));

    // 그룹명 빈도 TOP 10 (마케팅 인사이트)
    const topGroupNames = [...nameFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // 전체 카운트 (필터 적용)
    const total = await prisma.contactGroup.count({
      where: orgIdFilter ? { organizationId: orgIdFilter } : {},
    });

    logger.log('[GET /api/admin/groups-stats]', { total, limit, orgIdFilter });

    return NextResponse.json({ ok: true, groups: result, total, topGroupNames });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }
    logger.error('[GET /api/admin/groups-stats]', { err });
    return NextResponse.json({ ok: false, message: '서버 오류' }, { status: 500 });
  }
}
