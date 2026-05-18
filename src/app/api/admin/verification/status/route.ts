/**
 * GET /api/admin/verification/status
 *
 * 현재 검증 상태 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getFeatureFlagStatus } from "@/lib/middleware/feature-flag-middleware";
import { getRollbackStatus } from "@/lib/services/rollback-handler";
// import { verifyAdminToken } from "@/lib/auth";  // TODO: Fix auth import

export async function GET(req: NextRequest) {
  try {
    // 관리자 인증
    const auth = req.headers.get("authorization");
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: 실제 토큰 검증
    // await verifyAdminToken(auth);

    const [flagStatus, rollbackStatus] = await Promise.all([
      getFeatureFlagStatus(),
      getRollbackStatus(),
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      featureFlagStatus: flagStatus,
      rollbackStatus,
    });
  } catch (error) {
    logger.error("[API] 검증 상태 조회 실패", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
