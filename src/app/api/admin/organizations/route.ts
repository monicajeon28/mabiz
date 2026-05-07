import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { findOrCreateOrganization } from '@/lib/organization';

/**
 * GET /api/admin/organizations
 * GLOBAL_ADMIN only: 전체 대리점 목록 (멤버 수 포함)
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const orgs = await prisma.organization.findMany({
      select: {
        id:          true,
        name:        true,
        slug:        true,
        status:      true,
        plan:        true,
        contractRef: true,
        createdAt:   true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = orgs.map((org) => ({
      id:          org.id,
      name:        org.name,
      slug:        org.slug,
      status:      org.status,
      plan:        org.plan,
      contractRef: org.contractRef,
      createdAt:   org.createdAt,
      memberCount: org._count.members,
    }));

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
