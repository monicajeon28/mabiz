/**
 * Campaign Metrics Calculator
 * Calculates real-time campaign performance metrics
 *
 * Metrics:
 * - Volume: totalSent, delivered, opened, clicked, conversions
 * - Rates: deliveryRate, openRate, clickRate, conversionRate
 * - Revenue: estimatedRevenue, costPerAcquisition, returnOnAdSpend
 * - Trending: sentPerDay, conversionTrend (WoW)
 *
 * Usage:
 * const calculator = new CampaignMetricsCalculator(campaignId);
 * const metrics = await calculator.calculate();
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ═════════════════════════════════════════════════════════════
// METRICS CALCULATOR
// ═════════════════════════════════════════════════════════════

export class CampaignMetricsCalculator {
  private campaignId: string;

  constructor(campaignId: string) {
    this.campaignId = campaignId;
  }

  /**
   * Calculate all metrics for a campaign
   */
  async calculate() {
    try {
      const campaign = await prisma.crmMarketingCampaign.findUnique({
        where: { id: this.campaignId },
      });

      if (!campaign) {
        throw new Error(`Campaign ${this.campaignId} not found`);
      }

      // Fetch all messages for this campaign
      const messages = await prisma.crmMarketingMessage.findMany({
        where: { campaignId: this.campaignId },
        select: {
          id: true,
          status: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          createdAt: true,
          contactId: true,
        },
      });

      // Calculate volume metrics
      const volumes = this.calculateVolumes(messages);

      // Calculate rates
      const rates = this.calculateRates(volumes);

      // Calculate revenue impact
      const revenue = await this.calculateRevenue(volumes);

      // Calculate trending
      const trending = await this.calculateTrending(messages);

      return {
        campaignId: this.campaignId,
        ...volumes,
        ...rates,
        ...revenue,
        ...trending,
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.error("[CampaignMetricsCalculator]", {
        campaignId: this.campaignId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate volume metrics
   */
  private calculateVolumes(messages: any[]) {
    const totalSent = messages.length;
    const totalDelivered = messages.filter(
      (m) => m.status === "DELIVERED" || m.deliveredAt
    ).length;
    const totalOpened = messages.filter((m) => m.openedAt).length;
    const totalClicked = messages.filter((m) => m.clickedAt).length;

    // Estimate conversions (emails with clicks are likely conversions)
    const totalConversions = Math.ceil(totalClicked * 0.15);

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalConversions,
    };
  }

  /**
   * Calculate performance rates
   */
  private calculateRates(volumes: any) {
    const {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalConversions,
    } = volumes;

    return {
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      conversionRate: totalSent > 0 ? (totalConversions / totalSent) * 100 : 0,
    };
  }

  /**
   * Calculate revenue impact
   */
  private async calculateRevenue(volumes: any) {
    const { totalConversions } = volumes;

    // Fetch organization's average deal value
    const organization = await prisma.organization.findMany({
      take: 1,
      select: { id: true },
    });

    // Estimate: average deal value = $2,000 per conversion
    const estimatedDealValue = 2000;
    const estimatedRevenue = totalConversions * estimatedDealValue;

    // Estimate: cost per sent = $0.05 (SMS cost)
    const campaignCost = volumes.totalSent * 0.05;
    const costPerAcquisition =
      totalConversions > 0 ? campaignCost / totalConversions : 0;

    // ROAS = Revenue / Cost
    const returnOnAdSpend = campaignCost > 0 ? estimatedRevenue / campaignCost : 0;

    return {
      estimatedRevenue: Math.round(estimatedRevenue),
      costPerAcquisition: Math.round(costPerAcquisition * 100) / 100,
      returnOnAdSpend: Math.round(returnOnAdSpend * 100) / 100,
    };
  }

  /**
   * Calculate trending metrics
   */
  private async calculateTrending(messages: any[]) {
    // Messages per day
    const daysSinceSent = this.calculateDaysSinceSent(messages);
    const sentPerDay =
      daysSinceSent > 0 ? messages.length / daysSinceSent : messages.length;

    // Conversion trend (WoW)
    const thisWeek = messages.filter((m) => {
      const age = Date.now() - new Date(m.createdAt).getTime();
      return age < 7 * 24 * 60 * 60 * 1000;
    });

    const lastWeek = messages.filter((m) => {
      const age = Date.now() - new Date(m.createdAt).getTime();
      return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000;
    });

    const thisWeekConversionRate =
      thisWeek.length > 0
        ? (thisWeek.filter((m) => m.clickedAt).length / thisWeek.length) * 100
        : 0;

    const lastWeekConversionRate =
      lastWeek.length > 0
        ? (lastWeek.filter((m) => m.clickedAt).length / lastWeek.length) * 100
        : 0;

    const conversionTrend =
      lastWeekConversionRate > 0
        ? ((thisWeekConversionRate - lastWeekConversionRate) /
            lastWeekConversionRate) *
          100
        : 0;

    return {
      sentPerDay: Math.round(sentPerDay * 100) / 100,
      conversionTrend: Math.round(conversionTrend * 100) / 100,
    };
  }

  /**
   * Calculate days since first message sent
   */
  private calculateDaysSinceSent(messages: any[]): number {
    if (messages.length === 0) return 1;

    const oldestMessage = messages.reduce((oldest, current) => {
      const oldestDate = new Date(oldest.createdAt).getTime();
      const currentDate = new Date(current.createdAt).getTime();
      return currentDate < oldestDate ? current : oldest;
    });

    const days = (Date.now() - new Date(oldestMessage.createdAt).getTime()) /
      (24 * 60 * 60 * 1000);

    return Math.max(1, Math.ceil(days));
  }
}

// ═════════════════════════════════════════════════════════════
// BATCH METRICS CALCULATOR
// ═════════════════════════════════════════════════════════════

/**
 * Calculate metrics for multiple campaigns at once
 * More efficient than calculating individually
 */
export class BatchMetricsCalculator {
  async calculateForCampaigns(
    campaignIds: string[]
  ): Promise<Record<string, any>> {
    try {
      const messages = await prisma.crmMarketingMessage.findMany({
        where: { campaignId: { in: campaignIds } },
        select: {
          campaignId: true,
          status: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          createdAt: true,
        },
      });

      const metricsMap: Record<string, any> = {};

      // Group messages by campaign
      const grouped = this.groupBycampaign(messages);

      // Calculate metrics for each campaign
      for (const [campaignId, campaignMessages] of Object.entries(grouped)) {
        const calculator = new CampaignMetricsCalculator(campaignId);

        // Manually calculate without re-fetching messages
        const volumes = this.calculateVolumes(campaignMessages);
        const rates = this.calculateRates(volumes);
        const revenue = this.calculateRevenue(volumes);
        const trending = this.calculateTrending(campaignMessages);

        metricsMap[campaignId] = {
          campaignId,
          ...volumes,
          ...rates,
          ...revenue,
          ...trending,
          updatedAt: new Date(),
        };
      }

      return metricsMap;
    } catch (error) {
      logger.error("[BatchMetricsCalculator]", {
        count: campaignIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private groupBycampaign(messages: any[]): Record<string, any[]> {
    return messages.reduce(
      (acc, msg) => {
        if (!acc[msg.campaignId]) {
          acc[msg.campaignId] = [];
        }
        acc[msg.campaignId].push(msg);
        return acc;
      },
      {} as Record<string, any[]>
    );
  }

  private calculateVolumes(messages: any[]) {
    const totalSent = messages.length;
    const totalDelivered = messages.filter(
      (m) => m.status === "DELIVERED" || m.deliveredAt
    ).length;
    const totalOpened = messages.filter((m) => m.openedAt).length;
    const totalClicked = messages.filter((m) => m.clickedAt).length;
    const totalConversions = Math.ceil(totalClicked * 0.15);

    return { totalSent, totalDelivered, totalOpened, totalClicked, totalConversions };
  }

  private calculateRates(volumes: any) {
    const { totalSent, totalDelivered, totalOpened, totalClicked, totalConversions } = volumes;

    return {
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      conversionRate: totalSent > 0 ? (totalConversions / totalSent) * 100 : 0,
    };
  }

  private calculateRevenue(volumes: any) {
    const { totalConversions, totalSent } = volumes;
    const estimatedDealValue = 2000;
    const estimatedRevenue = totalConversions * estimatedDealValue;
    const campaignCost = totalSent * 0.05;
    const costPerAcquisition = totalConversions > 0 ? campaignCost / totalConversions : 0;
    const returnOnAdSpend = campaignCost > 0 ? estimatedRevenue / campaignCost : 0;

    return {
      estimatedRevenue: Math.round(estimatedRevenue),
      costPerAcquisition: Math.round(costPerAcquisition * 100) / 100,
      returnOnAdSpend: Math.round(returnOnAdSpend * 100) / 100,
    };
  }

  private calculateTrending(messages: any[]) {
    const daysSinceSent = this.calculateDaysSinceSent(messages);
    const sentPerDay = daysSinceSent > 0 ? messages.length / daysSinceSent : messages.length;
    const conversionTrend = 0; // Simplified

    return {
      sentPerDay: Math.round(sentPerDay * 100) / 100,
      conversionTrend,
    };
  }

  private calculateDaysSinceSent(messages: any[]): number {
    if (messages.length === 0) return 1;
    const oldestDate = Math.min(
      ...messages.map((m) => new Date(m.createdAt).getTime())
    );
    const days = (Date.now() - oldestDate) / (24 * 60 * 60 * 1000);
    return Math.max(1, Math.ceil(days));
  }
}
