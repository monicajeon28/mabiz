export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

interface ApisTravelerRow {
  travelerId: number; reservationId: number; pnrNumber: string | null;
  roomNumber: number | null; cabinType: string | null;
  engSurname: string | null; engGivenName: string | null; korName: string | null;
  residentNum: string | null; gender: string | null; birthDate: string | null;
  nationality: string | null;
  passportNo: string | null; issueDate: string | null; expiryDate: string | null;
  phone: string | null; companionGroupId: number | null; roomingGroupId: number | null;
  airlineName: string | null;
  paymentDate: Date | null; paymentMethod: string | null; paymentAmount: number | null;
  agentName: string | null; remarks: string | null; groupMemo: string | null;
  notes: string | null; passportDriveUrl: string | null;
}

export async function GET(req: NextRequest) {
  const manager = await requireCrmManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 401 });

  const tripIdRaw = req.nextUrl.searchParams.get('tripId');
  const tripId = parseInt(tripIdRaw ?? '', 10);
  if (isNaN(tripId)) return NextResponse.json({ ok: false, message: 'tripId 필수' }, { status: 400 });

  try {
    const tripRows = await prisma.$queryRaw<Array<{ id: number; productCode: string; shipName: string; cruiseName: string | null; departureDate: Date }>>(
      Prisma.sql`SELECT id, "productCode", "shipName", "cruiseName", "departureDate" FROM "Trip" WHERE id = ${tripId} LIMIT 1`
    );
    if (!tripRows[0]) return NextResponse.json({ ok: false, message: '여행을 찾을 수 없습니다.' }, { status: 404 });
    const trip = tripRows[0];

    const travelers = await prisma.$queryRaw<ApisTravelerRow[]>(Prisma.sql`
      SELECT
        tr.id as "travelerId", tr."reservationId",
        r."pnrNumber", tr."roomNumber", r."cabinType",
        tr."engSurname", tr."engGivenName", tr."korName",
        tr."residentNum", tr.gender, tr."birthDate", tr.nationality,
        tr."passportNo", tr."issueDate", tr."expiryDate",
        tr.phone, tr."companionGroupId", tr."roomingGroupId",
        r."airlineName", r."paymentDate", r."paymentMethod", r."paymentAmount",
        r."agentName", r.remarks, r."groupMemo", tr.notes, tr."passportDriveUrl"
      FROM "Traveler" tr
      JOIN "Reservation" r ON r.id = tr."reservationId"
      WHERE r."tripId" = ${tripId}
      ORDER BY r.id ASC, tr."roomNumber" ASC, tr.id ASC
    `);

    return NextResponse.json({
      ok: true,
      trip: {
        tripId: trip.id, productCode: trip.productCode, shipName: trip.shipName,
        cruiseName: trip.cruiseName, departureDate: trip.departureDate.toISOString(),
      },
      travelers,
    });
  } catch (err) {
    logger.error('[GET /api/passport/admin/apis-by-trip]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
