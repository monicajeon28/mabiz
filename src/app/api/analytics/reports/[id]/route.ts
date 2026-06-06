import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 자동 리포트 상세 API
 *
 * GET /api/analytics/reports/[id]
 * - DailyReport 단건 조회 (조직 격리)
 * - 소비처(page.tsx)는 응답을 그대로 expandedData 객체로 사용하므로 "bare object" 반환
 *   (사용 필드: revenue, conversionRate, smsOpenRate, emailOpenRate,
 *    alerts[], recommendations[], topPartners[])
 * - 존재하지 않으면 404 → page.tsx는 expandRow에서 throw 후 무시 (정상 처리)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const orgId = session.organizationId;

    const report = await prisma.dailyReport.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!report) {
      return NextResponse.json(
        { error: '리포트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // JSON 필드는 그대로 통과 (page.tsx가 기대하는 shape 그대로 저장됨)
    const alerts = Array.isArray(report.alerts) ? report.alerts : [];
    const recommendations = Array.isArray(report.recommendations)
      ? report.recommendations
      : [];
    const topPartners = Array.isArray(report.topPartners)
      ? report.topPartners
      : [];

    // page.tsx는 응답을 그대로 객체로 setExpandedData() 하므로 bare object 반환
    const detail = {
      id: report.id,
      reportDate: report.reportDate.toISOString(),
      revenue: Number(report.revenue),
      weeklyRevenue: Number(report.weeklyRevenue),
      monthlyRevenue: Number(report.monthlyRevenue),
      conversionRate: report.conversionRate,
      conversionCount: report.conversionCount,
      smsOpenRate: report.smsOpenRate,
      kakaoClickRate: report.kakaoClickRate,
      emailOpenRate: report.emailOpenRate,
      smsSent: report.smsSent,
      kakaoSent: report.kakaoSent,
      emailSent: report.emailSent,
      alerts,
      recommendations,
      topPartners,
      status: report.status,
    };

    return NextResponse.json(detail);
  } catch (error) {
    logger.error('Analytics report detail error:', error as object);
    return NextResponse.json(
      { error: '리포트 상세를 가져올 수 없습니다' },
      { status: 500 }
    );
  }
}
