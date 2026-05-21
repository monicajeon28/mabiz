export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/pnr/customer/[reservationId]
 * 고객용 예약 정보 조회 (여권 등록 페이지에서 사용)
 * 보안: 전화번호 또는 이메일로 본인 확인 필요
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId: reservationIdStr } = await params;
    const reservationId = parseInt(reservationIdStr);

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

    // 예약 정보 조회 (travelers 포함)
    const reservation = await prisma.gmReservation.findFirst({
      where: {
        id: reservationId,
        // 본인 확인: 전화번호 또는 이메일이 일치해야 함
        ...(phone || email ? {
          user: {
            OR: [
              ...(phone ? [{ phone: phone }] : []),
              ...(email ? [{ email: email }] : []),
            ]
          }
        } : {})
      },
      include: {
        travelers: {
          orderBy: [
            { roomNumber: 'asc' },
            { id: 'asc' },
          ],
        },
        trip: true,
        user: {
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

    // Contact 조회 (전화번호 기준, 결제상태 표시용)
    const contact = phone
      ? await prisma.contact.findFirst({
          where: {
            phone,
            deletedAt: null,
          },
          select: {
            id: true,
            lastPaymentStatus: true,
            lastPaymentAt: true,
            lastRefundedAt: true,
            paymentStatusNote: true,
          },
        })
      : null;

    return NextResponse.json({
      ok: true,
      reservation: {
        id: reservation.id,
        totalPeople: reservation.totalPeople,
        passportStatus: reservation.passportStatus,
        cabinType: reservation.cabinType,
        trip: reservation.trip || null,
        user: reservation.user,
        travelers: reservation.travelers.map((t) => ({
          id: t.id,
          roomNumber: t.roomNumber,
          korName: t.korName,
          engSurname: t.engSurname,
          engGivenName: t.engGivenName,
          passportNo: t.passportNo,
          residentNum: t.residentNum,
          nationality: t.nationality,
          birthDate: t.birthDate || null,
          expiryDate: t.expiryDate || null,
        })),
        paymentStatus: contact?.lastPaymentStatus || 'unknown',
        paymentStatusNote: contact?.paymentStatusNote || null,
        lastPaymentAt: contact?.lastPaymentAt || null,
        lastRefundedAt: contact?.lastRefundedAt || null,
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Reservation GET] Error:', err);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch reservation' },
      { status: 500 }
    );
  }
}
