import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import {
  predictAllChurns,
  identifyAllUpsells,
} from "@/lib/predictive-analytics";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all"; // "churn", "upsell", or "all"

    const responses: any = {
      ok: true,
    };

    if (type === "churn" || type === "all") {
      const churns = await predictAllChurns(orgId);
      responses.churnPredictions = {
        total: churns.length,
        highRisk: churns.filter((c) => c.churnProbability > 0.75).length,
        mediumRisk: churns.filter(
          (c) => c.churnProbability > 0.5 && c.churnProbability <= 0.75
        ).length,
        predictions: churns.slice(0, 50), // Top 50
      };
    }

    if (type === "upsell" || type === "all") {
      const upsells = await identifyAllUpsells(orgId);
      responses.upsellOpportunities = {
        total: upsells.length,
        totalPotentialRevenue: upsells.reduce(
          (sum, u) => sum + u.upsellPotential,
          0
        ),
        opportunities: upsells.slice(0, 50), // Top 50
      };
    }

    logger.log("[Predictive Analytics]", {
      organizationId: orgId,
      type,
      ...(responses.churnPredictions && {
        churnHighRisk: responses.churnPredictions.highRisk,
      }),
      ...(responses.upsellOpportunities && {
        upsellCount: responses.upsellOpportunities.total,
      }),
    });

    return NextResponse.json({
      ...responses,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[Predictive Analytics]", { err });
    return NextResponse.json(
      { ok: false, message: "예측 분석 조회 실패" },
      { status: 500 }
    );
  }
}
