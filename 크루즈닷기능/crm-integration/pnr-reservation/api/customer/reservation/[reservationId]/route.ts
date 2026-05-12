export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/customer/reservation/[reservationId]
 * 고객용 예약 정보 조회 (여권 등록 페이지에서 사용)
 * 보안: 전화번호 또는 이메일로 본인 확인 필요
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { reservationId: string } }
) {
  try {
    const reservationId = parseInt(params.reservationId);
    
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid reservation ID' },
        { status: 400 }
      );
    }

    // 보안: 전화번호 또는 이메일 확인 (URL 파라미터)
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const email = searchParams.get('email');

    // 예약 정보 조회 (Traveler 포함)
    const reservation = await prisma.reservation.findFirst({
      where: { 
        id: reservationId,
        // 본인 확인: 전화번호 또는 이메일이 일치해야 함
        ...(phone || email ? {
          User: {
            OR: [
              ...(phone ? [{ phone: phone }] : []),
              ...(email ? [{ email: email }] : []),
            ]
          }
        } : {})
      },
      include: {
        Traveler: {
          orderBy: [
            { roomNumber: 'asc' },
            { id: 'asc' },
          ],
        },
        Trip: true,
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: 'Reservation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservation: {
        id: reservation.id,
        totalPeople: reservation.totalPeople,
        passportStatus: reservation.passportStatus,
        cabinType: reservation.cabinType, // 객실 타입 (발코니, 오션뷰 등)
        trip: reservation.Trip || null,
        user: reservation.User,
        travelers: reservation.Traveler.map((t) => ({
          id: t.id,
          roomNumber: t.roomNumber,
          korName: t.korName,
          engSurname: t.engSurname,
          engGivenName: t.engGivenName,
          passportNo: t.passportNo,
          residentNum: t.residentNum,
          nationality: t.nationality,
          birthDate: t.birthDate || null, // Prisma 스키마에 맞게 수정
          expiryDate: t.expiryDate || null, // Prisma 스키마에 맞게 수정
        })),
      },
    });
  } catch (error: any) {
    console.error('[Reservation GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch reservation' },
      { status: 500 }
    );
  }
}
