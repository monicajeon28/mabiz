export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/passport/public/reservation-status
 * 여권 등록 상태 업데이트
 * 세션 기반 인증 (getMabizSession)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');

    if (!idParam) {
      return NextResponse.json(
        { ok: false, error: '예약 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const reservationId = parseInt(idParam);
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 예약 ID입니다' },
        { status: 400 }
      );
    }

    const { status } = await req.json();
    if (!status || !['PENDING', 'LATER', 'COMPLETED'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 상태 값입니다' },
        { status: 400 }
      );
    }

    // 예약 존재 및 권한 확인
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      select: { mainUserId: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: '예약을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (reservation.mainUserId !== Number(session.userId)) {
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 상태 업데이트
    await prisma.gmReservation.update({
      where: { id: reservationId },
      data: { passportStatus: status },
    });

    return NextResponse.json({
      ok: true,
      message: '상태가 업데이트되었습니다',
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[API] 여권 상태 업데이트 오류:', err);
    return NextResponse.json(
      { ok: false, error: '상태 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
