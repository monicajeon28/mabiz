import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createCampaign, executeCampaign } from "@/lib/services/multi-channel-campaign";
import type { CreateCampaignRequest } from "@/lib/types/multi-channel";

/**
 * POST /api/campaigns/multi-channel
 * 멀티채널 캠페인 생성
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const body = (await req.json()) as CreateCampaignRequest;

    const {
      name,
      channels,
      message,
      subject,
      recipients,
      scheduleAt,
      templateIds,
      lensType,
      segmentId,
    } = body;

    // 입력 검증
    if (!name || !channels || channels.length === 0 || !message || !recipients || recipients.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "필수 정보가 부족합니다.",
        },
        { status: 400 }
      );
    }

    // 캠페인 생성
    const result = await createCampaign({
      organizationId,
      name,
      channels,
      message,
      subject,
      recipients,
      scheduleAt,
      templateIds,
      lensType,
      segmentId,
    });

    logger.log("[POST /api/campaigns/multi-channel] 캠페인 생성", {
      campaignId: result.campaignId,
      channels,
      recipientCount: recipients.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("[POST /api/campaigns/multi-channel] 오류", { error });
    return NextResponse.json(
      { ok: false, message: "캠페인 생성 실패" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/multi-channel
 * 캠페인 목록 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = { organizationId };
    if (status) {
      where.status = status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.multiChannelCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: { metrics: true },
      }),
      prisma.multiChannelCampaign.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      campaigns,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("[GET /api/campaigns/multi-channel] 오류", { error });
    return NextResponse.json(
      { ok: false, message: "캠페인 조회 실패" },
      { status: 500 }
    );
  }
}
