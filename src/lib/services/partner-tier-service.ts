/**
 * Partner Tier Service
 *
 * 4-tier system based on monthly commission:
 * - Tier 4 (Bronze): <$1K/month (15% commission)
 * - Tier 3 (Silver): $1K-$5K/month (18% commission)
 * - Tier 2 (Gold): $5K-$20K/month (21% commission)
 * - Tier 1 (Platinum): >$20K/month (25% commission + quarterly bonus)
 *
 * Auto-calculate on 1st of each month
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type TierLevel = 'Tier1' | 'Tier2' | 'Tier3' | 'Tier4';

export interface TierBenefits {
  tier: TierLevel;
  name: string;
  minMonthlyCommission: number;
  maxMonthlyCommission: number;
  baseCommissionRate: number; // percentage
  bonus?: {
    quarterly?: number; // dollars
    annual?: number; // dollars
  };
  benefits: string[];
  dedicatedManager?: boolean;
  exclusiveOffers?: boolean;
  prioritySupport?: boolean;
}

const TIER_CONFIG: Record<TierLevel, TierBenefits> = {
  Tier1: {
    tier: 'Tier1',
    name: 'Platinum',
    minMonthlyCommission: 20000,
    maxMonthlyCommission: Infinity,
    baseCommissionRate: 25,
    bonus: {
      quarterly: 1000,
      annual: 5000,
    },
    benefits: [
      'Dedicated account manager',
      'Quarterly business review',
      'Custom commission packages',
      'Priority support (24/7)',
      'Exclusive partner resources',
      'Co-marketing opportunities',
      'Annual partner conference',
      'Commission advance options',
    ],
    dedicatedManager: true,
    exclusiveOffers: true,
    prioritySupport: true,
  },
  Tier2: {
    tier: 'Tier2',
    name: 'Gold',
    minMonthlyCommission: 5000,
    maxMonthlyCommission: 20000,
    baseCommissionRate: 21,
    bonus: {
      quarterly: 500,
    },
    benefits: [
      'Dedicated account manager',
      'Monthly business reviews',
      'Exclusive offers and promotions',
      'Priority email support',
      'Access to partner community',
      'Quarterly training sessions',
      'Marketing materials and templates',
    ],
    dedicatedManager: true,
    exclusiveOffers: true,
    prioritySupport: false,
  },
  Tier3: {
    tier: 'Tier3',
    name: 'Silver',
    minMonthlyCommission: 1000,
    maxMonthlyCommission: 5000,
    baseCommissionRate: 18,
    benefits: [
      'Partner account manager',
      'Monthly newsletters',
      'New offers and promotions',
      'Standard email support',
      'Access to knowledge base',
      'Monthly training webinars',
      'Marketing support',
    ],
    dedicatedManager: false,
    exclusiveOffers: false,
    prioritySupport: false,
  },
  Tier4: {
    tier: 'Tier4',
    name: 'Bronze',
    minMonthlyCommission: 0,
    maxMonthlyCommission: 1000,
    baseCommissionRate: 15,
    benefits: [
      'Self-service partner portal',
      'Email support',
      'Access to knowledge base',
      'Weekly newsletter',
      'Onboarding materials',
    ],
    dedicatedManager: false,
    exclusiveOffers: false,
    prioritySupport: false,
  },
};

/**
 * Calculate tier for a partner based on monthly commission
 */
export function calculateTier(monthlyCommission: number): TierLevel {
  if (monthlyCommission >= 20000) return 'Tier1';
  if (monthlyCommission >= 5000) return 'Tier2';
  if (monthlyCommission >= 1000) return 'Tier3';
  return 'Tier4';
}

/**
 * Get tier benefits
 */
export function getTierBenefits(tier: TierLevel): TierBenefits {
  return TIER_CONFIG[tier];
}

/**
 * Update partner tier based on current monthly commission
 */
export async function updatePartnerTier(partnerId: string) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      performances: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        where: {
          week: null, // Get monthly data only
        },
      },
    },
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  // Get current month commission
  const currentMetrics = partner.metrics?.[0];
  const monthlyCommission = currentMetrics ? Number(currentMetrics.revenue) : 0;

  // Calculate new tier
  const newTier = calculateTier(monthlyCommission);
  const oldTier = partner.incomeLevel as TierLevel;

  // Check if tier changed
  const tierChanged = oldTier !== newTier;

  // Update partner
  const updated = await prisma.partner.update({
    where: { id: partnerId },
    data: {
      incomeLevel: newTier,
    },
  });

  // Log tier change if it occurred
  if (tierChanged) {
    logger.info('Partner tier updated', {
      partnerId,
      oldTier,
      newTier,
      monthlyCommission,
    });

    // Grant new benefits when tier up
    if (
      (newTier === 'Tier2' && oldTier === 'Tier3') ||
      (newTier === 'Tier2' && oldTier === 'Tier4') ||
      (newTier === 'Tier1' && oldTier !== 'Tier1')
    ) {
      await grantTierBenefits(partnerId, newTier);
    }
  }

  return {
    partner: updated,
    tierChanged,
    oldTier,
    newTier,
    monthlyCommission,
    benefits: getTierBenefits(newTier),
  };
}

/**
 * Grant benefits when partner tiers up
 */
async function grantTierBenefits(partnerId: string, tier: TierLevel) {
  const benefits = getTierBenefits(tier);

  logger.info('Granting tier benefits', {
    partnerId,
    tier,
    benefitCount: benefits.benefits.length,
  });

  // TODO: Implement benefit tracking
  // This could include:
  // - Sending congratulation email
  // - Notifying admin
  // - Triggering workflow for dedicated manager assignment
  // - Creating tasks for onboarding new benefits

  return benefits;
}

/**
 * Calculate all partner tiers for an organization (monthly)
 */
export async function calculateAllPartnerTiers(organizationId: string) {
  const partners = await prisma.partner.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { id: true },
  });

  const results = {
    total: partners.length,
    processed: 0,
    tierCounts: {
      Tier1: 0,
      Tier2: 0,
      Tier3: 0,
      Tier4: 0,
    },
    tierPromoted: [] as Array<{
      partnerId: string;
      fromTier: TierLevel;
      toTier: TierLevel;
    }>,
    tierDemoted: [] as Array<{
      partnerId: string;
      fromTier: TierLevel;
      toTier: TierLevel;
    }>,
    errors: [] as string[],
  };

  for (const partner of partners) {
    try {
      const { tierChanged, oldTier, newTier } = await updatePartnerTier(partner.id);
      results.processed++;
      results.tierCounts[newTier as TierLevel]++;

      if (tierChanged) {
        const tierOrder: Record<TierLevel, number> = {
          Tier1: 1,
          Tier2: 2,
          Tier3: 3,
          Tier4: 4,
        };

        if (tierOrder[newTier as TierLevel] < tierOrder[oldTier as TierLevel]) {
          results.tierPromoted.push({
            partnerId: partner.id,
            fromTier: oldTier as TierLevel,
            toTier: newTier as TierLevel,
          });
        } else {
          results.tierDemoted.push({
            partnerId: partner.id,
            fromTier: oldTier as TierLevel,
            toTier: newTier as TierLevel,
          });
        }
      }
    } catch (err) {
      results.errors.push(`${partner.id}: ${String(err)}`);
      logger.error('Error calculating partner tier', { partnerId: partner.id, err });
    }
  }

  return results;
}

/**
 * Get partners by tier
 */
export async function getPartnersByTier(
  organizationId: string,
  tier: TierLevel
) {
  const partners = await prisma.partner.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      incomeLevel: tier,
    },
    include: {
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      contacts: {
        where: { type: { in: ['CUSTOMER', 'PROSPECT'] } },
        select: { id: true, purchasedAt: true },
      },
    },
    orderBy: {
      totalRevenue: 'desc',
    },
  });

  return partners;
}

/**
 * Get tier summary for organization
 */
export async function getTierSummary(organizationId: string) {
  const tiers = await Promise.all(
    (['Tier1', 'Tier2', 'Tier3', 'Tier4'] as const).map((tier) =>
      getPartnersByTier(organizationId, tier)
    )
  );

  const totalCommission = tiers.flat().reduce((sum, p) => {
    return sum + Number(p.totalRevenue);
  }, 0);

  return {
    Tier1: {
      count: tiers[0].length,
      commission: tiers[0].reduce((sum, p) => sum + Number(p.totalRevenue), 0),
      percentage: totalCommission > 0 ? (tiers[0].reduce((sum, p) => sum + Number(p.totalRevenue), 0) / totalCommission) * 100 : 0,
    },
    Tier2: {
      count: tiers[1].length,
      commission: tiers[1].reduce((sum, p) => sum + Number(p.totalRevenue), 0),
      percentage: totalCommission > 0 ? (tiers[1].reduce((sum, p) => sum + Number(p.totalRevenue), 0) / totalCommission) * 100 : 0,
    },
    Tier3: {
      count: tiers[2].length,
      commission: tiers[2].reduce((sum, p) => sum + Number(p.totalRevenue), 0),
      percentage: totalCommission > 0 ? (tiers[2].reduce((sum, p) => sum + Number(p.totalRevenue), 0) / totalCommission) * 100 : 0,
    },
    Tier4: {
      count: tiers[3].length,
      commission: tiers[3].reduce((sum, p) => sum + Number(p.totalRevenue), 0),
      percentage: totalCommission > 0 ? (tiers[3].reduce((sum, p) => sum + Number(p.totalRevenue), 0) / totalCommission) * 100 : 0,
    },
    totalPartners: tiers.reduce((sum, t) => sum + t.length, 0),
    totalCommission,
  };
}
