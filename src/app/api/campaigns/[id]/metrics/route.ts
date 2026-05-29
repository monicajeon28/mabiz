import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { getCampaignMetrics } from "@/lib/services/multi-channel-campaign";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/[id]/metrics
 * 캠페인 메트릭 조회 (크로스채널 어트리뷰션 포함)
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);
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

    const metrics = await getCampaignMetrics(campaignId);

    return NextResponse.json({
      ok: true,
      ...metrics,
    });
  } catch (error) {
    logger.error("[GET /api/campaigns/[id]/metrics] 오류", { error });
    return NextResponse.json(
      { ok: false, message: "메트릭 조회 실패" },
      { status: 500 }
    );
  }
}
