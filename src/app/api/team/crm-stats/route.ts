import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { getCache, setCache } from '@/lib/redis';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const orgId = requireOrgId(ctx);

    // 캐시 조회
    const cacheKey = `crm-stats:${orgId}:v1`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // KST 기준 이번 달 범위 계산
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date(Date.now() + kstOffset);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - kstOffset);

    // 7-way Promise.all: members + 6개 count() 쿼리 병합
    const [members, totalContacts, totalLeads, totalCustomers, monthLeads, monthCustomers, optOutCount] = await Promise.all([
      prisma.organizationMember.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { userId: true, displayName: true, role: true },
      }),
      prisma.contact.count({ where: { organizationId: orgId } }),
      prisma.contact.count({ where: { organizationId: orgId, type: 'LEAD' } }),
      prisma.contact.count({ where: { organizationId: orgId, type: 'CUSTOMER' } }),
      prisma.contact.count({
        where: { organizationId: orgId, type: 'LEAD', createdAt: { gte: monthStart } },
      }),
      prisma.contact.count({
        where: { organizationId: orgId, purchasedAt: { gte: monthStart } },
      }),
      prisma.contact.count({
        where: { organizationId: orgId, optOutAt: { not: null } },
      }),
    ]);

    const conversionRate =
      totalLeads > 0 ? Math.round((totalCustomers / totalLeads) * 100 * 10) / 10 : 0;

    logger.log('[TeamCrmStats]', { orgId, totalContacts, optOutCount });

    const responseData = {
      ok: true,
      members,
      summary: {
        totalContacts,
        totalLeads,
        totalCustomers,
        monthLeads,
        monthCustomers,
        conversionRate,
        optOutCount,
      },
    };

    // 캐시 저장 (2분 TTL)
    await setCache(cacheKey, responseData, 120);

    return NextResponse.json(responseData);
  } catch (e) {
    logger.error('[TeamCrmStats]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
