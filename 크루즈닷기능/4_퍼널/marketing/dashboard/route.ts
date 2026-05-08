export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    console.log('[Marketing Dashboard] No session ID');
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
      console.log('[Marketing Dashboard] Session not found:', sid?.substring(0, 10) + '...');
      return false;
    }

    if (!session.User) {
      console.log('[Marketing Dashboard] User not found in session:', { sessionId: session.id, userId: session.userId });
      return false;
    }

    const isAdmin = session.User.role === 'admin';
    console.log('[Marketing Dashboard] Auth check:', { userId: session.userId, role: session.User.role, isAdmin });
    return isAdmin;
  } catch (error: any) {
    console.error('[Marketing Dashboard] Auth check error:', error);
    console.error('[Marketing Dashboard] Auth check error details:', {
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
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    // 모든 랜딩페이지 조회 (마케팅 관련 여부와 관계없이 전체 조회)
    let marketingPages: any[] = [];
    try {
      marketingPages = await prisma.landingPage.findMany({
        where: {
          // 모든 랜딩페이지 조회 (필터링 제거)
        },
        include: {
          LandingPageView: {
            select: {
              id: true,
              viewedAt: true,
            },
          },
          LandingPageRegistration: {
            select: {
              id: true,
              registeredAt: true,
            },
          },
        },
      });
    } catch (queryError: any) {
      console.error('[Marketing Dashboard] Landing pages query error:', queryError);
      console.error('[Marketing Dashboard] Error details:', {
        message: queryError?.message,
        code: queryError?.code,
        meta: queryError?.meta,
        stack: queryError?.stack,
      });
      // 에러 발생 시 빈 배열로 계속 진행
      marketingPages = [];
    }

    // 날짜 범위 설정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    // 전체 통계
    const totalPages = marketingPages.length;
    const activePages = marketingPages.filter(p => p.isActive).length;

    // 전체 유입 및 전환 통계
    let totalViews = 0;
    let totalViewsToday = 0;
    let totalViewsThisWeek = 0;
    let totalViewsThisMonth = 0;
    let totalRegistrations = 0;
    let totalRegistrationsToday = 0;
    let totalRegistrationsThisWeek = 0;
    let totalRegistrationsThisMonth = 0;

    // 랜딩페이지별 통계
    const pageStats = marketingPages.map(page => {
      const views = page.LandingPageView || [];
      const registrations = page.LandingPageRegistration || [];

      const viewsToday = views.filter(v => {
        const viewDate = new Date(v.viewedAt);
        return viewDate >= today;
      }).length;

      const viewsThisWeek = views.filter(v => {
        const viewDate = new Date(v.viewedAt);
        return viewDate >= thisWeek;
      }).length;

      const viewsThisMonth = views.filter(v => {
        const viewDate = new Date(v.viewedAt);
        return viewDate >= thisMonth;
      }).length;

      const registrationsToday = registrations.filter(r => {
        const regDate = new Date(r.registeredAt);
        return regDate >= today;
      }).length;

      const registrationsThisWeek = registrations.filter(r => {
        const regDate = new Date(r.registeredAt);
        return regDate >= thisWeek;
      }).length;

      const registrationsThisMonth = registrations.filter(r => {
        const regDate = new Date(r.registeredAt);
        return regDate >= thisMonth;
      }).length;

      const totalPageViews = views.length;
      const totalPageRegistrations = registrations.length;
      const conversionRate = totalPageViews > 0 
        ? (totalPageRegistrations / totalPageViews) * 100 
        : 0;

      // 전체 통계에 합산
      totalViews += totalPageViews;
      totalViewsToday += viewsToday;
      totalViewsThisWeek += viewsThisWeek;
      totalViewsThisMonth += viewsThisMonth;
      totalRegistrations += totalPageRegistrations;
      totalRegistrationsToday += registrationsToday;
      totalRegistrationsThisWeek += registrationsThisWeek;
      totalRegistrationsThisMonth += registrationsThisMonth;

      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        isActive: page.isActive,
        category: page.category,
        pageGroup: page.pageGroup,
        views: {
          total: totalPageViews,
          today: viewsToday,
          thisWeek: viewsThisWeek,
          thisMonth: viewsThisMonth,
        },
        registrations: {
          total: totalPageRegistrations,
          today: registrationsToday,
          thisWeek: registrationsThisWeek,
          thisMonth: registrationsThisMonth,
        },
        conversionRate: conversionRate,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt ? page.updatedAt.toISOString() : new Date().toISOString(),
      };
    });

    // 전체 전환율 계산
    const overallConversionRate = totalViews > 0 
      ? (totalRegistrations / totalViews) * 100 
      : 0;

    // 고객 통계
    let totalCustomers = 0;
    let newCustomers = 0;
    let convertedCustomers = 0;
    
    try {
      totalCustomers = await prisma.marketingCustomer.count();
      newCustomers = await prisma.marketingCustomer.count({
        where: { status: 'NEW' },
      });
      convertedCustomers = await prisma.marketingCustomer.count({
        where: { status: 'CONVERTED' },
      });
    } catch (customerError: any) {
      console.error('[Marketing Dashboard] Customer stats error:', customerError);
    }

    // 퍼널 통계
    let totalFunnels = 0;
    let activeFunnels = 0;
    
    try {
      totalFunnels = await prisma.marketingFunnel.count();
      activeFunnels = await prisma.marketingFunnel.count({
        where: { status: 'ACTIVE' },
      });
    } catch (funnelError: any) {
      console.error('[Marketing Dashboard] Funnel stats error:', funnelError);
    }

    return NextResponse.json({
      ok: true,
      data: {
        overview: {
          pages: {
            total: totalPages,
            active: activePages,
          },
          views: {
            total: totalViews,
            today: totalViewsToday,
            thisWeek: totalViewsThisWeek,
            thisMonth: totalViewsThisMonth,
          },
          registrations: {
            total: totalRegistrations,
            today: totalRegistrationsToday,
            thisWeek: totalRegistrationsThisWeek,
            thisMonth: totalRegistrationsThisMonth,
          },
          conversionRate: overallConversionRate,
        },
        customers: {
          total: totalCustomers,
          new: newCustomers,
          converted: convertedCustomers,
        },
        funnels: {
          total: totalFunnels,
          active: activeFunnels,
        },
        pageStats: pageStats.sort((a, b) => {
          // 최근 업데이트 순으로 정렬
          const dateA = typeof a.updatedAt === 'string' ? new Date(a.updatedAt) : a.updatedAt;
          const dateB = typeof b.updatedAt === 'string' ? new Date(b.updatedAt) : b.updatedAt;
          return dateB.getTime() - dateA.getTime();
        }),
      },
    });
  } catch (error: any) {
    console.error('[Marketing Dashboard] Error:', error);
    console.error('[Marketing Dashboard] Error message:', error?.message);
    console.error('[Marketing Dashboard] Error stack:', error?.stack);
    return NextResponse.json({
      ok: false,
      error: '데이터를 불러오는데 실패했습니다.',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    }, { status: 500 });
  }
}
