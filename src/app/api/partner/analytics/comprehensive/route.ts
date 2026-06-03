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

    // 파트너별 4개 비동기 작업을 Promise.all로 병렬 실행 (직렬 300+ 쿼리 → 배치 병렬)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const analyticsData: PartnerAnalytics[] = await Promise.all(
      partners.map(async (partner) => {
        // 4개 쿼리/계산을 병렬로 실행
        const [currentTier, churnRisk, customerCount, tierUpgrade] =
          await Promise.all([
            calculatePartnerTier(partner.id),
            detectPartnerChurnRisk(partner.id),
            prisma.contact.count({
              where: { partnerId: partner.id, organizationId: orgId },
            }),
            getTierUpgradeOpportunities(partner.id),
          ]);

        // 월간 수익 계산 (이미 메모리에 로드된 settlementLedger 사용)
        const monthlyRevenue = partner.settlementLedger
          .filter((s) => new Date(s.createdAt) >= monthStart)
          .reduce((sum: bigint, s) => sum + (s.netAmount || BigInt(0)), BigInt(0));

        const totalRevenue = partner.totalRevenue;

        // 확인율
        const confirmedCount = partner.metrics.filter(
          (m) => m.customerCount && m.customerCount > 0
        ).length;
        const confirmedRate =
          partner.metrics.length > 0
            ? (confirmedCount / partner.metrics.length) * 100
            : 0;

        // 월간 성장률 (vs 지난달)
        const lastMonthRevenue = partner.settlementLedger
          .filter(
            (s) =>
              new Date(s.createdAt) >= lastMonth &&
              new Date(s.createdAt) <= lastMonthEnd
          )
          .reduce((sum: bigint, s) => sum + (s.netAmount || BigInt(0)), BigInt(0));

        const monthlyGrowth =
          lastMonthRevenue > BigInt(0)
            ? (Number(monthlyRevenue - lastMonthRevenue) / Number(lastMonthRevenue)) * 100
            : 0;

        return {
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
            revenueGapToNext: BigInt(tierUpgrade.revenueGapToNextTier ?? 0),
          },
          performance: {
            confirmedRate,
            avgRevenuePerCustomer:
              customerCount > 0 ? Number(totalRevenue) / customerCount : 0,
            monthlyGrowth,
          },
        };
      })
    );

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
