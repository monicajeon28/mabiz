/**
 * GET /api/admin/ab-tests/cron-history
 * Monitoring endpoint: View cron execution history
 * Shows last 30 executions with metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { getExecutionHistory, getMonitoringSummary, getHealthCheckData } from "@/lib/services/ab-test-monitoring";
import { logger } from "@/lib/logger";
import { enforceRBAC } from "@/app/api/_middleware/enforce-rbac";

export async function GET(request: NextRequest) {
  const rbacCheck = enforceRBAC(request, { allowedRoles: ['GLOBAL_ADMIN'] });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const orgId = request.nextUrl.searchParams.get("orgId");

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "30", 10);
    const summary = getMonitoringSummary();
    const history = getExecutionHistory(limit);
    const health = await getHealthCheckData();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      health,
      history,
    });
  } catch (error) {
    logger.error("[GET /api/admin/ab-tests/cron-history]", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
