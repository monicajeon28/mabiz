import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { FunnelState } from '@/lib/funnel-state-machine';

const BONSA_ORG_ID = 'org-cruisedot-main';

function resolveOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): string {
  return ctx.role === 'GLOBAL_ADMIN' ? BONSA_ORG_ID : requireOrgId(ctx);
}

// GET /api/funnel-states/stats
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    // 상태별 고객 수
    const stateCounts = await prisma.contactFunnelState.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: true,
    });

    // 전체 퍼널 상태 수
    const totalStates = await prisma.contactFunnelState.count({
      where: { organizationId: orgId },
    });

    // 전체 고객 수
    const totalContacts = await prisma.contact.count({
      where: { organizationId: orgId, deletedAt: null },
    });

    // 상태별 통계 구성
    const states: FunnelState[] = ['PENDING', 'ACTIVE', 'WAITING', 'COMPLETED', 'FAILED', 'ARCHIVED'];
    const stats = states.map((state) => {
      const count = stateCounts.find((s) => s.status === state)?._count || 0;
      return {
        status: state,
        count,
        percentage: totalStates > 0 ? Math.round((count / totalStates) * 100) : 0,
      };
    });

    // 변환율 계산 (PENDING → COMPLETED)
    const pending = stateCounts.find((s) => s.status === 'PENDING')?._count || 0;
    const completed = stateCounts.find((s) => s.status === 'COMPLETED')?._count || 0;
    const conversionRate = pending > 0 ? Math.round((completed / pending) * 100) : 0;

    // 평균 체류시간 계산 (COMPLETED 상태 기준)
    const completedStates = await prisma.contactFunnelState.findMany({
      where: {
        organizationId: orgId,
        status: 'COMPLETED',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    let averageDaysToComplete = 0;
    if (completedStates.length > 0) {
      const totalMs = completedStates.reduce((acc, state) => {
        const days = (state.updatedAt.getTime() - state.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return acc + days;
      }, 0);
      averageDaysToComplete = Math.round(totalMs / completedStates.length);
    }

    return NextResponse.json({
      ok: true,
      data: {
        stats,
        total: totalStates,
        totalContacts,
        conversionRate,
        averageDaysToComplete,
        summary: {
          pending,
          active: stateCounts.find((s) => s.status === 'ACTIVE')?._count || 0,
          waiting: stateCounts.find((s) => s.status === 'WAITING')?._count || 0,
          completed,
          failed: stateCounts.find((s) => s.status === 'FAILED')?._count || 0,
          archived: stateCounts.find((s) => s.status === 'ARCHIVED')?._count || 0,
        },
      },
    });
  } catch (err) {
    logger.error('[GET /api/funnel-states/stats]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
