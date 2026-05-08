export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    console.log('[PWA Stats] No session ID');
    return false;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session) {
      console.log('[PWA Stats] Session not found:', sid?.substring(0, 10) + '...');
      return false;
    }

    if (!session.User) {
      console.log('[PWA Stats] User not found in session:', { sessionId: session.id, userId: session.userId });
      return false;
    }

    const isAdmin = session.User.role === 'admin';
    console.log('[PWA Stats] Auth check:', { userId: session.userId, role: session.User.role, isAdmin });
    return isAdmin;
  } catch (error: any) {
    console.error('[PWA Stats] Auth check error:', error);
    console.error('[PWA Stats] Auth check error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return false;
  }
}

export async function GET() {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      console.log('[PWA Stats] No session cookie found');
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'No session cookie'
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      console.log('[PWA Stats] Admin check failed for session:', sid);
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin check failed'
      }, { status: 403 });
    }

    // PWA 설치 통계 계산 (필드가 없을 수 있으므로 안전하게 처리)
    let genieCount = 0;
    let mallCount = 0;
    let bothCount = 0;
    let recentInstalls: any[] = [];
    
    try {
      // 먼저 필드 존재 여부 확인을 위해 스키마 체크
      const userSample = await prisma.user.findFirst({
        select: {
          id: true,
        },
      });

      if (userSample) {
        // 필드가 존재하는 경우에만 쿼리 실행
        try {
          genieCount = await prisma.user.count({
            where: { pwaGenieInstalledAt: { not: null } },
          });
        } catch (e: any) {
          if (e.code === 'P2001' || e.message?.includes('no such column') || e.message?.includes('Unknown column')) {
            console.log('[PWA Stats] pwaGenieInstalledAt field not found, using default value 0');
            genieCount = 0;
          } else {
            throw e;
          }
        }

        try {
          mallCount = await prisma.user.count({
            where: { pwaMallInstalledAt: { not: null } },
          });
        } catch (e: any) {
          if (e.code === 'P2001' || e.message?.includes('no such column') || e.message?.includes('Unknown column')) {
            console.log('[PWA Stats] pwaMallInstalledAt field not found, using default value 0');
            mallCount = 0;
          } else {
            throw e;
          }
        }

        try {
          bothCount = await prisma.user.count({
            where: {
              pwaGenieInstalledAt: { not: null },
              pwaMallInstalledAt: { not: null },
            },
          });
        } catch (e: any) {
          if (e.code === 'P2001' || e.message?.includes('no such column') || e.message?.includes('Unknown column')) {
            console.log('[PWA Stats] PWA fields not found, using default value 0');
            bothCount = 0;
          } else {
            throw e;
          }
        }

        // 최근 설치 고객 (최근 20명)
        try {
          recentInstalls = await prisma.user.findMany({
            where: {
              OR: [
                { pwaGenieInstalledAt: { not: null } },
                { pwaMallInstalledAt: { not: null } },
              ],
            },
            select: {
              id: true,
              name: true,
              email: true,
              pwaGenieInstalledAt: true,
              pwaMallInstalledAt: true,
              createdAt: true,
            },
            orderBy: [
              { pwaGenieInstalledAt: 'desc' },
              { pwaMallInstalledAt: 'desc' },
            ],
            take: 20,
          });
        } catch (e: any) {
          if (e.code === 'P2001' || e.message?.includes('no such column') || e.message?.includes('Unknown column')) {
            console.log('[PWA Stats] PWA fields not found, using empty array');
            recentInstalls = [];
          } else {
            throw e;
          }
        }
      }
    } catch (statsError: any) {
      console.error('[PWA Stats] Statistics query error:', statsError);
      // 필드가 없는 경우는 정상적인 상황이므로 계속 진행
      if (!statsError?.message?.includes('no such column') && !statsError?.message?.includes('Unknown column')) {
        throw statsError;
      }
    }

    const totalCount = genieCount + mallCount - bothCount;

    // 최근 7일 일별 설치 통계
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // 일별 지니 설치 수
    let dailyGenie: Array<{ date: string; count: number }> = [];
    let dailyMall: Array<{ date: string; count: number }> = [];
    
    try {
      const dailyGenieRaw = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE(pwaGenieInstalledAt) as date,
          COUNT(*) as count
        FROM User
        WHERE pwaGenieInstalledAt IS NOT NULL
          AND pwaGenieInstalledAt >= ${sevenDaysAgo}
        GROUP BY DATE(pwaGenieInstalledAt)
        ORDER BY date ASC
      `;

      dailyGenie = dailyGenieRaw.map((d: { date: string; count: bigint }) => ({
        date: d.date,
        count: Number(d.count),
      }));
    } catch (dailyGenieError: any) {
      // 필드가 없거나 쿼리 에러인 경우
      console.log('[PWA Stats] Daily Genie query skipped:', dailyGenieError?.message);
      dailyGenie = [];
    }

    // 일별 몰 설치 수
    try {
      const dailyMallRaw = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE(pwaMallInstalledAt) as date,
          COUNT(*) as count
        FROM User
        WHERE pwaMallInstalledAt IS NOT NULL
          AND pwaMallInstalledAt >= ${sevenDaysAgo}
        GROUP BY DATE(pwaMallInstalledAt)
        ORDER BY date ASC
      `;

      dailyMall = dailyMallRaw.map((d: { date: string; count: bigint }) => ({
        date: d.date,
        count: Number(d.count),
      }));
    } catch (dailyMallError: any) {
      // 필드가 없거나 쿼리 에러인 경우
      console.log('[PWA Stats] Daily Mall query skipped:', dailyMallError?.message);
      dailyMall = [];
    }

    // 일별 통합 데이터 생성
    const dailyStats: Array<{ date: string; genie: number; mall: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      const genieCount = dailyGenie.find(d => d.date === dateStr)?.count || 0;
      const mallCount = dailyMall.find(d => d.date === dateStr)?.count || 0;
      
      dailyStats.push({
        date: dateStr,
        genie: genieCount,
        mall: mallCount,
      });
    }

    return NextResponse.json({
      ok: true,
      stats: {
        summary: {
          genie: genieCount,
          mall: mallCount,
          both: bothCount,
          total: totalCount,
        },
        recentInstalls,
        dailyStats,
      },
    });
  } catch (error: any) {
    console.error('[PWA Stats API] Error:', error);
    console.error('[PWA Stats API] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        ok: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
