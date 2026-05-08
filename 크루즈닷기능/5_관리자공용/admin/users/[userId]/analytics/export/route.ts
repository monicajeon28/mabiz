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
        User: {  // ✅ 대문자 U로 변경
          select: { role: true },
        },
      },
    });
    return session?.User.role === 'admin';  // ✅ 대문자 U로 변경
  } catch (error) {
    logger.error('[Admin Analytics Export] Auth check error:', error);
    return false;
  }
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

    const format = req.nextUrl.searchParams.get('format') || 'json'; // 'json' or 'csv'

    // 사용자 기본 정보
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

    // 채팅 히스토리 (요약)
    const chatHistories = await prisma.chatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // 최근 50개만 (효율성)
    });

    const chatSummary = chatHistories.map(ch => ({
      날짜: ch.createdAt.toISOString().split('T')[0],
      대화_수: Array.isArray(ch.messages) ? ch.messages.length : 0,
    }));

    // 여행 기록
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: {
        itineraries: {
          select: {
            location: true,
            country: true,
            date: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const tripsSummary = trips.map(trip => ({
      크루즈명: trip.cruiseName || '이름 없음',
      출발일: trip.startDate?.toISOString().split('T')[0] || '',
      종료일: trip.endDate?.toISOString().split('T')[0] || '',
      방문_지역: trip.itineraries?.map(i => i.location).filter(Boolean).join(', ') || '',
    }));

    // 가계부 요약
    const expenses = await prisma.expense.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100, // 최근 100개만
    });

    const expensesSummary = expenses.map(exp => ({
      날짜: exp.createdAt.toISOString().split('T')[0],
      카테고리: exp.category || '기타',
      금액_원화: Math.round(exp.krwAmount || 0),
      통화: exp.currency || 'KRW',
    }));

    // 체크리스트 요약
    const checklistItems = await prisma.checklistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // 최근 50개만
    });

    const checklistSummary = checklistItems.map(item => ({
      항목: item.text || '',
      완료: item.completed ? '완료' : '미완료',
      날짜: item.createdAt.toISOString().split('T')[0],
    }));

    // 방문 국가
    const visitedCountries = await prisma.visitedCountry.findMany({
      where: { userId },
      orderBy: { visitCount: 'desc' },
    });

    const countriesSummary = visitedCountries.map(vc => ({
      국가명: vc.countryName,
      방문_횟수: vc.visitCount,
      마지막_방문일: vc.lastVisited.toISOString().split('T')[0],
    }));

    // 기능 사용 통계
    const featureUsages = await prisma.featureUsage.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });

    const featuresSummary = featureUsages.map(fu => ({
      기능명: fu.feature,
      사용_횟수: fu.usageCount,
      마지막_사용일: fu.lastUsedAt?.toISOString().split('T')[0] || '',
    }));

    // 데이터 요약
    const exportData = {
      사용자_정보: {
        이름: user.name || '이름 없음',
        전화번호: user.phone || '없음',
        이메일: user.email || '없음',
        가입일: user.createdAt.toISOString().split('T')[0],
        마지막_접속: user.lastActiveAt?.toISOString().split('T')[0] || '없음',
        여행_횟수: user.tripCount || 0,
      },
      AI_채팅_요약: {
        총_대화_수: chatHistories.length,
        최근_대화_기록: chatSummary,
      },
      여행_기록: tripsSummary,
      가계부_요약: {
        총_지출_항목: expenses.length,
        최근_지출_내역: expensesSummary,
      },
      체크리스트_요약: {
        총_항목_수: checklistItems.length,
        완료_항목_수: checklistItems.filter(item => item.completed).length,
        최근_항목: checklistSummary,
      },
      방문_국가: countriesSummary,
      기능_사용: featuresSummary,
    };

    if (format === 'csv') {
      // CSV 형식으로 변환
      let csv = '';

      // 사용자 정보
      csv += '=== 사용자 정보 ===\n';
      csv += '항목,값\n';
      Object.entries(exportData.사용자_정보).forEach(([key, value]) => {
        csv += `${key},${value}\n`;
      });

      csv += '\n=== AI 채팅 요약 ===\n';
      csv += '날짜,대화_수\n';
      exportData.AI_채팅_요약.최근_대화_기록.forEach(item => {
        csv += `${item.날짜},${item.대화_수}\n`;
      });

      csv += '\n=== 여행 기록 ===\n';
      csv += '크루즈명,출발일,종료일,방문_지역\n';
      exportData.여행_기록.forEach(trip => {
        csv += `${trip.크루즈명},${trip.출발일},${trip.종료일},"${trip.방문_지역}"\n`;
      });

      csv += '\n=== 가계부 요약 ===\n';
      csv += '날짜,카테고리,금액_원화,통화\n';
      exportData.가계부_요약.최근_지출_내역.forEach(exp => {
        csv += `${exp.날짜},${exp.카테고리},${exp.금액_원화},${exp.통화}\n`;
      });

      csv += '\n=== 방문 국가 ===\n';
      csv += '국가명,방문_횟수,마지막_방문일\n';
      exportData.방문_국가.forEach(country => {
        csv += `${country.국가명},${country.방문_횟수},${country.마지막_방문일}\n`;
      });

      csv += '\n=== 기능 사용 ===\n';
      csv += '기능명,사용_횟수,마지막_사용일\n';
      exportData.기능_사용.forEach(feature => {
        csv += `${feature.기능명},${feature.사용_횟수},${feature.마지막_사용일}\n`;
      });

      const fileName = `고객_${user.name || user.id}_사용데이터_${new Date().toISOString().split('T')[0]}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        },
      });
    } else {
      // JSON 형식
      const fileName = `고객_${user.name || user.id}_사용데이터_${new Date().toISOString().split('T')[0]}.json`;

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        },
      });
    }
  } catch (error) {
    logger.error('[Admin Analytics Export] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}
