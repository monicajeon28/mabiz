/**
 * POST /api/admin/verification/rollback
 *
 * 수동 롤백 트리거 (운영팀용)
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rollbackToSendingHistory } from "@/lib/services/rollback-handler";
import { notifySlack } from "@/lib/services/slack-notifier";
import { enforceRBAC } from "@/app/api/_middleware/enforce-rbac";

interface RollbackRequest {
  reason?: string;
  adminEmail?: string;
}

export async function POST(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'],
    errorMessage: '관리자만 접근 가능합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    // 관리자 인증은 이미 middleware에서 처리됨

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
