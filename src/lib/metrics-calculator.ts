import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface HeroKPI {
  label: string;
  value: number;
  previousValue: number;
  change: number; // percentage
  changeType: "UP" | "DOWN" | "STABLE";
  target: number;
  achievementPercent: number;
}

export interface MetricsPyramid {
  // Layer 1: Hero KPIs
  hero: {
    totalRevenue: HeroKPI;
    newContacts: HeroKPI;
    conversionRate: HeroKPI;
    averageOrderValue: HeroKPI;
  };

  // Layer 2: Lens breakdown
  lenseMetrics: {
    lensName: string;
    contactCount: number;
    conversionRate: number;
    revenue: number;
    trend: "UP" | "DOWN" | "STABLE";
  }[];

  // Layer 3: Channel analysis
  channelMetrics: {
    channel: string; // SMS, EMAIL, CALL, etc
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    cpa: number; // Cost per acquisition
    roas: number; // Return on ad spend
  }[];

  // Layer 4: Risk analysis
  riskMetrics: {
    totalContacts: number;
    atRiskCount: number;
    riskScore: number; // Average 0-100
    severityDistribution: {
      RED: number;
      YELLOW: number;
      GREEN: number;
    };
  };

  // Layer 5: Business model
  businessModel: {
    partnerCount: number;
    topPartnerRevenue: number;
    averagePartnerRevenue: number;
    partnerRetentionRate: number;
    affiliateRevenuePercent: number;
  };
}

export async function calculateHeroKPIs(
  organizationId: string
): Promise<MetricsPyramid["hero"]> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const [
    currentContacts,
    previousContacts,
    currentRevenue,
    previousRevenue,
    conversions,
    previousConversions,
  ] = await Promise.all([
    prisma.contact.count({
      where: { organizationId, createdAt: { gte: monthStart } },
    }),
    prisma.contact.count({
      where: {
        organizationId,
        createdAt: { gte: lastMonthStart, lt: monthStart },
      },
    }),
    prisma.affiliateSale.aggregate({
      where: {
        organizationId,
        createdAt: { gte: monthStart },
        status: "CONFIRMED",
      },
      _sum: { saleAmount: true },
    }),
    prisma.affiliateSale.aggregate({
      where: {
        organizationId,
        createdAt: { gte: lastMonthStart, lt: monthStart },
        status: "CONFIRMED",
      },
      _sum: { saleAmount: true },
    }),
    prisma.affiliateSale.count({
      where: {
        organizationId,
        createdAt: { gte: monthStart },
        status: "CONFIRMED",
      },
    }),
    prisma.affiliateSale.count({
      where: {
        organizationId,
        createdAt: { gte: lastMonthStart, lt: monthStart },
        status: "CONFIRMED",
      },
    }),
  ]);

  const totalRevenue = currentRevenue._sum.saleAmount || 0;
  const previousTotalRevenue = previousRevenue._sum.saleAmount || 0;
  const revenueChange =
    previousTotalRevenue > 0
      ? ((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100
      : 0;

  const newContactsChange =
    previousContacts > 0
      ? ((currentContacts - previousContacts) / previousContacts) * 100
      : 0;

  const currentConversionRate =
    currentContacts > 0 ? (conversions / currentContacts) * 100 : 0;
  const previousConversionRate =
    previousContacts > 0 ? (previousConversions / previousContacts) * 100 : 0;
  const conversionRateChange =
    previousConversionRate > 0
      ? ((currentConversionRate - previousConversionRate) /
          previousConversionRate) *
        100
      : 0;

  const currentAOV = conversions > 0 ? totalRevenue / conversions : 0;
  const previousAOV =
    previousConversions > 0 ? previousTotalRevenue / previousConversions : 0;
  const aovChange =
    previousAOV > 0 ? ((currentAOV - previousAOV) / previousAOV) * 100 : 0;

  const targetRevenue = 10000000; // 1천만원 목표
  const targetContacts = 100;
  const targetConversionRate = 15; // 15%
  const targetAOV = 2000000; // 200만원

  return {
    totalRevenue: {
      label: "월간 매출",
      value: totalRevenue,
      previousValue: previousTotalRevenue,
      change: revenueChange,
      changeType:
        revenueChange > 2 ? "UP" : revenueChange < -2 ? "DOWN" : "STABLE",
      target: targetRevenue,
      achievementPercent: targetRevenue > 0 ? (totalRevenue / targetRevenue) * 100 : 0,
    },
    newContacts: {
      label: "신규 고객",
      value: currentContacts,
      previousValue: previousContacts,
      change: newContactsChange,
      changeType:
        newContactsChange > 2 ? "UP" : newContactsChange < -2 ? "DOWN" : "STABLE",
      target: targetContacts,
      achievementPercent: targetContacts > 0 ? (currentContacts / targetContacts) * 100 : 0,
    },
    conversionRate: {
      label: "전환율",
      value: currentConversionRate,
      previousValue: previousConversionRate,
      change: conversionRateChange,
      changeType:
        conversionRateChange > 2
          ? "UP"
          : conversionRateChange < -2
            ? "DOWN"
            : "STABLE",
      target: targetConversionRate,
      achievementPercent: targetConversionRate > 0 ? (currentConversionRate / targetConversionRate) * 100 : 0,
    },
    averageOrderValue: {
      label: "평균 주문액",
      value: currentAOV,
      previousValue: previousAOV,
      change: aovChange,
      changeType: aovChange > 2 ? "UP" : aovChange < -2 ? "DOWN" : "STABLE",
      target: targetAOV,
      achievementPercent: targetAOV > 0 ? (currentAOV / targetAOV) * 100 : 0,
    },
  };
}

export async function calculateMetricsPyramid(
  organizationId: string
): Promise<MetricsPyramid> {
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  const hero = await calculateHeroKPIs(organizationId);

  // Layer 2: Lens metrics
  const lenseMetrics = await Promise.all(
    ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"].map(
      async (lens) => {
        const contactCount = await prisma.contact.count({
          where: {
            organizationId,
            tags: { hasSome: [lens] },
          },
        });

        const conversions = await prisma.affiliateSale.count({
          where: {
            organizationId,
            createdAt: { gte: monthStart },
            status: "CONFIRMED",
          },
        });

        const revenue = await prisma.affiliateSale.aggregate({
          where: {
            organizationId,
            createdAt: { gte: monthStart },
            status: "CONFIRMED",
          },
          _sum: { saleAmount: true },
        });

        return {
          lensName: lens,
          contactCount,
          conversionRate:
            contactCount > 0 ? (conversions / contactCount) * 100 : 0,
          revenue: revenue._sum.saleAmount || 0,
          trend: "STABLE" as const,
        };
      }
    )
  );

  // Layer 3: Channel metrics (simplified)
  const channelMetrics = [
    {
      channel: "SMS",
      sent: 12500,
      opened: 3750,
      clicked: 750,
      converted: 150,
      cpa: 50000,
      roas: 3.5,
    },
    {
      channel: "EMAIL",
      sent: 8000,
      opened: 2400,
      clicked: 480,
      converted: 96,
      cpa: 62500,
      roas: 2.8,
    },
    {
      channel: "CALL",
      sent: 200,
      opened: 150,
      clicked: 75,
      converted: 30,
      cpa: 100000,
      roas: 4.2,
    },
  ];

  // Layer 4: Risk metrics
  const totalContacts = await prisma.contact.count({
    where: { organizationId },
  });

  const atRiskContacts = await prisma.contact.count({
    where: {
      organizationId,
      tags: { hasSome: ["RISK_HIGH", "RISK_CRITICAL"] },
    },
  });

  const riskMetrics = {
    totalContacts,
    atRiskCount: atRiskContacts,
    riskScore: 45, // TODO: Calculate actual average risk score
    severityDistribution: {
      RED: Math.floor(atRiskContacts * 0.4),
      YELLOW: Math.floor(atRiskContacts * 0.5),
      GREEN: totalContacts - atRiskContacts,
    },
  };

  // Layer 5: Business model
  const partners = await prisma.partner.findMany({
    where: { organizationId },
    select: { id: true, name: true, totalRevenue: true, totalEarnings: true },
  });

  // Get affiliate sales separately
  const affiliateSales = await prisma.affiliateSale.findMany({
    where: {
      organizationId,
      createdAt: { gte: monthStart },
    },
    select: { affiliateCode: true, saleAmount: true, commissionAmount: true, refundedAmount: true },
  });

  // Group affiliate sales by partner (using affiliate code or similar mapping)
  const partnerRevenues = partners.map((p) => {
    const sales = affiliateSales.filter(s => s.affiliateCode === p.id);
    return sales.reduce((sum, s) => sum + (s.saleAmount - (s.refundedAmount || 0)), 0);
  });

  const businessModel = {
    partnerCount: partners.length,
    topPartnerRevenue: partnerRevenues.length > 0 ? Math.max(...partnerRevenues) : 0,
    averagePartnerRevenue:
      partnerRevenues.length > 0
        ? partnerRevenues.reduce((a, b) => a + b, 0) / partnerRevenues.length
        : 0,
    partnerRetentionRate: 0.85, // TODO: Calculate actual retention
    affiliateRevenuePercent: 0.25, // TODO: Calculate actual percentage
  };

  return {
    hero,
    lenseMetrics,
    channelMetrics,
    riskMetrics,
    businessModel,
  };
}
