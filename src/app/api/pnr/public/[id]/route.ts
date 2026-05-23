export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET: 예약 정보 조회 (Public - 인증 없음)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const reservationId = parseInt(idStr);
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 예약 ID입니다' },
        { status: 400 }
      );
    }

    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: {
        trip: {
          select: {
            productCode: true,
            shipName: true,
            departureDate: true,
          },
        },
        mainUser: {
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

    return NextResponse.json({
      ok: true,
      reservation: {
        id: reservation.id,
        trip: {
          productCode: reservation.trip.productCode,
          shipName: reservation.trip.shipName,
          departureDate: reservation.trip.departureDate.toISOString(),
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
    const err = error as Record<string, unknown>;
    logger.error('[API] 예약 조회 오류:', err);
    return NextResponse.json(
      { ok: false, error: '예약 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
