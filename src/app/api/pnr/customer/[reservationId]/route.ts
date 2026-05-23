export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ERROR_MESSAGES, PNR_ERROR_CODES } from '@/lib/pnr-errors';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

/**
 * GET /api/pnr/customer/[reservationId]?phone=010-1234-5678
 * 고객용 예약 정보 조회 (여권 등록 페이지에서 사용)
 *
 * 보안 전략:
 * 1. 비인증 고객: phone 필수 파라미터 + 일치성 검증
 * 2. 인증 사용자(admin/partner): 본인 확인 생략 가능
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

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    // ════════════════════════════════════════════════════════════
    // Step 1: 기본 예약 정보 조회 (필터 없음)
    // ════════════════════════════════════════════════════════════
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: {
        trip: true,
        mainUser: {
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

    const reservationTravelers = await prisma.gmTraveler.findMany({
      where: { reservationId },
      orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
    });

    // ════════════════════════════════════════════════════════════
    // Step 2: 인증 상태 확인
    // ════════════════════════════════════════════════════════════
    const authCheck = enforceRBAC(req, { authOnly: true });
    const isAuthenticated = authCheck === true;

    // ════════════════════════════════════════════════════════════
    // Step 3: 접근 권한 검증 (IDOR 방지)
    // ════════════════════════════════════════════════════════════
    if (!isAuthenticated) {
      // 비인증 고객: phone 필수 + 정확한 일치 검증
      if (!phone) {
        return NextResponse.json(
          { ok: false, error: 'Phone verification required for public access' },
          { status: 401 }
        );
      }

      // DB에서 실제 phone 조회 (한 번 더 검증)
      const userPhone = await prisma.gmReservation.findUnique({
        where: { id: reservationId },
        select: {
          mainUser: {
            select: { phone: true },
          },
        },
      });

      // phone이 정확히 일치하는지 확인
      if (!userPhone?.mainUser?.phone || userPhone.mainUser.phone !== phone) {
        return NextResponse.json(
          { ok: false, error: 'Phone verification failed' },
          { status: 401 }
        );
      }
    }

    // ════════════════════════════════════════════════════════════
    // Step 4: Contact 정보 조회 (결제상태용)
    // ════════════════════════════════════════════════════════════
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

    // ════════════════════════════════════════════════════════════
    // Step 5: 응답 반환
    // ════════════════════════════════════════════════════════════
    return NextResponse.json({
      ok: true,
      reservation: {
        id: reservation.id,
        totalPeople: reservation.totalPeople,
        passportStatus: reservation.passportStatus,
        cabinType: reservation.cabinType,
        trip: reservation.trip || null,
        mainUser: reservation.mainUser,
        travelers: reservationTravelers.map((t) => ({
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
    logger.error('[PNR Verify] Unexpected error:', { error });
    return NextResponse.json(
      { ok: false, message: ERROR_MESSAGES.LOAD_FAILED },
      { status: 500 }
    );
  }
}
