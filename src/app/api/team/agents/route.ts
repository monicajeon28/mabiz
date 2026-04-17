export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    // 조직 ID 결정
    const orgId = ctx.organizationId;

    // AGENT 역할 멤버 조회
    const agentWhere = orgId
      ? { organizationId: orgId, isActive: true, role: 'AGENT' }
      : { isActive: true, role: 'AGENT' };

    const agents = await prisma.organizationMember.findMany({
      where: agentWhere,
      select: {
        id: true,
        userId: true,
        displayName: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            externalAffiliateProfileId: true,
          },
        },
      },
      orderBy: { displayName: 'asc' },
      take: 200,
    });

    if (agents.length === 0) {
      return NextResponse.json({ ok: true, metrics: [] });
    }

    const userIds = agents.map((a) => a.userId);

    // 리드 수 집계 (assignedUserId 기준)
    const leadCounts = await prisma.contact.groupBy({
      by: ['assignedUserId'],
      where: {
        assignedUserId: { in: userIds },
        ...(orgId ? { organizationId: orgId } : {}),
      },
      _count: { _all: true },
    });

    const leadCountMap = new Map<string, number>();
    leadCounts.forEach((row) => {
      if (row.assignedUserId) {
        leadCountMap.set(row.assignedUserId, row._count._all);
      }
    });

    // 판매 집계 (affiliateUserId 기준, 완료된 판매만)
    const salesGroups = await prisma.affiliateSale.groupBy({
      by: ['affiliateUserId'],
      where: {
        affiliateUserId: { in: userIds },
        status: { in: ['EARNED', 'PAID'] },
        ...(orgId ? { organizationId: orgId } : {}),
      },
      _count: { _all: true },
      _sum: { commissionAmount: true },
    });

    const salesMap = new Map<string, { count: number; salesCommission: number }>();
    salesGroups.forEach((row) => {
      if (row.affiliateUserId) {
        salesMap.set(row.affiliateUserId, {
          count: row._count._all,
          salesCommission: row._sum.commissionAmount ?? 0,
        });
      }
    });

    // 메트릭 조합 + 판매 수 기준 내림차순 정렬
    const metrics = agents
      .map((agent) => {
        const leadTotal = leadCountMap.get(agent.userId) ?? 0;
        const saleData = salesMap.get(agent.userId);
        return {
          agent: {
            id: agent.id,
            affiliateCode: agent.userId,
            displayName: agent.displayName,
            status: agent.role,
          },
          leads: { total: leadTotal },
          sales: {
            count: saleData?.count ?? 0,
            salesCommission: saleData?.salesCommission ?? 0,
          },
        };
      })
      .sort((a, b) => b.sales.count - a.sales.count || b.leads.total - a.leads.total);

    logger.log('[team/agents] 판매원 리더보드 조회', {
      role: ctx.role,
      orgId: orgId ?? 'global',
      agentCount: agents.length,
    });

    return NextResponse.json({ ok: true, metrics });
  } catch (e: unknown) {
    logger.error('[team/agents] 조회 실패', {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
