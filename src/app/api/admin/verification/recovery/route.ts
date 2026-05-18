/**
 * POST /api/admin/verification/recovery
 *
 * ExecutionLog 복구 (데이터 검증 후, 운영팀용)
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  enableExecutionLogFeature,
  clearRollbackState,
} from "@/lib/services/rollback-handler";
import { notifySlack } from "@/lib/services/slack-notifier";

interface RecoveryRequest {
  action: "enable_execution_log" | "clear_rollback_state";
  verificationStatus: "passed" | "failed" | "pending";
  adminEmail?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 관리자 인증
    const auth = req.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: RecoveryRequest = await req.json();
    const { action, verificationStatus, adminEmail = "unknown@mabiz.co.kr", notes = "" } = body;

    if (verificationStatus !== "passed") {
      return NextResponse.json(
        {
          error: "Data verification failed",
          message: "Cannot recover without passing verification",
        },
        { status: 400 }
      );
    }

    logger.info("[API] ExecutionLog 복구 시작", {
      action,
      verificationStatus,
      adminEmail,
      notes,
      timestamp: new Date().toISOString(),
    });

    // 복구 실행
    if (action === "enable_execution_log") {
      await enableExecutionLogFeature();
    }

    await clearRollbackState();

    // Slack 알림
    await notifySlack({
      type: "RECOVERY_COMPLETED",
      details: {
        action,
        adminEmail,
        notes,
        timestamp: new Date().toISOString(),
        message: "ExecutionLog Feature Flag 재활성화 완료",
      },
    });

    return NextResponse.json({
      success: true,
      message: "ExecutionLog recovery completed",
      data: {
        executionLogEnabled: true,
        rollbackCleared: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("[API] ExecutionLog 복구 실패", { error });

    await notifySlack({
      type: "ERROR_ROLLBACK",
      message: "ExecutionLog 복구 중 오류 발생",
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        message: "ExecutionLog recovery failed",
      },
      { status: 500 }
    );
  }
}
