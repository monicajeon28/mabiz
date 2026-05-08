export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 관리자가 사용자의 새 여행을 시작
 * - 비밀번호를 3800으로 초기화
 * - tripCount 증가
 * - currentTripEndDate 설정
 * - onboarded를 false로 설정 (새 여행이므로 온보딩 다시)
 */
export async function POST(req: Request) {
  try {
    // 관리자 인증 확인
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        expiresAt: true,
        User: {
          select: {
            id: true,
            role: true,
            name: true,
          }
        }
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 🔒 세션 만료 검증
    if (session.expiresAt && session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
      return NextResponse.json({ ok: false, error: '세션이 만료되었습니다.' }, { status: 401 });
    }

    const { userId, endDate } = await req.json();

    if (!userId || !endDate) {
      return NextResponse.json({ 
        ok: false, 
        error: 'userId와 endDate가 필요합니다.' 
      }, { status: 400 });
    }

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, tripCount: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 비밀번호 이벤트 기록
    if (user.password !== '3800') {
      await prisma.passwordEvent.create({
        data: {
          userId: user.id,
          from: user.password,
          to: '3800',
          reason: '새 여행 시작 (관리자)',
        },
      });
    }

    // 사용자 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: '3800',
        tripCount: { increment: 1 },
        currentTripEndDate: new Date(endDate),
        onboarded: false, // 새 여행이므로 온보딩 다시
        loginCount: 0, // 로그인 카운트 초기화
      },
      select: { id: true, tripCount: true, currentTripEndDate: true },
    });

    return NextResponse.json({ 
      ok: true, 
      user: updatedUser,
      message: `${updatedUser.tripCount}번째 여행이 시작되었습니다.`,
    });
  } catch (e) {
    console.error('START_TRIP_ERROR', e);
    return NextResponse.json({ ok: false, error: '여행 시작 실패' }, { status: 500 });
  }
}
