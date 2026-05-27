/**
 * Daily Performance Report Service (TASK 6-2)
 *
 * Generates comprehensive daily performance reports:
 * - Revenue summary (today, week, month YTD)
 * - Conversion metrics (by day, by channel, by lens)
 * - Top performers (partners, sequences, lenses)
 * - Alerts (anomalies, below-threshold metrics)
 * - Recommendations (actionable insights)
 *
 * Executed: Daily at 6 AM via cron
 * Stored: DailyReport model for history + trending
 * Distributed: Email, Slack, Dashboard widget
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────

export interface DailyReportMetrics {
  summary: {
    revenue: {
      today: number;
      week: number;
      month: number;
      forecast: number;
      trend: 'UP' | 'DOWN' | 'STABLE';
      percentChange: number;
    };
    conversion: {
      rate: number;
      count: number;
      target: number;
      percentChange: number;
    };
    sequenceCompletions: {
      day0: { sent: number; openRate: number; clickRate: number };
      day1: { sent: number; openRate: number; clickRate: number };
      day2: { sent: number; openRate: number; clickRate: number };
      day3: { sent: number; openRate: number; clickRate: number };
      completionRate: number;
    };
  };
  byChannel: {
    sms: {
      sent: number;
      openRate: number;
      clickRate: number;
      conversionRate: number;
      cost: number;
      cpa: number;
    };
    kakao: {
      sent: number;
      openRate: number;
      clickRate: number;
      conversionRate: number;
      cost: number;
      cpa: number;
    };
    email: {
      sent: number;
      openRate: number;
      clickRate: number;
      conversionRate: number;
      cost: number;
      cpa: number;
    };
  };
  byLens: Record<
    string,
    {
      contactCount: number;
      conversionRate: number;
      conversionCount: number;
      revenue: number;
      trend: number;
    }
  >;
  topPerformers: {
    partners: Array<{
      id: string;
      name: string;
      revenue: number;
      conversionCount: number;
      conversionRate: number;
      trend: number;
    }>;
    sequences: Array<{
      id: string;
      name: string;
      conversionRate: number;
      completionCount: number;
      trend: number;
    }>;
  };
  alerts: Array<{
    type: 'RED' | 'YELLOW';
    metric: string;
    value: number;
    threshold: number;
    message: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    impact: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action?: string;
  }>;
}

// ─────────────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────────────

export class DailyReportGenerator {
  private orgId: string;
  private today: Date;
  private yesterday: Date;
  private weekAgo: Date;
  private monthAgo: Date;

  constructor(orgId: string) {
    this.orgId = orgId;

    // Initialize date ranges
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);

    this.yesterday = new Date(this.today);
    this.yesterday.setDate(this.yesterday.getDate() - 1);

    this.weekAgo = new Date(this.today);
    this.weekAgo.setDate(this.weekAgo.getDate() - 7);

    this.monthAgo = new Date(this.today);
    this.monthAgo.setDate(this.monthAgo.getDate() - 30);
  }

  /**
   * Generate complete daily report
   */
  async generateReport(): Promise<DailyReportMetrics> {
    try {
      const [summary, byChannel, byLens, topPerformers, alerts, recommendations] =
        await Promise.all([
          this.generateSummary(),
          this.generateChannelMetrics(),
          this.generateLensMetrics(),
          this.generateTopPerformers(),
          this.generateAlerts(),
          this.generateRecommendations(),
        ]);

      return {
        summary,
        byChannel,
        byLens,
        topPerformers,
        alerts,
        recommendations,
      };
    } catch (err) {
      logger.error('[DailyReport] Generation failed', {
        orgId: this.orgId,
        err,
      });
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────
  // SUMMARY SECTION
  // ─────────────────────────────────────────────────────

  private async generateSummary() {
    const [todayRevenue, weekRevenue, monthRevenue, yesterdayRevenue, conversions, day03Metrics] =
      await Promise.all([
        this.calculateRevenue(this.today),
        this.calculateRevenue(this.weekAgo),
        this.calculateRevenue(this.monthAgo),
        this.calculateRevenue(this.yesterday),
        this.getConversionMetrics(),
        this.getDay03Metrics(),
      ]);

    const revenuePercent = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
    const revenueTrend =
      revenuePercent > 5 ? 'UP' : revenuePercent < -5 ? 'DOWN' : 'STABLE';

    return {
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        month: monthRevenue,
        forecast: this.forecastRevenue(monthRevenue),
        trend: revenueTrend,
        percentChange: parseFloat(revenuePercent.toFixed(2)),
      },
      conversion: {
        rate: conversions.rate,
        count: conversions.count,
        target: 3.0, // Target 3% conversion rate
        percentChange: conversions.percentChange,
      },
      sequenceCompletions: day03Metrics,
    };
  }

  private async calculateRevenue(fromDate: Date): Promise<number> {
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + 1);

    const sales = await prisma.affiliateSale.aggregate({
      where: {
        organizationId: this.orgId,
        createdAt: {
          gte: fromDate,
          lt: toDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(sales._sum.amount || 0) / 100; // Convert cents to dollars
  }

  private async getConversionMetrics() {
    const today = this.today;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayConversions, yesterdayConversions, todayTotal, yesterdayTotal] = await Promise.all([
      prisma.affiliateSale.count({
        where: {
          organizationId: this.orgId,
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.affiliateSale.count({
        where: {
          organizationId: this.orgId,
          createdAt: { gte: this.yesterday, lt: today },
        },
      }),
      prisma.contact.count({
        where: {
          organizationId: this.orgId,
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.contact.count({
        where: {
          organizationId: this.orgId,
          createdAt: { gte: this.yesterday, lt: today },
        },
      }),
    ]);

    const rate = todayTotal > 0 ? (todayConversions / todayTotal) * 100 : 0;
    const previousRate = yesterdayTotal > 0 ? (yesterdayConversions / yesterdayTotal) * 100 : 0;
    const percentChange = previousRate > 0 ? ((rate - previousRate) / previousRate) * 100 : 0;

    return {
      rate: parseFloat(rate.toFixed(2)),
      count: todayConversions,
      percentChange: parseFloat(percentChange.toFixed(2)),
    };
  }

  private async getDay03Metrics() {
    const today = this.today;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const day0 = await prisma.smsLog.aggregate({
      where: {
        organizationId: this.orgId,
        dayNumber: 0,
        createdAt: { gte: today, lt: tomorrow },
      },
      _count: true,
    });

    const day0Opened = await prisma.smsLog.count({
      where: {
        organizationId: this.orgId,
        dayNumber: 0,
        status: 'OPENED',
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    const day0Clicked = await prisma.smsLog.count({
      where: {
        organizationId: this.orgId,
        dayNumber: 0,
        status: 'CLICKED',
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    const day0Count = day0._count || 0;
    const day0OpenRate = day0Count > 0 ? (day0Opened / day0Count) * 100 : 0;
    const day0ClickRate = day0Count > 0 ? (day0Clicked / day0Count) * 100 : 0;

    // Simplified: use similar pattern for days 1-3
    const generateDayMetrics = async (dayNumber: number) => {
      const sent = await prisma.smsLog.count({
        where: {
          organizationId: this.orgId,
          dayNumber,
          createdAt: { gte: today, lt: tomorrow },
        },
      });

      const opened = await prisma.smsLog.count({
        where: {
          organizationId: this.orgId,
          dayNumber,
          status: 'OPENED',
          createdAt: { gte: today, lt: tomorrow },
        },
      });

      const clicked = await prisma.smsLog.count({
        where: {
          organizationId: this.orgId,
          dayNumber,
          status: 'CLICKED',
          createdAt: { gte: today, lt: tomorrow },
        },
      });

      return {
        sent,
        openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
        clickRate: sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(2)) : 0,
      };
    };

    const [day1, day2, day3] = await Promise.all([
      generateDayMetrics(1),
      generateDayMetrics(2),
      generateDayMetrics(3),
    ]);

    const totalSent = day0Count + day1.sent + day2.sent + day3.sent;
    const totalCompleted = day0Opened + day1.sent + day2.sent + day3.sent; // Simplified
    const completionRate = totalSent > 0 ? (totalCompleted / totalSent) * 100 : 0;

    return {
      day0: {
        sent: day0Count,
        openRate: parseFloat(day0OpenRate.toFixed(2)),
        clickRate: parseFloat(day0ClickRate.toFixed(2)),
      },
      day1,
      day2,
      day3,
      completionRate: parseFloat(completionRate.toFixed(2)),
    };
  }

  private forecastRevenue(monthlyRevenue: number): number {
    // Simple forecast: extend current month's trend
    const dayOfMonth = this.today.getDate();
    const daysInMonth = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0).getDate();
    return parseFloat(((monthlyRevenue / dayOfMonth) * daysInMonth).toFixed(0));
  }

  // ─────────────────────────────────────────────────────
  // BY-CHANNEL METRICS
  // ─────────────────────────────────────────────────────

  private async generateChannelMetrics() {
    const today = this.today;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [sms, kakao, email] = await Promise.all([
      this.getChannelMetrics('SMS', today, tomorrow),
      this.getChannelMetrics('KAKAO', today, tomorrow),
      this.getChannelMetrics('EMAIL', today, tomorrow),
    ]);

    return {
      sms,
      kakao,
      email,
    };
  }

  private async getChannelMetrics(channel: string, from: Date, to: Date) {
    const logs =
      channel === 'SMS'
        ? await prisma.smsLog.findMany({
            where: {
              organizationId: this.orgId,
              createdAt: { gte: from, lt: to },
            },
            select: { status: true, cost: true },
          })
        : [];

    const sent = logs.length;
    const opened = logs.filter((l) => l.status === 'OPENED').length;
    const clicked = logs.filter((l) => l.status === 'CLICKED').length;
    const converted = logs.filter((l) => l.status === 'CONVERTED').length;

    const totalCost = logs.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);
    const cpa = converted > 0 ? totalCost / converted : 0;

    return {
      sent,
      openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
      clickRate: sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(2)) : 0,
      conversionRate: sent > 0 ? parseFloat(((converted / sent) * 100).toFixed(2)) : 0,
      cost: totalCost,
      cpa: parseFloat(cpa.toFixed(2)),
    };
  }

  // ─────────────────────────────────────────────────────
  // BY-LENS METRICS
  // ─────────────────────────────────────────────────────

  private async generateLensMetrics() {
    const today = this.today;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const classifications = await prisma.contactLensClassification.findMany({
      where: {
        organizationId: this.orgId,
        createdAt: { gte: today, lt: tomorrow },
      },
      include: {
        contact: {
          select: {
            id: true,
            purchasedAt: true,
            status: true,
          },
        },
      },
    });

    const lensMap: Record<string, { count: number; converted: number; revenue: number }> = {};

    for (const c of classifications) {
      const lens = c.lensName || 'UNKNOWN';
      if (!lensMap[lens]) {
        lensMap[lens] = { count: 0, converted: 0, revenue: 0 };
      }
      lensMap[lens].count++;

      if (c.contact.purchasedAt && c.contact.purchasedAt >= today) {
        lensMap[lens].converted++;
      }
    }

    const byLens: Record<string, any> = {};

    for (const [lens, metrics] of Object.entries(lensMap)) {
      const conversionRate =
        metrics.count > 0 ? parseFloat(((metrics.converted / metrics.count) * 100).toFixed(2)) : 0;

      byLens[lens] = {
        contactCount: metrics.count,
        conversionRate,
        conversionCount: metrics.converted,
        revenue: metrics.revenue,
        trend: 0, // Calculate trend if needed
      };
    }

    return byLens;
  }

  // ─────────────────────────────────────────────────────
  // TOP PERFORMERS
  // ─────────────────────────────────────────────────────

  private async generateTopPerformers() {
    const today = this.today;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Top partners by revenue
    const partnerSales = await prisma.affiliateSale.groupBy({
      by: ['partnerId'],
      where: {
        organizationId: this.orgId,
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: 3,
    });

    const partners = await Promise.all(
      partnerSales.map(async (ps) => {
        const partner = await prisma.partner.findUnique({
          where: { id: ps.partnerId },
        });

        const revenue = Number(ps._sum.amount || 0) / 100;
        const conversionCount = ps._count;
        const conversions = await prisma.contact.count({
          where: {
            organizationId: this.orgId,
            partnerId: ps.partnerId,
            createdAt: { gte: today, lt: tomorrow },
          },
        });

        return {
          id: ps.partnerId,
          name: partner?.name || 'Unknown Partner',
          revenue,
          conversionCount,
          conversionRate:
            conversions > 0
              ? parseFloat(((conversionCount / conversions) * 100).toFixed(2))
              : 0,
          trend: 0,
        };
      })
    );

    // Top sequences by conversion rate
    const topSequences = await prisma.contactLensSequence.findMany({
      where: {
        organizationId: this.orgId,
      },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
      take: 3,
      orderBy: {
        contacts: {
          _count: 'desc',
        },
      },
    });

    const sequences = topSequences.map((seq) => ({
      id: seq.id,
      name: seq.sequenceName,
      conversionRate: seq.estimatedConversionRate || 0,
      completionCount: seq.contacts?.length || 0,
      trend: 0,
    }));

    return {
      partners,
      sequences,
    };
  }

  // ─────────────────────────────────────────────────────
  // ALERTS & THRESHOLDS
  // ─────────────────────────────────────────────────────

  private async generateAlerts() {
    const alerts: DailyReportMetrics['alerts'] = [];

    const summary = await this.generateSummary();
    const channels = await this.generateChannelMetrics();

    // Revenue alert
    if (summary.revenue.today < 5000) {
      alerts.push({
        type: 'RED',
        metric: 'Daily Revenue',
        value: summary.revenue.today,
        threshold: 5000,
        message: `Revenue $${summary.revenue.today.toFixed(0)} below $5K target`,
        priority: 'CRITICAL',
      });
    }

    // Conversion rate alert
    if (summary.conversion.rate < 2.0) {
      alerts.push({
        type: 'YELLOW',
        metric: 'Conversion Rate',
        value: summary.conversion.rate,
        threshold: 2.0,
        message: `Conversion rate ${summary.conversion.rate.toFixed(2)}% below 2% target`,
        priority: 'HIGH',
      });
    }

    // SMS open rate alert
    if (channels.sms.sent > 0 && channels.sms.openRate < 20) {
      alerts.push({
        type: 'YELLOW',
        metric: 'SMS Open Rate',
        value: channels.sms.openRate,
        threshold: 20,
        message: `SMS open rate ${channels.sms.openRate.toFixed(2)}% below 20% target`,
        priority: 'MEDIUM',
      });
    }

    // Email open rate alert
    if (channels.email.sent > 0 && channels.email.openRate < 15) {
      alerts.push({
        type: 'YELLOW',
        metric: 'Email Open Rate',
        value: channels.email.openRate,
        threshold: 15,
        message: `Email open rate ${channels.email.openRate.toFixed(2)}% below 15% target`,
        priority: 'MEDIUM',
      });
    }

    // Large revenue drop
    if (summary.revenue.percentChange < -30) {
      alerts.push({
        type: 'RED',
        metric: 'Revenue Drop',
        value: summary.revenue.percentChange,
        threshold: -30,
        message: `Revenue dropped ${Math.abs(summary.revenue.percentChange).toFixed(1)}% vs yesterday`,
        priority: 'CRITICAL',
      });
    }

    // Check for partner at risk (no sales in 3 days)
    const partnersSuspended = await prisma.partnerSuspension.count({
      where: {
        organizationId: this.orgId,
        status: 'ACTIVE',
      },
    });

    if (partnersSuspended > 0) {
      alerts.push({
        type: 'YELLOW',
        metric: 'Partners At Risk',
        value: partnersSuspended,
        threshold: 0,
        message: `${partnersSuspended} partner(s) suspended - intervention needed`,
        priority: 'HIGH',
      });
    }

    return alerts;
  }

  // ─────────────────────────────────────────────────────
  // RECOMMENDATIONS
  // ─────────────────────────────────────────────────────

  private async generateRecommendations() {
    const recommendations: DailyReportMetrics['recommendations'] = [];

    const summary = await this.generateSummary();
    const channels = await this.generateChannelMetrics();

    // Day 0 optimization
    if (summary.sequenceCompletions.day0.openRate > 30) {
      recommendations.push({
        title: 'Increase Day 0 Message Budget',
        description: 'Day 0 messages showing highest open rate (>30%)',
        impact: 'Could increase conversion by 5-10%',
        priority: 'HIGH',
        action: 'Allocate more budget to Day 0 SMS',
      });
    }

    // Low completion rate
    if (summary.sequenceCompletions.completionRate < 50) {
      recommendations.push({
        title: 'Improve Sequence Completion',
        description: 'Day 0-3 sequences only ${summary.sequenceCompletions.completionRate.toFixed(1)}% completing',
        impact: 'Could recover 20-30% of abandoned contacts',
        priority: 'HIGH',
        action: 'Review and optimize Day 1-3 messaging',
      });
    }

    // SMS performance
    if (channels.sms.sent > 100 && channels.sms.conversionRate > channels.email.conversionRate) {
      recommendations.push({
        title: 'SMS Outperforming Email',
        description: `SMS conversion rate ${channels.sms.conversionRate.toFixed(2)}% vs Email ${channels.email.conversionRate.toFixed(2)}%`,
        impact: 'Could improve overall conversion by 2-3%',
        priority: 'MEDIUM',
        action: 'Shift budget from email to SMS',
      });
    }

    // Revenue trend
    if (summary.revenue.percentChange < -10) {
      recommendations.push({
        title: 'Investigate Revenue Decline',
        description: `Revenue down ${Math.abs(summary.revenue.percentChange).toFixed(1)}% vs yesterday`,
        impact: 'Could recover $5-10K if addressed',
        priority: 'CRITICAL',
        action: 'Check for system issues or campaign changes',
      });
    }

    // Top performer highlight
    const topPerformers = await this.generateTopPerformers();
    if (topPerformers.partners.length > 0) {
      const leader = topPerformers.partners[0];
      recommendations.push({
        title: `Partner Success: ${leader.name}`,
        description: `${leader.name} generated $${leader.revenue.toFixed(0)} today`,
        impact: 'Learn from their approach',
        priority: 'MEDIUM',
        action: `Review ${leader.name}'s sales approach and replicate`,
      });
    }

    return recommendations;
  }
}

/**
 * Helper: Save report to database
 */
export async function saveDailyReport(
  orgId: string,
  reportDate: Date,
  metrics: DailyReportMetrics
) {
  try {
    const report = await prisma.dailyReport.upsert({
      where: {
        organizationId_reportDate: {
          organizationId: orgId,
          reportDate,
        },
      },
      update: {
        // Summary
        revenue: Math.round(metrics.summary.revenue.today * 100),
        weeklyRevenue: Math.round(metrics.summary.revenue.week * 100),
        monthlyRevenue: Math.round(metrics.summary.revenue.month * 100),
        conversionRate: metrics.summary.conversion.rate,
        conversionCount: metrics.summary.conversion.count,

        // Day 0
        day0Sent: metrics.summary.sequenceCompletions.day0.sent,
        day0Opened: Math.round(
          (metrics.summary.sequenceCompletions.day0.openRate / 100) *
            metrics.summary.sequenceCompletions.day0.sent
        ),
        day0Clicked: Math.round(
          (metrics.summary.sequenceCompletions.day0.clickRate / 100) *
            metrics.summary.sequenceCompletions.day0.sent
        ),

        // Channels
        smsSent: metrics.byChannel.sms.sent,
        smsOpenRate: metrics.byChannel.sms.openRate,
        kakaoSent: metrics.byChannel.kakao.sent,
        kakaoClickRate: metrics.byChannel.kakao.clickRate,
        emailSent: metrics.byChannel.email.sent,
        emailOpenRate: metrics.byChannel.email.openRate,

        // Data
        alerts: JSON.stringify(metrics.alerts),
        recommendations: JSON.stringify(metrics.recommendations),
        channelMetrics: JSON.stringify(metrics.byChannel),
        lensMetrics: JSON.stringify(metrics.byLens),
        topPartners: JSON.stringify(metrics.topPerformers.partners),
        topSequences: JSON.stringify(metrics.topPerformers.sequences),

        status: 'COMPLETED',
        updatedAt: new Date(),
      },
      create: {
        organizationId: orgId,
        reportDate,

        // Summary
        revenue: Math.round(metrics.summary.revenue.today * 100),
        weeklyRevenue: Math.round(metrics.summary.revenue.week * 100),
        monthlyRevenue: Math.round(metrics.summary.revenue.month * 100),
        conversionRate: metrics.summary.conversion.rate,
        conversionCount: metrics.summary.conversion.count,

        // Day 0
        day0Sent: metrics.summary.sequenceCompletions.day0.sent,
        day0Opened: Math.round(
          (metrics.summary.sequenceCompletions.day0.openRate / 100) *
            metrics.summary.sequenceCompletions.day0.sent
        ),
        day0Clicked: Math.round(
          (metrics.summary.sequenceCompletions.day0.clickRate / 100) *
            metrics.summary.sequenceCompletions.day0.sent
        ),

        // Channels
        smsSent: metrics.byChannel.sms.sent,
        smsOpenRate: metrics.byChannel.sms.openRate,
        kakaoSent: metrics.byChannel.kakao.sent,
        kakaoClickRate: metrics.byChannel.kakao.clickRate,
        emailSent: metrics.byChannel.email.sent,
        emailOpenRate: metrics.byChannel.email.openRate,

        // Data
        alerts: JSON.stringify(metrics.alerts),
        recommendations: JSON.stringify(metrics.recommendations),
        channelMetrics: JSON.stringify(metrics.byChannel),
        lensMetrics: JSON.stringify(metrics.byLens),
        topPartners: JSON.stringify(metrics.topPerformers.partners),
        topSequences: JSON.stringify(metrics.topPerformers.sequences),

        status: 'COMPLETED',
      },
    });

    logger.log('[DailyReport] Saved successfully', {
      orgId,
      reportDate: reportDate.toISOString().split('T')[0],
      revenue: metrics.summary.revenue.today,
    });

    return report;
  } catch (err) {
    logger.error('[DailyReport] Save failed', { orgId, err });
    throw err;
  }
}
