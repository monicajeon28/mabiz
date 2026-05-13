export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgIdOrNull } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/partner/list?month=5&year=2026
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));

    const partners = await prisma.partner.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        status: 'ACTIVE',
      },
      include: {
        metrics: {
          where: { year, month },
          take: 1,
        },
        _count: {
          select: { contacts: true },
        },
      },
      orderBy: { totalRevenue: 'desc' },
    });

    const partnersWithMetrics = partners.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      commissionRate: p.commissionRate?.toString() || '0',
      totalRevenue: Number(p.totalRevenue),
      customerCount: p._count.contacts,
      monthlyMetrics: p.metrics[0] ? {
        customerCount: p.metrics[0].customerCount,
        leadCount: p.metrics[0].leadCount,
        revenue: Number(p.metrics[0].revenue),
      } : null,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      data: partnersWithMetrics,
      count: partnersWithMetrics.length,
    });
  } catch (err) {
    logger.error('[GET /api/partner/list]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
