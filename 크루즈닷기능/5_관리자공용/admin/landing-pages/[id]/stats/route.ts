export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  try {
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Landing Pages Stats] Auth check error:', error);
    return false;
  }
}

// GET: 랜딩페이지 통계 (유입, 이탈율, 전환율)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const landingPageId = parseInt(resolvedParams.id);
    if (isNaN(landingPageId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 랜딩페이지 ID입니다' }, { status: 400 });
    }

    // 랜딩페이지 조회
    const page = await prisma.landingPage.findUnique({
      where: { id: landingPageId },
    });

    if (!page) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // 날짜 범위 설정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);
    const thisYear = new Date(today);
    thisYear.setMonth(0, 1);
    thisYear.setHours(0, 0, 0, 0);

    // 유입 통계 (LandingPageView)
    const [totalViews, viewsToday, viewsThisWeek, viewsThisMonth, viewsThisYear] = await Promise.all([
      prisma.landingPageView.count({
        where: { landingPageId },
      }),
      prisma.landingPageView.count({
        where: {
          landingPageId,
          viewedAt: { gte: today },
        },
      }),
      prisma.landingPageView.count({
        where: {
          landingPageId,
          viewedAt: { gte: thisWeek },
        },
      }),
      prisma.landingPageView.count({
        where: {
          landingPageId,
          viewedAt: { gte: thisMonth },
        },
      }),
      prisma.landingPageView.count({
        where: {
          landingPageId,
          viewedAt: { gte: thisYear },
        },
      }),
    ]);

    // 전환 통계 (LandingPageRegistration)
    const [totalRegistrations, registrationsToday, registrationsThisWeek, registrationsThisMonth, registrationsThisYear] = await Promise.all([
      prisma.landingPageRegistration.count({
        where: {
          landingPageId,
          deletedAt: null,
        },
      }),
      prisma.landingPageRegistration.count({
        where: {
          landingPageId,
          deletedAt: null,
          registeredAt: { gte: today },
        },
      }),
      prisma.landingPageRegistration.count({
        where: {
          landingPageId,
          deletedAt: null,
          registeredAt: { gte: thisWeek },
        },
      }),
      prisma.landingPageRegistration.count({
        where: {
          landingPageId,
          deletedAt: null,
          registeredAt: { gte: thisMonth },
        },
      }),
      prisma.landingPageRegistration.count({
        where: {
          landingPageId,
          deletedAt: null,
          registeredAt: { gte: thisYear },
        },
      }),
    ]);

    // 전환율 계산
    const conversionRate = totalViews > 0 ? (totalRegistrations / totalViews) * 100 : 0;
    const conversionRateToday = viewsToday > 0 ? (registrationsToday / viewsToday) * 100 : 0;
    const conversionRateThisWeek = viewsThisWeek > 0 ? (registrationsThisWeek / viewsThisWeek) * 100 : 0;
    const conversionRateThisMonth = viewsThisMonth > 0 ? (registrationsThisMonth / viewsThisMonth) * 100 : 0;
    const conversionRateThisYear = viewsThisYear > 0 ? (registrationsThisYear / viewsThisYear) * 100 : 0;

    // 이탈율 계산 (유입 - 전환 = 이탈)
    const bounceCount = totalViews - totalRegistrations;
    const bounceRate = totalViews > 0 ? (bounceCount / totalViews) * 100 : 0;
    const bounceCountToday = viewsToday - registrationsToday;
    const bounceRateToday = viewsToday > 0 ? (bounceCountToday / viewsToday) * 100 : 0;
    const bounceCountThisWeek = viewsThisWeek - registrationsThisWeek;
    const bounceRateThisWeek = viewsThisWeek > 0 ? (bounceCountThisWeek / viewsThisWeek) * 100 : 0;
    const bounceCountThisMonth = viewsThisMonth - registrationsThisMonth;
    const bounceRateThisMonth = viewsThisMonth > 0 ? (bounceCountThisMonth / viewsThisMonth) * 100 : 0;
    const bounceCountThisYear = viewsThisYear - registrationsThisYear;
    const bounceRateThisYear = viewsThisYear > 0 ? (bounceCountThisYear / viewsThisYear) * 100 : 0;

    return NextResponse.json({
      ok: true,
      stats: {
        views: {
          total: totalViews,
          today: viewsToday,
          thisWeek: viewsThisWeek,
          thisMonth: viewsThisMonth,
          thisYear: viewsThisYear,
        },
        registrations: {
          total: totalRegistrations,
          today: registrationsToday,
          thisWeek: registrationsThisWeek,
          thisMonth: registrationsThisMonth,
          thisYear: registrationsThisYear,
        },
        conversionRate: {
          total: Math.round(conversionRate * 100) / 100,
          today: Math.round(conversionRateToday * 100) / 100,
          thisWeek: Math.round(conversionRateThisWeek * 100) / 100,
          thisMonth: Math.round(conversionRateThisMonth * 100) / 100,
          thisYear: Math.round(conversionRateThisYear * 100) / 100,
        },
        bounceRate: {
          total: Math.round(bounceRate * 100) / 100,
          today: Math.round(bounceRateToday * 100) / 100,
          thisWeek: Math.round(bounceRateThisWeek * 100) / 100,
          thisMonth: Math.round(bounceRateThisMonth * 100) / 100,
          thisYear: Math.round(bounceRateThisYear * 100) / 100,
        },
      },
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages Stats] Error:', error);
    return NextResponse.json(
      { ok: false, error: '통계 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
