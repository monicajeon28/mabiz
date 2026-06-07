/**
 * GET /api/admin/verification/status
 *
 * 현재 검증 상태 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getFeatureFlagStatus } from "@/lib/middleware/feature-flag-middleware";
import { getRollbackStatus } from "@/lib/services/rollback-handler";
import { enforceRBAC } from "@/app/api/_middleware/enforce-rbac";

export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'],
    errorMessage: '관리자만 접근 가능합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {

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
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
