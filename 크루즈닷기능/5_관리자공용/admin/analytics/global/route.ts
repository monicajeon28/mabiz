export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });
    return session?.User.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    // 전체 사용자 수
    const totalUsers = await prisma.user.count({
      where: { role: 'user' },
    });

    // 활성 사용자 수
    const activeUsers = await prisma.user.count({
      where: {
        role: 'user',
        isHibernated: false,
        isLocked: false,
      },
    });

    // 전체 여행 수
    const totalTrips = await prisma.trip.count();

    // 전체 채팅 히스토리 수
    const totalChatHistories = await prisma.chatHistory.count();

    // 전체 메시지 수 (추정)
    const chatHistories = await prisma.chatHistory.findMany({
      select: { messages: true },
      take: 1000,
    });

    let sampleMessageCount = 0;
    chatHistories.forEach(ch => {
      if (Array.isArray(ch.messages)) {
        sampleMessageCount += ch.messages.length;
      }
    });

    const avgMessagesPerChat = chatHistories.length > 0
      ? Math.round(sampleMessageCount / chatHistories.length)
      : 0;
    const estimatedTotalMessages = totalChatHistories * avgMessagesPerChat;

    // 전체 지출 통계
    const expenses = await prisma.expense.findMany({
      take: 10000,
    });

    const totalExpenses = await prisma.expense.count();
    const totalExpenseKRW = expenses.reduce((sum, e) => sum + (e.krwAmount || 0), 0);
    const avgExpensePerUser = activeUsers > 0
      ? Math.round(totalExpenseKRW / activeUsers)
      : 0;

    // 체크리스트 통계
    const checklistItems = await prisma.checklistItem.findMany({
      take: 5000,
    });
    const totalChecklistItems = await prisma.checklistItem.count();
    const completedItems = checklistItems.filter(item => item.completed).length;
    const avgCompletionRate = checklistItems.length > 0
      ? Math.round((completedItems / checklistItems.length) * 100)
      : 0;

    // 기능 사용 통계 (page_view 제외)
    const featureUsages = await prisma.featureUsage.findMany({
      where: {
        feature: { not: 'page_view' },
      },
    });
    const featureStats: Record<string, { totalUsage: number; avgUsagePerUser: number; userCount: number }> = {};

    featureUsages.forEach(fu => {
      if (!featureStats[fu.feature]) {
        featureStats[fu.feature] = {
          totalUsage: 0,
          avgUsagePerUser: 0,
          userCount: 0,
        };
      }
      featureStats[fu.feature].totalUsage += fu.usageCount;
      featureStats[fu.feature].userCount++;
    });

    Object.keys(featureStats).forEach(feature => {
      const stats = featureStats[feature];
      stats.avgUsagePerUser = stats.userCount > 0
        ? Math.round(stats.totalUsage / stats.userCount)
        : 0;
    });

    // 방문 국가 통계
    const visitedCountries = await prisma.visitedCountry.findMany();
    const countryStats: Record<string, number> = {};
    visitedCountries.forEach(vc => {
      countryStats[vc.countryName] = (countryStats[vc.countryName] || 0) + vc.visitCount;
    });

    const topCountries = Object.entries(countryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ 국가명: country, 방문_횟수: count }));

    const averages = {
      사용자당_평균_여행_수: activeUsers > 0 ? Math.round((totalTrips / activeUsers) * 10) / 10 : 0,
      사용자당_평균_대화_수: activeUsers > 0 ? Math.round((totalChatHistories / activeUsers) * 10) / 10 : 0,
      사용자당_평균_메시지_수: activeUsers > 0 ? Math.round((estimatedTotalMessages / activeUsers) * 10) / 10 : 0,
      사용자당_평균_지출_금액_원화: avgExpensePerUser,
      사용자당_평균_체크리스트_항목_수: activeUsers > 0 ? Math.round((totalChecklistItems / activeUsers) * 10) / 10 : 0,
      평균_체크리스트_완료율_퍼센트: avgCompletionRate,
    };

    const summary = {
      전체_통계: {
        총_사용자_수: totalUsers,
        활성_사용자_수: activeUsers,
        총_여행_수: totalTrips,
        총_대화_수: totalChatHistories,
        추정_총_메시지_수: estimatedTotalMessages,
        총_지출_항목_수: totalExpenses,
        총_지출_금액_원화: Math.round(totalExpenseKRW),
        총_체크리스트_항목_수: totalChecklistItems,
      },
      평균_통계: averages,
      기능_사용_통계: Object.entries(featureStats).map(([feature, stats]) => ({
        기능명: feature,
        총_사용_횟수: stats.totalUsage,
        사용한_사용자_수: stats.userCount,
        사용자당_평균_사용_횟수: stats.avgUsagePerUser,
      })),
      인기_방문_국가: topCountries,
    };

    return NextResponse.json({
      ok: true,
      data: summary,
    });
  } catch (error) {
    logger.error('[Admin Global Analytics] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch global analytics' },
      { status: 500 }
    );
  }
}
