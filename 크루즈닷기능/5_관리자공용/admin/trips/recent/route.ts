export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';  // ✅ 대문자 U로 변경
  } catch (error) {
    console.error('[Admin Recent Trips] Auth check error:', error);
    return false;
  }
}

export async function GET() {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    // 최근 여행 등록 (최근 10개)
    // UserTrip 모델을 사용하여 조회
    const recentUserTrips = await prisma.userTrip.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cruiseName: true,
        destination: true,
        startDate: true,
        userId: true,
        User: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      trips: recentUserTrips.map(trip => ({
        id: trip.id,
        cruiseName: trip.cruiseName || '크루즈명 없음',
        destination: trip.destination ? (typeof trip.destination === 'string' ? trip.destination : JSON.stringify(trip.destination)) : null,
        startDate: trip.startDate ? trip.startDate.toISOString() : null,
        userName: trip.User?.name || '이름 없음',
        userPhone: trip.User?.phone || '',
      })),
    });
  } catch (error: any) {
    console.error('[Admin Recent Trips API] Error:', error);
    console.error('[Admin Recent Trips API] Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
