/**
 * Win-Back Prediction Engine
 * Identifies inactive customers that can be reactivated
 * Features: Historical LTV, churn reason, time since last purchase, re-engagement receptiveness
 * Output: Reactivation probability + best offer type + expected revenue
 */

import { prisma } from '@/lib/prisma';
import { Contact } from '@prisma/client';

export interface WinBackSignal {
  historicalLtv: number; // $ - past customer value
  timeSinceLastPurchase: number; // days
  churnTimeWindow: boolean; // sweet spot: 30-90 days
  cruiseCount: number; // total historical purchases
  lastSatisfactionScore: number | null;
  previousEngagementLevel: string; // 'high', 'medium', 'low'
  reactivationSegment: string | null;
  inactivityPattern: string; // 'gradual', 'sudden', 'seasonal'
  seasonalRelevance: number; // 0-100: likelihood of seasonal reactivation
}

export interface WinBackOpportunity {
  contactId: string;
  reactivationProbability: number; // 0-100
  reactivationUrgency: number; // 0-100: how soon to reach out
  signals: WinBackSignal;
  winBackReason: string[];
  bestOffer: {
    type: 'DISCOUNT' | 'SPECIAL_GIFT' | 'EXCLUSIVE_ACCESS' | 'LOYALTY_RECOGNITION';
    incentiveValue: number; // $ or %
    reasoning: string[];
  };
  expectedReactivationValue: number; // $ revenue if successful
  expectedFirstPurchaseValue: number; // $ first purchase if reactivated
  optimalContactTime: Date; // When to send message
  contentTheme: 'NOSTALGIA' | 'APOLOGY' | 'EXCLUSIVE_OFFER' | 'SEASONAL' | 'LOYALTY';
}

export class WinBackPredictor {
  private readonly FEATURE_WEIGHTS = {
    historicalLtv: 0.25,
    cruiseCount: 0.20,
    timeWindow: 0.20,
    satisfaction: 0.15,
    seasonality: 0.20
  };

  /**
   * Extract win-back signals from contact data
   */
  private async extractSignals(contact: Contact): Promise<WinBackSignal> {
    const now = Date.now();
    const lastPurchaseTime = contact.lastPaymentAt ? new Date(contact.lastPaymentAt).getTime() : 0;
    const timeSinceLastPurchase = lastPurchaseTime ? Math.floor((now - lastPurchaseTime) / (1000 * 60 * 60 * 24)) : 999;

    // Determine if in sweet spot for reactivation (30-90 days = optimal)
    const churnTimeWindow = timeSinceLastPurchase >= 30 && timeSinceLastPurchase <= 180;

    // Inactivity pattern (simplified)
    let inactivityPattern: 'gradual' | 'sudden' | 'seasonal' = 'gradual';
    if (contact.cruiseCount >= 2 && timeSinceLastPurchase > 180) {
      inactivityPattern = 'sudden'; // Was active, now inactive
    }

    // Seasonal relevance: higher in certain months
    const month = new Date().getMonth();
    const seasonalRelevance = (month === 6 || month === 11 || month === 0) ? 80 : 40;

    return {
      historicalLtv: contact.ltvTotal,
      timeSinceLastPurchase,
      churnTimeWindow,
      cruiseCount: contact.cruiseCount,
      lastSatisfactionScore: contact.lastSatisfactionScore,
      previousEngagementLevel: this.estimateEngagementLevel(contact),
      reactivationSegment: contact.reactivationSegment,
      inactivityPattern,
      seasonalRelevance
    };
  }

  /**
   * Estimate previous engagement level
   */
  private estimateEngagementLevel(contact: Contact): string {
    if (contact.cruiseCount >= 5) return 'high';
    if (contact.cruiseCount >= 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate reactivation probability
   */
  private calculateReactivationProbability(signals: WinBackSignal): number {
    let probability = 40; // Base for inactive customers

    // High historical value = more likely to reactivate
    const ltvFactor = Math.min(100, (signals.historicalLtv / 5000) * 100);
    probability += ltvFactor * this.FEATURE_WEIGHTS.historicalLtv;

    // Multiple prior purchases = loyalty signal
    const cruisesFactor = Math.min(100, (signals.cruiseCount / 5) * 100);
    probability += cruisesFactor * this.FEATURE_WEIGHTS.cruiseCount;

    // Time window: sweet spot is 30-90 days
    const timeWindowFactor = signals.churnTimeWindow ? 30 : -10;
    probability += timeWindowFactor * this.FEATURE_WEIGHTS.timeWindow;

    // Satisfaction: high satisfaction = likely to reactivate
    const satisfactionFactor = signals.lastSatisfactionScore ? signals.lastSatisfactionScore * 5 : 30;
    probability += satisfactionFactor * this.FEATURE_WEIGHTS.satisfaction;

    // Seasonality: higher in peak seasons
    probability += signals.seasonalRelevance * this.FEATURE_WEIGHTS.seasonality * 0.3;

    return Math.max(0, Math.min(100, probability));
  }

  /**
   * Calculate reactivation urgency
   */
  private calculateReactivationUrgency(signals: WinBackSignal, probability: number): number {
    let urgency = 50;

    // High historical value = urgent
    if (signals.historicalLtv > 3000) urgency += 20;

    // In optimal reactivation window = urgent
    if (signals.churnTimeWindow) urgency += 30;

    // High historical engagement = urgent
    if (signals.previousEngagementLevel === 'high') urgency += 15;

    // Seasonal peak = urgent
    if (signals.seasonalRelevance > 70) urgency += 20;

    return Math.min(100, urgency);
  }

  /**
   * Identify win-back reasons
   */
  private identifyWinBackReasons(signals: WinBackSignal, probability: number): string[] {
    const reasons: string[] = [];

    if (signals.historicalLtv > 2000) {
      reasons.push(`High-value customer ($${signals.historicalLtv} lifetime)`);
    }

    if (signals.cruiseCount >= 3) {
      reasons.push(`Loyal customer (${signals.cruiseCount} prior cruises)`);
    }

    if (signals.lastSatisfactionScore && signals.lastSatisfactionScore >= 7) {
      reasons.push('Previously satisfied with experience');
    }

    if (signals.churnTimeWindow) {
      reasons.push('Optimal reactivation window (30-90 days inactive)');
    }

    if (signals.seasonalRelevance > 70) {
      reasons.push('Peak season - relevant offer timing');
    }

    if (signals.inactivityPattern === 'sudden') {
      reasons.push('Was active, now inactive - addressable gap');
    }

    return reasons.length > 0 ? reasons : ['Inactive customer with reactivation potential'];
  }

  /**
   * Recommend best win-back offer
   */
  private recommendOffer(signals: WinBackSignal): { type: 'DISCOUNT' | 'SPECIAL_GIFT' | 'EXCLUSIVE_ACCESS' | 'LOYALTY_RECOGNITION'; incentiveValue: number; reasoning: string[] } {
    const reasoning: string[] = [];

    // High satisfaction = loyalty-based offer
    if (signals.lastSatisfactionScore && signals.lastSatisfactionScore >= 8) {
      reasoning.push('Previous satisfaction warrants appreciation');
      return {
        type: 'LOYALTY_RECOGNITION',
        incentiveValue: 100, // $100 credit
        reasoning
      };
    }

    // Low satisfaction = apology discount
    if (signals.lastSatisfactionScore && signals.lastSatisfactionScore < 6) {
      reasoning.push('Address previous dissatisfaction');
      return {
        type: 'DISCOUNT',
        incentiveValue: 20, // 20% discount
        reasoning
      };
    }

    // High historical value = exclusive access
    if (signals.historicalLtv > 4000) {
      reasoning.push('Premium customer deserves exclusive treatment');
      return {
        type: 'EXCLUSIVE_ACCESS',
        incentiveValue: 250, // $250 onboard credit
        reasoning
      };
    }

    // Multiple purchases = loyalty offer
    if (signals.cruiseCount >= 3) {
      reasoning.push('Repeat customer - loyalty reward');
      return {
        type: 'DISCOUNT',
        incentiveValue: 15, // 15% discount
        reasoning
      };
    }

    // Default: moderate discount
    reasoning.push('Standard re-engagement offer');
    return {
      type: 'DISCOUNT',
      incentiveValue: 10, // 10% discount
      reasoning
    };
  }

  /**
   * Calculate expected reactivation value
   */
  private calculateExpectedValue(signals: WinBackSignal, probability: number): { reactivation: number; firstPurchase: number } {
    // Expected first purchase based on historical patterns
    const historicalAverage = signals.cruiseCount > 0 ? signals.historicalLtv / signals.cruiseCount : 2000;
    const firstPurchaseValue = historicalAverage * 0.85; // Usually slightly lower

    // Reactivation value: first purchase * estimated repeat rate
    const repeatProbability = Math.max(0.3, probability / 100);
    const reactivationValue = firstPurchaseValue * repeatProbability * (1 + (signals.cruiseCount / 10));

    return {
      reactivation: reactivationValue,
      firstPurchase: firstPurchaseValue
    };
  }

  /**
   * Determine optimal contact timing
   */
  private determineOptimalContactTime(signals: WinBackSignal): Date {
    const now = new Date();

    // Optimal windows:
    // 1. Peak seasons (summer, winter)
    // 2. 2-4 weeks after last notification would have landed
    // 3. Midweek, morning hours

    const month = now.getMonth();
    const optimalMonths = [0, 6, 11]; // Jan, Jul, Dec
    const daysUntilOptimalMonth = this.daysUntilMonth(optimalMonths);

    const contactTime = new Date(now);
    if (daysUntilOptimalMonth < 30) {
      // Schedule for optimal month
      const targetMonth = optimalMonths.find(m => m > month) || optimalMonths[0];
      contactTime.setMonth(targetMonth);
    } else {
      // Schedule for next week
      contactTime.setDate(contactTime.getDate() + 7);
    }

    // Set to 10 AM
    contactTime.setHours(10, 0, 0, 0);

    return contactTime;
  }

  /**
   * Helper: days until target month
   */
  private daysUntilMonth(targetMonths: number[]): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    let minDays = Infinity;

    for (const month of targetMonths) {
      let daysAhead = month - currentMonth;
      if (daysAhead < 0) daysAhead += 12;
      minDays = Math.min(minDays, daysAhead * 30);
    }

    return minDays;
  }

  /**
   * Determine content theme
   */
  private determineContentTheme(signals: WinBackSignal): 'NOSTALGIA' | 'APOLOGY' | 'EXCLUSIVE_OFFER' | 'SEASONAL' | 'LOYALTY' {
    if (signals.seasonalRelevance > 75) return 'SEASONAL';
    if (signals.lastSatisfactionScore && signals.lastSatisfactionScore < 6) return 'APOLOGY';
    if (signals.lastSatisfactionScore && signals.lastSatisfactionScore >= 8) return 'LOYALTY';
    if (signals.historicalLtv > 3000) return 'EXCLUSIVE_OFFER';
    return 'NOSTALGIA';
  }

  /**
   * Predict win-back opportunity for single contact
   */
  async predictWinBack(contact: Contact): Promise<WinBackOpportunity> {
    const signals = await this.extractSignals(contact);
    const reactivationProbability = this.calculateReactivationProbability(signals);
    const reactivationUrgency = this.calculateReactivationUrgency(signals, reactivationProbability);
    const offer = this.recommendOffer(signals);
    const values = this.calculateExpectedValue(signals, reactivationProbability);
    const contentTheme = this.determineContentTheme(signals);

    return {
      contactId: contact.id,
      reactivationProbability: Math.round(reactivationProbability),
      reactivationUrgency: Math.round(reactivationUrgency),
      signals,
      winBackReason: this.identifyWinBackReasons(signals, reactivationProbability),
      bestOffer: offer,
      expectedReactivationValue: Math.round(values.reactivation),
      expectedFirstPurchaseValue: Math.round(values.firstPurchase),
      optimalContactTime: this.determineOptimalContactTime(signals),
      contentTheme
    };
  }

  /**
   * Batch predict win-back opportunities
   */
  async predictWinBackBatch(organizationId: string, limit: number = 100): Promise<WinBackOpportunity[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        lastPaymentStatus: 'PAID', // Was a customer
        cruiseCount: { gte: 1 }, // Had at least one purchase
        lastPaymentAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Inactive 30+ days
        }
      },
      take: limit,
      orderBy: { ltvTotal: 'desc' }
    });

    const opportunities = await Promise.all(
      contacts.map(contact => this.predictWinBack(contact))
    );

    // Sort by reactivation probability (highest first)
    opportunities.sort((a, b) => b.reactivationProbability - a.reactivationProbability);

    return opportunities;
  }

  /**
   * Get high-value win-back candidates
   */
  async getHighPriorityWinBacks(organizationId: string): Promise<WinBackOpportunity[]> {
    const opportunities = await this.predictWinBackBatch(organizationId, 200);
    return opportunities
      .filter(o => o.reactivationProbability > 50 && o.signals.historicalLtv > 1000)
      .slice(0, 50);
  }
}
