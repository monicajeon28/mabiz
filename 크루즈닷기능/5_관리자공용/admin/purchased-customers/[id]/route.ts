import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: Number(session.userId) },
      select: { role: true },
    });

    if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const reservationId = parseInt(params.id);
    if (isNaN(reservationId)) {
      return NextResponse.json({ ok: false, error: 'Invalid reservation ID' }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        Trip: {
          select: {
            id: true,
            shipName: true,
            departureDate: true,
            productCode: true,
            spreadsheetId: true,
          },
        },
        Traveler: {
          select: {
            id: true,
            korName: true,
            engSurname: true,
            engGivenName: true,
            passportNo: true,
            nationality: true,
            birthDate: true,
            expiryDate: true,
            gender: true,
            roomNumber: true,
            passportImage: true,
          },
          orderBy: { roomNumber: 'asc' },
        },
        AffiliateSale: {
          include: {
            AffiliateProfile_agentIdToAffiliateProfile: {
              select: {
                displayName: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: 'Reservation not found' }, { status: 404 });
    }

    const mappedReservation = {
      id: reservation.id,
      totalPeople: reservation.totalPeople,
      pnrStatus: reservation.pnrStatus,
      createdAt: reservation.createdAt?.toISOString(),
      user: reservation.User ? {
        id: reservation.User.id,
        name: reservation.User.name,
        phone: reservation.User.phone,
        email: reservation.User.email,
      } : null,
      trip: reservation.Trip ? {
        id: reservation.Trip.id,
        departureDate: reservation.Trip.departureDate?.toISOString(),
        spreadsheetId: reservation.Trip.spreadsheetId,
        shipName: reservation.Trip.shipName,
        productCode: reservation.Trip.productCode,
        product: {
          cruiseLine: null,
          shipName: reservation.Trip.shipName,
          packageName: reservation.Trip.productCode,
        },
      } : null,
      travelers: reservation.Traveler.map((t) => ({
        id: t.id,
        korName: t.korName,
        engSurname: t.engSurname,
        engGivenName: t.engGivenName,
        passportNo: t.passportNo,
        nationality: t.nationality,
        birthDate: t.birthDate,
        expiryDate: t.expiryDate,
        gender: t.gender,
        roomNumber: t.roomNumber,
        passportImage: t.passportImage,
      })),
      affiliate: reservation.AffiliateSale?.AffiliateProfile_agentIdToAffiliateProfile ? {
        displayName: reservation.AffiliateSale.AffiliateProfile_agentIdToAffiliateProfile.displayName,
        type: reservation.AffiliateSale.AffiliateProfile_agentIdToAffiliateProfile.type,
      } : null,
    };

    return NextResponse.json({
      ok: true,
      reservation: mappedReservation,
    });
  } catch (error: any) {
    console.error('[Admin Purchased Customers Detail] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch reservation detail' },
      { status: 500 }
    );
  }
}
