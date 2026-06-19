/**
 * POST /api/cron/ab-test-sync
 * Vercel Cron Job 엔드포인트
 * 매 월요일 09:00 KST 실행
 */

import { NextRequest, NextResponse } from "next/server";
import { runABTestSyncJob } from "@/jobs/ab-test-sync-cron";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    // Vercel Cron 인증 — CRON_SECRET 미설정 시 fail-closed (500)
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: "CRON_SECRET 환경변수 미설정" }, { status: 503 });
    }
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cron 작업 실행
    const result = await runABTestSyncJob();

    return NextResponse.json(result);
  } catch (error) {
    logger.error("[POST /api/cron/ab-test-sync]", { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: 상태 확인 용도
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: "/api/cron/ab-test-sync",
    method: "POST",
    schedule: "0 9 * * 1", // 매 월요일 09:00 KST
    description: "A/B Test Weekly Assignment Sync to Monday.com",
    lastSync: null,
  });
}
