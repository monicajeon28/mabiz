export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales-confirmation/pnr/route.ts
// PNR 상태 업데이트 API — 수동 입력(PATCH) / 자동 발송(POST)

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * PATCH: PNR 상태 수동 업데이트
 * body: { reservationId: number, pnrNumber?: string, pnrStatus: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json() as { reservationId?: number; pnrNumber?: string; pnrStatus?: string };
    const { reservationId, pnrNumber, pnrStatus } = body;

    if (!reservationId || typeof reservationId !== 'number') {
      return NextResponse.json({ ok: false, error: 'reservationId가 필요합니다.' }, { status: 400 });
    }
    if (!pnrStatus || typeof pnrStatus !== 'string') {
      return NextResponse.json({ ok: false, error: 'pnrStatus가 필요합니다.' }, { status: 400 });
    }

    const VALID_PNR_STATUSES = ['PENDING', 'SENT', 'COMPLETED'];
    if (!VALID_PNR_STATUSES.includes(pnrStatus)) {
      return NextResponse.json(
        { ok: false, error: `pnrStatus는 ${VALID_PNR_STATUSES.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, pnrStatus: true },
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateData: { pnrStatus: string; pnrNumber?: string; updatedAt: Date } = {
      pnrStatus,
      updatedAt: new Date(),
    };
    if (pnrNumber !== undefined) {
      updateData.pnrNumber = pnrNumber;
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: updateData,
      select: { id: true, pnrStatus: true },
    });

    logger.debug('[PNR PATCH] PNR 상태 수동 업데이트', {
      reservationId,
      prevStatus: reservation.pnrStatus,
      newStatus: pnrStatus,
      adminId: sessionUser.id,
    });

    return NextResponse.json({ ok: true, reservationId: updated.id, pnrStatus: updated.pnrStatus });
  } catch (error: unknown) {
    logger.error('[PNR PATCH] 오류', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST: PNR 자동 발송 — pnrStatus = 'SENT'로 업데이트
 * body: { reservationId: number }
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json() as { reservationId?: number };
    const { reservationId } = body;

    if (!reservationId || typeof reservationId !== 'number') {
      return NextResponse.json({ ok: false, error: 'reservationId가 필요합니다.' }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, pnrStatus: true },
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { pnrStatus: 'SENT', updatedAt: new Date() },
    });

    logger.debug('[PNR POST] PNR 자동 발송 처리', {
      reservationId,
      prevStatus: reservation.pnrStatus,
      adminId: sessionUser.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logger.error('[PNR POST] 오류', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
