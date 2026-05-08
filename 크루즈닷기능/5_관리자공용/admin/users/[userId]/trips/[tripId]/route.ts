export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (session && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    logger.error('[Admin Auth] Error:', error);
  }

  return null;
}

// GET: 특정 여행 정보 조회 (Itinerary 포함)
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string; tripId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    const tripId = parseInt(params.tripId);

    if (isNaN(userId) || isNaN(tripId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID or trip ID' },
        { status: 400 }
      );
    }

    // 여행 정보 조회 (Itinerary 포함)
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: userId,
      },
      include: {
        Itinerary: {
          orderBy: { day: 'asc' },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { ok: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      trip: {
        id: trip.id,
        productId: trip.productId,
        productCode: trip.reservationCode || null,
        cruiseName: trip.cruiseName,
        startDate: trip.startDate?.toISOString() || null,
        endDate: trip.endDate?.toISOString() || null,
        companionType: trip.companionType,
        destination: trip.destination,
        nights: trip.nights,
        days: trip.days,
        visitCount: trip.visitCount,
        status: trip.status,
        itineraries: trip.Itinerary.map((it: any) => ({
          day: it.day,
          type: it.type,
          location: it.location,
          country: it.country,
          currency: it.currency,
          language: it.language,
          arrival: it.arrival,
          departure: it.departure,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[Admin Trip GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch trip' },
      { status: 500 }
    );
  }
}

// DELETE: 여행 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string; tripId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    const tripId = parseInt(params.tripId);

    if (isNaN(userId) || isNaN(tripId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID or trip ID' },
        { status: 400 }
      );
    }

    // 여행 소유권 확인
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: userId,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { ok: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // 여행 삭제 (Itinerary는 cascade로 자동 삭제됨)
    await prisma.trip.delete({
      where: { id: tripId },
    });

    return NextResponse.json({
      ok: true,
      message: 'Trip deleted successfully',
    });
  } catch (error: any) {
    logger.error('[Admin Trip DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete trip' },
      { status: 500 }
    );
  }
}
