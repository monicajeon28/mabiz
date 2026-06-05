export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const manager = await requireCrmManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const search = (req.nextUrl.searchParams.get('search')?.trim() ?? '').substring(0, 100);
    const searchCondition = search
      ? Prisma.sql`AND (t."shipName" ILIKE ${'%' + search + '%'} OR t."cruiseName" ILIKE ${'%' + search + '%'} OR t."productCode" ILIKE ${'%' + search + '%'})`
      : Prisma.empty;

    const trips = await prisma.$queryRaw<Array<{
      tripId: number; productCode: string; shipName: string; cruiseName: string | null;
      departureDate: Date; reservationCount: bigint; travelerCount: bigint;
    }>>(Prisma.sql`
      SELECT
        t.id as "tripId",
        t."productCode",
        t."shipName",
        t."cruiseName",
        t."departureDate",
        COUNT(DISTINCT r.id) as "reservationCount",
        COUNT(DISTINCT tr.id) as "travelerCount"
      FROM "Trip" t
      JOIN "Reservation" r ON r."tripId" = t.id
      LEFT JOIN "Traveler" tr ON tr."reservationId" = r.id
      WHERE 1=1 ${searchCondition}
      GROUP BY t.id, t."productCode", t."shipName", t."cruiseName", t."departureDate"
      ORDER BY t."departureDate" DESC
      LIMIT 100
    `);

    return NextResponse.json({
      ok: true,
      trips: trips.map(t => ({
        tripId: t.tripId,
        productCode: t.productCode,
        shipName: t.shipName,
        cruiseName: t.cruiseName,
        departureDate: t.departureDate.toISOString(),
        reservationCount: Number(t.reservationCount),
        travelerCount: Number(t.travelerCount),
      })),
    });
  } catch (err) {
    logger.error('[GET /api/passport/admin/apis-trips]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
