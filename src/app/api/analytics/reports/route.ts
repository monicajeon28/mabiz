import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { subDays, startOfDay } from 'date-fns';

/**
 * 자동 리포트 이력 목록 API
 *
 * GET /api/analytics/reports?days=7|30|90
 * - DailyReport 모델에서 기간 내 리포트 목록 조회
 * - 소비처(page.tsx)는 응답을 그대로 ReportRow[] 배열로 사용하므로 "bare array" 반환
 * - 저장된 리포트가 없으면 빈 배열([]) 반환 → 페이지가 '리포트 없음' 정상 표시
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const orgId = session.organizationId;
    const daysParam = parseInt(request.nextUrl.searchParams.get('days') || '30', 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30;

    const startDate = startOfDay(subDays(new Date(), days));

    const reports = await prisma.dailyReport.findMany({
      where: {
        organizationId: orgId,
        reportDate: { gte: startDate },
      },
      orderBy: { reportDate: 'desc' },
    });

    // page.tsx는 응답을 그대로 배열로 setReports() 하므로 bare array 반환
    const rows = reports.map((r) => {
      const alerts = Array.isArray(r.alerts) ? (r.alerts as unknown[]) : [];
      const topPartners = Array.isArray(r.topPartners)
        ? (r.topPartners as Array<{ name?: string; revenue?: number }>)
        : [];
      const top = topPartners[0];

      return {
        id: r.id,
        reportDate: r.reportDate.toISOString(),
        revenue: Number(r.revenue),
        conversionRate: r.conversionRate,
        alertCount: alerts.length,
        topPartner: top?.name ?? '',
        topPartnerRevenue: Number(top?.revenue ?? 0),
        status: r.status,
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    logger.error('Analytics reports list error:', error as object);
    return NextResponse.json(
      { error: '리포트 목록을 가져올 수 없습니다' },
      { status: 500 }
    );
  }
}
