import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { findOrCreateOrganization } from '@/lib/organization';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

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
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'],
    errorMessage: '관리자 권한이 필요합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
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
 * POST /api/admin/organizations
 * GLOBAL_ADMIN only: 대리점 수동 생성
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json() as {
      name:        string;
      ownerName:   string;
      ownerPhone:  string;
      ownerEmail?: string;
      slug?:       string;
    };

    const { name, ownerName, ownerPhone, ownerEmail, slug } = body;

    if (!name || !ownerName || !ownerPhone) {
      return NextResponse.json(
        { ok: false, error: 'name, ownerName, ownerPhone are required' },
        { status: 400 },
      );
    }

    const result = await findOrCreateOrganization({
      name,
      ownerName,
      ownerPhone,
      ownerEmail,
      slug,
      source: 'manual',
    });

    logger.warn('[POST /api/admin/organizations] 대리점 수동 생성', {
      orgId:   result.organization.id,
      created: result.created,
    });

    return NextResponse.json({ ok: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (err) {
    logger.error('[POST /api/admin/organizations]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
