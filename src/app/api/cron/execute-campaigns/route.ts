export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { executePendingCampaigns } from "@/lib/cron/execute-campaigns";

/**
 * GET /api/cron/execute-campaigns
 * Menu #38 Phase 2: 마케팅 캠페인 자동 발송 + 재시도
 *
 * 실행 방식:
 * - Vercel Cron (매일 정해진 시간, 예: 9:00 AM KST)
 * - 또는 외부 scheduler (Zapier, AWS EventBridge 등)
 *
 * 처리:
 * 1. CrmMarketingCampaign 조회 (status='ACTIVE', nextExecutionAt <= NOW)
 * 2. 각 캠페인별 SMS/Email 실제 발송
 * 3. SendingHistory에 기록
 * 4. 재시도 대상 처리 (RETRY_SCHEDULED, nextRetryAt <= NOW)
 * 5. nextExecutionAt 업데이트 (repeatRule 기반)
 */
export async function GET(req: Request) {
  // Cron 인증
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      logger.warn("[Cron/ExecuteCampaigns] CRON_SECRET 미설정");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 500 });
    }
    const expected = `Bearer ${secret}`;
    if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
      logger.warn("[Cron/ExecuteCampaigns] 인증 실패");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // 개발 환경에서는 선택적 인증
    if (secret) {
      const expected = `Bearer ${secret}`;
      if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
        logger.warn("[Cron/ExecuteCampaigns] 인증 실패");
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  try {
    logger.info("[Cron/ExecuteCampaigns] 시작", { timestamp: new Date().toISOString() });

    const result = await executePendingCampaigns();

    logger.info("[Cron/ExecuteCampaigns] 완료", result);

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[Cron/ExecuteCampaigns] 오류", { err });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/execute-campaigns
 * 수동 테스트용 엔드포인트 (개발 환경에서만 활성화)
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not allowed in production" }, { status: 403 });
  }

  try {
    logger.info("[Cron/ExecuteCampaigns] 수동 실행 시작");

    const result = await executePendingCampaigns();

    logger.info("[Cron/ExecuteCampaigns] 수동 실행 완료", result);

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[Cron/ExecuteCampaigns] 수동 실행 오류", { err });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
