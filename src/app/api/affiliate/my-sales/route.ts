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

    // ── 통계 계산
    const totalViews = landingPages.reduce((sum, p) => sum + p.viewCount, 0);
    const totalPayments = paymentRecords.length;
    const totalRevenue = paymentRecords
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const response = {
      ok: true,
      month: `${year}-${String(month).padStart(2, '0')}`,
      summary: {
        totalPages: landingPages.length,
        totalViews,
        totalPayments,
        totalRevenue,
      },
      pages: landingPages,
      payments: paymentRecords,
      ...(pageIdParam && { monthlyTrend, customers }),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('affiliate/my-sales error', error);
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
