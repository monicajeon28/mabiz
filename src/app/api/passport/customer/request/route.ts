export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * 여권 도움 요청 API
 * POST /api/passport/customer/request
 *
 * 고객이 "도와주세요" 버튼을 누르면 호출되는 API입니다.
 * Customer API — 세션 기반 인증 (getMabizSession)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { reservationId, requesterName, requesterPhone } = body;

    // 필수 필드 검증
    if (!reservationId) {
      return NextResponse.json(
        { ok: false, message: 'reservationId는 필수입니다.' },
        { status: 400 }
      );
    }

    const userId = Number(session.userId);

    // Reservation 존재 확인
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: {
        trip: {
          select: {
            id: true,
            cruiseName: true,
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
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 요청한 userId가 예약 소유자인지 확인
    if (reservation.mainUserId !== userId) {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. Reservation의 pnrStatus를 '도움요청'으로 업데이트
      const updatedReservation = await tx.gmReservation.update({
        where: { id: reservationId },
        data: {
          pnrStatus: '도움요청',
        },
      });

      return { reservation: updatedReservation };
    });

    // 알림 로깅
    const customerName = reservation.mainUser?.name || '고객';
    const customerPhone = reservation.mainUser?.phone || '';
    const cruiseName = reservation.trip?.cruiseName || '크루즈';
    const departureDate = reservation.trip?.departureDate
      ? new Date(reservation.trip.departureDate).toLocaleDateString('ko-KR')
      : '날짜 미정';

    logger.info('────────────────────────────────────────────');
    logger.info('[알림] 여권 등록 도움 요청');
    logger.info('────────────────────────────────────────────');
    logger.info(`고객: ${customerName} (${customerPhone})`);
    if (requesterName && requesterPhone) {
      logger.info(`신청자: ${requesterName} (${requesterPhone})`);
    }
    logger.info(`크루즈: ${cruiseName}`);
    logger.info(`출발일: ${departureDate}`);
    logger.info(`예약 ID: ${reservationId}`);
    logger.info(`인원수: ${reservation.totalPeople}명 (단체 여행)`);
    logger.info(`상태: 도움요청`);
    logger.info('────────────────────────────────────────────');

    return NextResponse.json({
      ok: true,
      message: '도움 요청이 성공적으로 등록되었습니다. 담당자가 곧 연락드리겠습니다.',
      data: {
        reservationId: result.reservation.id,
        pnrStatus: result.reservation.pnrStatus,
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport Request] Error:', { err });
    return NextResponse.json(
      {
        ok: false,
        message: String(err.message || '도움 요청 등록에 실패했습니다.'),
      },
      { status: 500 }
    );
  }
}
