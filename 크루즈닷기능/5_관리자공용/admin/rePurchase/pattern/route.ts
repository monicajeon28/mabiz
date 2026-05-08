export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      console.log('[Admin RePurchase Pattern] No session cookie found');
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {
      console.log('[Admin RePurchase Pattern] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {
      console.log('[Admin RePurchase Pattern] User is not admin:', session.User.role);
      return null;
    }

    console.log('[Admin RePurchase Pattern] Admin authenticated:', session.User.id);
    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Admin RePurchase Pattern] Auth check error:', error);
    return null;
  }
}

// GET: tripCount 기반 재구매 패턴 분석
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // tripCount >= 1인 모든 사용자 조회
    const usersWithTrips = await prisma.user.findMany({
      where: {
        role: 'user',
        tripCount: { gte: 1 },
      },
      select: {
        id: true,
        tripCount: true,
      },
    });

    // tripCount별 분류
    const firstTripUsers = usersWithTrips.filter(u => u.tripCount === 1).length; // 전환 대기
    const secondTripUsers = usersWithTrips.filter(u => u.tripCount === 2).length;
    const thirdTripUsers = usersWithTrips.filter(u => u.tripCount === 3).length;
    const fourthTripUsers = usersWithTrips.filter(u => u.tripCount === 4).length;
    const fifthPlusTripUsers = usersWithTrips.filter(u => u.tripCount >= 5).length;

    const convertedUsers = usersWithTrips.filter(u => u.tripCount >= 2).length; // 전환 완료 (2회 이상)
    const totalPotential = usersWithTrips.length; // 전체 잠재 고객

    const conversionRate = totalPotential > 0
      ? (convertedUsers / totalPotential) * 100
      : 0;

    // tripCount별 분포
    const byTripCount = {
      first: firstTripUsers,
      second: secondTripUsers,
      third: thirdTripUsers,
      fourth: fourthTripUsers,
      fifthPlus: fifthPlusTripUsers,
    };

    // 단계별 전환율 계산
    // 1회 -> 2회 전환율: 1회 고객 중 2회로 전환한 비율
    const firstToSecondRate = firstTripUsers > 0
      ? (secondTripUsers / (firstTripUsers + secondTripUsers)) * 100
      : 0;

    // 2회 -> 3회 전환율: 2회 고객 중 3회로 전환한 비율
    const secondToThirdRate = secondTripUsers > 0
      ? (thirdTripUsers / (secondTripUsers + thirdTripUsers)) * 100
      : 0;

    // 3회 -> 4회 전환율: 3회 고객 중 4회로 전환한 비율
    const thirdToFourthRate = thirdTripUsers > 0
      ? (fourthTripUsers / (thirdTripUsers + fourthTripUsers)) * 100
      : 0;

    // 4회 -> 5회 이상 전환율: 4회 고객 중 5회 이상으로 전환한 비율
    const fourthToFifthRate = fourthTripUsers > 0
      ? (fifthPlusTripUsers / (fourthTripUsers + fifthPlusTripUsers)) * 100
      : 0;

    const stats = {
      total: totalPotential,
      pending: firstTripUsers, // 전환 대기 (첫 번째 여행)
      converted: convertedUsers, // 전환 완료 (2회 이상)
      conversionRate,
      byTripCount,
      conversionRates: {
        firstToSecond: firstToSecondRate,
        secondToThird: secondToThirdRate,
        thirdToFourth: thirdToFourthRate,
        fourthToFifth: fourthToFifthRate,
      },
    };

    return NextResponse.json({
      ok: true,
      stats,
    });
  } catch (error) {
    console.error('[Admin RePurchase Pattern] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch re-purchase pattern' },
      { status: 500 }
    );
  }
}
