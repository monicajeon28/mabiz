/**
 * Demand Sensing - Early Warning System
 *
 * Detects demand shifts 3-5 days BEFORE they appear in sales
 * Uses leading indicators:
 * - Partner activity levels
 * - Customer inquiry surge
 * - Email engagement rate
 * - SMS open/click rates
 * - Website traffic patterns
 * - Social media mentions
 * - Search volume changes
 *
 * Outputs:
 * - Demand forecast (with confidence)
 * - Alert: "Surge detected → Expect +25% sales in 5 days"
 * - Helps with inventory, resource planning, staffing
 * - Early action on market shifts
 *
 * Algorithm:
 * 1. Collect leading indicators (7-day history)
 * 2. Compute leading correlation with sales (3-5 day lag)
 * 3. Detect changes in leading indicators
 * 4. Forecast sales based on changes
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface LeadingIndicator {
  date: Date;
  partnerActivityScore: number; // 0-100 (partner engagement)
  inquiryVolume: number; // number of customer inquiries
  emailEngagementRate: number; // 0-1 (opens + clicks)
  smsOpenRate: number; // 0-1
  websiteTraffic: number; // visitors
  socialMentions: number; // brand mentions
  searchVolume: number; // relative search interest
  averageOrderValue?: number; // from partner orders
}

export interface DemandSignal {
  indicator: string;
  change: number; // % change from baseline
  confidence: number; // 0-1
  direction: 'up' | 'down';
  leadDays: number; // days before sales impact
}

export interface DemandForecast {
  date: Date;
  expectedSalesChange: number; // % change from baseline
  confidence: number; // 0-1
  signals: DemandSignal[];
  recommendation: string;
  actions: string[];
}

export interface DemandSensingResult {
  forecast: DemandForecast[];
  summary: {
    overallTrend: 'surge' | 'decline' | 'stable';
    magnitude: number; // % change expected
    confidence: number;
    daysAhead: number; // forecast window
  };
  alerts: {
    critical: string[];
    warning: string[];
  };
  recommendations: {
    inventory: string;
    staffing: string;
    marketing: string;
    partnerships: string;
  };
}

export interface DemandSensingConfig {
  lookbackDays: number; // 30 default
  forecastDays: number; // 7 default
  minDataPoints: number; // 21 default
  signalThreshold: number; // 0.3 (30% change) default
  confidenceThreshold: number; // 0.6 (60%) default
  usePartnerActivity: boolean;
  useInquiries: boolean;
  useEngagement: boolean;
  useWebTraffic: boolean;
  useSocialSignals: boolean;
}

/**
 * Demand Sensing Engine
 */
export class DemandSensingEngine {
  private config: DemandSensingConfig;
  private baselineIndicators: LeadingIndicator | null = null;
  private indicatorHistory: LeadingIndicator[] = [];
  private correlations: Map<string, number> = new Map(); // indicator -> sales correlation

  constructor(config: Partial<DemandSensingConfig> = {}) {
    this.config = {
      lookbackDays: 30,
      forecastDays: 7,
      minDataPoints: 21,
      signalThreshold: 0.3,
      confidenceThreshold: 0.6,
      usePartnerActivity: true,
      useInquiries: true,
      useEngagement: true,
      useWebTraffic: true,
      useSocialSignals: true,
      ...config,
    };
  }

  /**
   * Fit demand sensing model to historical data
   */
  async fit(
    historicalIndicators: LeadingIndicator[],
    salesHistory: { date: Date; value: number }[]
  ): Promise<void> {
    if (historicalIndicators.length < this.config.minDataPoints) {
      throw new Error(
        `Need at least ${this.config.minDataPoints} indicator data points, got ${historicalIndicators.length}`
      );
    }

    this.indicatorHistory = historicalIndicators;

    // Compute baseline (average of first 50% of data)
    const baselineLength = Math.floor(historicalIndicators.length / 2);
    const baselineData = historicalIndicators.slice(0, baselineLength);

    this.baselineIndicators = {
      date: new Date(),
      partnerActivityScore:
        baselineData.reduce((s, d) => s + d.partnerActivityScore, 0) / baselineLength,
      inquiryVolume: baselineData.reduce((s, d) => s + d.inquiryVolume, 0) / baselineLength,
      emailEngagementRate:
        baselineData.reduce((s, d) => s + d.emailEngagementRate, 0) / baselineLength,
      smsOpenRate: baselineData.reduce((s, d) => s + d.smsOpenRate, 0) / baselineLength,
      websiteTraffic: baselineData.reduce((s, d) => s + d.websiteTraffic, 0) / baselineLength,
      socialMentions: baselineData.reduce((s, d) => s + d.socialMentions, 0) / baselineLength,
      searchVolume: baselineData.reduce((s, d) => s + d.searchVolume, 0) / baselineLength,
    };

    // Compute correlations with sales (using 3-5 day lag)
    await this.computeIndicatorCorrelations(historicalIndicators, salesHistory);

    logger.info('Demand sensing engine fitted');
  }

  /**
   * Compute correlation between indicators and sales (with lag)
   */
  private async computeIndicatorCorrelations(
    indicators: LeadingIndicator[],
    sales: { date: Date; value: number }[]
  ): Promise<void> {
    const lags = [3, 4, 5]; // test 3, 4, 5 day lags

    const indicatorNames = [
      'partnerActivityScore',
      'inquiryVolume',
      'emailEngagementRate',
      'smsOpenRate',
      'websiteTraffic',
      'socialMentions',
      'searchVolume',
    ];

    for (const indicator of indicatorNames) {
      let bestCorrelation = 0;

      for (const lag of lags) {
        const correlation = this.computeCorrelation(
          indicators.slice(0, -lag).map((d) => d[indicator as keyof LeadingIndicator] as number),
          sales.slice(lag).map((d) => d.value)
        );

        bestCorrelation = Math.max(bestCorrelation, Math.abs(correlation));
      }

      this.correlations.set(indicator, bestCorrelation);
    }
  }

  /**
   * Compute Pearson correlation coefficient
   */
  private computeCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0,
      denomX = 0,
      denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Detect demand signals in current indicators
   */
  private detectSignals(currentIndicators: LeadingIndicator): DemandSignal[] {
    if (!this.baselineIndicators) {
      return [];
    }

    const signals: DemandSignal[] = [];

    // Check each indicator
    const checks = [
      {
        name: 'Partner Activity',
        current: currentIndicators.partnerActivityScore,
        baseline: this.baselineIndicators.partnerActivityScore,
        enabled: this.config.usePartnerActivity,
        leadDays: 4,
      },
      {
        name: 'Customer Inquiries',
        current: currentIndicators.inquiryVolume,
        baseline: this.baselineIndicators.inquiryVolume,
        enabled: this.config.useInquiries,
        leadDays: 5,
      },
      {
        name: 'Email Engagement',
        current: currentIndicators.emailEngagementRate,
        baseline: this.baselineIndicators.emailEngagementRate,
        enabled: this.config.useEngagement,
        leadDays: 3,
      },
      {
        name: 'SMS Open Rate',
        current: currentIndicators.smsOpenRate,
        baseline: this.baselineIndicators.smsOpenRate,
        enabled: this.config.useEngagement,
        leadDays: 3,
      },
      {
        name: 'Website Traffic',
        current: currentIndicators.websiteTraffic,
        baseline: this.baselineIndicators.websiteTraffic,
        enabled: this.config.useWebTraffic,
        leadDays: 2,
      },
      {
        name: 'Social Mentions',
        current: currentIndicators.socialMentions,
        baseline: this.baselineIndicators.socialMentions,
        enabled: this.config.useSocialSignals,
        leadDays: 4,
      },
      {
        name: 'Search Volume',
        current: currentIndicators.searchVolume,
        baseline: this.baselineIndicators.searchVolume,
        enabled: this.config.useSocialSignals,
        leadDays: 3,
      },
    ];

    for (const check of checks) {
      if (!check.enabled) continue;

      const change = (check.current - check.baseline) / Math.max(0.01, check.baseline);

      if (Math.abs(change) > this.config.signalThreshold) {
        const correlation = this.correlations.get(
          check.name
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace('partnersactivity', 'partnerActivityScore')
            .replace('customerinquiries', 'inquiryVolume')
        ) || 0.5;

        signals.push({
          indicator: check.name,
          change,
          confidence: Math.min(1, Math.abs(change) * correlation),
          direction: change > 0 ? 'up' : 'down',
          leadDays: check.leadDays,
        });
      }
    }

    return signals;
  }

  /**
   * Forecast demand based on current signals
   */
  async forecast(currentIndicators: LeadingIndicator[]): Promise<DemandForecast[]> {
    if (!this.baselineIndicators) {
      throw new Error('Model not fitted. Call fit() first.');
    }

    const forecasts: DemandForecast[] = [];
    const baseDate = new Date();

    // Use most recent indicator as signal
    const signals = this.detectSignals(currentIndicators[currentIndicators.length - 1]);

    // Aggregate signals
    let upSignals = 0,
      downSignals = 0;
    let totalConfidence = 0;

    for (const signal of signals) {
      if (signal.direction === 'up') {
        upSignals += signal.confidence;
      } else {
        downSignals += signal.confidence;
      }
      totalConfidence += signal.confidence;
    }

    const netSignal = (upSignals - downSignals) / Math.max(1, totalConfidence);
    const overallConfidence = totalConfidence / signals.length;

    // Generate forecasts for next N days
    for (let i = 1; i <= this.config.forecastDays; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      // Sales impact increases then decreases (bell curve)
      const daysFromPeak = Math.abs(i - 4);
      const impactDecay = Math.exp(-Math.pow(daysFromPeak, 2) / 2);

      const expectedChange = netSignal * impactDecay * 0.5; // scale to 0-50% impact

      forecasts.push({
        date,
        expectedSalesChange: expectedChange,
        confidence: overallConfidence * (1 - daysFromPeak / 10), // confidence decreases with distance
        signals: i === 1 ? signals : [], // include signals on first day
        recommendation: this.getRecommendation(expectedChange, overallConfidence),
        actions: this.getActions(expectedChange, signals),
      });
    }

    return forecasts;
  }

  /**
   * Get recommendation based on forecast
   */
  private getRecommendation(salesChange: number, confidence: number): string {
    if (Math.abs(salesChange) < 0.05) {
      return 'Stable demand expected. Continue current operations.';
    }

    if (salesChange > 0.3) {
      return `Demand surge detected (${(salesChange * 100).toFixed(0)}% increase expected). ${confidence > 0.7 ? 'High confidence.' : 'Monitor closely.'} Prepare resources immediately.`;
    } else if (salesChange > 0.1) {
      return `Moderate demand increase (${(salesChange * 100).toFixed(0)}%) expected. Prepare to scale up operations.`;
    } else if (salesChange < -0.3) {
      return `Demand decline (${(Math.abs(salesChange) * 100).toFixed(0)}% drop expected). ${confidence > 0.7 ? 'High confidence decline.' : 'Monitor.'} Review inventory.`;
    } else if (salesChange < -0.1) {
      return `Moderate demand decrease expected. Reduce active promotions.`;
    }

    return 'Mixed signals. Monitor for clearer trends.';
  }

  /**
   * Get action items based on forecast
   */
  private getActions(salesChange: number, signals: DemandSignal[]): string[] {
    const actions: string[] = [];

    if (salesChange > 0.2) {
      actions.push('Increase inventory levels by 20-30%');
      actions.push('Alert fulfillment team to prepare for surge');
      actions.push('Review staffing levels - consider temporary staff');
      actions.push('Prepare customer support for higher ticket volume');
    } else if (salesChange < -0.2) {
      actions.push('Review marketing spend - consider pause/reduction');
      actions.push('Assess inventory levels - avoid overstock');
      actions.push('Plan partner engagement to stimulate demand');
    }

    // Signal-specific actions
    const upSignals = signals.filter((s) => s.direction === 'up');
    if (upSignals.some((s) => s.indicator.includes('Partner'))) {
      actions.push('Coordinate with high-activity partners on inventory');
    }
    if (upSignals.some((s) => s.indicator.includes('Inquiry'))) {
      actions.push('Follow up on pending inquiries - conversion opportunity');
    }
    if (upSignals.some((s) => s.indicator.includes('Engagement'))) {
      actions.push('Launch follow-up email/SMS campaigns - interest is high');
    }

    return actions.slice(0, 4); // limit to top 4
  }
}

/**
 * Demand Sensing Manager
 */
export class DemandSensingManager {
  /**
   * Generate demand forecast with early warning alerts
   */
  static async forecastDemand(
    lookbackDays: number = 30,
    config?: Partial<DemandSensingConfig>
  ): Promise<DemandSensingResult> {
    // Get historical indicators and sales
    const indicators = await this.getHistoricalIndicators(lookbackDays);
    const sales = await this.getHistoricalSales(lookbackDays);

    if (indicators.length < 21) {
      throw new Error('Insufficient historical data for demand sensing');
    }

    const engine = new DemandSensingEngine(config);
    await engine.fit(indicators, sales);

    // Generate forecast
    const forecast = await engine.forecast(indicators.slice(-7)); // use last week of indicators

    // Identify signals and alerts
    const signals = forecast[0].signals;
    const alerts = {
      critical: [] as string[],
      warning: [] as string[],
    };

    for (const day of forecast) {
      if (Math.abs(day.expectedSalesChange) > 0.4) {
        alerts.critical.push(
          `Day ${forecast.indexOf(day) + 1}: ${day.recommendation}`
        );
      } else if (Math.abs(day.expectedSalesChange) > 0.2) {
        alerts.warning.push(
          `Day ${forecast.indexOf(day) + 1}: ${day.recommendation}`
        );
      }
    }

    // Overall summary
    const avgChange = forecast.reduce((s, d) => s + d.expectedSalesChange, 0) / forecast.length;
    const avgConfidence = forecast.reduce((s, d) => s + d.confidence, 0) / forecast.length;

    return {
      forecast,
      summary: {
        overallTrend: avgChange > 0.1 ? 'surge' : avgChange < -0.1 ? 'decline' : 'stable',
        magnitude: Math.abs(avgChange),
        confidence: avgConfidence,
        daysAhead: forecast.length,
      },
      alerts,
      recommendations: {
        inventory: this.getInventoryRecommendation(avgChange),
        staffing: this.getStaffingRecommendation(avgChange),
        marketing: this.getMarketingRecommendation(avgChange),
        partnerships: this.getPartnershipRecommendation(signals),
      },
    };
  }

  private static getInventoryRecommendation(change: number): string {
    if (change > 0.3) return 'Increase stock by 25-35% across all SKUs';
    if (change > 0.1) return 'Increase stock by 10-15%';
    if (change < -0.2) return 'Reduce restocking; monitor current levels closely';
    return 'Maintain current inventory levels';
  }

  private static getStaffingRecommendation(change: number): string {
    if (change > 0.3) return 'Alert fulfillment team; prepare for +25% volume';
    if (change > 0.1) return 'Monitor staffing; may need +10% capacity';
    if (change < -0.2) return 'Review staffing schedule; adjust for lower volume';
    return 'Maintain current staffing';
  }

  private static getMarketingRecommendation(change: number): string {
    if (change > 0.3) return 'Increase ad spend by 20-30%; capitalize on demand surge';
    if (change > 0.1) return 'Maintain current ad spend';
    if (change < -0.2) return 'Reduce ad spend by 20-30%; focus on retention';
    return 'Optimize current campaigns';
  }

  private static getPartnershipRecommendation(signals: DemandSignal[]): string {
    const partnerSignals = signals.filter((s) => s.indicator.includes('Partner'));
    if (partnerSignals.some((s) => s.direction === 'up')) {
      return 'Partner activity increasing - reward top performers; scale successful partnerships';
    }
    if (partnerSignals.some((s) => s.direction === 'down')) {
      return 'Partner engagement declining - schedule check-ins; review incentives';
    }
    return 'Monitor partner performance; maintain current engagement strategy';
  }

  private static async getHistoricalIndicators(days: number): Promise<LeadingIndicator[]> {
    // Would query from analytics DB or partner API
    const indicators: LeadingIndicator[] = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      const dayOfWeek = date.getDay();
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0;

      indicators.push({
        date,
        partnerActivityScore: 50 + Math.random() * 40 * weekendMultiplier,
        inquiryVolume: 15 + Math.random() * 20 * weekendMultiplier,
        emailEngagementRate: 0.25 + Math.random() * 0.2 * weekendMultiplier,
        smsOpenRate: 0.35 + Math.random() * 0.2 * weekendMultiplier,
        websiteTraffic: 1000 + Math.random() * 500 * weekendMultiplier,
        socialMentions: 20 + Math.random() * 30,
        searchVolume: 100 + Math.random() * 50,
      });
    }

    return indicators;
  }

  private static async getHistoricalSales(days: number): Promise<{ date: Date; value: number }[]> {
    // Would query from analytics DB
    const sales: { date: Date; value: number }[] = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      const dayOfWeek = date.getDay();
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.8 : 1.0;
      const trend = i * 0.5;
      const seasonal = 100 * Math.sin((i / 7) * Math.PI * 2);
      const noise = Math.random() * 50 - 25;

      sales.push({
        date,
        value: Math.max(0, 1000 + trend + seasonal + noise) * weekendMultiplier,
      });
    }

    return sales;
  }
}
