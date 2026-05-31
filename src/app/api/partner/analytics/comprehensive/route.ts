import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { calculatePartnerTier, getTierUpgradeOpportunities } from "@/lib/partner-tier-system";
import { detectPartnerChurnRisk } from "@/lib/partner-churn-detector";
import { logger } from "@/lib/logger";

interface PartnerAnalytics {
  id: string;
  name: string;
  email: string | null;
  currentTier: string;
  monthlyRevenue: bigint;
  totalRevenue: bigint;
  customerCount: number;
  salesCount: number;
  churnRiskScore: number;
  churnSeverity: string;
  tierUpgradeProgress?: {
    nextTier?: string;
    percentageToNext: number;
    revenueGapToNext: bigint;
  };
  performance: {
    confirmedRate: number; // 확인율
    avgRevenuePerCustomer: number;
    monthlyGrowth: number; // %
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const searchParams = request.nextUrl.searchParams;
    const partnerId = searchParams.get("partnerId"); // Optional: specific partner

    // 파트너 목록 조회
    const partners = await prisma.partner.findMany({
      where: {
        organizationId: orgId,
        ...(partnerId ? { id: partnerId } : {}),
      },
      include: {
        metrics: {
          orderBy: { createdAt: "desc" },
          take: 6, // 6개월
        },
        settlementLedger: {
          orderBy: { createdAt: "desc" },
          take: 100, // 최근 정산 100건 조회
        },
      },
    });

    const analyticsData: PartnerAnalytics[] = [];

    for (const partner of partners) {
      const currentTier = await calculatePartnerTier(partner.id);
      const churnRisk = await detectPartnerChurnRisk(partner.id);

      // 월간 수익 계산
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );
      const monthlyRevenue = partner.settlementLedger
        .filter((s) => new Date(s.createdAt) >= monthStart)
        .reduce((sum: bigint, s) => sum + (s.netAmount || BigInt(0)), BigInt(0));

      // 총 수익 (Partner 모델의 totalRevenue 사용)
      const totalRevenue = partner.totalRevenue;

      // 확인율 (PartnerMetrics에 status가 없으므로, customerCount 기반으로 계산)
      const confirmedCount = partner.metrics.filter(
        (m) => m.customerCount && m.customerCount > 0
      ).length;
      const confirmedRate =
        partner.metrics.length > 0
          ? (confirmedCount / partner.metrics.length) * 100
          : 0;

      // 월간 성장률 (vs 지난달)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthStart = new Date(
        lastMonth.getFullYear(),
        lastMonth.getMonth(),
        1
      );
      const lastMonthEnd = new Date(
        lastMonth.getFullYear(),
        lastMonth.getMonth() + 1,
        0
      );

      const lastMonthRevenue = partner.settlementLedger
        .filter(
          (s) =>
            new Date(s.createdAt) >= lastMonthStart &&
            new Date(s.createdAt) <= lastMonthEnd
        )
        .reduce((sum: bigint, s) => sum + (s.netAmount || BigInt(0)), BigInt(0));

      const monthlyGrowth =
        lastMonthRevenue > BigInt(0)
          ? (Number(monthlyRevenue - lastMonthRevenue) / Number(lastMonthRevenue)) * 100
          : 0;

      // 고객 수 (Partner가 담당하는 Contact 수)
      const customerCount = await prisma.contact.count({
        where: {
          partnerId: partner.id,
          organizationId: orgId,
        },
      });

      // Tier upgrade progress
      const tierUpgrade = await getTierUpgradeOpportunities(partner.id);

      analyticsData.push({
        id: partner.id,
        name: partner.name,
        email: partner.email,
        currentTier,
        monthlyRevenue,
        totalRevenue,
        customerCount,
        salesCount: partner.settlementLedger.length,
        churnRiskScore: churnRisk?.churnRiskScore || 0,
        churnSeverity: churnRisk?.severity || "LOW",
        tierUpgradeProgress: {
          nextTier: tierUpgrade.nextTier,
          percentageToNext: tierUpgrade.percentageToNextTier || 0,
          revenueGapToNext: tierUpgrade.revenueGapToNextTier || BigInt(0),
        },
        performance: {
          confirmedRate,
          avgRevenuePerCustomer:
            customerCount > 0 ? Number(totalRevenue) / customerCount : 0,
          monthlyGrowth,
        },
      });
    }

    // 정렬 (위험도 높은 순서)
    analyticsData.sort((a, b) => b.churnRiskScore - a.churnRiskScore);

    logger.log("[Partner Analytics]", {
      organizationId: orgId,
      count: analyticsData.length,
      criticalRiskCount: analyticsData.filter(
        (a) => a.churnSeverity === "CRITICAL"
      ).length,
    });

    return NextResponse.json({
      ok: true,
      data: analyticsData,
    });
  } catch (err) {
    logger.error("[Partner Analytics]", { err });
    return NextResponse.json(
      { ok: false, message: "파트너 분석 조회 실패" },
      { status: 500 }
    );
  }
}
