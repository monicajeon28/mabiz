/**
 * POST /api/cron/ab-test-sync
 * Vercel Cron Job 엔드포인트
 * 매 월요일 09:00 KST 실행
 */

import { NextRequest, NextResponse } from "next/server";
import { runABTestSyncJob } from "@/jobs/ab-test-sync-cron";

export async function POST(request: NextRequest) {
  try {
    // Vercel Cron 인증
    const authHeader = request.headers.get("Authorization");
    const expectedToken = process.env.CRON_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cron 작업 실행
    const result = await runABTestSyncJob();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron job error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
