export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { syncApisInBackground } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: Number(session.userId) },
      select: { role: true },
    });

    if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { reservationId, korName, roomNumber } = body;

    if (!reservationId) {
      return NextResponse.json({ ok: false, error: 'Reservation ID is required' }, { status: 400 });
    }

    // 예약 존재 여부 확인 (Trip 정보도 포함)
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        Trip: {
          select: { id: true }
        }
      }
    });

    if (!reservation) {
      return NextResponse.json({ ok: false, error: 'Reservation not found' }, { status: 404 });
    }

    // 새 여행자 생성
    const newTraveler = await prisma.traveler.create({
      data: {
        reservationId,
        korName: korName || '',
        roomNumber: roomNumber || 1,
      },
    });

    // 예약의 총 인원 수 업데이트
    const travelerCount = await prisma.traveler.count({
      where: { reservationId },
    });

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { totalPeople: travelerCount },
    });

    // APIS 스프레드시트 자동 동기화 (재시도 로직 포함)
    const tripId = reservation.Trip?.id;
    if (tripId) {
      syncApisInBackground(tripId);
    }

    return NextResponse.json({
      ok: true,
      traveler: {
        id: newTraveler.id,
        korName: newTraveler.korName,
        roomNumber: newTraveler.roomNumber,
        reservationId: newTraveler.reservationId,
      },
    });
  } catch (error: any) {
    console.error('[Admin Travelers Create] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create traveler' },
      { status: 500 }
    );
  }
}
