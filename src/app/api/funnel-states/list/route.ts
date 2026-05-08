import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { FunnelState } from '@/lib/funnel-state-machine';

const BONSA_ORG_ID = 'org_bonsa_cruisedot';

function resolveOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): string {
  return ctx.role === 'GLOBAL_ADMIN' ? BONSA_ORG_ID : requireOrgId(ctx);
}

// GET /api/funnel-states/list?status=ACTIVE&limit=50&offset=0
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as FunnelState | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 필터 조건 구성
    const where: any = { organizationId: orgId };
    if (status) {
      where.status = status;
    }

    // 상태별 고객 조회
    const [states, total] = await Promise.all([
      prisma.contactFunnelState.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              type: true,
              assignedUserId: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.contactFunnelState.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: states,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    logger.error('[GET /api/funnel-states/list]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
