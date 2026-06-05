import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
// NOTE: multi-channel-campaign 서비스는 MultiChannelCampaign Prisma 모델 마이그레이션 후 활성화
// import { createCampaign, executeCampaign } from "@/lib/services/multi-channel-campaign";
// import type { CreateCampaignRequest } from "@/lib/types/multi-channel";

/**
 * POST /api/campaigns/multi-channel
 * 멀티채널 캠페인 생성
 */
export async function POST(_req: Request) {
  // MultiChannelCampaign Prisma 모델 마이그레이션 완료 후 활성화 필요
  return NextResponse.json(
    { ok: false, message: "멀티채널 캠페인 생성 기능은 준비 중입니다." },
    { status: 503 }
  );
}

/**
 * GET /api/campaigns/multi-channel
 * 캠페인 목록 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    // parseInt("abc") = NaN → Prisma take/skip NaN 오류 방지
    // 기본값 폴백 + 상한값 적용
    const MAX_LIMIT = 100;
    const rawLimit  = parseInt(url.searchParams.get("limit")  ?? "", 10);
    const rawOffset = parseInt(url.searchParams.get("offset") ?? "", 10);
    const limit  = Number.isFinite(rawLimit)  && rawLimit  > 0 ? Math.min(rawLimit,  MAX_LIMIT) : 20;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const where: any = { organizationId };
    if (status) {
      where.status = status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.crmMarketingCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.crmMarketingCampaign.count({ where }),
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
