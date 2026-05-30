import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId, BONSA_ORG_ID } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { getAvailableTransitions } from '@/lib/funnel-state-machine';



function resolveOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): string {
  return ctx.role === 'GLOBAL_ADMIN' ? BONSA_ORG_ID : requireOrgId(ctx);
}

// GET /api/funnel-states/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const state = await prisma.contactFunnelState.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            type: true,
            assignedUserId: true,
            leadScore: true,
            tags: true,
            lastContactedAt: true,
            purchasedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!state) {
      return NextResponse.json(
        { ok: false, message: '퍼널 상태를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // IDOR 방지: 조직 ID 검증
    if (state.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, message: '접근 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 가능한 다음 상태 계산
    const availableTransitions = getAvailableTransitions(state.status as string);

    return NextResponse.json({
      ok: true,
      data: {
        ...state,
        availableTransitions,
      },
    });
  } catch (err) {
    logger.error('[GET /api/funnel-states/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
