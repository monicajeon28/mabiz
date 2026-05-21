export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

// ============================================================================
// Zod Schemas
// ============================================================================

const CampaignCostSchema = z.object({
  smsSent: z.number().nonnegative(),
  smsRate: z.number().positive(),
  smsCost: z.number().nonnegative(),
  emailSent: z.number().nonnegative(),
  emailRate: z.number().positive(),
  emailCost: z.number().nonnegative(),
  actualCostTotal: z.number().nonnegative(),
});

const PerformanceSchema = z.object({
  successCount: z.number().nonnegative(),
  costPerSuccess: z.number().nonnegative(),
  estimatedRoi: z.number(),
});

const SummaryResponseSchema = z.object({
  ok: z.literal(true),
  campaignId: z.string(),
  campaignTitle: z.string(),
  period: z.string(), // YYYY-MM
  costs: CampaignCostSchema,
  performance: PerformanceSchema,
});

type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

// ============================================================================
// GET /api/campaigns/[id]/cost/summary — 캠페인별 비용 요약
// ============================================================================
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: campaignId } = await params;

    // ✅ 캠페인 조회 + IDOR 확인
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        organizationId: true,
        title: true,
        createdAt: true,
        sentCount: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ✅ CampaignCost 조회
    const campaignCost = await prisma.campaignCost.findUnique({
      where: {
        campaignId: campaignId,
      },
      select: {
        smsSent: true,
        smsRateCurrent: true,
        smsCostTotal: true,
        emailSent: true,
        emailRateCurrent: true,
        emailCostTotal: true,
        successCount: true,
        costPerSuccess: true,
        estimatedRoi: true,
        actualCostTotal: true,
        calculatedAt: true,
      },
    });

    if (!campaignCost) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인 비용 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ✅ 기간 추출 (YYYY-MM)
    const period = campaignCost.calculatedAt.toISOString().substring(0, 7);

    // ✅ 응답 데이터 구성
    const response: SummaryResponse = {
      ok: true,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      period,
      costs: {
        smsSent: campaignCost.smsSent,
        smsRate: campaignCost.smsRateCurrent?.toNumber() ?? 0,
        smsCost: campaignCost.smsCostTotal?.toNumber() ?? 0,
        emailSent: campaignCost.emailSent,
        emailRate: campaignCost.emailRateCurrent?.toNumber() ?? 0,
        emailCost: campaignCost.emailCostTotal?.toNumber() ?? 0,
        actualCostTotal: campaignCost.actualCostTotal?.toNumber() ?? 0,
      },
      performance: {
        successCount: campaignCost.successCount,
        costPerSuccess: campaignCost.costPerSuccess?.toNumber() ?? 0,
        estimatedRoi: campaignCost.estimatedRoi,
      },
    };

    // ✅ Zod 검증
    const validation = SummaryResponseSchema.safeParse(response);
    if (!validation.success) {
      logger.error('COST_SUMMARY_VALIDATION_ERROR', {
        campaignId,
        errors: validation.error.issues,
      });
      return NextResponse.json(
        { ok: false, error: 'INTERNAL_ERROR', message: '응답 검증에 실패했습니다.' },
        { status: 500 }
      );
    }

    logger.info('CAMPAIGN_COST_SUMMARY_RETRIEVED', {
      campaignId,
      organizationId: orgId,
      actualCostTotal: campaignCost.actualCostTotal,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error('CAMPAIGN_COST_SUMMARY_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
