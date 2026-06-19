export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/my-sales?month=2026-05                    — 페이지 + 결제 목록
 * GET /api/affiliate/my-sales?month=2026-05&pageId=xxx         — 상세 분석 포함 (트렌드 + 고객)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || !ctx.organizationId || !ctx.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const pageIdParam = searchParams.get('pageId');

    // 월 파싱 (YYYY-MM 형식)
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (monthParam) {
      const parts = monthParam.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          year = y;
          month = m;
        }
      }
    }

    // 월별 범위 (정확한 경계)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const userId = ctx.userId;
    const orgId = ctx.organizationId;

    // ── 기본 쿼리: 이 사용자가 만든 랜딩페이지 + 결제
    const [landingPages, paymentRecords] = await Promise.all([
      prisma.crmLandingPage.findMany({
        where: {
          organizationId: orgId,
          createdByUserId: userId,
          createdAt: { gte: startDate, lt: endDate },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          createdAt: true,
          viewCount: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payAppPayment.findMany({
        where: {
          organizationId: orgId,
          createdByUserId: userId,
          createdAt: { gte: startDate, lt: endDate },
        },
        select: {
          id: true,
          orderId: true,
          amount: true,
          status: true,
          paidAt: true,
          createdAt: true,
          landingPageId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // ── pageId가 있으면 상세 분석 포함
    let monthlyTrend: Array<{ month: string; views: number; payments: number; revenue: number }> = [];
    let customers: Array<{
      id: string;
      customerName: string;
      customerPhone: string;
      customerEmail: string | null;
      amount: number;
      status: string;
      paidAt: Date | null;
    }> = [];

    if (pageIdParam) {
      // 해당 페이지의 지난 3개월 트렌드
      const prevMonth2 = new Date(year, month - 3, 1);

      monthlyTrend = await prisma.$queryRaw<
        Array<{ month: string; views: number; payments: number; revenue: number }>
      >`
        SELECT
          TO_CHAR(pap."createdAt", 'YYYY-MM') AS month,
          0::integer AS views,
          COUNT(*)::integer AS payments,
          COALESCE(SUM(CASE WHEN pap.status = 'completed' THEN pap.amount ELSE 0 END), 0)::integer AS revenue
        FROM "CrmPayAppPayment" pap
        WHERE pap."landingPageId" = ${pageIdParam}
          AND pap."organizationId" = ${orgId}
          AND pap."createdByUserId" = ${userId}
          AND pap."createdAt" >= ${prevMonth2}
        GROUP BY TO_CHAR(pap."createdAt", 'YYYY-MM')
        ORDER BY month DESC
      `;

      // 해당 페이지를 통한 고객들
      customers = await prisma.$queryRaw<
        Array<{
          id: string;
          customerName: string;
          customerPhone: string;
          customerEmail: string | null;
          amount: number;
          status: string;
          paidAt: Date | null;
        }>
      >`
        SELECT
          pap.id,
          pap."customerName",
          pap."customerPhone",
          pap."customerEmail",
          pap.amount,
          pap.status,
          pap."paidAt"
        FROM "CrmPayAppPayment" pap
        WHERE pap."landingPageId" = ${pageIdParam}
          AND pap."organizationId" = ${orgId}
          AND pap."createdByUserId" = ${userId}
          AND pap."createdAt" >= ${startDate}
          AND pap."createdAt" < ${endDate}
        ORDER BY pap."createdAt" DESC
      `;
    }

    // ── 통계 계산 (프론트 AffiliateMonthlyData/AffiliatePageDetail 계약에 맞춘 실데이터 reshape)
    // ⚠️ 프론트는 응답을 json.data 로 읽으므로 반드시 { ok, data } 로 감싼다(없으면 마법사가 멈춤).
    const completed = paymentRecords.filter((p) => p.status === 'completed');
    const totalViews = landingPages.reduce((sum, p) => sum + p.viewCount, 0);
    const totalRevenue = completed.reduce((sum, p) => sum + p.amount, 0);
    const completedCount = completed.length;
    const conversionRate = totalViews > 0 ? Math.round((completedCount / totalViews) * 1000) / 10 : 0;
    const avgOrderAmount = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    if (pageIdParam) {
      // 상세 분석 (AffiliatePageDetail)
      const page = landingPages.find((p) => p.id === pageIdParam);
      const detail = {
        pageId: pageIdParam,
        pageTitle: page?.title ?? '',
        month: monthStr,
        totalRevenue,
        conversionRate,
        avgOrderAmount,
        // PayApp 결제에 상품명 정보가 없어 상품별 분해는 빈 배열(실데이터 한계)
        topProducts: [] as Array<{ productName: string; salesCount: number; totalAmount: number }>,
        monthlyTrend: monthlyTrend.map((t) => ({ month: t.month, revenue: t.revenue })),
        customers: customers.map((c) => ({
          customerName: c.customerName,
          amount: c.amount,
          paymentDate: c.paidAt ? c.paidAt.toISOString().slice(0, 10) : '',
          productName: '',
        })),
      };
      return NextResponse.json({ ok: true, data: detail });
    }

    // 월 요약 (AffiliateMonthlyData)
    const pagesShaped = landingPages.map((p) => {
      const pPayments = paymentRecords.filter((pm) => pm.landingPageId === p.id);
      const pCompleted = pPayments.filter((pm) => pm.status === 'completed');
      return {
        id: p.id,
        title: p.title,
        revenue: pCompleted.reduce((sum, pm) => sum + pm.amount, 0),
        conversionRate: p.viewCount > 0 ? Math.round((pPayments.length / p.viewCount) * 1000) / 10 : 0,
        salesCount: pCompleted.length,
      };
    });
    const monthly = {
      month: monthStr,
      totalRevenue,
      conversionRate,
      avgOrderAmount,
      topProducts: [] as Array<{ productName: string; salesCount: number }>,
      pages: pagesShaped,
    };
    return NextResponse.json({ ok: true, data: monthly });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('affiliate/my-sales error', { error: errMsg, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
