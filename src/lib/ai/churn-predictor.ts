/**
 * Churn Prediction Engine
 * Predicts which customers will churn in next 30 days based on behavioral signals
 * Features: Purchase recency, frequency trends, segment, engagement, support tickets
 * Output: Churn probability (0-100%) + confidence score
 */

import { prisma } from '@/lib/prisma';
import { Contact, CallLog, ScheduledSms } from '@prisma/client';

export interface ChurnSignal {
  daysSinceLastPurchase: number;
  purchaseFrequencyTrend: number; // -100 to +100: declining vs accelerating
  customerSegment: string;
  engagementScore: number; // 0-100: based on email opens, SMS clicks
  supportTicketCount: number;
  recentNegativeFeedback: boolean;
  cruiseCount: number;
  ltvTotal: number;
  lastSatisfactionScore: number | null;
  timeInCustomerBase: number; // days
}

export interface ChurnPrediction {
  contactId: string;
  churnProbability: number; // 0-100
  confidence: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: ChurnSignal;
  reasonsForChurn: string[];
  recommendedAction: 'MONITOR' | 'PROACTIVE_EMAIL' | 'SPECIAL_OFFER' | 'IMMEDIATE_CALL';
  estimatedChurnDate: Date;
}

export class ChurnPredictor {
  private readonly FEATURE_WEIGHTS = {
    daysSinceLastPurchase: 0.25,
    frequencyTrend: 0.20,
    engagement: 0.20,
    supportTickets: 0.15,
    segment: 0.10,
    ltv: 0.10
  };

  /**
   * Extract churn signals from contact data
   */
  private async extractSignals(
    contact: Contact & {
      callLogs?: CallLog[];
      scheduledSmsList?: ScheduledSms[];
    }
  ): Promise<ChurnSignal> {
    // Days since last purchase
    const daysSinceLastPurchase = contact.lastPaymentAt
      ? Math.floor((Date.now() - new Date(contact.lastPaymentAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999; // If no purchase, very high

    // Purchase frequency trend (simplified: compare recent vs historical)
    // In real implementation, would analyze last 3 vs last 6 months
    const purchaseFrequencyTrend = contact.cruiseCount > 0 ? -10 : -50; // Declining trend signal

    // Engagement score: based on calls, SMS interactions (simplified)
    const callCount = contact.callLogs?.length ?? 0;
    const engagementScore = Math.min(100, Math.max(0, 50 + (callCount * 5)));

    // Support ticket count (would need separate table in real implementation)
    const supportTicketCount = 0; // Placeholder

    // Negative feedback signal
    const recentNegativeFeedback = contact.lastSatisfactionScore ? contact.lastSatisfactionScore < 6 : false;

    // Time in customer base
    const timeInCustomerBase = Math.floor((Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    return {
      daysSinceLastPurchase,
      purchaseFrequencyTrend,
      customerSegment: contact.autoSegment || 'unclassified',
      engagementScore,
      supportTicketCount,
      recentNegativeFeedback,
      cruiseCount: contact.cruiseCount,
      ltvTotal: contact.ltvTotal,
      lastSatisfactionScore: contact.lastSatisfactionScore,
      timeInCustomerBase
    };
  }

  /**
   * Calculate churn probability using weighted signals
   */
  private calculateChurnProbability(signals: ChurnSignal): number {
    let probability = 50; // Start at neutral

    // Days since last purchase: high decay = high churn risk
    const recencyFactor = Math.min(100, (signals.daysSinceLastPurchase / 365) * 100);
    probability += recencyFactor * this.FEATURE_WEIGHTS.daysSinceLastPurchase;

    // Purchase frequency: declining trend = churn risk
    const frequencyFactor = Math.max(0, -signals.purchaseFrequencyTrend); // Convert to positive scale
    probability += frequencyFactor * this.FEATURE_WEIGHTS.frequencyTrend;

    // Engagement: low engagement = churn risk
    const engagementFactor = 100 - signals.engagementScore; // Inverse
    probability += engagementFactor * this.FEATURE_WEIGHTS.engagement;

    // Support tickets: high tickets = churn risk
    const supportFactor = Math.min(100, signals.supportTicketCount * 20);
    probability += supportFactor * this.FEATURE_WEIGHTS.supportTickets;

    // LTV: high LTV customers churn less (but if they do, it's significant)
    const ltvFactor = signals.ltvTotal > 5000 ? -20 : 10; // Reduce risk for high-value customers
    probability += ltvFactor * this.FEATURE_WEIGHTS.ltv;

    // Segment-based risk
    const segmentRiskMap: Record<string, number> = {
      'inactive': 80,
      'at-risk': 60,
      'at-risk-low-engagement': 70,
      'potential': 30,
      'engaged': 20,
      'unclassified': 50
    };
    const segmentRisk = segmentRiskMap[signals.customerSegment] || 50;
    probability += (segmentRisk - 50) * this.FEATURE_WEIGHTS.segment;

    // Clamp probability to 0-100 range
    return Math.max(0, Math.min(100, probability));
  }

  /**
   * Identify reasons for predicted churn
   */
  private identifyChurnReasons(signals: ChurnSignal, probability: number): string[] {
    const reasons: string[] = [];

    if (signals.daysSinceLastPurchase > 180) {
      reasons.push(`No purchase in ${signals.daysSinceLastPurchase} days`);
    }

    if (signals.purchaseFrequencyTrend < -30) {
      reasons.push('Purchase frequency declining');
    }

    if (signals.engagementScore < 30) {
      reasons.push('Low engagement with messages');
    }

    if (signals.supportTicketCount > 2) {
      reasons.push(`Multiple support issues (${signals.supportTicketCount})`);
    }

    if (signals.recentNegativeFeedback) {
      reasons.push('Recent negative satisfaction feedback');
    }

    if (probability > 70) {
      reasons.push('Multiple risk factors detected');
    }

    return reasons.length > 0 ? reasons : ['General inactivity'];
  }

  /**
   * Recommend action based on churn probability
   */
  private recommendAction(probability: number, ltvTotal: number): 'MONITOR' | 'PROACTIVE_EMAIL' | 'SPECIAL_OFFER' | 'IMMEDIATE_CALL' {
    if (probability < 50) {
      return 'MONITOR';
    }

    if (probability < 70) {
      return 'PROACTIVE_EMAIL'; // Re-engagement campaign
    }

    if (ltvTotal > 3000 || probability < 85) {
      return 'SPECIAL_OFFER'; // Offer discount/incentive
    }

    return 'IMMEDIATE_CALL'; // High-value at-risk customer needs personal touch
  }

  /**
   * Predict churn for a single contact
   */
  async predictChurn(contact: Contact & { callLogs?: CallLog[] }): Promise<ChurnPrediction> {
    const signals = await this.extractSignals(contact);
    const probability = this.calculateChurnProbability(signals);
    const confidence = Math.min(100, Math.max(50, 100 - Math.abs(probability - 50))); // Higher confidence near extremes

    const riskLevel =
      probability > 75 ? 'CRITICAL' :
      probability > 65 ? 'HIGH' :
      probability > 50 ? 'MEDIUM' :
      'LOW';

    const estimatedChurnDate = new Date();
    estimatedChurnDate.setDate(estimatedChurnDate.getDate() + 30); // 30-day window

    return {
      contactId: contact.id,
      churnProbability: Math.round(probability),
      confidence: Math.round(confidence),
      riskLevel,
      signals,
      reasonsForChurn: this.identifyChurnReasons(signals, probability),
      recommendedAction: this.recommendAction(probability, contact.ltvTotal),
      estimatedChurnDate
    };
  }

  /**
   * Batch predict churn for multiple contacts
   */
  async predictChurnBatch(organizationId: string, limit: number = 100): Promise<ChurnPrediction[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        lastPaymentStatus: { in: ['PAID', 'PAID_PARTIAL'] } // Only past customers
      },
      include: {
        callLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      },
      take: limit,
      orderBy: { lastPaymentAt: 'desc' }
    });

    const predictions = await Promise.all(
      contacts.map(contact => this.predictChurn(contact))
    );

    // Sort by risk level (CRITICAL first)
    const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    predictions.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    return predictions;
  }

  /**
   * Get high-risk contacts for intervention
   */
  async getChurnRiskContacts(organizationId: string): Promise<ChurnPrediction[]> {
    const predictions = await this.predictChurnBatch(organizationId, 500);
    return predictions.filter(p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH');
  }
}
