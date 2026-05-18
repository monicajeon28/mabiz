export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { calculateEstimatedRoi } from '@/lib/cost-utils';
import { z } from 'zod';

type Params = { params: Promise<{ orgId: string }> };

// ============================================================================
// Zod Schemas
// ============================================================================

const ChannelCostSchema = z.object({
  sent: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  roi: z.number(),
});

const MonthlyCostSchema = z.object({
  month: z.string(), // YYYY-MM
  campaigns: z.number().nonnegative(),
  sent: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  roi: z.number(),
});

const SummaryStatsSchema = z.object({
  totalCampaigns: z.number().nonnegative(),
  totalSent: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  avgCostPerCampaign: z.number().nonnegative(),
  avgRoi: z.number(),
});

const ReportResponseSchema = z.object({
  ok: z.literal(true),
  organizationId: z.string(),
  organizationName: z.string(),
  reportPeriod: z.object({
    startMonth: z.string(),
    endMonth: z.string(),
  }),
  summary: SummaryStatsSchema,
  byMonth: z.array(MonthlyCostSchema),
  byChannel: z.object({
    SMS: ChannelCostSchema.optional(),
    Email: ChannelCostSchema.optional(),
  }),
});

type ReportResponse = z.infer<typeof ReportResponseSchema>;

/**
 * 기본값: 현재 월 기준 3개월 전 ~ 현재 월
 */
function getDefaultDateRange(): { startMonth: string; endMonth: string } {
  const now = new Date();
  const endMonth = now.toISOString().substring(0, 7);

  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const startMonth = threeMonthsAgo.toISOString().substring(0, 7);

  return { startMonth, endMonth };
}

/**
 * YYYY-MM 형식 검증
 */
function isValidYearMonth(str: string): boolean {
  return /^\d{4}-\d{2}$/.test(str);
}

/**
 * 월의 마지막 날 이후 날짜 계산
 * "2026-05" → 2026-06-01 (다음 달 1일)
 * lt 필터에 사용하여 월 범위를 안정적으로 처리
 */
function getMonthEndDate(yearMonth: string): Date {
  const [year, month] = yearMonth.split('-').map(Number);
  // month는 이미 1-12 범위이므로 그대로 new Date에 전달 (month 매개변수는 0-11이므로 -1)
  return new Date(year, month, 1); // 다음 달의 1일
}

// ============================================================================
// GET /api/organizations/[orgId]/campaigns/cost/report — 조직별 비용 리포트
// ============================================================================
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const authOrgId = requireOrgId(ctx);
    const { orgId } = await params;

    // ✅ IDOR 보안: 요청 orgId와 인증 orgId 일치 확인
    if (orgId !== authOrgId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '다른 조직의 데이터에 접근할 수 없습니다.' },
        { status: 403 }
      );
    }

    // ✅ 조직 조회
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '조직을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ✅ 쿼리 파라미터 추출
    const url = new URL(req.url);
    const queryStartMonth = url.searchParams.get('startMonth');
    const queryEndMonth = url.searchParams.get('endMonth');

    // ✅ 기본값 설정
    const { startMonth: defaultStart, endMonth: defaultEnd } = getDefaultDateRange();
    const startMonth = queryStartMonth || defaultStart;
    const endMonth = queryEndMonth || defaultEnd;

    // ✅ 쿼리 파라미터 검증
    if (!isValidYearMonth(startMonth) || !isValidYearMonth(endMonth)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '기간은 YYYY-MM 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    if (startMonth > endMonth) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: 'startMonth는 endMonth 이전이어야 합니다.' },
        { status: 400 }
      );
    }

    // ✅ CampaignCost 조회 (월별 범위 필터)
    const campaignCosts = await prisma.campaignCost.findMany({
      where: {
        organizationId: orgId,
        calculatedAt: {
          gte: new Date(`${startMonth}-01`),
          lt: getMonthEndDate(endMonth), // ✅ P0 #1 수정: 안정적인 월 범위 처리
        },
      },
      select: {
        smsSent: true,
        smsCostTotal: true,
        emailSent: true,
        emailCostTotal: true,
        successCount: true,
        actualCostTotal: true,
        estimatedRoi: true,
        calculatedAt: true,
      },
    });

    // ✅ 월별 & 채널별 집계
    const monthlyMap = new Map<string, any>();
    let totalSmsSent = 0;
    let totalSmsCost = 0;
    let totalEmailSent = 0;
    let totalEmailCost = 0;
    let totalSuccessCount = 0;
    let totalCost = 0;
    let totalRoiSum = 0;

    campaignCosts.forEach((cost) => {
      const month = cost.calculatedAt.toISOString().substring(0, 7);

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          campaigns: 0,
          sent: 0,
          cost: 0,
          roiSum: 0,
        });
      }

      const monthData = monthlyMap.get(month);
      monthData.campaigns += 1;
      monthData.sent += cost.smsSent + cost.emailSent;
      monthData.cost += cost.actualCostTotal;
      monthData.roiSum += cost.estimatedRoi;

      totalSmsSent += cost.smsSent;
      totalSmsCost += cost.smsCostTotal;
      totalEmailSent += cost.emailSent;
      totalEmailCost += cost.emailCostTotal;
      totalSuccessCount += cost.successCount;
      totalCost += cost.actualCostTotal;
      totalRoiSum += cost.estimatedRoi;
    });

    // ✅ 월별 평균 ROI 계산
    const byMonth: MonthlyCostSchema[] = Array.from(monthlyMap.values()).map((data) => ({
      month: data.month,
      campaigns: data.campaigns,
      sent: data.sent,
      cost: data.cost,
      roi: data.campaigns > 0 ? data.roiSum / data.campaigns : 0,
    }));

    // ✅ 채널별 통계 계산 (P0 #2 수정: cost-utils와 통일된 ROI 계산)
    const byChannel: any = {};
    if (totalSmsSent > 0) {
      // SMS 채널: 예상 수익 기반 ROI (건당 평균 거래금액 가정: 150,000원)
      const estimatedSmsRevenue = totalSmsSent * 150000;
      byChannel.SMS = {
        sent: totalSmsSent,
        cost: totalSmsCost,
        roi: calculateEstimatedRoi(totalSmsCost, estimatedSmsRevenue),
      };
    }
    if (totalEmailSent > 0) {
      // Email 채널: 예상 수익 기반 ROI (건당 평균 거래금액 가정: 150,000원)
      const estimatedEmailRevenue = totalEmailSent * 150000;
      byChannel.Email = {
        sent: totalEmailSent,
        cost: totalEmailCost,
        roi: calculateEstimatedRoi(totalEmailCost, estimatedEmailRevenue),
      };
    }

    // ✅ 요약 통계 계산
    const totalCampaigns = campaignCosts.length;
    const avgCostPerCampaign = totalCampaigns > 0 ? totalCost / totalCampaigns : 0;
    const avgRoi = totalCampaigns > 0 ? totalRoiSum / totalCampaigns : 0;

    // ✅ 응답 데이터 구성
    const response: ReportResponse = {
      ok: true,
      organizationId: organization.id,
      organizationName: organization.name,
      reportPeriod: {
        startMonth,
        endMonth,
      },
      summary: {
        totalCampaigns,
        totalSent: totalSmsSent + totalEmailSent,
        totalCost,
        avgCostPerCampaign,
        avgRoi,
      },
      byMonth,
      byChannel,
    };

    // ✅ Zod 검증
    const validation = ReportResponseSchema.safeParse(response);
    if (!validation.success) {
      logger.error('COST_REPORT_VALIDATION_ERROR', {
        orgId,
        errors: validation.error.issues,
      });
      return NextResponse.json(
        { ok: false, error: 'INTERNAL_ERROR', message: '응답 검증에 실패했습니다.' },
        { status: 500 }
      );
    }

    logger.info('ORGANIZATION_COST_REPORT_RETRIEVED', {
      orgId,
      organizationName: organization.name,
      totalCampaigns,
      totalCost,
      period: `${startMonth} ~ ${endMonth}`,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error('ORGANIZATION_COST_REPORT_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
