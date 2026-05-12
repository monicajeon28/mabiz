// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 여행 종료 1일 후 계정을 자동으로 잠금하는 Cron Job
 * 
 * 실행 조건:
 * - currentTripEndDate가 1일 이전인 사용자
 * - 비밀번호가 3800인 사용자 (이미 변경된 경우 제외)
 * 
 * 작업:
 * - 계정 상태를 잠금으로 변경 (isLocked: true)
 * - 비밀번호를 8300으로 변경
 * - PasswordEvent 기록
 * - currentTripEndDate를 null로 설정
 * - onboarded를 false로 설정 (다음 여행 준비)
 */
export async function POST(req: Request) {
  try {
    // 보안: Cron 비밀 키 확인 (환경 변수로 설정)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
    }

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    // 1일 전 날짜 계산
    const oneDayAgo = new Date(todayUTC);
    oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1);

    // 여행 종료 1일 후인 사용자 찾기
    const expiredUsers = await prisma.user.findMany({
      where: {
        currentTripEndDate: {
          lte: oneDayAgo, // 1일 이전
        },
        password: '3800', // 아직 변경되지 않은 사용자만
        isLocked: false, // 이미 잠금된 사용자는 제외
      },
      select: { id: true, name: true, currentTripEndDate: true, password: true },
    });

    if (expiredUsers.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: '변경할 사용자가 없습니다.',
        count: 0 
      });
    }

    // 각 사용자의 계정 잠금 및 비밀번호 변경
    const results = [];
    for (const user of expiredUsers) {
      // 비밀번호 이벤트 기록
      await prisma.passwordEvent.create({
        data: {
          userId: user.id,
          from: user.password,
          to: '8300',
          reason: '여행 종료 1일 후 자동 잠금',
        },
      });

      // 사용자 정보 업데이트 (계정 잠금 + 비밀번호 변경)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isLocked: true, // 계정 잠금
          lockedAt: new Date(),
          lockedReason: '여행 종료 1일 후 자동 잠금',
          password: '8300', // 비밀번호를 8300으로 변경하여 로그인 불가능하게 함
          currentTripEndDate: null,
          onboarded: false, // 다음 여행을 위해 리셋
          loginCount: 0, // 로그인 카운트 초기화
        },
      });

      results.push({
        userId: user.id,
        name: user.name,
        endDate: user.currentTripEndDate,
      });
    }

    return NextResponse.json({ 
      ok: true, 
      message: `${expiredUsers.length}명의 계정을 잠금 처리했습니다.`,
      count: expiredUsers.length,
      users: results,
    });
  } catch (e) {
    logger.error('EXPIRE_TRIPS_ERROR', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * GET 메서드: 테스트용 (실제 운영에서는 제거 권장)
 */
export async function GET(req: Request) {
  try {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const oneDayAgo = new Date(todayUTC);
    oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1);

    // 변경 대상 사용자 조회 (변경하지 않고 조회만)
    const expiredUsers = await prisma.user.findMany({
      where: {
        currentTripEndDate: {
          lte: oneDayAgo,
        },
        password: '3800',
        isLocked: false, // 이미 잠금된 사용자는 제외
      },
      select: { 
        id: true, 
        name: true, 
        phone: true,
        currentTripEndDate: true, 
        password: true,
        tripCount: true,
        isLocked: true,
      },
    });

    return NextResponse.json({ 
      ok: true, 
      message: `${expiredUsers.length}명의 사용자가 계정 잠금 대상입니다.`,
      count: expiredUsers.length,
      users: expiredUsers,
      oneDayAgo: oneDayAgo.toISOString(),
    });
  } catch (e) {
    logger.error('EXPIRE_TRIPS_CHECK_ERROR', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

