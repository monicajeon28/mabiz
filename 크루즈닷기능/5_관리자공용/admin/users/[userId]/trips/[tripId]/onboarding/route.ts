export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/trips/[tripId]/onboarding/route.ts
// 관리자가 특정 사용자의 여행 온보딩 상태를 수동으로 설정하는 API

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: { select: { id: true, role: true } } },
    });
    if (!session?.User || session.User.role !== 'admin') return null;
    return session.User;
  } catch (error) {
    logger.error('[Admin Onboarding] Auth error:', error);
    return null;
  }
}

/**
 * GET /api/admin/users/[userId]/trips/[tripId]/onboarding
 * 특정 여행의 온보딩 상태를 조회합니다.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string; tripId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const userId = parseInt(params.userId);
    const tripId = parseInt(params.tripId);
    if (isNaN(userId) || isNaN(tripId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID입니다' }, { status: 400 });
    }

    // 사용자 온보딩 상태 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        onboarded: true,
        onboardingUpdatedAt: true,
        onboardingUpdatedByUser: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 여행 정보 조회 (소유권 확인)
    const trip = await prisma.userTrip.findFirst({
      where: { id: tripId, userId },
      select: {
        id: true,
        cruiseName: true,
        status: true,
        companionType: true,
        startDate: true,
        endDate: true,
        destination: true,
        updatedAt: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ ok: false, error: '여행을 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      onboarding: {
        userId: user.id,
        tripId: trip.id,
        isOnboarded: user.onboarded,
        onboardingUpdatedAt: user.onboardingUpdatedAt?.toISOString() ?? null,
        onboardingUpdatedByUser: user.onboardingUpdatedByUser,
        trip: {
          id: trip.id,
          cruiseName: trip.cruiseName,
          status: trip.status,
          companionType: trip.companionType,
          startDate: trip.startDate?.toISOString() ?? null,
          endDate: trip.endDate?.toISOString() ?? null,
          destination: trip.destination,
        },
      },
    });
  } catch (error) {
    logger.error('[Admin Onboarding] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '온보딩 정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users/[userId]/trips/[tripId]/onboarding
 * 온보딩 완료 상태로 수동 설정합니다.
 * 요청: { companionType?: string, onboarded?: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string; tripId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const userId = parseInt(params.userId);
    const tripId = parseInt(params.tripId);
    if (isNaN(userId) || isNaN(tripId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID입니다' }, { status: 400 });
    }

    let companionType: string | undefined;
    let onboarded: boolean = true;
    try {
      const body = await req.json();
      companionType = typeof body?.companionType === 'string' ? body.companionType.trim() : undefined;
      onboarded = typeof body?.onboarded === 'boolean' ? body.onboarded : true;
    } catch {
      // 바디 없으면 기본값 사용
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 여행 소유권 확인
    const trip = await prisma.userTrip.findFirst({
      where: { id: tripId, userId },
      select: { id: true },
    });
    if (!trip) {
      return NextResponse.json({ ok: false, error: '여행을 찾을 수 없습니다' }, { status: 404 });
    }

    const now = new Date();

    // 트랜잭션: 여행 동반자 정보 + 사용자 온보딩 상태 동시 업데이트
    const [updatedTrip, updatedUser] = await prisma.$transaction([
      prisma.userTrip.update({
        where: { id: tripId },
        data: {
          ...(companionType ? { companionType } : {}),
          updatedAt: now,
        },
        select: { id: true, companionType: true, updatedAt: true },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          onboarded,
          onboardingUpdatedAt: now,
          onboardingUpdatedByUser: false, // 관리자가 설정한 경우 false
          updatedAt: now,
        },
        select: { id: true, onboarded: true, onboardingUpdatedAt: true },
      }),
    ]);

    logger.log('[Admin Onboarding] 온보딩 상태 업데이트', {
      adminId: admin.id,
      userId,
      tripId,
      onboarded,
      companionType,
    });

    return NextResponse.json({
      ok: true,
      message: '온보딩 상태가 업데이트되었습니다',
      onboarding: {
        userId: updatedUser.id,
        isOnboarded: updatedUser.onboarded,
        onboardingUpdatedAt: updatedUser.onboardingUpdatedAt?.toISOString() ?? null,
        trip: {
          id: updatedTrip.id,
          companionType: updatedTrip.companionType,
          updatedAt: updatedTrip.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('[Admin Onboarding] POST error:', error);
    return NextResponse.json(
      { ok: false, error: '온보딩 상태 설정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
