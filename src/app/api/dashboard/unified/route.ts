import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { calculateHeroKPIs } from "@/lib/metrics-calculator";
import { predictAllChurns, identifyAllUpsells } from "@/lib/predictive-analytics";
import { detectAllChurnRisks } from "@/lib/partner-churn-detector";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

/**
 * Unified Dashboard API
 * GET /api/dashboard/unified
 *
 * Single endpoint that returns all dashboard data:
 * - Hero KPIs (top-level metrics)
 * - Contact at-risk summary
 * - Partner churn risks
 * - Churn predictions
 * - Upsell opportunities
 * - Recent activity
 * - Health status
 */

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const startTime = Date.now();

    // Parallel execution for performance
    const [hero, contactChurns, partnerChurns, upsells, activity, health] =
      await Promise.all([
        calculateHeroKPIs(orgId),
        predictAllChurns(orgId),
        detectAllChurnRisks(orgId),
        identifyAllUpsells(orgId),
        getRecentActivity(orgId),
        getSystemHealth(orgId),
      ]);

    const duration = Date.now() - startTime;

    logger.log("[Unified Dashboard]", {
      organizationId: orgId,
      responseTime: `${duration}ms`,
      churnPredictions: contactChurns.length,
      partnerChurns: partnerChurns.length,
      upsellOpportunities: upsells.length,
    });

    return NextResponse.json({
      ok: true,
      data: {
        // Layer 1: Hero KPIs
        heroKpis: hero,

        // Layer 2: At-Risk Summary
        atRiskContacts: {
          critical: contactChurns.filter((c) => c.churnProbability > 0.85)
            .length,
          high: contactChurns.filter(
            (c) => c.churnProbability > 0.65 && c.churnProbability <= 0.85
          ).length,
          medium: contactChurns.filter(
            (c) => c.churnProbability > 0.5 && c.churnProbability <= 0.65
          ).length,
          topRisks: contactChurns.slice(0, 5),
        },

        // Layer 3: Partner Management
        partnerInsights: {
          totalPartners: (await prisma.partner.count({ where: { organizationId: orgId } })),
          atRiskCount: partnerChurns.length,
          critical: partnerChurns.filter((p) => p.severity === "CRITICAL")
            .length,
          topRisks: partnerChurns.slice(0, 5),
        },

        // Layer 4: Revenue Opportunities
        opportunities: {
          totalUpsellPotential: upsells.reduce(
            (sum, u) => sum + u.upsellPotential,
            0
          ),
          count: upsells.length,
          topOpportunities: upsells.slice(0, 5),
        },

        // Layer 5: System Health
        recentActivity: activity,
        health: health,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        responseTime: `${duration}ms`,
      },
    });
  } catch (err) {
    logger.error("[Unified Dashboard]", { err });
    return NextResponse.json(
      { ok: false, message: "대시보드 로드 실패" },
      { status: 500 }
    );
  }
}

async function getRecentActivity(
  organizationId: string
): Promise<{
  lastContactCreated: string | null;
  lastSaleConfirmed: string | null;
  messagesSentToday: number;
  callsMadeToday: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [lastContact, lastSale, messagesToday, callsToday] = await Promise.all([
    prisma.contact.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.affiliateSale.findFirst({
      where: { organizationId, status: "CONFIRMED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.smsLog.count({
      where: { organizationId, sentAt: { gte: today } },
    }),
    prisma.callLog.count({
      where: { contact: { organizationId }, createdAt: { gte: today } },
    }),
  ]);

  return {
    lastContactCreated: lastContact?.createdAt?.toISOString() || null,
    lastSaleConfirmed: lastSale?.createdAt?.toISOString() || null,
    messagesSentToday: messagesToday,
    callsMadeToday: callsToday,
  };
}

async function getSystemHealth(
  organizationId: string
): Promise<{
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  checks: Array<{ name: string; status: string; message?: string }>;
}> {
  const checks: Array<{ name: string; status: string; message?: string }> = [];

  // Check 1: SMS Config
  const smsConfig = await prisma.orgSmsConfig.findUnique({
    where: { organizationId },
  });
  checks.push({
    name: "SMS Configuration",
    status: smsConfig ? "✅" : "❌",
    message: smsConfig
      ? "Configured"
      : "SMS not configured - set up in Settings → SMS",
  });

  // Check 2: Contact data
  const contactCount = await prisma.contact.count({
    where: { organizationId },
  });
  checks.push({
    name: "Contact Database",
    status: contactCount > 0 ? "✅" : "⚠️",
    message: `${contactCount} contacts loaded`,
  });

  // Check 3: Recent partner activity
  const activePartners = await prisma.partner.count({
    where: {
      organizationId,
      updatedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });
  checks.push({
    name: "Partner Activity",
    status: activePartners > 0 ? "✅" : "⚠️",
    message: `${activePartners} partners active in last 7 days`,
  });

  // Check 4: API execution logs
  const recentLogs = await prisma.executionLog.count({
    where: {
      organizationId,
      sentAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000),
      },
    },
  });
  checks.push({
    name: "System Activity",
    status: recentLogs > 0 ? "✅" : "⚠️",
    message: `${recentLogs} operations in last hour`,
  });

  const criticalCount = checks.filter((c) => c.status.includes("❌")).length;
  const warningCount = checks.filter((c) => c.status.includes("⚠️")).length;

  let status: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
  if (criticalCount > 1) status = "CRITICAL";
  else if (criticalCount > 0 || warningCount > 2) status = "WARNING";

  return {
    status,
    checks,
  };
}
