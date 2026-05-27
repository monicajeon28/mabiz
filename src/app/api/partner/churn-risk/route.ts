import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { detectAllChurnRisks } from "@/lib/partner-churn-detector";
import { logger } from "@/lib/logger";

interface ChurnRiskResponse {
  ok: boolean;
  data?: {
    totalPartners: number;
    atRiskCount: number;
    critical: number;
    high: number;
    medium: number;
    partners: Array<{
      id: string;
      name: string;
      riskScore: number;
      severity: string;
      lastActivityDays: number;
      recommendedActions: string[];
    }>;
  };
  message?: string;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const churnRisks = await detectAllChurnRisks(orgId);

    const totalPartners = await prisma.partner.count({
      where: { organizationId: orgId },
    });

    const stats = {
      critical: churnRisks.filter((c) => c.severity === "CRITICAL").length,
      high: churnRisks.filter((c) => c.severity === "HIGH").length,
      medium: churnRisks.filter((c) => c.severity === "MEDIUM").length,
    };

    logger.log("[Partner Churn Risk]", {
      organizationId: orgId,
      totalPartners,
      atRiskCount: churnRisks.length,
      ...stats,
    });

    return NextResponse.json<ChurnRiskResponse>({
      ok: true,
      data: {
        totalPartners,
        atRiskCount: churnRisks.length,
        critical: stats.critical,
        high: stats.high,
        medium: stats.medium,
        partners: churnRisks.map((c) => ({
          id: c.partnerId,
          name: c.partnerName,
          riskScore: c.churnRiskScore,
          severity: c.severity,
          lastActivityDays: c.signals.lastActivityDays,
          recommendedActions: c.recommendedActions,
        })),
      },
    });
  } catch (err) {
    logger.error("[Partner Churn Risk]", { err });
    return NextResponse.json(
      { ok: false, message: "파트너 유실 위험도 조회 실패" },
      { status: 500 }
    );
  }
}
