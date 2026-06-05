import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
// NOTE: getCampaignMetrics는 MultiChannelCampaign 마이그레이션 후 활성화
// import { getCampaignMetrics } from "@/lib/services/multi-channel-campaign";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/[id]/metrics
 * 캠페인 메트릭 조회 (크로스채널 어트리뷰션 포함)
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);
    const { id: campaignId } = await params;

    // 캠페인 소유권 확인
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, message: "캠페인을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 기본 메트릭은 crmMarketingCampaign 필드에서 직접 반환
    return NextResponse.json({
      ok: true,
      campaignId,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      openCount: campaign.openCount,
      clickCount: campaign.clickCount,
      registeredCount: campaign.registeredCount,
      totalCount: campaign.totalCount,
    });
  } catch (error) {
    logger.error("[GET /api/campaigns/[id]/metrics] 오류", { error });
    return NextResponse.json(
      { ok: false, message: "메트릭 조회 실패" },
      { status: 500 }
    );
  }
}
