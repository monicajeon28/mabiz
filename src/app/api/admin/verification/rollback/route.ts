/**
 * POST /api/admin/verification/rollback
 *
 * 수동 롤백 트리거 (운영팀용)
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rollbackToSendingHistory } from "@/lib/services/rollback-handler";
import { notifySlack } from "@/lib/services/slack-notifier";

interface RollbackRequest {
  reason?: string;
  adminEmail?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 관리자 인증 (간단한 토큰 확인)
    const auth = req.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: RollbackRequest = await req.json();
    const reason = body.reason || "Manual rollback triggered by admin";
    const adminEmail = body.adminEmail || "unknown@mabiz.co.kr";

    logger.info("[API] 수동 롤백 시작", {
      reason,
      adminEmail,
      timestamp: new Date().toISOString(),
    });

    // 롤백 실행
    const result = await rollbackToSendingHistory(reason);

    // Slack 알림
    await notifySlack({
      type: "CRITICAL_ROLLBACK",
      message: `수동 롤백 실행 (by ${adminEmail})`,
      details: {
        reason,
        result,
        adminEmail,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Manual rollback completed",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[API] 수동 롤백 실패", { error });

    await notifySlack({
      type: "ERROR_ROLLBACK",
      message: "수동 롤백 실행 중 오류 발생",
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Manual rollback failed",
      },
      { status: 500 }
    );
  }
}
