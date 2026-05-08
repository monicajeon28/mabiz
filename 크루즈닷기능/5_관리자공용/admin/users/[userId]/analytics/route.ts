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
  } catch (error) {
    logger.error('[Admin Analytics] Auth check error:', error);
    return false;
  }
}

// 채팅 메시지에서 모드별 검색어 추출
function extractChatModes(messages: any[]): {
  goMode: Array<{ query: string; timestamp: string | null }>;
  showMode: Array<{ query: string; timestamp: string | null }>;
  generalMode: Array<{ query: string; timestamp: string | null }>;
  translateMode: Array<{ query: string; fromLang: string; toLang: string; timestamp: string | null }>;
} {
  const goMode: Array<{ query: string; timestamp: string | null }> = [];
  const showMode: Array<{ query: string; timestamp: string | null }> = [];
  const generalMode: Array<{ query: string; timestamp: string | null }> = [];
  const translateMode: Array<{ query: string; fromLang: string; toLang: string; timestamp: string | null }> = [];

  messages.forEach((msg: any) => {
    if (msg.role === 'user' && msg.text) {
      const text = msg.text;
      const timestamp = msg.timestamp || msg.createdAt || null;

      // "지니야 가자" 모드 감지
      if (text.includes('가자') || text.includes('찾아줘') || text.includes('검색') || msg.mode === 'go') {
        goMode.push({ query: text, timestamp });
      }
      
      // "지니야 보여줘" 모드 감지
      if (text.includes('보여줘') || text.includes('보여') || text.includes('알려줘') || msg.mode === 'show') {
        showMode.push({ query: text, timestamp });
      }
      
      // 번역 모드 감지
      if (text.includes('번역') || text.includes('translate') || msg.mode === 'translate') {
        translateMode.push({ 
          query: text, 
          fromLang: msg.from || 'unknown',
          toLang: msg.to || 'unknown',
          timestamp 
        });
      }
      
      // 일반 모드 (위에 해당하지 않는 경우)
      if (!text.includes('가자') && !text.includes('보여줘') && !text.includes('번역') && !msg.mode) {
        generalMode.push({ query: text, timestamp });
      }
    }
  });

  return { goMode, showMode, generalMode, translateMode };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // 사용자 기본 정보 (동반자 정보 포함)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        tripCount: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // 1. 채팅 히스토리 분석 (모드별 분류)
    const chatHistories = await prisma.chatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    let totalMessages = 0;
    let totalChats = chatHistories.length;
    const allMessages: any[] = [];

    chatHistories.forEach(history => {
      if (history.messages && Array.isArray(history.messages)) {
        allMessages.push(...history.messages);
        totalMessages += history.messages.length;
      }
    });

    const { goMode, showMode, generalMode, translateMode } = extractChatModes(allMessages);

    // 2. 여행 기록 분석 (다이어리 포함)
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: {
        CruiseProduct: {
          select: {
            productCode: true,
            packageName: true,
            cruiseLine: true,
            shipName: true,
          },
        },
        Itinerary: {
          select: {
            location: true,
            country: true,
            date: true,
            type: true,
          },
        },
        TravelDiaryEntry: {
          select: {
            id: true,
            title: true,
            content: true,
            visitDate: true,
            countryCode: true,
            countryName: true,
          },
          orderBy: { visitDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 온보딩 여행 (companionType이 있는 여행)
    const onboardingTrips = trips.filter(trip => trip.companionType);

    // 3. 가계부 사용 분석
    const expenses = await prisma.expense.findMany({
      where: { userId },
      include: {
        Trip: {
          select: {
            id: true,
            cruiseName: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 예산 계산 (가장 큰 지출을 기준으로 추정)
    const totalExpenseKRW = expenses.reduce((sum, e) => sum + (e.krwAmount || 0), 0);
    const estimatedBudget = totalExpenseKRW > 0 ? Math.round(totalExpenseKRW * 1.2) : 0; // 지출의 120%를 예산으로 추정

    const expenseStats = {
      totalExpenses: expenses.length,
      totalAmountKRW: totalExpenseKRW,
      totalAmountUSD: expenses.reduce((sum, e) => sum + (e.usdAmount || 0), 0),
      estimatedBudget,
      categories: {} as Record<string, { count: number; totalKRW: number }>,
      currencies: {} as Record<string, number>,
      locations: {} as Record<string, number>, // 소비 장소별 통계
    };

    expenses.forEach(expense => {
      const category = expense.category || '기타';
      if (!expenseStats.categories[category]) {
        expenseStats.categories[category] = { count: 0, totalKRW: 0 };
      }
      expenseStats.categories[category].count++;
      expenseStats.categories[category].totalKRW += expense.krwAmount || 0;

      const currency = expense.currency || 'KRW';
      expenseStats.currencies[currency] = (expenseStats.currencies[currency] || 0) + 1;

      // 소비 장소 추출 (description에서)
      if (expense.description) {
        const location = expense.description.split(',')[0] || expense.description.split(' ')[0] || '기타';
        expenseStats.locations[location] = (expenseStats.locations[location] || 0) + 1;
      }
    });

    // 4. 체크리스트 사용 분석
    const checklistItems = await prisma.checklistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // 체크한 항목과 새로 추가한 항목 구분
    const completedItems = checklistItems.filter(item => item.completed);
    const customItems = checklistItems.filter(item => item.text && !item.text.includes('기본')); // 기본 항목이 아닌 사용자 추가 항목

    const checklistStats = {
      totalItems: checklistItems.length,
      completedItems: completedItems.length,
      customItems: customItems.length,
      customItemsList: customItems.map(item => ({
        text: item.text,
        completed: item.completed,
        createdAt: item.createdAt.toISOString(),
      })),
      completionRate: checklistItems.length > 0 
        ? Math.round((completedItems.length / checklistItems.length) * 100)
        : 0,
    };

    // 5. 번역기 사용 분석 (국가별)
    const translationStats = {
      totalUsage: translateMode.length,
      byLanguage: {} as Record<string, number>,
      queries: translateMode.map(t => ({
        query: t.query,
        fromLang: t.fromLang,
        toLang: t.toLang,
        timestamp: t.timestamp,
      })),
    };

    translateMode.forEach(t => {
      const key = `${t.fromLang} → ${t.toLang}`;
      translationStats.byLanguage[key] = (translationStats.byLanguage[key] || 0) + 1;
    });

    // 6. 여행 지도 (MapTravelRecord)
    const mapRecords = await prisma.mapTravelRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // 7. 동반자 수정 이력 (Trip의 companionType 변경 추적)
    const companionChanges = trips
      .filter(trip => trip.companionType)
      .map(trip => ({
        tripId: trip.id,
        cruiseName: trip.cruiseName,
        companionType: trip.companionType,
        createdAt: trip.createdAt.toISOString(),
      }));

    // 8. 기능 사용 통계
    const featureUsages = await prisma.featureUsage.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });

    const featureStats: Record<string, { usageCount: number; lastUsedAt: string | null }> = {};
    featureUsages.forEach(fu => {
      featureStats[fu.feature] = {
        usageCount: fu.usageCount,
        lastUsedAt: fu.lastUsedAt ? fu.lastUsedAt.toISOString() : null,
      };
    });

    // 9. 사용자 활동 추적
    const activities = await prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const activityStats: Record<string, number> = {};
    activities.forEach(activity => {
      const action = activity.action || 'unknown';
      activityStats[action] = (activityStats[action] || 0) + 1;
    });

    // 10. 방문 국가 통계
    const visitedCountries = await prisma.visitedCountry.findMany({
      where: { userId },
      orderBy: { visitCount: 'desc' },
    });

    // 종합 분석 데이터
    const analytics = {
      사용자_정보: {
        이름: user.name || '이름 없음',
        전화번호: user.phone || '없음',
        이메일: user.email || '없음',
        가입일: user.createdAt.toISOString(),
        마지막_접속: user.lastActiveAt?.toISOString() || '없음',
        여행_횟수: user.tripCount || 0,
      },
      AI_채팅_사용: {
        총_대화_횟수: totalChats,
        총_메시지_수: totalMessages,
        지니야_가자_검색: {
          총_횟수: goMode.length,
          검색어_목록: goMode.map(m => ({
            검색어: m.query,
            시간: m.timestamp,
          })),
        },
        지니야_보여줘_검색: {
          총_횟수: showMode.length,
          검색어_목록: showMode.map(m => ({
            검색어: m.query,
            시간: m.timestamp,
          })),
        },
        일반_검색: {
          총_횟수: generalMode.length,
          검색어_목록: generalMode.map(m => ({
            검색어: m.query,
            시간: m.timestamp,
          })),
        },
      },
      번역기_사용: {
        총_사용_횟수: translationStats.totalUsage,
        언어별_사용: Object.entries(translationStats.byLanguage).map(([lang, count]) => ({
          언어_쌍: lang,
          사용_횟수: count,
        })),
        번역_질문_목록: translationStats.queries,
      },
      여행_기록: {
        총_여행_수: trips.length,
        온보딩_여행: onboardingTrips.map(trip => ({
          크루즈명: trip.cruiseName || '이름 없음',
          동반자: trip.companionType || '없음',
          출발일: trip.startDate?.toISOString() || null,
          종료일: trip.endDate?.toISOString() || null,
          상품코드: trip.CruiseProduct?.productCode || null,
          패키지명: trip.CruiseProduct?.packageName || null,
        })),
        다이어리_등록_여행: trips
          .filter(trip => trip.TravelDiaryEntry && trip.TravelDiaryEntry.length > 0)
          .map(trip => ({
            크루즈명: trip.cruiseName || '이름 없음',
            다이어리_기록_수: trip.TravelDiaryEntry?.length || 0,
            다이어리_목록: trip.TravelDiaryEntry?.map(entry => ({
              제목: entry.title,
              내용: entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : ''),
              방문일: entry.visitDate.toISOString(),
              국가: entry.countryName,
            })) || [],
          })),
      },
      가계부_사용: {
        총_지출_항목: expenseStats.totalExpenses,
        총_지출_금액_원화: Math.round(expenseStats.totalAmountKRW),
        총_지출_금액_달러: Math.round(expenseStats.totalAmountUSD * 100) / 100,
        추정_예산_원화: estimatedBudget,
        카테고리별_지출: Object.entries(expenseStats.categories).map(([cat, data]) => ({
          카테고리: cat,
          항목_수: data.count,
          총_금액_원화: Math.round(data.totalKRW),
        })),
        소비_장소별_통계: Object.entries(expenseStats.locations).map(([location, count]) => ({
          장소: location,
          항목_수: count,
        })),
        사용한_통화: Object.keys(expenseStats.currencies),
        지출_입력_내역: expenses.map(expense => ({
          설명: expense.description,
          카테고리: expense.category,
          금액_원화: Math.round(expense.krwAmount),
          통화: expense.currency,
          입력일: expense.createdAt.toISOString(),
        })),
      },
      체크리스트_사용: {
        총_항목_수: checklistStats.totalItems,
        완료_항목_수: checklistStats.completedItems,
        사용자_추가_항목_수: checklistStats.customItems,
        사용자_추가_항목_목록: checklistStats.customItemsList,
        완료율_퍼센트: checklistStats.completionRate,
      },
      여행_지도_사용: {
        저장된_여행_수: mapRecords.length,
        저장된_여행_목록: mapRecords.map(record => ({
          크루즈명: record.cruiseName,
          동반자: record.companion,
          목적지: record.destination,
          출발일: record.startDate.toISOString(),
          종료일: record.endDate.toISOString(),
          인상: record.impressions || '없음',
          저장일: record.createdAt.toISOString(),
        })),
      },
      내_정보_수정: {
        동반자_수정_이력: companionChanges,
      },
      기능_사용_통계: featureStats,
      활동_통계: activityStats,
      방문_국가: visitedCountries.map(vc => ({
        국가명: vc.countryName,
        방문_횟수: vc.visitCount,
        마지막_방문일: vc.lastVisited.toISOString(),
      })),
    };

    return NextResponse.json({
      ok: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('[Admin Analytics] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
