import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/b2b-prospects
 * B2B 구매자/문의자 목록 (CrmB2BProspect 테이블)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const url = new URL(req.url);

    const q     = url.searchParams.get('q');
    const page  = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: orgId };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { companyName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.b2BProspect.count({ where }),
    ]);

    return NextResponse.json({ ok: true, prospects, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[GET /api/b2b-prospects]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
