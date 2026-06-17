import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/organizations
 * GLOBAL_ADMIN only: 전체 대리점 목록 (멤버 수 포함)
 *
 * 최적화 (배치 쿼리):
 * 1. findMany로 조직 정보 + 리드/계약/멤버 카운트 조회 (1번)
 * 2. 배치 쿼리로 모든 조직의 OWNER 멤버 조회 (1번)
 * 총 2 쿼리로 고정 (조직 수 무관)
 */
export async function GET(req: NextRequest) {
  try {
    // ────────────────────────────────────────────────────────
    // RBAC: GLOBAL_ADMIN 전용 엔드포인트 (세션 기반 단일 체크)
    // ────────────────────────────────────────────────────────
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 검색 파라미터
    const url = new URL(req.url);
    const search = url.searchParams.get('search');

    // [Query 1] 조직 기본 정보 + 카운트
    const orgs = await prisma.organization.findMany({
      where: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { members: { some: { displayName: { contains: search, mode: 'insensitive' } } } },
        ],
      } : undefined,
      select: {
        id:          true,
        name:        true,
        slug:        true,
        status:      true,
        plan:        true,
        contractRef: true,
        createdAt:   true,
        _count: {
          select: { members: true, contacts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // [Query 2 - 배치] 모든 조직의 OWNER 멤버를 한 번에 조회
    const orgIds = orgs.map(o => o.id);
    const ownerMembers = orgIds.length > 0
      ? await prisma.organizationMember.findMany({
          where: {
            organizationId: { in: orgIds },
            role: 'OWNER',
            isActive: true,
          },
          select: {
            organizationId: true,
            displayName: true,
            phone: true,
            email: true,
            userId: true,
          },
        })
      : [];

    // ownerMembers를 organizationId로 맵핑 (가장 먼저 생성된 OWNER 1명만)
    const ownerMap = new Map<string, typeof ownerMembers[0]>();
    for (const member of ownerMembers) {
      if (!ownerMap.has(member.organizationId)) {
        ownerMap.set(member.organizationId, member);
      }
    }

    const result = orgs.map((org) => {
      const owner = ownerMap.get(org.id) ?? null;
      return {
        id:           org.id,
        name:         org.name,
        slug:         org.slug,
        status:       org.status,
        plan:         org.plan,
        contractRef:  org.contractRef,
        createdAt:    org.createdAt,
        memberCount:  org._count.members,
        contactCount: org._count.contacts,
        owner: owner ? {
          name:  owner.displayName,
          phone: owner.phone ? (() => {
            const d = owner.phone!.replace(/[^0-9]/g, '');
            if (d.length === 11) return `${d.slice(0,3)}-****-${d.slice(7)}`;
            return d.slice(0, 3) + '-***-' + d.slice(d.length - 4);
          })() : null,
          email: owner.email,
        } : null,
      };
    });

    return NextResponse.json({ ok: true, organizations: result });
  } catch (err) {
    logger.error('[GET /api/admin/organizations]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/organizations — 제거됨 (2026-06-05)
 * 대리점 수동 생성 기능 폐지. 대리점장 계정은 반드시
 * "계약서 작성 → 승인" 경로(webhook/contract-signed → 승인)로만 생성된다.
 * 수동 생성 경로가 다시 필요하면 git 히스토리(이 커밋 이전) 참조.
 */
