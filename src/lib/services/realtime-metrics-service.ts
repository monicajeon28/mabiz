import { prisma } from '@/lib/prisma';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';
import { RealtimeMetrics } from '@/lib/realtime/kpi-socket';
import { formatISO, subMinutes, subHours, subDays, startOfDay } from 'date-fns';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

const DEFAULT_CACHE_TTL = 60; // 1 minute

class RealtimeMetricsService {
  /**
   * Get today's revenue with comparison to yesterday
   */
  async getTodayRevenue(organizationId: string): Promise<{ today: number; yesterday: number }> {
    const cacheKey = `realtime:revenue:${organizationId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as { today: number; yesterday: number };
      }
    } catch (error) {
      logger.warn('Redis cache miss for revenue', { organizationId });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = new Date(todayStart.getTime() - 1);

    try {
      const [todaySales, yesterdaySales] = await Promise.all([
        prisma.affiliateSale.aggregate({
          where: {
            organizationId,
            createdAt: { gte: todayStart },
            status: { in: ['CONFIRMED', 'APPROVED'] },
          },
          _sum: { saleAmount: true },
        }),
        prisma.affiliateSale.aggregate({
          where: {
            organizationId,
            createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
            status: { in: ['CONFIRMED', 'APPROVED'] },
          },
          _sum: { saleAmount: true },
        }),
      ]);

      const result = {
        today: todaySales._sum?.saleAmount || 0,
        yesterday: yesterdaySales._sum?.saleAmount || 0,
      };

      // Cache for 1 minute
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, JSON.stringify(result)).catch(() => {
        logger.warn('Failed to cache revenue metrics');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching today revenue', { error, organizationId });
      return { today: 0, yesterday: 0 };
    }
  }

  /**
   * Get conversion rate for the last hour
   */
  async getLastHourConversion(organizationId: string): Promise<number> {
    const cacheKey = `realtime:conversion:${organizationId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as number;
      }
    } catch (error) {
      logger.warn('Redis cache miss for conversion rate', { organizationId });
    }

    const oneHourAgo = subHours(new Date(), 1);

    try {
      const [sent, converted] = await Promise.all([
        prisma.contactLensSequence.count({
          where: {
            contact: { organizationId },
            day0SentAt: { gte: oneHourAgo },
          },
        }),
        prisma.contactLensSequence.count({
          where: {
            contact: { organizationId },
            day0ConvertedAt: { gte: oneHourAgo },
          },
        }),
      ]);

      const conversionRate = sent > 0 ? (converted / sent) * 100 : 0;

      // Cache for 1 minute
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, JSON.stringify(conversionRate)).catch(() => {
        logger.warn('Failed to cache conversion rate');
      });

      return Number(conversionRate.toFixed(2));
    } catch (error) {
      logger.error('Error fetching conversion rate', { error, organizationId });
      return 0;
    }
  }

  /**
   * Get active Day 0-3 sequences
   */
  async getActiveDaySequences(organizationId: string): Promise<number> {
    const cacheKey = `realtime:active-sequences:${organizationId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as number;
      }
    } catch (error) {
      logger.warn('Redis cache miss for active sequences', { organizationId });
    }

    try {
      const count = await prisma.contactLensSequence.count({
        where: {
          contact: { organizationId },
          OR: [
            { day0SentAt: { gte: subDays(new Date(), 3) }, day0ConvertedAt: null },
            { day1SentAt: { gte: subDays(new Date(), 3) }, day1ConvertedAt: null },
            { day2SentAt: { gte: subDays(new Date(), 3) }, day2ConvertedAt: null },
            { day3SentAt: { gte: subDays(new Date(), 3) }, day3ConvertedAt: null },
          ],
        },
      });

      // Cache for 1 minute
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, JSON.stringify(count)).catch(() => {
        logger.warn('Failed to cache active sequences');
      });

      return count;
    } catch (error) {
      logger.error('Error fetching active sequences', { error, organizationId });
      return 0;
    }
  }

  /**
   * Get top 3 lenses by conversion
   */
  async getTopLenses(
    organizationId: string,
    limit = 3
  ): Promise<Array<{ lens: string; count: number }>> {
    const cacheKey = `realtime:top-lenses:${organizationId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as Array<{ lens: string; count: number }>;
      }
    } catch (error) {
      logger.warn('Redis cache miss for top lenses', { organizationId });
    }

    try {
      const lenses = await prisma.contactLensClassification.groupBy({
        by: ['lensType'],
        where: {
          organizationId,
          status: 'ACTIVE',
        },
        _count: true,
        orderBy: [{ lensType: 'asc' }],
        take: limit,
      });

      const result = lenses.map((l) => ({
        lens: l.lensType || 'Unknown',
        count: typeof l._count === 'number' ? l._count : 0,
      }));

      // Cache for 5 minutes
      await redis.setex(cacheKey, 5 * DEFAULT_CACHE_TTL, JSON.stringify(result)).catch(() => {
        logger.warn('Failed to cache top lenses');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching top lenses', { error, organizationId });
      return [];
    }
  }

  /**
   * Get segment metrics (newlywed, family, couple)
   */
  async getChannelMetrics(organizationId: string) {
    const cacheKey = `realtime:channels:${organizationId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      logger.warn('Redis cache miss for channel metrics', { organizationId });
    }

    const today = startOfDay(new Date());

    try {
      const [newlywedSent, newlywedDelivered, newlywedConverted, familySent, familyDelivered, familyConverted, coupleSent, coupleDelivered, coupleConverted] = await Promise.all([
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'newlywed',
            createdAt: { gte: today },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'newlywed',
            createdAt: { gte: today },
            deliveredAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'newlywed',
            createdAt: { gte: today },
            status: 'converted',
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'family',
            createdAt: { gte: today },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'family',
            createdAt: { gte: today },
            deliveredAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'family',
            createdAt: { gte: today },
            status: 'converted',
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'couple',
            createdAt: { gte: today },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'couple',
            createdAt: { gte: today },
            deliveredAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            segment: 'couple',
            createdAt: { gte: today },
            status: 'converted',
          },
        }),
      ]);

      const result = {
        newlywed: { sent: newlywedSent, delivered: newlywedDelivered, converted: newlywedConverted },
        family: { sent: familySent, delivered: familyDelivered, converted: familyConverted },
        couple: { sent: coupleSent, delivered: coupleDelivered, converted: coupleConverted },
      };

      // Cache for 2 minutes
      await redis.setex(cacheKey, 2 * DEFAULT_CACHE_TTL, JSON.stringify(result)).catch(() => {
        logger.warn('Failed to cache segment metrics');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching segment metrics', { error, organizationId });
      return {
        newlywed: { sent: 0, delivered: 0, converted: 0 },
        family: { sent: 0, delivered: 0, converted: 0 },
        couple: { sent: 0, delivered: 0, converted: 0 },
      };
    }
  }

  /**
   * Get top 5 partners by today's revenue
   */
  async getPartnerLeaderboard(
    organizationId: string,
    limit = 5
  ): Promise<Array<{ affiliateCode: string; name: string; saleAmount: number }>> {
    const cacheKey = `realtime:partners:${organizationId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as Array<{ affiliateCode: string; name: string; saleAmount: number }>;
      }
    } catch (error) {
      logger.warn('Redis cache miss for partner leaderboard', { organizationId });
    }

    const today = startOfDay(new Date());

    try {
      const sales = await prisma.affiliateSale.groupBy({
        by: ['affiliateCode'],
        where: {
          organizationId,
          createdAt: { gte: today },
          status: { in: ['CONFIRMED', 'APPROVED'] },
        },
        _sum: { saleAmount: true },
        orderBy: { _sum: { saleAmount: 'desc' } },
        take: limit,
      });

      const affiliateCodes = sales.map((s) => s.affiliateCode).filter(Boolean) as string[];

      let partnerMap = new Map<string, string>();
      if (affiliateCodes.length > 0) {
        const partners = await prisma.partner.findMany({
          where: { status: { in: ['ACTIVE'] } },
          select: { id: true, name: true },
        });
        partnerMap = new Map(partners.map((p) => [p.id, p.name]));
      }

      const result = sales
        .filter((s) => s.affiliateCode)
        .map((s) => ({
          affiliateCode: s.affiliateCode as string,
          name: partnerMap.get(s.affiliateCode as string) || 'Unknown',
          saleAmount: s._sum?.saleAmount || 0,
        }));

      // Cache for 1 minute
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, JSON.stringify(result)).catch(() => {
        logger.warn('Failed to cache partner leaderboard');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching partner leaderboard', { error, organizationId });
      return [];
    }
  }

  /**
   * Get all real-time metrics
   */
  async getAllMetrics(organizationId: string): Promise<RealtimeMetrics> {
    try {
      const [revenue, conversion, sequences, lenses, channels, partners] = await Promise.all([
        this.getTodayRevenue(organizationId),
        this.getLastHourConversion(organizationId),
        this.getActiveDaySequences(organizationId),
        this.getTopLenses(organizationId),
        this.getChannelMetrics(organizationId),
        this.getPartnerLeaderboard(organizationId),
      ]);

      // TODO: Fetch cron health and database health from monitoring system
      const cronHealth: Record<string, any> = {
        'sms-sequence-day0': {
          status: 'healthy',
          lastRun: new Date().toISOString(),
        },
        'sms-sequence-day1': {
          status: 'healthy',
          lastRun: new Date().toISOString(),
        },
      };

      return {
        todayRevenue: revenue.today,
        yesterdayRevenue: revenue.yesterday,
        lastHourConversion: conversion,
        activeDaySequences: sequences,
        topLenses: lenses,
        channelMetrics: channels,
        partnerLeaderboard: partners,
        cronHealth,
        databaseHealth: {
          queryLatency: 0,
          connectionCount: 0,
        },
      };
    } catch (error) {
      logger.error('Error fetching all metrics', { error, organizationId });
      throw error;
    }
  }

  /**
   * Invalidate all metrics cache for organization
   */
  async invalidateCache(organizationId: string): Promise<void> {
    const pattern = `realtime:*:${organizationId}`;
    // Note: This is a simple implementation. For production, use SCAN with pattern matching
    const keys = [
      `realtime:revenue:${organizationId}`,
      `realtime:conversion:${organizationId}`,
      `realtime:active-sequences:${organizationId}`,
      `realtime:top-lenses:${organizationId}`,
      `realtime:channels:${organizationId}`,
      `realtime:partners:${organizationId}`,
    ];

    await Promise.allSettled(keys.map((key) => redis.del(key)));
  }
}

export const realtimeMetricsService = new RealtimeMetricsService();
