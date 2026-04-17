import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/contacts/all — GLOBAL_ADMIN 전용, 전 조직 고객 조회
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q     = searchParams.get('q') ?? '';
    const type  = searchParams.get('type') ?? '';
    const orgId = searchParams.get('orgId') ?? '';
    const page  = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '30');

    const where = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(type ? { type } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q } },
        ],
      } : {}),
    };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          type: true,
          purchasedAt: true,
          updatedAt: true,
          tags: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    // phone 마스킹
    const masked = contacts.map(c => ({
      ...c,
      phone: c.phone.substring(0, 4) + '****',
    }));

    logger.log('[ContactsAll] 조회', { total, orgId: orgId || '전체' });
    return NextResponse.json({ ok: true, contacts: masked, total, page, limit });
  } catch (e) {
    logger.error('[ContactsAll]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
