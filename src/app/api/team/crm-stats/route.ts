import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const orgId = requireOrgId(ctx);

    // 팀원 목록
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true, displayName: true, role: true },
    });

    // 전체 고객 통계
    const [totalContacts, totalLeads, totalCustomers] = await Promise.all([
      prisma.contact.count({ where: { organizationId: orgId } }),
      prisma.contact.count({ where: { organizationId: orgId, type: 'LEAD' } }),
      prisma.contact.count({ where: { organizationId: orgId, type: 'CUSTOMER' } }),
    ]);

    // 이번 달 통계
    const thisMonthStart = new Date();
    thisMonthStart.setUTCDate(1);
    thisMonthStart.setUTCHours(0, 0, 0, 0);

    const [monthLeads, monthCustomers] = await Promise.all([
      prisma.contact.count({
        where: { organizationId: orgId, type: 'LEAD', createdAt: { gte: thisMonthStart } },
      }),
      prisma.contact.count({
        where: { organizationId: orgId, purchasedAt: { gte: thisMonthStart } },
      }),
    ]);

    const conversionRate =
      totalLeads > 0 ? Math.round((totalCustomers / totalLeads) * 100 * 10) / 10 : 0;

    logger.log('[TeamCrmStats]', { orgId, totalContacts });
    return NextResponse.json({
      ok: true,
      members,
      summary: {
        totalContacts,
        totalLeads,
        totalCustomers,
        monthLeads,
        monthCustomers,
        conversionRate,
      },
    });
  } catch (e) {
    logger.error('[TeamCrmStats]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
