/**
 * Partner Churn Risk Detector
 *
 * 10-point risk scoring system for partner health assessment
 * Triggers automatic interventions based on risk level
 *
 * Risk Levels:
 * - GREEN (0-3): Healthy, continue normal support
 * - YELLOW (4-6): At-risk, send encouragement + incentive
 * - RED (7+): Critical, immediate intervention required
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface ChurnRiskScore {
  partnerId: string;
  score: number; // 0-10+
  riskLevel: 'GREEN' | 'YELLOW' | 'RED';
  breakdown: {
    noSalesIn7Days: boolean; // +3
    noSalesIn14Days: boolean; // +5
    commissionDrop30Percent: boolean; // +4
    noEmailOpenIn30Days: boolean; // +2
    referredLessThan5: boolean; // +1
    ratingBelow3Stars: boolean; // +3
  };
  previousScore: number;
  previousLevel: 'GREEN' | 'YELLOW' | 'RED';
  changedLevel: boolean;
  lastUpdated: Date;
}

/**
 * Calculate partner churn risk score
 * Returns detailed breakdown and recommended action
 */
export async function calculateChurnRisk(partnerId: string): Promise<ChurnRiskScore> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      contacts: {
        where: { type: { in: ['CUSTOMER', 'PROSPECT'] } },
        select: { id: true, createdAt: true, purchasedAt: true },
      },
      riskFlags: true,
    },
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  let score = 0;
  const breakdown = {
    noSalesIn7Days: false,
    noSalesIn14Days: false,
    commissionDrop30Percent: false,
    noEmailOpenIn30Days: false,
    referredLessThan5: false,
    ratingBelow3Stars: false,
  };

  // Signal 1: No sales in last 7 days (+3 points)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSales = partner.contacts.filter(
    (c) => c.purchasedAt && c.purchasedAt > sevenDaysAgo
  ).length;

  if (recentSales === 0) {
    score += 3;
    breakdown.noSalesIn7Days = true;
  }

  // Signal 2: No sales in last 14 days (+5 points)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentSales14Days = partner.contacts.filter(
    (c) => c.purchasedAt && c.purchasedAt > fourteenDaysAgo
  ).length;

  if (recentSales14Days === 0) {
    score += 5;
    breakdown.noSalesIn14Days = true;
  }

  // Signal 3: Commission drop >30% vs last month (+4 points)
  if (partner.metrics && partner.metrics.length > 0) {
    const currentMonth = partner.metrics[0];

    // Get previous month metrics
    const previousMonthDate = new Date();
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

    const previousMetrics = await prisma.partnerMetrics.findFirst({
      where: {
        partnerId,
        year: previousMonthDate.getFullYear(),
        month: previousMonthDate.getMonth() + 1,
      },
    });

    if (previousMetrics && previousMetrics.revenue > 0) {
      const percentChange = ((Number(currentMonth.revenue) - Number(previousMetrics.revenue)) / Number(previousMetrics.revenue)) * 100;
      if (percentChange < -30) {
        score += 4;
        breakdown.commissionDrop30Percent = true;
      }
    }
  }

  // Signal 4: Hasn't opened email in 30 days (+2 points)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Check PartnerOnboardingLog for recent email opens
  const recentEmailOpen = await prisma.partnerOnboardingLog?.findFirst({
    where: {
      partnerId,
      emailOpenedAt: { gt: thirtyDaysAgo },
    },
  }).catch(() => null);

  if (!recentEmailOpen) {
    score += 2;
    breakdown.noEmailOpenIn30Days = true;
  }

  // Signal 5: Referred <5 customers total (+1 point)
  if (partner.contacts.length < 5) {
    score += 1;
    breakdown.referredLessThan5 = true;
  }

  // Signal 6: Rating <3/5 stars (+3 points)
  // This would come from a Partner ratings table (future enhancement)
  // For now, we skip this signal
  // TODO: Implement partner ratings system

  // Determine risk level
  const riskLevel = score <= 3 ? 'GREEN' : score <= 6 ? 'YELLOW' : 'RED';

  // Get previous score for comparison
  const previousRisk = partner.riskFlags || {
    totalRiskScore: 0,
  };
  const previousScore = previousRisk?.totalRiskScore || 0;
  const previousLevel = previousScore <= 3 ? 'GREEN' : previousScore <= 6 ? 'YELLOW' : 'RED';
  const changedLevel = previousLevel !== riskLevel;

  // Update or create risk flags record
  if (partner.riskFlags) {
    await prisma.partnerRiskFlags.update({
      where: { partnerId },
      data: {
        totalRiskScore: score,
        lowPerformanceScore: breakdown.noSalesIn7Days || breakdown.noSalesIn14Days ? score : 0,
        churnScore: breakdown.commissionDrop30Percent ? score : 0,
        lastReviewedAt: new Date(),
      },
    });
  } else {
    await prisma.partnerRiskFlags.create({
      data: {
        partnerId,
        totalRiskScore: score,
        lowPerformanceScore: breakdown.noSalesIn7Days || breakdown.noSalesIn14Days ? score : 0,
        churnScore: breakdown.commissionDrop30Percent ? score : 0,
      },
    });
  }

  return {
    partnerId,
    score,
    riskLevel,
    breakdown,
    previousScore,
    previousLevel,
    changedLevel,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate churn risk for all partners
 * Returns summary of partners by risk level
 */
export async function calculateAllPartnerChurnRisks(organizationId: string) {
  const partners = await prisma.partner.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { id: true },
  });

  const results = {
    total: partners.length,
    processed: 0,
    byRiskLevel: {
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
    },
    changedToRed: [] as string[],
    changedToYellow: [] as string[],
    improved: [] as string[],
    errors: [] as string[],
  };

  for (const partner of partners) {
    try {
      const risk = await calculateChurnRisk(partner.id);
      results.processed++;
      results.byRiskLevel[risk.riskLevel]++;

      if (risk.changedLevel) {
        if (risk.riskLevel === 'RED') {
          results.changedToRed.push(partner.id);
        } else if (risk.riskLevel === 'YELLOW') {
          results.changedToYellow.push(partner.id);
        } else {
          results.improved.push(partner.id);
        }
      }
    } catch (err) {
      results.errors.push(`${partner.id}: ${String(err)}`);
      logger.error('Error calculating churn risk', { partnerId: partner.id, err });
    }
  }

  return results;
}

/**
 * Get partners at specific risk level
 */
export async function getPartnersByRiskLevel(
  organizationId: string,
  riskLevel: 'GREEN' | 'YELLOW' | 'RED'
) {
  const minScore = riskLevel === 'GREEN' ? 0 : riskLevel === 'YELLOW' ? 4 : 7;
  const maxScore = riskLevel === 'GREEN' ? 3 : riskLevel === 'YELLOW' ? 6 : 100;

  const partners = await prisma.partner.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      riskFlags: {
        totalRiskScore: {
          gte: minScore,
          lte: maxScore,
        },
      },
    },
    include: {
      riskFlags: true,
      contacts: {
        select: { id: true, createdAt: true, purchasedAt: true },
      },
    },
    orderBy: {
      riskFlags: {
        totalRiskScore: 'desc',
      },
    },
  });

  return partners;
}
