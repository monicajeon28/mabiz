export const dynamic = 'force-dynamic';

// 여권 상태 업데이트 API -- 수동 확인(PATCH) / 자동 확인(POST)

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireCrmManager } from '@/lib/passport-auth';
import prisma from '@/lib/prisma';

/**
 * PATCH: 여권 상태 수동 업데이트
 * body: { reservationId: number, passportStatus: 'SUBMITTED' | 'COMPLETED' }
 */
export async function PATCH(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json() as { reservationId?: number; passportStatus?: string };
    const { reservationId, passportStatus } = body;

    if (!reservationId || typeof reservationId !== 'number') {
      return NextResponse.json({ ok: false, error: 'reservationId가 필요합니다.' }, { status: 400 });
    }
    if (!passportStatus) {
      return NextResponse.json({ ok: false, error: 'passportStatus가 필요합니다.' }, { status: 400 });
    }

    const VALID_PASSPORT_STATUSES = ['SUBMITTED', 'COMPLETED'];
    if (!VALID_PASSPORT_STATUSES.includes(passportStatus)) {
      return NextResponse.json(
        { ok: false, error: `passportStatus는 ${VALID_PASSPORT_STATUSES.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      select: { id: true, passportStatus: true },
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updated = await prisma.gmReservation.update({
      where: { id: reservationId },
      data: { passportStatus, updatedAt: new Date() },
      select: { id: true, passportStatus: true },
    });

    logger.log('[Passport PATCH] 여권 상태 수동 업데이트', {
      reservationId,
      prevStatus: reservation.passportStatus,
      newStatus: passportStatus,
      managerId: manager.id,
    });

    return NextResponse.json({ ok: true, reservationId: updated.id, passportStatus: updated.passportStatus });
  } catch (error: unknown) {
    logger.error('[Passport PATCH] 오류', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST: 여권 자동 확인 -- PassportSubmission 테이블에서 제출 여부 조회 후 passportStatus 업데이트
 * body: { reservationId: number }
 */
export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json() as { reservationId?: number };
    const { reservationId } = body;

    if (!reservationId || typeof reservationId !== 'number') {
      return NextResponse.json({ ok: false, error: 'reservationId가 필요합니다.' }, { status: 400 });
    }

    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      select: { id: true, mainUserId: true, passportStatus: true },
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    }

    const passportSubmission = await prisma.gmPassportSubmission.findFirst({
      where: { userId: reservation.mainUserId, isSubmitted: true },
      select: { id: true },
    });

    if (!passportSubmission) {
      return NextResponse.json(
        { ok: false, error: '여권 미제출: 해당 사용자의 여권 제출 내역이 없습니다.' },
        { status: 404 }
      );
    }

    await prisma.gmReservation.update({
      where: { id: reservationId },
      data: { passportStatus: 'COMPLETED', updatedAt: new Date() },
    });

    logger.log('[Passport POST] 여권 자동 확인 완료', {
      reservationId,
      mainUserId: reservation.mainUserId,
      prevStatus: reservation.passportStatus,
      managerId: manager.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logger.error('[Passport POST] 오류', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
