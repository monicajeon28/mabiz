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
          _sum: { amount: true },
        }),
        prisma.affiliateSale.aggregate({
          where: {
            organizationId,
            createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
            status: { in: ['CONFIRMED', 'APPROVED'] },
          },
          _sum: { amount: true },
        }),
      ]);

      const result = {
        today: todaySales._sum?.amount || 0,
        yesterday: yesterdaySales._sum?.amount || 0,
      };

      // Cache for 1 minute
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, result).catch(() => {
        logger.warn('Failed to cache revenue metrics');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching today revenue', error, { organizationId });
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
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, conversionRate).catch(() => {
        logger.warn('Failed to cache conversion rate');
      });

      return Number(conversionRate.toFixed(2));
    } catch (error) {
      logger.error('Error fetching conversion rate', error, { organizationId });
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
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, count).catch(() => {
        logger.warn('Failed to cache active sequences');
      });

      return count;
    } catch (error) {
      logger.error('Error fetching active sequences', error, { organizationId });
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
        orderBy: { _count: 'desc' },
        take: limit,
      });

      const result = lenses.map((l) => ({
        lens: l.lensType || 'Unknown',
        count: l._count,
      }));

      // Cache for 5 minutes
      await redis.setex(cacheKey, 5 * DEFAULT_CACHE_TTL, result).catch(() => {
        logger.warn('Failed to cache top lenses');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching top lenses', error, { organizationId });
      return [];
    }
  }

  /**
   * Get channel metrics (SMS, Kakao, Email)
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
      const [smsSent, smsOpened, smsClicked, kakaoSent, kakaoOpened, kakaoClicked, emailSent, emailOpened, emailClicked] = await Promise.all([
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'SMS',
            createdAt: { gte: today },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'SMS',
            createdAt: { gte: today },
            openedAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'SMS',
            createdAt: { gte: today },
            clickedAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'KAKAO',
            createdAt: { gte: today },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'KAKAO',
            createdAt: { gte: today },
            openedAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'KAKAO',
            createdAt: { gte: today },
            clickedAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'EMAIL',
            createdAt: { gte: today },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'EMAIL',
            createdAt: { gte: today },
            openedAt: { not: null },
          },
        }),
        prisma.crmMarketingMessage.count({
          where: {
            organizationId,
            channel: 'EMAIL',
            createdAt: { gte: today },
            clickedAt: { not: null },
          },
        }),
      ]);

      const result = {
        sms: { sent: smsSent, opened: smsOpened, clicked: smsClicked },
        kakao: { sent: kakaoSent, opened: kakaoOpened, clicked: kakaoClicked },
        email: { sent: emailSent, opened: emailOpened, clicked: emailClicked },
      };

      // Cache for 2 minutes
      await redis.setex(cacheKey, 2 * DEFAULT_CACHE_TTL, result).catch(() => {
        logger.warn('Failed to cache channel metrics');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching channel metrics', error, { organizationId });
      return {
        sms: { sent: 0, opened: 0, clicked: 0 },
        kakao: { sent: 0, opened: 0, clicked: 0 },
        email: { sent: 0, opened: 0, clicked: 0 },
      };
    }
  }

  /**
   * Get top 5 partners by today's revenue
   */
  async getPartnerLeaderboard(
    organizationId: string,
    limit = 5
  ): Promise<Array<{ partnerId: string; name: string; amount: number }>> {
    const cacheKey = `realtime:partners:${organizationId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as Array<{ partnerId: string; name: string; amount: number }>;
      }
    } catch (error) {
      logger.warn('Redis cache miss for partner leaderboard', { organizationId });
    }

    const today = startOfDay(new Date());

    try {
      const sales = await prisma.affiliateSale.groupBy({
        by: ['partnerId'],
        where: {
          organizationId,
          createdAt: { gte: today },
          status: { in: ['CONFIRMED', 'APPROVED'] },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: limit,
      });

      const partnerIds = sales.map((s) => s.partnerId).filter(Boolean) as string[];

      let partners: Array<{ id: string; name: string }> = [];
      if (partnerIds.length > 0) {
        partners = await prisma.affiliateProfile.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true },
        });
      }

      const partnerMap = new Map(partners.map((p) => [p.id, p.name]));

      const result = sales
        .filter((s) => s.partnerId)
        .map((s) => ({
          partnerId: s.partnerId as string,
          name: partnerMap.get(s.partnerId as string) || 'Unknown',
          amount: s._sum?.amount || 0,
        }));

      // Cache for 1 minute
      await redis.setex(cacheKey, DEFAULT_CACHE_TTL, result).catch(() => {
        logger.warn('Failed to cache partner leaderboard');
      });

      return result;
    } catch (error) {
      logger.error('Error fetching partner leaderboard', error, { organizationId });
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
      logger.error('Error fetching all metrics', error, { organizationId });
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
