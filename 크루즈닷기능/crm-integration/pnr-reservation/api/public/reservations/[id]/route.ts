export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET: 예약 정보 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const reservationId = parseInt(params.id);
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 예약 ID입니다' },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        Trip: {
          select: {
            productCode: true,
            shipName: true,
            departureDate: true,
          },
        },
        MainUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: '예약을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 예약인지 확인
    if (reservation.mainUserId !== parseInt(session.userId)) {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservation: {
        id: reservation.id,
        trip: {
          productCode: reservation.Trip.productCode,
          shipName: reservation.Trip.shipName,
          departureDate: reservation.Trip.departureDate.toISOString(),
        },
        totalPeople: reservation.totalPeople,
        cabinType: reservation.cabinType,
        paymentAmount: reservation.paymentAmount,
        paymentDate: reservation.paymentDate?.toISOString(),
        paymentMethod: reservation.paymentMethod,
        passportStatus: reservation.passportStatus,
      },
    });
  } catch (error) {
    console.error('[API] 예약 조회 오류:', error);
    return NextResponse.json(
      { ok: false, error: '예약 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
