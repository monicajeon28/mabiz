/**
 * Performance Alerts Service (TASK 6-2)
 *
 * Threshold-based and anomaly detection:
 * - Revenue thresholds
 * - Conversion rate targets
 * - Channel-specific metrics
 * - Partner health checks
 * - Automatic escalation for critical issues
 *
 * Integration with daily report generation
 */

import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────

export interface AlertThresholds {
  dailyRevenue: {
    min: number; // $5K
    criticalDrop: number; // -30%
  };
  conversionRate: {
    min: number; // 2%
    target: number; // 3%
  };
  smsOpenRate: {
    min: number; // 20%
    target: number; // 25%
  };
  smsClickRate: {
    min: number; // 5%
  };
  emailOpenRate: {
    min: number; // 15%
  };
  emailClickRate: {
    min: number; // 3%
  };
  sequenceCompletion: {
    min: number; // 50%
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'RED' | 'YELLOW' | 'GREEN';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
  action?: string;
  escalateTo?: string[]; // Email addresses for critical alerts
}

export interface AnomalyDetection {
  detected: boolean;
  type: 'SPIKE' | 'DROP' | 'NONE';
  percentChange: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

// ─────────────────────────────────────────────────────
// DEFAULT THRESHOLDS
// ─────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  dailyRevenue: {
    min: 5000,
    criticalDrop: -30,
  },
  conversionRate: {
    min: 2.0,
    target: 3.0,
  },
  smsOpenRate: {
    min: 20,
    target: 25,
  },
  smsClickRate: {
    min: 5,
  },
  emailOpenRate: {
    min: 15,
  },
  emailClickRate: {
    min: 3,
  },
  sequenceCompletion: {
    min: 50,
  },
};

// ─────────────────────────────────────────────────────
// ALERT GENERATOR
// ─────────────────────────────────────────────────────

export class PerformanceAlertGenerator {
  private thresholds: AlertThresholds;

  constructor(customThresholds?: Partial<AlertThresholds>) {
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...customThresholds,
    };
  }

  /**
   * Generate alert for revenue
   */
  generateRevenueAlert(
    currentRevenue: number,
    previousRevenue: number,
    target: number = 5000
  ): PerformanceAlert | null {
    const percentChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    // Critical drop alert
    if (percentChange < this.thresholds.dailyRevenue.criticalDrop) {
      return {
        id: `ALERT_REVENUE_CRITICAL_${Date.now()}`,
        type: 'RED',
        metric: 'Revenue Drop',
        value: currentRevenue,
        threshold: target,
        message: `🚨 CRITICAL: Revenue $${currentRevenue.toFixed(0)} (${percentChange.toFixed(1)}% drop vs yesterday)`,
        priority: 'CRITICAL',
        action: 'Investigate system issues or campaign changes immediately',
        escalateTo: ['ceo@company.com', 'sales@company.com'],
        timestamp: new Date(),
      };
    }

    // Below minimum alert
    if (currentRevenue < this.thresholds.dailyRevenue.min) {
      return {
        id: `ALERT_REVENUE_LOW_${Date.now()}`,
        type: 'RED',
        metric: 'Daily Revenue',
        value: currentRevenue,
        threshold: this.thresholds.dailyRevenue.min,
        message: `Revenue $${currentRevenue.toFixed(0)} below $${this.thresholds.dailyRevenue.min.toFixed(0)} target`,
        priority: 'HIGH',
        action: 'Review sales pipeline and conversion funnel',
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Generate alert for conversion rate
   */
  generateConversionAlert(
    rate: number,
    previousRate: number
  ): PerformanceAlert | null {
    if (rate < this.thresholds.conversionRate.min) {
      const percentChange = previousRate > 0 ? ((rate - previousRate) / previousRate) * 100 : 0;

      return {
        id: `ALERT_CONVERSION_${Date.now()}`,
        type: 'YELLOW',
        metric: 'Conversion Rate',
        value: rate,
        threshold: this.thresholds.conversionRate.min,
        message: `Conversion rate ${rate.toFixed(2)}% below ${this.thresholds.conversionRate.min.toFixed(2)}% target (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`,
        priority: 'HIGH',
        action: 'Review landing page, pricing, or value proposition',
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Generate alert for SMS metrics
   */
  generateSmsAlert(
    sent: number,
    openRate: number,
    clickRate: number
  ): PerformanceAlert | null {
    // Only alert if sent > 0
    if (sent === 0) return null;

    if (openRate < this.thresholds.smsOpenRate.min) {
      return {
        id: `ALERT_SMS_OPEN_${Date.now()}`,
        type: 'YELLOW',
        metric: 'SMS Open Rate',
        value: openRate,
        threshold: this.thresholds.smsOpenRate.min,
        message: `SMS open rate ${openRate.toFixed(2)}% below ${this.thresholds.smsOpenRate.min.toFixed(2)}% target`,
        priority: 'MEDIUM',
        action: 'Test new SMS subject lines or send times',
        timestamp: new Date(),
      };
    }

    if (clickRate < this.thresholds.smsClickRate.min) {
      return {
        id: `ALERT_SMS_CLICK_${Date.now()}`,
        type: 'YELLOW',
        metric: 'SMS Click Rate',
        value: clickRate,
        threshold: this.thresholds.smsClickRate.min,
        message: `SMS click rate ${clickRate.toFixed(2)}% below ${this.thresholds.smsClickRate.min.toFixed(2)}% target`,
        priority: 'MEDIUM',
        action: 'Improve SMS CTA clarity and urgency',
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Generate alert for email metrics
   */
  generateEmailAlert(
    sent: number,
    openRate: number,
    clickRate: number
  ): PerformanceAlert | null {
    if (sent === 0) return null;

    if (openRate < this.thresholds.emailOpenRate.min) {
      return {
        id: `ALERT_EMAIL_OPEN_${Date.now()}`,
        type: 'YELLOW',
        metric: 'Email Open Rate',
        value: openRate,
        threshold: this.thresholds.emailOpenRate.min,
        message: `Email open rate ${openRate.toFixed(2)}% below ${this.thresholds.emailOpenRate.min.toFixed(2)}% target`,
        priority: 'MEDIUM',
        action: 'Test new email subject lines or sender names',
        timestamp: new Date(),
      };
    }

    if (clickRate < this.thresholds.emailClickRate.min) {
      return {
        id: `ALERT_EMAIL_CLICK_${Date.now()}`,
        type: 'YELLOW',
        metric: 'Email Click Rate',
        value: clickRate,
        threshold: this.thresholds.emailClickRate.min,
        message: `Email click rate ${clickRate.toFixed(2)}% below ${this.thresholds.emailClickRate.min.toFixed(2)}% target`,
        priority: 'MEDIUM',
        action: 'Review email copy and CTA button placement',
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Generate alert for sequence completion
   */
  generateSequenceCompletionAlert(
    completionRate: number,
    sequenceName: string
  ): PerformanceAlert | null {
    if (completionRate < this.thresholds.sequenceCompletion.min) {
      return {
        id: `ALERT_SEQUENCE_${Date.now()}`,
        type: 'YELLOW',
        metric: `${sequenceName} Completion Rate`,
        value: completionRate,
        threshold: this.thresholds.sequenceCompletion.min,
        message: `${sequenceName} completion rate ${completionRate.toFixed(2)}% below ${this.thresholds.sequenceCompletion.min.toFixed(2)}% target`,
        priority: 'MEDIUM',
        action: `Review and optimize ${sequenceName} messaging`,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Generate alert for partner metrics
   */
  generatePartnerAlert(
    partnerId: string,
    partnerName: string,
    lastSalesDays: number,
    commissionDropPercent: number
  ): PerformanceAlert | null {
    if (lastSalesDays >= 7) {
      return {
        id: `ALERT_PARTNER_INACTIVE_${Date.now()}`,
        type: 'YELLOW',
        metric: `Partner Inactivity: ${partnerName}`,
        value: lastSalesDays,
        threshold: 7,
        message: `Partner ${partnerName} has no sales for ${lastSalesDays} days`,
        priority: 'HIGH',
        action: `Send encouragement message and offer incentive to ${partnerName}`,
        timestamp: new Date(),
      };
    }

    if (commissionDropPercent > 40) {
      return {
        id: `ALERT_PARTNER_REVENUE_DROP_${Date.now()}`,
        type: 'YELLOW',
        metric: `Partner Revenue Drop: ${partnerName}`,
        value: commissionDropPercent,
        threshold: 40,
        message: `Partner ${partnerName} commission down ${commissionDropPercent.toFixed(1)}% vs last week`,
        priority: 'MEDIUM',
        action: `Contact ${partnerName} to discuss performance and offer support`,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Detect anomalies in metrics
   */
  detectAnomaly(
    current: number,
    historical: number[],
    type: 'REVENUE' | 'CONVERSION' | 'OPEN_RATE'
  ): AnomalyDetection {
    if (historical.length === 0 || historical.every((v) => v === 0)) {
      return {
        detected: false,
        type: 'NONE',
        percentChange: 0,
        severity: 'LOW',
        description: 'Insufficient historical data',
      };
    }

    const average = historical.reduce((a, b) => a + b, 0) / historical.length;
    const percentChange = average > 0 ? ((current - average) / average) * 100 : 0;
    const stdDev = this.calculateStdDev(historical, average);
    const zScore = stdDev > 0 ? Math.abs((current - average) / stdDev) : 0;

    // Z-score > 2 is ~95% confidence interval
    if (zScore > 2) {
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (zScore > 3) severity = 'HIGH'; // 99.7% confidence

      return {
        detected: true,
        type: percentChange > 0 ? 'SPIKE' : 'DROP',
        percentChange,
        severity,
        description: `${percentChange > 0 ? 'Spike' : 'Drop'} detected: ${Math.abs(percentChange).toFixed(1)}% deviation from average`,
      };
    }

    // Also check for revenue spike (>200%)
    if (type === 'REVENUE' && percentChange > 200) {
      return {
        detected: true,
        type: 'SPIKE',
        percentChange,
        severity: 'MEDIUM',
        description: `Unusual spike: ${percentChange.toFixed(1)}% above average`,
      };
    }

    return {
      detected: false,
      type: 'NONE',
      percentChange,
      severity: 'LOW',
      description: 'Normal variation',
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    const squareDiffs = values.map((value) => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Log alert to system
   */
  logAlert(alert: PerformanceAlert, orgId: string): void {
    logger.warn('[PerformanceAlert] Alert generated', {
      orgId,
      alertType: alert.type,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      priority: alert.priority,
    });
  }
}

/**
 * Helper: Generate all alerts for a report
 */
export function generateAllAlerts(
  orgId: string,
  metrics: {
    revenue: number;
    previousRevenue: number;
    conversionRate: number;
    previousConversionRate: number;
    sms: { sent: number; openRate: number; clickRate: number };
    email: { sent: number; openRate: number; clickRate: number };
    sequenceCompletion: number;
    partners: Array<{
      id: string;
      name: string;
      lastSalesDays: number;
      commissionDropPercent: number;
    }>;
  }
): PerformanceAlert[] {
  const generator = new PerformanceAlertGenerator();
  const alerts: PerformanceAlert[] = [];

  // Revenue alerts
  const revenueAlert = generator.generateRevenueAlert(metrics.revenue, metrics.previousRevenue);
  if (revenueAlert) {
    alerts.push(revenueAlert);
    generator.logAlert(revenueAlert, orgId);
  }

  // Conversion alerts
  const conversionAlert = generator.generateConversionAlert(
    metrics.conversionRate,
    metrics.previousConversionRate
  );
  if (conversionAlert) {
    alerts.push(conversionAlert);
    generator.logAlert(conversionAlert, orgId);
  }

  // SMS alerts
  const smsAlert = generator.generateSmsAlert(
    metrics.sms.sent,
    metrics.sms.openRate,
    metrics.sms.clickRate
  );
  if (smsAlert) {
    alerts.push(smsAlert);
    generator.logAlert(smsAlert, orgId);
  }

  // Email alerts
  const emailAlert = generator.generateEmailAlert(
    metrics.email.sent,
    metrics.email.openRate,
    metrics.email.clickRate
  );
  if (emailAlert) {
    alerts.push(emailAlert);
    generator.logAlert(emailAlert, orgId);
  }

  // Sequence alerts
  const sequenceAlert = generator.generateSequenceCompletionAlert(
    metrics.sequenceCompletion,
    'Day 0-3'
  );
  if (sequenceAlert) {
    alerts.push(sequenceAlert);
    generator.logAlert(sequenceAlert, orgId);
  }

  // Partner alerts
  for (const partner of metrics.partners) {
    const partnerAlert = generator.generatePartnerAlert(
      partner.id,
      partner.name,
      partner.lastSalesDays,
      partner.commissionDropPercent
    );
    if (partnerAlert) {
      alerts.push(partnerAlert);
      generator.logAlert(partnerAlert, orgId);
    }
  }

  return alerts;
}
