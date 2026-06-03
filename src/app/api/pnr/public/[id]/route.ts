export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET: 예약 정보 조회 (Public - 전화번호 소유자 검증)
 *
 * IDOR 방지: 예약 ID만으로는 조회 불가.
 * 쿼리 파라미터 `phone`을 필수로 받아 예약 담당자(mainUser.phone)와 일치해야 응답.
 * 불일치 시 404를 반환하여 유효한 ID 존재 여부를 노출하지 않음.
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

    // 전화번호 파라미터 필수 검증
    const phoneParam = req.nextUrl.searchParams.get('phone');
    if (!phoneParam || phoneParam.trim().length < 8) {
      return NextResponse.json(
        { ok: false, error: '전화번호 인증이 필요합니다' },
        { status: 401 }
      );
    }
    const normalizedPhone = phoneParam.trim().replace(/\D/g, '');

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

    // 전화번호 소유자 검증 — 불일치 시 존재 여부 노출 방지를 위해 404 반환
    const ownerPhone = (reservation.mainUser?.phone ?? '').replace(/\D/g, '');
    if (!ownerPhone || ownerPhone !== normalizedPhone) {
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
