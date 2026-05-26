/**
 * Partner Analytics Service
 *
 * Daily aggregation of partner metrics:
 * - Sales count (day/week/month)
 * - Commission earned
 * - Customer metrics
 * - Performance tier calculation
 * - Comparison with previous periods
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface DailyMetrics {
  partnerId: string;
  date: Date;
  salesCount: number;
  commission: bigint;
  weeklyComparison: {
    salesCount: number;
    commission: bigint;
    percentChange: number;
  };
  monthlyComparison: {
    salesCount: number;
    commission: bigint;
    percentChange: number;
  };
  topCustomers: Array<{
    contactId: string;
    name: string;
    email: string;
    purchasedAt: Date | null;
  }>;
  churnRate: number; // % of referred customers lost
  currentTier: 'Tier1' | 'Tier2' | 'Tier3' | 'Tier4';
  rank: number; // Rank among all partners in organization
}

/**
 * Get or create daily metrics for a partner
 */
export async function getDailyMetrics(partnerId: string): Promise<DailyMetrics> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      contacts: {
        where: { type: { in: ['CUSTOMER', 'PROSPECT'] } },
        select: {
          id: true,
          name: true,
          email: true,
          purchasedAt: true,
          createdAt: true,
        },
      },
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 2, // Current and previous month
      },
    },
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayDate = new Date();
  const yesterday = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);

  // Calculate sales today
  const salesToday = partner.contacts.filter((c) => {
    if (!c.purchasedAt) return false;
    const purchaseDate = new Date(c.purchasedAt);
    purchaseDate.setHours(0, 0, 0, 0);
    return purchaseDate.getTime() === today.getTime();
  }).length;

  // Calculate weekly metrics (last 7 days vs 7 days before)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const salesLast7Days = partner.contacts.filter(
    (c) => c.purchasedAt && c.purchasedAt > sevenDaysAgo
  ).length;

  const salesPrevious7Days = partner.contacts.filter(
    (c) => c.purchasedAt && c.purchasedAt > fourteenDaysAgo && c.purchasedAt <= sevenDaysAgo
  ).length;

  const weeklyPercentChange =
    salesPrevious7Days > 0
      ? ((salesLast7Days - salesPrevious7Days) / salesPrevious7Days) * 100
      : 0;

  // Calculate monthly metrics
  const thisMonth = new Date();
  const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
  const firstDayThisMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);

  const salesThisMonth = partner.contacts.filter((c) => {
    if (!c.purchasedAt) return false;
    return c.purchasedAt >= firstDayThisMonth;
  }).length;

  const salesLastMonth = partner.contacts.filter((c) => {
    if (!c.purchasedAt) return false;
    return c.purchasedAt >= lastMonth && c.purchasedAt < firstDayThisMonth;
  }).length;

  const monthlyPercentChange =
    salesLastMonth > 0
      ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100
      : 0;

  // Calculate commission from metrics
  const currentMetrics = partner.metrics?.[0];
  const previousMetrics = partner.metrics?.[1];

  const currentCommission = currentMetrics ? BigInt(currentMetrics.revenue) : BigInt(0);
  const previousCommission = previousMetrics ? BigInt(previousMetrics.revenue) : BigInt(0);

  // Get top customers by purchase date
  const topCustomers = partner.contacts
    .sort((a, b) => {
      if (!a.purchasedAt || !b.purchasedAt) return 0;
      return b.purchasedAt.getTime() - a.purchasedAt.getTime();
    })
    .slice(0, 5)
    .map((c) => ({
      contactId: c.id,
      name: c.name,
      email: c.email || '',
      purchasedAt: c.purchasedAt,
    }));

  // Calculate churn rate (customers created but never purchased)
  const totalReferred = partner.contacts.length;
  const customersPurchased = partner.contacts.filter((c) => c.purchasedAt).length;
  const churnRate = totalReferred > 0 ? ((totalReferred - customersPurchased) / totalReferred) * 100 : 0;

  // Calculate current tier based on monthly commission
  let currentTier: 'Tier1' | 'Tier2' | 'Tier3' | 'Tier4';
  const monthlyCommission = Number(currentCommission);

  if (monthlyCommission > 20000) {
    currentTier = 'Tier1';
  } else if (monthlyCommission > 5000) {
    currentTier = 'Tier2';
  } else if (monthlyCommission > 1000) {
    currentTier = 'Tier3';
  } else {
    currentTier = 'Tier4';
  }

  // Calculate rank among all partners in organization
  const allPartnerCommissions = await prisma.partner.findMany({
    where: { organizationId: partner.organizationId, status: 'ACTIVE' },
    include: {
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      totalRevenue: 'desc',
    },
  });

  const rank =
    allPartnerCommissions.findIndex((p) => p.id === partnerId) + 1 || 999;

  return {
    partnerId,
    date: today,
    salesCount: salesToday,
    commission: currentCommission,
    weeklyComparison: {
      salesCount: salesLast7Days,
      commission: previousCommission,
      percentChange: weeklyPercentChange,
    },
    monthlyComparison: {
      salesCount: salesThisMonth,
      commission: previousCommission,
      percentChange: monthlyPercentChange,
    },
    topCustomers,
    churnRate,
    currentTier,
    rank,
  };
}

/**
 * Aggregate daily metrics for all partners in organization
 */
export async function aggregateDailyMetrics(organizationId: string) {
  const partners = await prisma.partner.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { id: true },
  });

  const results = {
    total: partners.length,
    processed: 0,
    byTier: {
      Tier1: 0,
      Tier2: 0,
      Tier3: 0,
      Tier4: 0,
    },
    topPerformers: [] as string[],
    needsAttention: [] as string[],
    errors: [] as string[],
  };

  for (const partner of partners) {
    try {
      const metrics = await getDailyMetrics(partner.id);
      results.processed++;
      results.byTier[metrics.currentTier]++;

      if (metrics.rank <= 5) {
        results.topPerformers.push(partner.id);
      }

      if (metrics.churnRate > 50) {
        results.needsAttention.push(partner.id);
      }
    } catch (err) {
      results.errors.push(`${partner.id}: ${String(err)}`);
      logger.error('Error aggregating daily metrics', { partnerId: partner.id, err });
    }
  }

  return results;
}

/**
 * Get top N partners by commission
 */
export async function getTopPartners(
  organizationId: string,
  limit: number = 10
) {
  const partners = await prisma.partner.findMany({
    where: { organizationId, status: 'ACTIVE' },
    include: {
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      contacts: {
        select: { id: true, purchasedAt: true },
      },
    },
    orderBy: {
      totalRevenue: 'desc',
    },
    take: limit,
  });

  return partners.map((p, index) => ({
    rank: index + 1,
    partner: p,
    commission: p.metrics[0]?.revenue || BigInt(0),
    salesCount: p.contacts.filter((c) => c.purchasedAt).length,
  }));
}

/**
 * Get partner ranking and percentile
 */
export async function getPartnerRanking(partnerId: string) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { organizationId: true },
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const totalPartners = await prisma.partner.count({
    where: { organizationId: partner.organizationId, status: 'ACTIVE' },
  });

  const partnersAbove = await prisma.partner.count({
    where: {
      organizationId: partner.organizationId,
      status: 'ACTIVE',
      totalRevenue: {
        gt: (await prisma.partner.findUnique({ where: { id: partnerId } }))
          ?.totalRevenue || 0,
      },
    },
  });

  const rank = partnersAbove + 1;
  const percentile = Math.round(((totalPartners - partnersAbove) / totalPartners) * 100);

  return {
    rank,
    totalPartners,
    percentile,
  };
}
