import { NextResponse } from "next/server";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import {
  recommendChannels,
  recommendChannelsForContact,
  recommendChannelMix,
} from "@/lib/services/channel-recommender";
import type { ChannelRecommendationRequest } from "@/lib/types/multi-channel";

/**
 * POST /api/channels/recommend
 * 세그먼트 또는 고객 기반 채널 추천
 *
 * 요청:
 * {
 *   "segmentId": "seg_123",              // 세그먼트 기반 추천
 *   "contactId": "con_456",              // 또는 고객 기반 추천
 *   "messageType": "PROMOTIONAL",        // PROMOTIONAL | TRANSACTIONAL | INFORMATIONAL
 *   "urgency": "HIGH",                   // HIGH | MEDIUM | LOW
 *   "frequency": "DAILY"                 // DAILY | WEEKLY | MONTHLY
 * }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const body = (await req.json()) as ChannelRecommendationRequest;
    const { segmentId, contactId, messageType, urgency, frequency } = body;

    if (!segmentId && !contactId) {
      return NextResponse.json(
        { ok: false, message: "segmentId 또는 contactId가 필요합니다." },
        { status: 400 }
      );
    }

    let recommendations;

    if (contactId) {
      // 고객 기반 추천
      recommendations = await recommendChannelsForContact(
        contactId,
        organizationId
      );
    } else if (segmentId) {
      // 세그먼트 기반 추천
      recommendations = await recommendChannels(segmentId, organizationId, {
        messageType,
        urgency,
        frequency,
      });
    }

    logger.log("[POST /api/channels/recommend] 채널 추천", {
      segmentId,
      contactId,
      recommendedChannels: recommendations?.map((r) => r.channel),
    });

    return NextResponse.json({
      ok: true,
      recommendations,
    });
  } catch (error) {
    logger.error("[POST /api/channels/recommend] 오류", { error });
    return NextResponse.json(
      { ok: false, message: "채널 추천 실패" },
      { status: 500 }
    );
  }
}
