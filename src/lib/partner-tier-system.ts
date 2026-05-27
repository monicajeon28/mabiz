import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type PartnerTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export interface TierBenefit {
  tier: PartnerTier;
  minMonthlyRevenue: number;
  maxMonthlyRevenue: number | null;
  commissionRate: number;
  bonusPercentage: number;
  features: string[];
  supportLevel: "BASIC" | "STANDARD" | "PREMIUM" | "ELITE";
}

const TIER_DEFINITIONS: Record<PartnerTier, TierBenefit> = {
  BRONZE: {
    tier: "BRONZE",
    minMonthlyRevenue: 0,
    maxMonthlyRevenue: 500000, // 50만원
    commissionRate: 0.15, // 15%
    bonusPercentage: 0, // No bonus
    features: [
      "기본 판매 대시보드",
      "월 1회 성과 리포팅",
      "이메일 지원",
    ],
    supportLevel: "BASIC",
  },

  SILVER: {
    tier: "SILVER",
    minMonthlyRevenue: 500000,
    maxMonthlyRevenue: 2000000,
    commissionRate: 0.18, // 18%
    bonusPercentage: 5, // +5% 월 성과 보너스
    features: [
      "고급 판매 대시보드",
      "주 1회 성과 리포팅",
      "우선 이메일/전화 지원",
      "마케팅 자료 지원",
    ],
    supportLevel: "STANDARD",
  },

  GOLD: {
    tier: "GOLD",
    minMonthlyRevenue: 2000000,
    maxMonthlyRevenue: 5000000,
    commissionRate: 0.2, // 20%
    bonusPercentage: 10, // +10% 월 성과 보너스
    features: [
      "전체 CRM 대시보드 + 분석",
      "주 2회 성과 리포팅",
      "전담 계정 매니저",
      "맞춤형 마케팅 지원",
      "우선 지원 (전화/라이브 챗)",
    ],
    supportLevel: "PREMIUM",
  },

  PLATINUM: {
    tier: "PLATINUM",
    minMonthlyRevenue: 5000000,
    maxMonthlyRevenue: null,
    commissionRate: 0.22, // 22%
    bonusPercentage: 15, // +15% 월 성과 보너스 + 성과금
    features: [
      "전체 CRM + 예측 분석",
      "일일 성과 리포팅",
      "전담 계정 매니저 + 계약금",
      "AI 기반 마케팅 최적화",
      "VIP 지원 (24/7 전담 번호)",
      "연 2회 오프라인 미팅",
      "신규 기능 우선 테스트 권리",
    ],
    supportLevel: "ELITE",
  },
};

export async function calculatePartnerTier(
  partnerId: string,
  monthYearOffset: number = 0
): Promise<PartnerTier> {
  try {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthYearOffset);

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        affiliateSales: {
          where: {
            createdAt: {
              gte: new Date(
                targetDate.getFullYear(),
                targetDate.getMonth(),
                1
              ),
              lt: new Date(
                targetDate.getFullYear(),
                targetDate.getMonth() + 1,
                1
              ),
            },
          },
        },
      },
    });

    if (!partner) return "BRONZE";

    const monthlyRevenue = partner.affiliateSales.reduce(
      (sum, s) => sum + (s.confirmedAmount || 0),
      0
    );

    // 수익에 따라 티어 결정
    for (const tier of ["PLATINUM", "GOLD", "SILVER", "BRONZE"] as const) {
      const def = TIER_DEFINITIONS[tier];
      if (
        monthlyRevenue >= def.minMonthlyRevenue &&
        (!def.maxMonthlyRevenue || monthlyRevenue < def.maxMonthlyRevenue)
      ) {
        return tier;
      }
    }

    return "BRONZE";
  } catch (err) {
    logger.error("[Partner Tier] Calculation failed", { err, partnerId });
    return "BRONZE";
  }
}

export async function updatePartnerTiers(
  organizationId: string
): Promise<{ updated: number; changes: string[] }> {
  try {
    const partners = await prisma.partner.findMany({
      where: { organizationId },
      select: { id: true, commissionRate: true },
    });

    const changes: string[] = [];
    let updated = 0;

    for (const partner of partners) {
      const newTier = await calculatePartnerTier(partner.id);
      const tierDef = TIER_DEFINITIONS[newTier];

      // Update commission rate if changed
      if (
        parseFloat(partner.commissionRate as any) !== tierDef.commissionRate
      ) {
        await prisma.partner.update({
          where: { id: partner.id },
          data: {
            commissionRate: tierDef.commissionRate.toFixed(2),
          },
        });

        changes.push(
          `Partner ${partner.id}: tier=${newTier}, commission=${(tierDef.commissionRate * 100).toFixed(0)}%`
        );
        updated++;
      }
    }

    if (updated > 0) {
      logger.log("[Partner Tier] Updated partners", {
        organizationId,
        updated,
        changes: changes.slice(0, 5), // Log first 5
      });
    }

    return { updated, changes };
  } catch (err) {
    logger.error("[Partner Tier] Update failed", { err, organizationId });
    return { updated: 0, changes: [] };
  }
}

export async function getTierBenefits(
  tier: PartnerTier
): Promise<TierBenefit> {
  return TIER_DEFINITIONS[tier];
}

export async function getTierUpgradeOpportunities(
  partnerId: string
): Promise<{
  currentTier: PartnerTier;
  currentRevenue: number;
  nextTier?: PartnerTier;
  revenueGapToNextTier?: number;
  percentageToNextTier?: number;
}> {
  try {
    const currentTier = await calculatePartnerTier(partnerId);
    const currentDef = TIER_DEFINITIONS[currentTier];

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        affiliateSales: {
          where: {
            createdAt: {
              gte: new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1
              ),
            },
          },
        },
      },
    });

    if (!partner) {
      return { currentTier, currentRevenue: 0 };
    }

    const currentRevenue = partner.affiliateSales.reduce(
      (sum, s) => sum + (s.confirmedAmount || 0),
      0
    );

    // Find next tier
    const tierOrder: PartnerTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
    const currentIndex = tierOrder.indexOf(currentTier);
    const nextTier =
      currentIndex < tierOrder.length - 1
        ? tierOrder[currentIndex + 1]
        : undefined;

    if (nextTier) {
      const nextDef = TIER_DEFINITIONS[nextTier];
      const gap = nextDef.minMonthlyRevenue - currentRevenue;
      const percentage = (currentRevenue / nextDef.minMonthlyRevenue) * 100;

      return {
        currentTier,
        currentRevenue,
        nextTier,
        revenueGapToNextTier: Math.max(0, gap),
        percentageToNextTier: Math.min(100, percentage),
      };
    }

    return { currentTier, currentRevenue };
  } catch (err) {
    logger.error("[Partner Tier] Opportunity check failed", {
      err,
      partnerId,
    });
    return { currentTier: "BRONZE", currentRevenue: 0 };
  }
}
