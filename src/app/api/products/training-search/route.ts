export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

type TrainingProduct = {
  id: number;
  productCode: string;
  packageName: string;
  cruiseLine: string;
  shipName: string;
  basePrice: number | null;
  nights: number;
  days: number;
  startDate: Date | null;
  saleStatus: string;
  availableCount: number | null;
  reservedCount: number | null;
  tourCities: string | null;
  daysLeft: number | null;
};

export async function GET(req: Request) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '30', 10));

    const now = new Date();

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."deletedAt" IS NULL`,
      Prisma.sql`p."isActive" = true`,
      Prisma.sql`(p."startDate" IS NULL OR p."startDate" > ${now})`,
    ];

    if (q) {
      conditions.push(
        Prisma.sql`(
          p."packageName" ILIKE ${'%' + q + '%'}
          OR p."tourCities" ILIKE ${'%' + q + '%'}
          OR p."cruiseLine" ILIKE ${'%' + q + '%'}
          OR p."shipName" ILIKE ${'%' + q + '%'}
          OR CAST(p."basePrice" AS TEXT) ILIKE ${'%' + q + '%'}
        )`
      );
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const rows = await prisma.$queryRaw<TrainingProduct[]>(Prisma.sql`
      SELECT
        p.id,
        p."productCode",
        p."packageName",
        p."cruiseLine",
        p."shipName",
        p."basePrice",
        p."nights",
        p."days",
        p."startDate",
        p."saleStatus",
        p."availableCount",
        p."reservedCount",
        p."tourCities",
        CASE
          WHEN p."startDate" IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (p."startDate" - ${now}::timestamp))::integer
        END AS "daysLeft"
      FROM "CruiseProduct" p
      ${whereClause}
      ORDER BY p."startDate" ASC NULLS LAST, p."basePrice" ASC NULLS LAST
      LIMIT ${limit}
    `);

    const products = rows.map((r) => ({
      id: r.id,
      productCode: r.productCode,
      name: r.packageName,
      cruiseLine: r.cruiseLine,
      ship: r.shipName,
      price: r.basePrice ? Number(r.basePrice) : null,
      nights: r.nights,
      days: r.days,
      startDate: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
      saleStatus: r.saleStatus,
      availableCount: r.availableCount ?? null,
      reservedCount: r.reservedCount ?? null,
      tourCities: r.tourCities ?? null,
      daysLeft: r.daysLeft !== null ? Number(r.daysLeft) : null,
    }));

    return NextResponse.json({ ok: true, products, total: products.length });
  } catch (err) {
    logger.error('[training-search] 오류', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
