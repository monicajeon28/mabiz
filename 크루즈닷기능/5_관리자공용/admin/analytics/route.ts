export const dynamic = 'force-dynamic';

// app/api/admin/analytics/route.ts
// 관리자 데이터 분석 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
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

    if (!session || !session.User) {
      return false;
    }

    return session.User.role === 'admin';
  } catch {
    return false;
  }
}

// 날짜 범위 계산
function calculateStartDate(range: string): Date {
  const now = new Date();
  const startDate = new Date(now);

  switch (range) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  startDate.setHours(0, 0, 0, 0);
  return startDate;
}

// 주 시작일 계산
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// 월 시작일 계산
function getMonthStart(): Date {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
}

export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 401 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('range') || '30d';
    const startDate = calculateStartDate(timeRange);
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. 사용자 통계
    const totalUsers = await prisma.user.count({
      where: { role: 'user' },
    });

    const activeUsers = await prisma.user.count({
      where: {
        role: 'user',
        isHibernated: false,
        isLocked: false,
        lastActiveAt: { gte: startDate },
      },
    });

    const newToday = await prisma.user.count({
      where: {
        role: 'user',
        createdAt: { gte: today },
      },
    });

    const newThisWeek = await prisma.user.count({
      where: {
        role: 'user',
        createdAt: { gte: weekStart },
      },
    });

    const newThisMonth = await prisma.user.count({
      where: {
        role: 'user',
        createdAt: { gte: monthStart },
      },
    });

    const hibernatedUsers = await prisma.user.count({
      where: {
        role: 'user',
        isHibernated: true,
      },
    });

    // 2. 기능 사용 통계
    const featureUsages = await prisma.featureUsage.findMany({
      where: {
        lastUsedAt: { gte: startDate },
        feature: { not: 'page_view' },
      },
    });

    const featureStats = new Map<string, { usageCount: number; activeUsers: Set<number> }>();

    featureUsages.forEach(usage => {
      const existing = featureStats.get(usage.feature) || { usageCount: 0, activeUsers: new Set<number>() };
      existing.usageCount += usage.usageCount || 1;
      if (usage.userId) {
        existing.activeUsers.add(usage.userId);
      }
      featureStats.set(usage.feature, existing);
    });

    const features = Array.from(featureStats.entries()).map(([feature, data]) => ({
      feature,
      usageCount: data.usageCount,
      activeUsers: data.activeUsers.size,
    })).sort((a, b) => b.usageCount - a.usageCount);

    // 3. 여행 통계
    const totalTrips = await prisma.trip.count();

    const tripsThisWeek = await prisma.trip.count({
      where: {
        departureDate: { gte: weekStart },
      },
    });

    const trips = await prisma.trip.findMany({
      where: {
        departureDate: { gte: startDate },
      },
      select: {
        departureDate: true,
        endDate: true,
        Itinerary: {
          select: {
            location: true,
            country: true,
          },
        },
      },
    });

    // 평균 기간 계산
    let totalDays = 0;
    trips.forEach(trip => {
      if (trip.departureDate && trip.endDate) {
        const days = Math.ceil((trip.endDate.getTime() - trip.departureDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += days;
      }
    });
    const avgDuration = trips.length > 0 ? Math.round(totalDays / trips.length) : 0;

    // 목적지 통계
    const destinationCounts = new Map<string, number>();

    trips.forEach(trip => {
      if (trip.Itinerary && Array.isArray(trip.Itinerary)) {
        trip.Itinerary.forEach((itinerary: { location?: string; country?: string }) => {
          const dest = itinerary.location || itinerary.country;
          if (dest) {
            destinationCounts.set(dest, (destinationCounts.get(dest) || 0) + 1);
          }
        });
      }
    });

    // 다이어리 여행지 (MapTravelRecord)
    try {
      const diaryRecords = await prisma.mapTravelRecord.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          destination: true,
        },
      });

      diaryRecords.forEach(record => {
        if (record.destination) {
          destinationCounts.set(record.destination, (destinationCounts.get(record.destination) || 0) + 1);
        }
      });
    } catch {
      // MapTravelRecord 테이블이 없는 경우 무시
    }

    const topDestinations = Array.from(destinationCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 4. 지출 통계
    const expenses = await prisma.expense.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      take: 10000,
    });

    const totalExpenseKRW = expenses.reduce((sum, e) => sum + (e.krwAmount || 0), 0);
    const avgDaily = expenses.length > 0
      ? Math.round(totalExpenseKRW / expenses.length)
      : 0;

    const expenseByCategory = new Map<string, number>();
    expenses.forEach(expense => {
      const category = expense.category || '기타';
      expenseByCategory.set(category, (expenseByCategory.get(category) || 0) + (expense.krwAmount || 0));
    });

    const byCategory: Record<string, number> = {};
    expenseByCategory.forEach((amount, category) => {
      byCategory[category] = amount;
    });

    // 5. 재구매 통계
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

    const firstTripUsers = usersWithTrips.filter(u => u.tripCount === 1).length;
    const secondTripUsers = usersWithTrips.filter(u => u.tripCount === 2).length;
    const thirdTripUsers = usersWithTrips.filter(u => u.tripCount === 3).length;
    const fourthTripUsers = usersWithTrips.filter(u => u.tripCount === 4).length;
    const fifthPlusTripUsers = usersWithTrips.filter(u => u.tripCount >= 5).length;

    const convertedUsers = usersWithTrips.filter(u => u.tripCount >= 2).length;
    const totalPotential = firstTripUsers + convertedUsers;

    const conversionRate = totalPotential > 0
      ? Math.round((convertedUsers / totalPotential) * 100)
      : 0;

    const conversionByTripCount = {
      first: firstTripUsers,
      second: secondTripUsers,
      third: thirdTripUsers,
      fourth: fourthTripUsers,
      fifthPlus: fifthPlusTripUsers,
    };

    const firstToSecondRate = firstTripUsers > 0
      ? Math.round((secondTripUsers / (firstTripUsers + secondTripUsers)) * 100)
      : 0;

    const secondToThirdRate = secondTripUsers > 0
      ? Math.round((thirdTripUsers / (secondTripUsers + thirdTripUsers)) * 100)
      : 0;

    const thirdToFourthRate = thirdTripUsers > 0
      ? Math.round((fourthTripUsers / (thirdTripUsers + fourthTripUsers)) * 100)
      : 0;

    const fourthToFifthRate = fourthTripUsers > 0
      ? Math.round((fifthPlusTripUsers / (fourthTripUsers + fifthPlusTripUsers)) * 100)
      : 0;

    // 6. 추이 데이터 (일별)
    const trendData: Array<{ date: string; newUsers: number; activeUsers: number; newTrips: number }> = [];
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      const newUsers = await prisma.user.count({
        where: {
          role: 'user',
          createdAt: { gte: date, lt: nextDay },
        },
      });

      const dailyActiveUsers = await prisma.user.count({
        where: {
          role: 'user',
          lastActiveAt: { gte: date, lt: nextDay },
        },
      });

      const newTrips = await prisma.trip.count({
        where: {
          departureDate: { gte: date, lt: nextDay },
        },
      });

      trendData.push({
        date: date.toISOString().split('T')[0],
        newUsers,
        activeUsers: dailyActiveUsers,
        newTrips,
      });
    }

    // 7. 전체 평균 데이터 계산
    const allUsers = await prisma.user.findMany({
      where: { role: 'user' },
      select: {
        id: true,
        tripCount: true,
      },
    });

    const avgTripCount = allUsers.length > 0
      ? Math.round((allUsers.reduce((sum, u) => sum + (u.tripCount || 0), 0) / allUsers.length) * 100) / 100
      : 0;

    const allChatHistories = await prisma.chatHistory.findMany({
      take: 1000,
      select: {
        messages: true,
        userId: true,
      },
    });

    let totalChatMessages = 0;
    const userChatCounts = new Map<number, number>();
    allChatHistories.forEach(history => {
      if (history.messages && Array.isArray(history.messages)) {
        const count = history.messages.length;
        totalChatMessages += count;
        userChatCounts.set(history.userId, (userChatCounts.get(history.userId) || 0) + count);
      }
    });

    const avgChatMessagesPerUser = userChatCounts.size > 0
      ? Math.round((totalChatMessages / userChatCounts.size) * 100) / 100
      : 0;

    const allChecklistItems = await prisma.checklistItem.findMany({
      take: 10000,
      select: {
        userId: true,
        completed: true,
      },
    });

    const userChecklistCounts = new Map<number, { total: number; completed: number }>();
    allChecklistItems.forEach(item => {
      const existing = userChecklistCounts.get(item.userId) || { total: 0, completed: 0 };
      existing.total++;
      if (item.completed) existing.completed++;
      userChecklistCounts.set(item.userId, existing);
    });

    const avgChecklistItemsPerUser = userChecklistCounts.size > 0
      ? Math.round((allChecklistItems.length / userChecklistCounts.size) * 100) / 100
      : 0;

    const avgChecklistCompletionRate = userChecklistCounts.size > 0
      ? Math.round((Array.from(userChecklistCounts.values()).reduce((sum, u) => {
          const rate = u.total > 0 ? (u.completed / u.total) * 100 : 0;
          return sum + rate;
        }, 0) / userChecklistCounts.size) * 100) / 100
      : 0;

    const allExpenses = await prisma.expense.findMany({
      take: 10000,
      select: {
        userId: true,
        krwAmount: true,
      },
    });

    const userExpenseCounts = new Map<number, { count: number; totalKRW: number }>();
    allExpenses.forEach(expense => {
      const existing = userExpenseCounts.get(expense.userId) || { count: 0, totalKRW: 0 };
      existing.count++;
      existing.totalKRW += expense.krwAmount || 0;
      userExpenseCounts.set(expense.userId, existing);
    });

    const avgExpensesPerUser = userExpenseCounts.size > 0
      ? Math.round((allExpenses.length / userExpenseCounts.size) * 100) / 100
      : 0;

    const avgExpenseAmountPerUser = userExpenseCounts.size > 0
      ? Math.round(Array.from(userExpenseCounts.values()).reduce((sum, u) => sum + u.totalKRW, 0) / userExpenseCounts.size)
      : 0;

    const allActivities = await prisma.userActivity.findMany({
      where: {
        action: { contains: 'translation' },
      },
      take: 1000,
      select: {
        userId: true,
      },
    });

    const translationUserCounts = new Set<number>();
    allActivities.forEach(activity => {
      translationUserCounts.add(activity.userId);
    });

    const avgTranslationUsageRate = allUsers.length > 0
      ? Math.round((translationUserCounts.size / allUsers.length) * 100)
      : 0;

    const allFeatureUsages = await prisma.featureUsage.findMany({
      take: 10000,
      select: {
        userId: true,
        feature: true,
        usageCount: true,
      },
    });

    const featureUsageByUser = new Map<number, number>();
    allFeatureUsages.forEach(fu => {
      featureUsageByUser.set(fu.userId, (featureUsageByUser.get(fu.userId) || 0) + (fu.usageCount || 1));
    });

    const avgFeatureUsagePerUser = featureUsageByUser.size > 0
      ? Math.round((Array.from(featureUsageByUser.values()).reduce((sum, count) => sum + count, 0) / featureUsageByUser.size) * 100) / 100
      : 0;

    return NextResponse.json({
      ok: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newToday,
          newThisWeek,
          newThisMonth,
          hibernated: hibernatedUsers,
        },
        features,
        trips: {
          total: totalTrips,
          thisWeek: tripsThisWeek,
          avgDuration,
          topDestinations,
          source: 'onboarding_and_diary',
        },
        expenses: {
          totalKRW: totalExpenseKRW,
          avgDaily,
          byCategory,
        },
        rePurchase: {
          conversionRate,
          pending: firstTripUsers,
          converted: convertedUsers,
          total: totalPotential,
          byTripCount: conversionByTripCount,
          conversionRates: {
            firstToSecond: firstToSecondRate,
            secondToThird: secondToThirdRate,
            thirdToFourth: thirdToFourthRate,
            fourthToFifth: fourthToFifthRate,
          },
        },
        averages: {
          avgTripCountPerUser: avgTripCount,
          avgChatMessagesPerUser,
          avgChecklistItemsPerUser,
          avgChecklistCompletionRate,
          avgExpensesPerUser,
          avgExpenseAmountPerUser,
          avgTranslationUsageRate,
          avgFeatureUsagePerUser,
        },
      },
      trends: trendData,
    });
  } catch (error) {
    logger.error('[Admin Analytics API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
