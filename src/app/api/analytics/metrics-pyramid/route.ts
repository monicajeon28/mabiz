import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { calculateMetricsPyramid } from "@/lib/metrics-calculator";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const pyramid = await calculateMetricsPyramid(orgId);

    logger.log("[Metrics Pyramid]", {
      organizationId: orgId,
      heroRevenue: pyramid.hero.totalRevenue.value,
      atRiskContacts: pyramid.riskMetrics.atRiskCount,
    });

    return NextResponse.json({
      ok: true,
      data: pyramid,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[Metrics Pyramid]", { err });
    return NextResponse.json(
      { ok: false, message: "KPI 대시보드 조회 실패" },
      { status: 500 }
    );
  }
}
