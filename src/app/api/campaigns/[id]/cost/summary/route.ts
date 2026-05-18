export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { calculateCampaignCost } from '@/lib/campaign-cost';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/[id]/cost/summary
 * 캠페인의 비용 요약 조회
 */
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: campaignId } = await params;

    // IDOR 방지: 캠페인 소유권 확인
    const campaign = await prisma.crmMarketingCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
        totalCount: true,
        sentCount: true,
        failedCount: true
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (campaign.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 비용 계산 (필요시 자동 계산)
    await calculateCampaignCost({
      campaignId,
      organizationId: orgId
    });

    // 비용 데이터 조회
    const cost = await prisma.campaignCost.findUnique({
      where: { campaignId }
    });

    if (!cost) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '비용 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    logger.log('[GET /api/campaigns/[id]/cost/summary]', {
      campaignId,
      orgId,
      totalCost: cost.actualCostTotal
    });

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        totalCount: campaign.totalCount,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount
      },
      cost: {
        sms: {
          sent: cost.smsSent,
          rate: cost.smsRateCurrent,
          total: cost.smsCostTotal
        },
        email: {
          sent: cost.emailSent,
          rate: cost.emailRateCurrent,
          total: cost.emailCostTotal
        },
        summary: {
          totalCost: cost.actualCostTotal,
          successCount: cost.successCount,
          failureCount: cost.failureCount,
          costPerSuccess: cost.costPerSuccess,
          estimatedRevenue: cost.estimatedRevenue,
          estimatedRoi: cost.estimatedRoi
        },
        calculatedAt: cost.calculatedAt
      }
    });
  } catch (err) {
    logger.error('[GET /api/campaigns/[id]/cost/summary]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
