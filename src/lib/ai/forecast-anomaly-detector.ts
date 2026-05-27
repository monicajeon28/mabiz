/**
 * Forecast Anomaly Detection Module
 *
 * Detects when actual performance deviates significantly from forecast
 * - Significant drop (below lower CI): Alert! Why?
 * - Unexpected surge (above upper CI): Great! Replicate
 *
 * Root cause analysis:
 * - Partner {{name}} exceeded target → Celebrate + incentivize
 * - SMS open rate dropped 5pp → Investigate + fix
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { RevenueForecasts, DailyForecast } from '@/lib/ai/revenue-forecaster';

export interface AnomalyDetection {
  date: Date;
  metric: 'revenue' | 'conversion' | 'sms_open_rate' | 'partner_sales';
  actual: number;
  forecast: number;
  lower95: number;
  upper95: number;
  deviation: number; // % deviation from forecast
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'POSITIVE' | 'NEGATIVE';
  rootCauses: RootCause[];
  recommendations: string[];
}

export interface RootCause {
  factor: string;
  impact: number; // -50 to +50 percentage points
  confidence: number; // 0-1
  evidence: string;
}

export interface AnomalyReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  anomalies: AnomalyDetection[];
  summary: {
    totalAnomalies: number;
    positiveCount: number;
    negativeCount: number;
    criticalCount: number;
    averageDeviation: number;
  };
  topRootCauses: Array<{
    factor: string;
    occurrences: number;
    totalImpact: number;
  }>;
  actionItems: ActionItem[];
}

export interface ActionItem {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'INVESTIGATE' | 'CELEBRATE' | 'REPLICATE' | 'FIX';
  title: string;
  description: string;
  estimatedImpact: number; // $ or %
  targetDate: Date;
}

// ────────────────────────────────────────────────────────────
// Anomaly Detection Engine
// ────────────────────────────────────────────────────────────

export class ForecastAnomalyDetector {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  /**
   * Main detection function
   */
  async detectAnomalies(
    forecast: RevenueForecasts,
    lookbackDays: number = 7
  ): Promise<AnomalyReport> {
    try {
      const startTime = Date.now();

      // 1. Get actual results for lookback period
      const actualResults = await this.getActualResults(lookbackDays);

      // 2. Compare to forecast
      const anomalies = this.identifyAnomalies(forecast, actualResults);

      // 3. Analyze root causes
      const anomaliesWithCauses = await Promise.all(
        anomalies.map((anomaly) => this.analyzeRootCauses(anomaly))
      );

      // 4. Generate recommendations
      const withRecommendations = anomaliesWithCauses.map((anomaly) =>
        this.generateRecommendations(anomaly)
      );

      // 5. Summarize findings
      const summary = this.summarizeFindings(withRecommendations);

      // 6. Create action items
      const actionItems = this.createActionItems(withRecommendations);

      logger.info(`Anomaly detection completed for ${this.organizationId}`, {
        lookbackDays,
        anomaliesFound: withRecommendations.length,
        executionMs: Date.now() - startTime,
      });

      return {
        period: {
          startDate: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
        anomalies: withRecommendations,
        summary,
        topRootCauses: this.rankRootCauses(withRecommendations),
        actionItems,
      };
    } catch (error) {
      logger.error('Anomaly detection failed', {
        organizationId: this.organizationId,
        error: String(error),
      });
      return this.getEmptyReport();
    }
  }

  /**
   * Get actual results for lookback period
   */
  private async getActualResults(days: number): Promise<Map<string, ActualMetrics>> {
    const result = new Map<string, ActualMetrics>();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get revenue data
    const sales = await prisma.affiliateSale.findMany({
      where: {
        organizationId: this.organizationId,
        createdAt: { gte: startDate },
      },
      select: {
        saleAmount: true,
        createdAt: true,
        affiliateCode: true,
        customerId: true,
      },
    });

    // Get conversions
    const conversions = await prisma.funnelConversion.findMany({
      where: {
        convertedAt: { gte: startDate },
      },
      select: {
        conversionValue: true,
        convertedAt: true,
      },
    });

    // Get SMS metrics
    const smsMessages = await prisma.crmMarketingMessage.findMany({
      where: {
        organizationId: this.organizationId,
        channel: 'SMS',
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        isOpened: true,
        isConverted: true,
        createdAt: true,
      },
    });

    // Aggregate by date
    const revenueByDate = new Map<string, number>();
    const conversionsByDate = new Map<string, number>();
    const smsMetricsByDate = new Map<
      string,
      { sent: number; opened: number; converted: number }
    >();
    const partnersByDate = new Map<string, Map<string, number>>();

    // Process sales
    sales.forEach((sale) => {
      const dateKey = this.getDateKey(sale.createdAt);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + sale.saleAmount);

      // Partner tracking
      if (!partnersByDate.has(dateKey)) {
        partnersByDate.set(dateKey, new Map());
      }
      const partnerMap = partnersByDate.get(dateKey)!;
      const code = sale.affiliateCode;
      partnerMap.set(code, (partnerMap.get(code) || 0) + sale.saleAmount);
    });

    // Process conversions
    conversions.forEach((conv) => {
      const dateKey = this.getDateKey(conv.convertedAt);
      if (conv.conversionValue) {
        conversionsByDate.set(dateKey, (conversionsByDate.get(dateKey) || 0) + 1);
      }
    });

    // Process SMS metrics
    smsMessages.forEach((msg) => {
      const dateKey = this.getDateKey(msg.createdAt);
      if (!smsMetricsByDate.has(dateKey)) {
        smsMetricsByDate.set(dateKey, { sent: 0, opened: 0, converted: 0 });
      }

      const metrics = smsMetricsByDate.get(dateKey)!;
      metrics.sent++;
      if (msg.isOpened) metrics.opened++;
      if (msg.isConverted) metrics.converted++;
    });

    // Build result
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = this.getDateKey(date);

      const revenue = revenueByDate.get(dateKey) || 0;
      const conversions = conversionsByDate.get(dateKey) || 0;
      const smsMetrics = smsMetricsByDate.get(dateKey);

      result.set(dateKey, {
        date,
        revenue,
        conversions,
        smsOpenRate: smsMetrics ? (smsMetrics.opened / smsMetrics.sent) * 100 : 0,
        smsConversionRate: smsMetrics ? (smsMetrics.converted / smsMetrics.sent) * 100 : 0,
        topPartner: this.getTopPartner(partnersByDate.get(dateKey)),
      });
    }

    return result;
  }

  /**
   * Identify anomalies by comparing actual to forecast
   */
  private identifyAnomalies(
    forecast: RevenueForecasts,
    actual: Map<string, ActualMetrics>
  ): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];

    actual.forEach((actualMetrics) => {
      // Find corresponding forecast
      const matchingForecast = forecast.daily.find(
        (f) => this.getDateKey(f.date) === this.getDateKey(actualMetrics.date)
      );

      if (!matchingForecast) return;

      // Check revenue anomaly
      const revenueDeviation =
        ((actualMetrics.revenue - matchingForecast.revenue) / matchingForecast.revenue) * 100;

      if (
        actualMetrics.revenue < matchingForecast.lower95 ||
        actualMetrics.revenue > matchingForecast.upper95
      ) {
        const severity = this.calculateSeverity(
          revenueDeviation,
          matchingForecast.lower95,
          matchingForecast.upper95,
          actualMetrics.revenue
        );

        anomalies.push({
          date: actualMetrics.date,
          metric: 'revenue',
          actual: actualMetrics.revenue,
          forecast: matchingForecast.revenue,
          lower95: matchingForecast.lower95,
          upper95: matchingForecast.upper95,
          deviation: revenueDeviation,
          severity,
          type: revenueDeviation > 0 ? 'POSITIVE' : 'NEGATIVE',
          rootCauses: [],
          recommendations: [],
        });
      }
    });

    return anomalies;
  }

  /**
   * Analyze root causes for anomalies
   */
  private async analyzeRootCauses(anomaly: AnomalyDetection): Promise<AnomalyDetection> {
    const causes: RootCause[] = [];

    if (anomaly.metric === 'revenue') {
      // Check partner sales
      const topPartnerImpact = await this.analyzePartnerImpact(anomaly.date);
      if (topPartnerImpact.impact !== 0) {
        causes.push(topPartnerImpact);
      }

      // Check SMS activity
      const smsImpact = await this.analyzeSmsImpact(anomaly.date);
      if (smsImpact.impact !== 0) {
        causes.push(smsImpact);
      }

      // Check campaign activity
      const campaignImpact = await this.analyzeCampaignImpact(anomaly.date);
      if (campaignImpact.impact !== 0) {
        causes.push(campaignImpact);
      }

      // Check external factors
      const externalImpact = await this.analyzeExternalFactors(anomaly.date);
      if (externalImpact.impact !== 0) {
        causes.push(externalImpact);
      }
    }

    return { ...anomaly, rootCauses: causes };
  }

  /**
   * Analyze partner sales impact
   */
  private async analyzePartnerImpact(date: Date): Promise<RootCause> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const partnerSales = await prisma.affiliateSale.findMany({
      where: {
        organizationId: this.organizationId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        affiliateCode: true,
        saleAmount: true,
      },
    });

    if (partnerSales.length === 0) {
      return {
        factor: 'Partner Sales',
        impact: 0,
        confidence: 0,
        evidence: 'No partner sales detected',
      };
    }

    // Sort partners by sales
    const partners = new Map<string, number>();
    partnerSales.forEach((sale) => {
      partners.set(sale.affiliateCode, (partners.get(sale.affiliateCode) || 0) + sale.saleAmount);
    });

    const topPartnerSales = Math.max(...Array.from(partners.values()));
    const avgPartnerSales = Array.from(partners.values()).reduce((a, b) => a + b, 0) / partners.size;

    const impact = ((topPartnerSales - avgPartnerSales) / avgPartnerSales) * 100;

    return {
      factor: `Partner Spike - ${Array.from(partners.keys())[0]}`,
      impact: Math.min(50, impact),
      confidence: Math.min(0.95, partnerSales.length * 0.1),
      evidence: `${partnerSales.length} partner sales detected`,
    };
  }

  /**
   * Analyze SMS activity impact
   */
  private async analyzeSmsImpact(date: Date): Promise<RootCause> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const smsMessages = await prisma.crmMarketingMessage.findMany({
      where: {
        organizationId: this.organizationId,
        channel: 'SMS',
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        isOpened: true,
      },
    });

    if (smsMessages.length === 0) {
      return { factor: 'SMS Activity', impact: 0, confidence: 0, evidence: 'No SMS sent' };
    }

    const openRate = (smsMessages.filter((m) => m.isOpened).length / smsMessages.length) * 100;
    const historicalRate = 25; // Historical average

    const impact = openRate - historicalRate;

    return {
      factor: 'SMS Campaign Activity',
      impact,
      confidence: Math.min(0.9, smsMessages.length * 0.01),
      evidence: `${smsMessages.length} SMS sent, ${openRate.toFixed(1)}% open rate`,
    };
  }

  /**
   * Analyze campaign impact
   */
  private async analyzeCampaignImpact(date: Date): Promise<RootCause> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const campaigns = await prisma.campaignCost.findMany({
      where: {
        organizationId: this.organizationId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        cost: true,
      },
    });

    if (campaigns.length === 0) {
      return {
        factor: 'Campaign Spend',
        impact: 0,
        confidence: 0,
        evidence: 'No campaign spend',
      };
    }

    const totalSpend = campaigns.reduce((sum, c) => sum + c.cost, 0);
    const expectedROAS = 3.0; // Expected return on ad spend
    const expectedRevenue = totalSpend * expectedROAS;

    return {
      factor: 'Campaign Investment',
      impact: 5, // Typical campaign lift
      confidence: 0.7,
      evidence: `${campaigns.length} campaigns, $${totalSpend.toFixed(0)} spent`,
    };
  }

  /**
   * Analyze external factors (holidays, weather, etc.)
   */
  private async analyzeExternalFactors(date: Date): Promise<RootCause> {
    // Simplified - in production would check weather, holidays, events
    const month = date.getMonth();
    const dayOfWeek = date.getDay();

    let impact = 0;
    let evidence = '';

    // Check for weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      impact = -10; // Weekends typically lower
      evidence = 'Weekend';
    }

    // Check for holiday season
    if ((month === 11 && date.getDate() > 20) || (month === 0 && date.getDate() < 3)) {
      impact = 15; // Holiday boost
      evidence = 'Holiday Season';
    }

    if (impact === 0) {
      return { factor: 'External Factors', impact: 0, confidence: 0, evidence: 'No known factors' };
    }

    return {
      factor: 'External Factors',
      impact,
      confidence: 0.6,
      evidence,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(anomaly: AnomalyDetection): AnomalyDetection {
    const recommendations: string[] = [];

    if (anomaly.type === 'POSITIVE') {
      // Positive anomaly - celebrate and replicate
      if (anomaly.rootCauses.length > 0) {
        const topCause = anomaly.rootCauses[0];
        recommendations.push(`Great performance! "${topCause.factor}" contributed significantly.`);
        recommendations.push(`Consider scaling: ${this.getReplicationStrategy(topCause.factor)}`);
      }
    } else {
      // Negative anomaly - investigate and fix
      recommendations.push('Performance below forecast.');
      if (anomaly.rootCauses.length > 0) {
        const topCause = anomaly.rootCauses[0];
        recommendations.push(`Likely cause: ${topCause.factor} (${topCause.impact.toFixed(1)}% impact)`);
        recommendations.push(`Action: ${this.getRemediationStrategy(topCause.factor)}`);
      }
    }

    if (anomaly.severity === 'CRITICAL') {
      recommendations.push('⚠️ URGENT: Escalate to management immediately');
    }

    return { ...anomaly, recommendations };
  }

  /**
   * Get replication strategy
   */
  private getReplicationStrategy(factor: string): string {
    if (factor.includes('Partner')) {
      return 'Increase partner commission, add partner recruitment campaigns';
    }
    if (factor.includes('SMS')) {
      return 'Expand SMS frequency, test new message templates';
    }
    if (factor.includes('Campaign')) {
      return 'Increase ad spend on performing creatives';
    }
    return 'Review and replicate success factors';
  }

  /**
   * Get remediation strategy
   */
  private getRemediationStrategy(factor: string): string {
    if (factor.includes('SMS')) {
      return 'Check SMS delivery rate, review message content, test new templates';
    }
    if (factor.includes('Campaign')) {
      return 'Review ad account health, check audience targeting, pause underperforming ads';
    }
    return 'Investigate and take corrective action';
  }

  /**
   * Calculate severity
   */
  private calculateSeverity(
    deviation: number,
    lower95: number,
    upper95: number,
    actual: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const absDeviation = Math.abs(deviation);

    if (absDeviation > 50 || actual < lower95 * 0.5) {
      return 'CRITICAL';
    }
    if (absDeviation > 30) {
      return 'HIGH';
    }
    if (absDeviation > 15) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Summarize findings
   */
  private summarizeFindings(anomalies: AnomalyDetection[]): AnomalyReport['summary'] {
    const positive = anomalies.filter((a) => a.type === 'POSITIVE');
    const negative = anomalies.filter((a) => a.type === 'NEGATIVE');
    const critical = anomalies.filter((a) => a.severity === 'CRITICAL');

    const avgDeviation =
      anomalies.length > 0 ? anomalies.reduce((sum, a) => sum + Math.abs(a.deviation), 0) / anomalies.length : 0;

    return {
      totalAnomalies: anomalies.length,
      positiveCount: positive.length,
      negativeCount: negative.length,
      criticalCount: critical.length,
      averageDeviation: avgDeviation,
    };
  }

  /**
   * Rank root causes by frequency
   */
  private rankRootCauses(
    anomalies: AnomalyDetection[]
  ): AnomalyReport['topRootCauses'] {
    const causes = new Map<string, { occurrences: number; totalImpact: number }>();

    anomalies.forEach((anomaly) => {
      anomaly.rootCauses.forEach((cause) => {
        if (!causes.has(cause.factor)) {
          causes.set(cause.factor, { occurrences: 0, totalImpact: 0 });
        }
        const data = causes.get(cause.factor)!;
        data.occurrences++;
        data.totalImpact += cause.impact;
      });
    });

    return Array.from(causes.entries())
      .map(([factor, data]) => ({
        factor,
        ...data,
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);
  }

  /**
   * Create action items
   */
  private createActionItems(anomalies: AnomalyDetection[]): ActionItem[] {
    const items: ActionItem[] = [];

    anomalies.forEach((anomaly) => {
      if (anomaly.type === 'POSITIVE' && anomaly.deviation > 20) {
        items.push({
          priority: 'HIGH',
          type: 'CELEBRATE',
          title: `Celebrate: Performance ${anomaly.deviation.toFixed(0)}% above forecast`,
          description: `Great results on ${anomaly.date.toLocaleDateString()}. Root causes: ${anomaly.rootCauses.map((c) => c.factor).join(', ')}`,
          estimatedImpact: anomaly.actual * 0.1,
          targetDate: new Date(),
        });
      }

      if (anomaly.severity === 'CRITICAL') {
        items.push({
          priority: 'HIGH',
          type: 'INVESTIGATE',
          title: `Urgent: ${anomaly.metric} deviation of ${anomaly.deviation.toFixed(0)}%`,
          description: `Performance significantly below forecast on ${anomaly.date.toLocaleDateString()}. Immediate investigation required.`,
          estimatedImpact: -anomaly.actual * 0.2,
          targetDate: new Date(),
        });
      }

      if (anomaly.rootCauses.length > 0) {
        const topCause = anomaly.rootCauses[0];
        items.push({
          priority: anomaly.severity === 'HIGH' || anomaly.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          type: anomaly.type === 'POSITIVE' ? 'REPLICATE' : 'FIX',
          title: `${anomaly.type === 'POSITIVE' ? 'Replicate' : 'Fix'}: ${topCause.factor}`,
          description: topCause.evidence,
          estimatedImpact: topCause.impact,
          targetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        });
      }
    });

    return items.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Helper: Get top partner
   */
  private getTopPartner(partners: Map<string, number> | undefined): string {
    if (!partners || partners.size === 0) return '';
    return Array.from(partners.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Helper: Convert date to key
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Empty report
   */
  private getEmptyReport(): AnomalyReport {
    return {
      period: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
      anomalies: [],
      summary: {
        totalAnomalies: 0,
        positiveCount: 0,
        negativeCount: 0,
        criticalCount: 0,
        averageDeviation: 0,
      },
      topRootCauses: [],
      actionItems: [],
    };
  }
}

export async function detectAnomalies(
  organizationId: string,
  forecast: RevenueForecasts,
  lookbackDays?: number
): Promise<AnomalyReport> {
  const detector = new ForecastAnomalyDetector(organizationId);
  return detector.detectAnomalies(forecast, lookbackDays);
}

// Type for internal use
interface ActualMetrics {
  date: Date;
  revenue: number;
  conversions: number;
  smsOpenRate: number;
  smsConversionRate: number;
  topPartner: string;
}
