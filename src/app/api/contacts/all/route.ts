import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/contacts/all — GLOBAL_ADMIN 전용, 전 조직 고객 조회
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: 'GLOBAL_ADMIN만 접근 가능합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q     = searchParams.get('q') ?? '';
    const type  = searchParams.get('type') ?? '';
    const orgId = searchParams.get('orgId') ?? '';
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const page  = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
    const rawLimit = parseInt(searchParams.get('limit') ?? '30', 10);
    const limit = Number.isNaN(rawLimit) ? 30 : Math.min(Math.max(1, rawLimit), 200);

    const tagParam = searchParams.get('tags');
    const tags = tagParam ? tagParam.split(',').map(t => t.trim()).filter(Boolean) : [];

    const sortBy = searchParams.get('sortBy'); // updatedAt_desc | createdAt_desc | name_asc
    const orderBy =
      sortBy === 'createdAt_desc' ? { createdAt: 'desc' as const } :
      sortBy === 'name_asc'       ? { name: 'asc' as const } :
      { updatedAt: 'desc' as const }; // 기본값

    const where = {
      deletedAt: null, // 삭제된 고객(soft delete) 제외
      ...(orgId ? { organizationId: orgId } : {}),
      ...(type ? { type } : {}),
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
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
        orderBy,
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
          surveyData: true,
          organization: { select: { name: true } },
          groups: { select: { group: { select: { id: true, name: true, color: true } } } },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    const masked = contacts; // GLOBAL_ADMIN only (403 gate above)

    logger.log('[ContactsAll] 조회', { total, orgId: orgId || '전체' });
    return NextResponse.json({ ok: true, contacts: masked, total, page, limit });
  } catch (e) {
    logger.error('[ContactsAll]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
