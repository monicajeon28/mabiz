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

type TripRow = {
  productCode: string;
  departureDate: Date;
  shipName: string;
};

type InventoryRow = {
  tripCode: string;
  cabinType: string;
  total: bigint;
  booked: bigint;
};

type CabinEntry = { total: number; booked: number; remaining: number };
type CabinSummary = Record<string, CabinEntry>;

/**
 * GET /api/products
 * GMcruise 상품 목록 조회 (읽기 전용)
 * + 출발일(D-day) + 객실 잔여 현황 (CabinInventory)
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

    // ── 배치 조회: GmTrip + CabinInventory ─────────────────────────
    const codes = rows.map((r) => r.code).filter((c) => c && c.length > 0);

    const [tripRows, inventoryRows] = await (codes.length > 0
      ? Promise.all([
          prisma.$queryRaw<TripRow[]>(Prisma.sql`
            SELECT DISTINCT ON ("productCode") "productCode", "departureDate", "shipName"
            FROM "Trip"
            WHERE "productCode" IN (${Prisma.join(codes)})
            ORDER BY "productCode", "departureDate" ASC
          `),
          ctx.organizationId
            ? prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
                SELECT "tripCode", "cabinType",
                       SUM("totalCount")::bigint  AS total,
                       SUM("bookedCount")::bigint AS booked
                FROM "CabinInventory"
                WHERE "tripCode" IN (${Prisma.join(codes)})
                  AND "organizationId" = ${ctx.organizationId}
                GROUP BY "tripCode", "cabinType"
              `)
            : Promise.resolve([] as InventoryRow[]),
        ])
      : Promise.resolve([[] as TripRow[], [] as InventoryRow[]]));

    // ── 인덱스 맵 빌드 ───────────────────────────────────────────
    const tripMap = new Map<string, TripRow>();
    for (const t of tripRows) tripMap.set(t.productCode, t);

    const inventoryMap = new Map<string, CabinSummary>();
    for (const inv of inventoryRows) {
      if (!inv.tripCode) continue;
      if (!inventoryMap.has(inv.tripCode)) inventoryMap.set(inv.tripCode, {});
      const summary = inventoryMap.get(inv.tripCode)!;
      const t = Number(inv.total);
      const b = Number(inv.booked);
      summary[inv.cabinType] = { total: t, booked: b, remaining: t - b };
    }

    // ── D-day 계산 (KST 기준) ────────────────────────────────────
    const todayKst = new Date(Date.now() + 9 * 3600000);
    todayKst.setUTCHours(0, 0, 0, 0);

    function calcDaysLeft(dep: Date): number {
      const d = new Date(dep);
      d.setUTCHours(0, 0, 0, 0);
      return Math.round((d.getTime() - todayKst.getTime()) / 86400000);
    }

    const products = rows.map((r) => {
      const trip     = tripMap.get(r.code);
      const daysLeft = trip ? calcDaysLeft(trip.departureDate) : null;
      const cabinSummary = inventoryMap.get(r.code) ?? null;

      return {
        id:             r.id,
        code:           r.code,
        name:           r.name,
        category:       r.category,
        price:          Number(r.price),
        commissionRate: r.commissionRate != null ? Number(r.commissionRate) : null,
        isActive:       r.isActive,
        description:    r.description,
        createdAt:      r.createdAt.toISOString(),
        departureDate:  trip ? trip.departureDate.toISOString() : null,
        shipName:       trip?.shipName ?? null,
        daysLeft,
        cabinSummary,
      };
    });

    logger.log('[GET /api/products]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, products, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/products]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
