/**
 * Scenario Planner Service
 *
 * Enables "what-if" analysis to predict revenue impact of:
 * - Increasing SMS send volume
 * - Deploying new Day 0-3 sequences
 * - Changing partner commission
 * - Launching new marketing channels
 * - Adjusting pricing
 *
 * Function: predictWithScenario(changes) → forecast
 */

import { RevenueForecast, RevenueForecasts } from '@/lib/ai/revenue-forecaster';
import { ConversionRateForecaster, ConversionForecast } from '@/lib/ai/conversion-forecaster';
import { logger } from '@/lib/logger';

export interface ScenarioChange {
  type:
    | 'sms_volume_increase'
    | 'new_sequence'
    | 'partner_commission'
    | 'marketing_channel'
    | 'pricing'
    | 'conversion_lift'
    | 'channel_shift';
  value: number; // Percentage or absolute value
  description?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ScenarioResult {
  baselineForecast: RevenueForecasts;
  scenarioForecast: RevenueForecasts;
  conversionImpact: ConversionForecast;
  analysis: {
    revenue7DayDelta: number; // $ change
    revenue30DayDelta: number;
    revenue90DayDelta: number;
    percentChange7Day: number;
    percentChange30Day: number;
    percentChange90Day: number;
    roi: number; // Estimated ROI %
    paybackPeriodDays: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; // Based on confidence intervals
    recommendation: string;
  };
  scenarios: {
    name: string;
    impact: ScenarioImpact;
  }[];
}

export interface ScenarioImpact {
  revenue7Day: number;
  revenue30Day: number;
  conversion7Day: number;
  confidence: number;
  riskScore: number;
}

// ────────────────────────────────────────────────────────────
// Scenario Planning Engine
// ────────────────────────────────────────────────────────────

export class ScenarioPlanner {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  /**
   * Main function: Run scenario analysis
   */
  async predictWithScenario(changes: ScenarioChange[]): Promise<ScenarioResult> {
    try {
      const startTime = Date.now();

      // 1. Get baseline forecast (no changes)
      const revenueForecast = new RevenueForecast(this.organizationId);
      const baselineRevenue = await revenueForecast.forecast(90);

      const conversionForecast = new ConversionRateForecaster(this.organizationId);
      const baselineConversion = await conversionForecast.forecast(90);

      // 2. Apply scenario changes
      const scenarioRevenue = this.applyScenarioChanges(baselineRevenue, changes);

      // 3. Calculate conversions with scenario
      const scenarioConversion = this.applyConversionChanges(baselineConversion, changes);

      // 4. Analyze impact
      const analysis = this.analyzeImpact(baselineRevenue, scenarioRevenue, changes);

      // 5. Generate individual scenario impacts
      const scenarios = this.generateIndividualScenarios(baselineRevenue, changes);

      logger.info(`Scenario analysis completed for ${this.organizationId}`, {
        changeCount: changes.length,
        revenueDelta7D: analysis.revenue7DayDelta,
        percentChange7D: analysis.percentChange7Day,
        executionMs: Date.now() - startTime,
      });

      return {
        baselineForecast: baselineRevenue,
        scenarioForecast: scenarioRevenue,
        conversionImpact: scenarioConversion,
        analysis,
        scenarios,
      };
    } catch (error) {
      logger.error('Scenario planning failed', {
        organizationId: this.organizationId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Apply scenario changes to revenue forecast
   */
  private applyScenarioChanges(baseline: RevenueForecasts, changes: ScenarioChange[]): RevenueForecasts {
    const modified = JSON.parse(JSON.stringify(baseline)) as RevenueForecasts;

    // Calculate total impact multiplier
    let impactMultiplier = 1.0;
    let smsLift = 0;
    let conversionLift = 0;

    changes.forEach((change) => {
      switch (change.type) {
        case 'sms_volume_increase':
          // 20% increase in SMS volume typically yields 8-12% revenue lift
          smsLift = change.value * 0.0004; // 0.04% per 1% increase
          impactMultiplier *= 1 + smsLift;
          break;

        case 'new_sequence':
          // New Day 0-3 sequence: 5-15% conversion lift
          conversionLift = change.value * 0.001; // 0.1% per 1% conversion increase
          impactMultiplier *= 1 + conversionLift;
          break;

        case 'partner_commission':
          // Higher commission attracts more partners
          // 1% commission increase → ~2% partner sales increase
          const partnerLift = (change.value / 100) * 0.02;
          impactMultiplier *= 1 + partnerLift;
          break;

        case 'marketing_channel':
          // New marketing channel: 5-25% revenue increase depending on investment
          const channelLift = change.value * 0.001;
          impactMultiplier *= 1 + channelLift;
          break;

        case 'pricing':
          // Price change impacts revenue directly
          // But typically reduces volume slightly
          const volumeReduction = change.value > 0 ? -0.02 : 0.01; // Higher price → less volume
          impactMultiplier *= 1 + change.value / 100 + volumeReduction;
          break;

        case 'conversion_lift':
          // Direct conversion increase
          conversionLift = change.value / 100;
          impactMultiplier *= 1 + conversionLift;
          break;

        case 'channel_shift':
          // Shifting spend between channels - neutral on total
          break;
      }
    });

    // Apply multiplier to forecasts
    modified.daily.forEach((forecast) => {
      forecast.revenue = Math.round(forecast.revenue * impactMultiplier);
      forecast.lower90 = Math.round(forecast.lower90 * impactMultiplier);
      forecast.upper90 = Math.round(forecast.upper90 * impactMultiplier);
      forecast.lower95 = Math.round(forecast.lower95 * impactMultiplier);
      forecast.upper95 = Math.round(forecast.upper95 * impactMultiplier);
    });

    modified.weekly.forEach((forecast) => {
      forecast.revenue = Math.round(forecast.revenue * impactMultiplier);
      forecast.lower90 = Math.round(forecast.lower90 * impactMultiplier);
      forecast.upper90 = Math.round(forecast.upper90 * impactMultiplier);
    });

    // Update summary
    modified.summary.total7Day = Math.round(modified.summary.total7Day * impactMultiplier);
    modified.summary.total30Day = Math.round(modified.summary.total30Day * impactMultiplier);
    modified.summary.total90Day = Math.round(modified.summary.total90Day * impactMultiplier);
    modified.summary.avg7Day = Math.round(modified.summary.avg7Day * impactMultiplier);
    modified.summary.avg30Day = Math.round(modified.summary.avg30Day * impactMultiplier);
    modified.summary.expectedGrowth = ((impactMultiplier - 1) * 100) / 7; // Annualize

    return modified;
  }

  /**
   * Apply changes to conversion forecast
   */
  private applyConversionChanges(
    baseline: ConversionForecast,
    changes: ScenarioChange[]
  ): ConversionForecast {
    const modified = JSON.parse(JSON.stringify(baseline)) as ConversionForecast;

    let conversionMultiplier = 1.0;

    changes.forEach((change) => {
      if (change.type === 'new_sequence') {
        // New sequence: 15-25% conversion lift
        conversionMultiplier *= 1 + change.value / 100;
      } else if (change.type === 'conversion_lift') {
        conversionMultiplier *= 1 + change.value / 100;
      }
    });

    // Apply to overall forecast
    modified.overall.forecast7Day *= conversionMultiplier;
    modified.overall.forecast30Day *= conversionMultiplier;

    // Apply to channels
    Object.keys(modified.byChannel).forEach((channel) => {
      modified.byChannel[channel as keyof typeof modified.byChannel].forecast7Day *= conversionMultiplier;
      modified.byChannel[channel as keyof typeof modified.byChannel].forecast30Day *= conversionMultiplier;
    });

    return modified;
  }

  /**
   * Analyze impact of scenario vs baseline
   */
  private analyzeImpact(
    baseline: RevenueForecasts,
    scenario: RevenueForecasts,
    changes: ScenarioChange[]
  ): ScenarioResult['analysis'] {
    const baselines = {
      total7: baseline.summary.total7Day,
      total30: baseline.summary.total30Day,
      total90: baseline.summary.total90Day,
    };

    const scenarios = {
      total7: scenario.summary.total7Day,
      total30: scenario.summary.total30Day,
      total90: scenario.summary.total90Day,
    };

    const revenue7DayDelta = scenarios.total7 - baselines.total7;
    const revenue30DayDelta = scenarios.total30 - baselines.total30;
    const revenue90DayDelta = scenarios.total90 - baselines.total90;

    const percentChange7Day = ((revenue7DayDelta / baselines.total7) * 100) || 0;
    const percentChange30Day = ((revenue30DayDelta / baselines.total30) * 100) || 0;
    const percentChange90Day = ((revenue90DayDelta / baselines.total90) * 100) || 0;

    // ROI calculation
    const implementationCost = this.estimateImplementationCost(changes);
    const annualizedBenefit = revenue90DayDelta * (365 / 90);
    const roi = (annualizedBenefit / Math.max(1, implementationCost)) * 100;

    // Payback period
    const dailyBenefit = revenue7DayDelta / 7;
    const paybackPeriodDays = Math.max(0, Math.ceil(implementationCost / Math.max(1, dailyBenefit)));

    // Risk assessment
    const confidenceAverage =
      (scenario.confidence.accuracy + scenario.metadata.seasonal_period) / 2;
    const riskLevel =
      confidenceAverage > 0.8 ? 'LOW' : confidenceAverage > 0.6 ? 'MEDIUM' : 'HIGH';

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      percentChange7Day,
      percentChange30Day,
      roi,
      paybackPeriodDays
    );

    return {
      revenue7DayDelta,
      revenue30DayDelta,
      revenue90DayDelta,
      percentChange7Day,
      percentChange30Day,
      percentChange90Day,
      roi,
      paybackPeriodDays,
      riskLevel,
      recommendation,
    };
  }

  /**
   * Estimate implementation cost
   */
  private estimateImplementationCost(changes: ScenarioChange[]): number {
    let cost = 0;

    changes.forEach((change) => {
      switch (change.type) {
        case 'sms_volume_increase':
          // SMS cost ~$0.01 per message
          cost += 100000 * 0.01; // Assume 100K messages
          break;
        case 'new_sequence':
          // Sequence setup cost: ~$5,000
          cost += 5000;
          break;
        case 'marketing_channel':
          // First month ad spend
          cost += change.value * 1000; // Assume $1K per 1% budget
          break;
        case 'partner_commission':
          // Higher commission = higher cost (estimated per partner)
          cost += 2000; // Setup cost
          break;
        default:
          break;
      }
    });

    return cost;
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(
    change7: number,
    change30: number,
    roi: number,
    payback: number
  ): string {
    if (roi < 0) {
      return `Scenario shows negative ROI (${roi.toFixed(0)}%). Not recommended.`;
    }

    if (payback > 90) {
      return `Scenario pays back in ${payback.toFixed(0)} days. Consider phased approach.`;
    }

    if (change30 > 20) {
      return `Strong revenue growth (+${change30.toFixed(1)}% in 30 days) with ${payback.toFixed(0)}-day payback. Recommended.`;
    }

    if (change30 > 5) {
      return `Moderate growth (+${change30.toFixed(1)}%) with ${payback.toFixed(0)}-day payback. Consider implementation.`;
    }

    return `Minimal impact (+${change30.toFixed(1)}%). Lower priority.`;
  }

  /**
   * Generate individual scenario impacts
   */
  private generateIndividualScenarios(
    baseline: RevenueForecasts,
    changes: ScenarioChange[]
  ): { name: string; impact: ScenarioImpact }[] {
    return changes.map((change) => {
      const singleChange = [change];
      const singleScenario = this.applyScenarioChanges(baseline, singleChange);

      const delta7 = singleScenario.summary.total7Day - baseline.summary.total7Day;
      const delta30 = singleScenario.summary.total30Day - baseline.summary.total30Day;

      return {
        name: change.description || change.type,
        impact: {
          revenue7Day: delta7,
          revenue30Day: delta30,
          conversion7Day: delta7 > 0 ? 0.5 : -0.5, // Placeholder
          confidence: 0.75,
          riskScore: change.value > 50 ? 0.8 : 0.3,
        },
      };
    });
  }
}

/**
 * Public API
 */
export async function predictWithScenario(
  organizationId: string,
  changes: ScenarioChange[]
): Promise<ScenarioResult> {
  const planner = new ScenarioPlanner(organizationId);
  return planner.predictWithScenario(changes);
}

/**
 * Convenience function for common scenarios
 */
export async function scenarioIncreaseSmS(
  organizationId: string,
  percentIncrease: number
): Promise<ScenarioResult> {
  return predictWithScenario(organizationId, [
    {
      type: 'sms_volume_increase',
      value: percentIncrease,
      description: `Increase SMS volume by ${percentIncrease}%`,
    },
  ]);
}

export async function scenarioNewSequence(
  organizationId: string,
  conversionLift: number
): Promise<ScenarioResult> {
  return predictWithScenario(organizationId, [
    {
      type: 'new_sequence',
      value: conversionLift,
      description: `Deploy new Day 0-3 sequence (+${conversionLift}% conversion)`,
    },
  ]);
}

export async function scenarioPartnerGrowth(
  organizationId: string,
  commissionIncrease: number
): Promise<ScenarioResult> {
  return predictWithScenario(organizationId, [
    {
      type: 'partner_commission',
      value: commissionIncrease,
      description: `Increase partner commission by ${commissionIncrease}%`,
    },
  ]);
}

export async function scenarioCombined(
  organizationId: string,
  changes: ScenarioChange[]
): Promise<ScenarioResult> {
  return predictWithScenario(organizationId, changes);
}
