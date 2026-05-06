export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type RawProduct = {
  id: number;
  code: string;
  name: string;
  category: string | null;
  price: number;
  commissionRate: number | null;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
};

/**
 * GET /api/products
 * GMcruise 상품 목록 조회 (읽기 전용)
 *
 * FREE_SALES: 403
 * 파라미터: page, limit, isActive('true'|'false'), q(이름/코드 검색)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(200, parseInt(searchParams.get('limit') ?? '50') || 50);
    const offset = (page - 1) * limit;

    const q           = searchParams.get('q')?.trim() ?? '';
    const isActiveRaw = searchParams.get('isActive');
    const isActive: boolean | null =
      isActiveRaw === 'true'  ? true  :
      isActiveRaw === 'false' ? false :
      null;

    const conditions: Prisma.Sql[] = [];
    if (isActive !== null) conditions.push(Prisma.sql`p."isActive" = ${isActive}`);
    if (q) conditions.push(Prisma.sql`(p.name ILIKE ${'%' + q + '%'} OR p.code ILIKE ${'%' + q + '%'})`);

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawProduct[]>(Prisma.sql`
        SELECT p.id, p.code, p.name, p.category, p.price,
               p."commissionRate", p."isActive", p.description, p."createdAt"
        FROM "Product" p
        ${whereClause}
        ORDER BY p."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM "Product" p ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const products = rows.map((r) => ({
      id:             r.id,
      code:           r.code,
      name:           r.name,
      category:       r.category,
      price:          Number(r.price),
      commissionRate: r.commissionRate != null ? Number(r.commissionRate) : null,
      isActive:       r.isActive,
      description:    r.description,
      createdAt:      r.createdAt.toISOString(),
    }));

    logger.log('[GET /api/products]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, products, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/products]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
