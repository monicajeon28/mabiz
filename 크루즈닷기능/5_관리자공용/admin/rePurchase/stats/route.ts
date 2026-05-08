export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { calculateConversionRate } from '@/lib/rePurchase/trigger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      console.log('[Admin RePurchase Stats] No session cookie found');
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {  // ✅ 대문자 U로 변경
      console.log('[Admin RePurchase Stats] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {  // ✅ 대문자 U로 변경
      console.log('[Admin RePurchase Stats] User is not admin:', session.User.role);  // ✅ 대문자 U로 변경
      return null;
    }

    console.log('[Admin RePurchase Stats] Admin authenticated:', session.User.id);  // ✅ 대문자 U로 변경
    return {
      id: session.User.id,  // ✅ 대문자 U로 변경
      name: session.User.name,  // ✅ 대문자 U로 변경
      role: session.User.role,  // ✅ 대문자 U로 변경
    };
  } catch (error) {
    console.error('[Admin RePurchase Stats] Auth check error:', error);
    return null;
  }
}

// GET: 재구매 전환 통계
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const timeRange = (searchParams.get('range') || 'all') as '7d' | '30d' | '90d' | 'all';

    const stats = await calculateConversionRate(timeRange);

    // 일별 추이 데이터
    const now = new Date();
    const startDate = timeRange === 'all' 
      ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 최대 90일
      : timeRange === '7d'
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : timeRange === '30d'
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const triggers = await prisma.rePurchaseTrigger.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        converted: true,
        triggerType: true,
      },
    });

    // 일별 그룹화
    const dailyStats: Record<string, { total: number; converted: number }> = {};
    triggers.forEach((trigger) => {
      const date = new Date(trigger.createdAt).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, converted: 0 };
      }
      dailyStats[date].total++;
      if (trigger.converted) {
        dailyStats[date].converted++;
      }
    });

    const trends = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        converted: stats.converted,
        conversionRate: stats.total > 0 ? (stats.converted / stats.total) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      ok: true,
      stats,
      trends,
    });
  } catch (error) {
    console.error('[Admin RePurchase Stats] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
