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
  monthlyRevenue: number;
  totalRevenue: number;
  customerCount: number;
  salesCount: number;
  churnRiskScore: number;
  churnSeverity: string;
  tierUpgradeProgress?: {
    nextTier?: string;
    percentageToNext: number;
    revenueGapToNext: number;
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
        affiliateSales: {
          orderBy: { createdAt: "desc" },
          take: 180, // 6개월
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
      const monthlyRevenue = partner.affiliateSales
        .filter((s) => new Date(s.createdAt) >= monthStart)
        .reduce((sum, s) => sum + (s.confirmedAmount || 0), 0);

      // 총 수익
      const totalRevenue = partner.affiliateSales.reduce(
        (sum, s) => sum + (s.confirmedAmount || 0),
        0
      );

      // 확인율
      const confirmedCount = partner.affiliateSales.filter(
        (s) => s.status === "CONFIRMED"
      ).length;
      const confirmedRate =
        partner.affiliateSales.length > 0
          ? (confirmedCount / partner.affiliateSales.length) * 100
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

      const lastMonthRevenue = partner.affiliateSales
        .filter(
          (s) =>
            new Date(s.createdAt) >= lastMonthStart &&
            new Date(s.createdAt) <= lastMonthEnd
        )
        .reduce((sum, s) => sum + (s.confirmedAmount || 0), 0);

      const monthlyGrowth =
        lastMonthRevenue > 0
          ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
          : 0;

      // 고객 수
      const uniqueCustomers = new Set(
        partner.affiliateSales.map((s) => s.customerId)
      ).size;

      // Tier upgrade progress
      const tierUpgrade = await getTierUpgradeOpportunities(partner.id);

      analyticsData.push({
        id: partner.id,
        name: partner.name,
        email: partner.email,
        currentTier,
        monthlyRevenue,
        totalRevenue,
        customerCount: uniqueCustomers,
        salesCount: partner.affiliateSales.length,
        churnRiskScore: churnRisk?.churnRiskScore || 0,
        churnSeverity: churnRisk?.severity || "LOW",
        tierUpgradeProgress: {
          nextTier: tierUpgrade.nextTier,
          percentageToNext: tierUpgrade.percentageToNextTier || 0,
          revenueGapToNext: tierUpgrade.revenueGapToNextTier || 0,
        },
        performance: {
          confirmedRate,
          avgRevenuePerCustomer:
            uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0,
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
