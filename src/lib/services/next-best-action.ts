/**
 * Next-Best-Action (NBA) Engine
 * For each contact, recommends the best action based on predictions + history + business rules
 * Optimizes for revenue impact and customer experience
 */

import { prisma } from '@/lib/prisma';
import { Contact } from '@prisma/client';
import { ChurnPredictor } from '@/lib/ai/churn-predictor';
import { UpsellPredictor } from '@/lib/ai/upsell-predictor';
import { WinBackPredictor } from '@/lib/ai/winback-predictor';

export interface NextBestAction {
  contactId: string;
  recommendedAction: 'EMAIL' | 'SMS' | 'CALL' | 'OFFER' | 'PAUSE';
  actionType: string; // 'SAVE_VIP', 'UPSELL', 'WINBACK', 'NURTURE', 'NONE'
  priority: number; // 1-100: highest priority first
  expectedRevenue: number; // $ potential revenue from this action
  expectedConversionProbability: number; // 0-100%
  timing: {
    sendImmediately: boolean;
    sendAt: Date;
    optimalDayOfWeek: string;
    optimalTimeOfDay: string;
  };
  message: {
    channel: 'SMS' | 'EMAIL' | 'CALL' | 'IN_APP';
    preview: string;
    psychologyLens: string;
    personalizedElements: Record<string, string>;
  };
  reasoning: string[];
  ifConvertedExpectation: string;
  abTestVariant?: 'A' | 'B';
}

export class NextBestActionEngine {
  private churnPredictor = new ChurnPredictor();
  private upsellPredictor = new UpsellPredictor();
  private winBackPredictor = new WinBackPredictor();

  /**
   * Generate next best action for a single contact
   */
  async generateNBA(contact: Contact): Promise<NextBestAction | null> {
    // Get all predictions
    const churnPrediction = await this.churnPredictor.predictChurn(contact as any);
    const upsellOpportunity = await this.upsellPredictor.predictUpsell(contact);
    const winBackOpportunity = await this.winBackPredictor.predictWinBack(contact);

    // Score all opportunities
    const opportunities = [
      { type: 'CHURN', score: churnPrediction.churnProbability, prediction: churnPrediction },
      { type: 'UPSELL', score: upsellOpportunity.opportunityScore, prediction: upsellOpportunity },
      { type: 'WINBACK', score: winBackOpportunity.reactivationProbability, prediction: winBackOpportunity }
    ];

    // Filter by minimum score and exclusivity rules
    const viable = opportunities
      .filter(o => {
        if (o.type === 'CHURN') return o.score > 70; // Only urgent churn
        if (o.type === 'UPSELL') return o.score > 75; // Only ready customers
        if (o.type === 'WINBACK') return o.score > 55; // Moderate threshold
        return false;
      })
      .sort((a, b) => b.score - a.score);

    if (viable.length === 0) {
      return this.generateNurturingAction(contact);
    }

    // Select top opportunity
    const selected = viable[0];

    switch (selected.type) {
      case 'CHURN':
        return this.generateChurnSaveAction(contact, selected.prediction);
      case 'UPSELL':
        return this.generateUpsellAction(contact, selected.prediction);
      case 'WINBACK':
        return this.generateWinBackAction(contact, selected.prediction);
      default:
        return null;
    }
  }

  /**
   * Generate churn save action
   */
  private async generateChurnSaveAction(contact: Contact, prediction: any): Promise<NextBestAction> {
    const recommendedAction = prediction.recommendedAction;
    const channel = recommendedAction === 'IMMEDIATE_CALL' ? 'CALL' : 'SMS';

    const messages = {
      SMS: {
        A: `Hi ${contact.name}, we've valued having you with us. Is there anything we can improve? 💙`,
        B: `${contact.name}, we're offering exclusive VIP members like you a 20% welcome back bonus → [LINK]`
      },
      CALL: {
        A: `Personal outreach from our VIP team to address any concerns`,
        B: `Concierge call to personally discuss your preferences`
      }
    };

    const variant = Math.random() > 0.5 ? 'A' : 'B';
    const channel_key = (channel === 'CALL' ? 'CALL' : 'SMS') as 'SMS' | 'CALL';
    const message = messages[channel_key][variant as 'A' | 'B'];

    return {
      contactId: contact.id,
      recommendedAction: channel,
      actionType: 'SAVE_VIP',
      priority: Math.min(100, prediction.churnProbability + 20), // Higher for churn
      expectedRevenue: contact.ltvTotal * 0.5,
      expectedConversionProbability: 100 - prediction.churnProbability,
      timing: {
        sendImmediately: prediction.riskLevel === 'CRITICAL',
        sendAt: new Date(),
        optimalDayOfWeek: 'Tuesday',
        optimalTimeOfDay: '10:00 AM'
      },
      message: {
        channel: channel,
        preview: message,
        psychologyLens: 'L6 (Loss Aversion) - Fear of losing valuable customer',
        personalizedElements: {
          name: contact.name || 'Valued Customer',
          ltv: `$${contact.ltvTotal}`,
          cruiseCount: `${contact.cruiseCount}`,
          riskLevel: prediction.riskLevel
        }
      },
      reasoning: prediction.reasonsForChurn,
      ifConvertedExpectation: `Retain customer and generate $${Math.round(contact.ltvTotal * 0.5)} revenue`,
      abTestVariant: variant as 'A' | 'B'
    };
  }

  /**
   * Generate upsell action
   */
  private async generateUpsellAction(contact: Contact, opportunity: any): Promise<NextBestAction> {
    const messages = {
      A: `${contact.name}, based on your cruise history, you'd love ${opportunity.recommendedProduct.name}. See why →`,
      B: `Upgrade available: Your next cruise in ${opportunity.recommendedProduct.name} →`
    };

    const variant = Math.random() > 0.5 ? 'A' : 'B';

    return {
      contactId: contact.id,
      recommendedAction: 'EMAIL',
      actionType: 'UPSELL',
      priority: Math.min(100, opportunity.opportunityScore + 10),
      expectedRevenue: opportunity.recommendedProduct.expectedRevenue,
      expectedConversionProbability: opportunity.expectedConversionProbability,
      timing: {
        sendImmediately: opportunity.urgency === 'HIGH',
        sendAt: new Date(),
        optimalDayOfWeek: 'Thursday',
        optimalTimeOfDay: '2:00 PM'
      },
      message: {
        channel: 'EMAIL',
        preview: messages[variant as 'A' | 'B'],
        psychologyLens: 'L8 (Repurchase/Habit) - Encourage repeat with better product',
        personalizedElements: {
          name: contact.name || 'Valued Customer',
          productName: opportunity.recommendedProduct.name,
          currentSpend: `$${contact.ltvTotal}`,
          expectedValue: `$${opportunity.recommendedProduct.expectedRevenue}`
        }
      },
      reasoning: opportunity.recommendedProduct.reasoning,
      ifConvertedExpectation: `Generate $${opportunity.recommendedProduct.expectedRevenue} revenue + long-term LTV increase`,
      abTestVariant: variant as 'A' | 'B'
    };
  }

  /**
   * Generate win-back action
   */
  private async generateWinBackAction(contact: Contact, opportunity: any): Promise<NextBestAction> {
    const themeMessages = {
      NOSTALGIA: `${contact.name}, remember your amazing cruise? Your next adventure awaits →`,
      APOLOGY: `We'd love to win back your trust. Here's our apology offer →`,
      EXCLUSIVE_OFFER: `VIP invitation: ${contact.name}, exclusive comeback offer inside →`,
      SEASONAL: `Perfect timing! Seasonal special pricing on your favorite destination →`,
      LOYALTY: `Welcome back! As a loyal customer, enjoy this exclusive recognition →`
    };

    const variant = Math.random() > 0.5 ? 'A' : 'B';

    return {
      contactId: contact.id,
      recommendedAction: 'SMS',
      actionType: 'WINBACK',
      priority: Math.min(100, opportunity.reactivationUrgency + 15),
      expectedRevenue: opportunity.expectedReactivationValue,
      expectedConversionProbability: opportunity.reactivationProbability,
      timing: {
        sendImmediately: opportunity.reactivationUrgency > 80,
        sendAt: opportunity.optimalContactTime,
        optimalDayOfWeek: 'Tuesday',
        optimalTimeOfDay: '10:00 AM'
      },
      message: {
        channel: 'SMS',
        preview: themeMessages[opportunity.contentTheme],
        psychologyLens: 'L0 (Reactivation) - Emotional reconnection + timely offer',
        personalizedElements: {
          name: contact.name || 'Valued Customer',
          daysSinceInactive: `${opportunity.signals.timeSinceLastPurchase}`,
          historicalValue: `$${opportunity.signals.historicalLtv}`,
          offerIncentive: `${opportunity.bestOffer.incentiveValue}${opportunity.bestOffer.type === 'DISCOUNT' ? '%' : '$'}`
        }
      },
      reasoning: opportunity.winBackReason,
      ifConvertedExpectation: `Reactivate $${opportunity.signals.historicalLtv} customer + expected first purchase $${opportunity.expectedFirstPurchaseValue}`,
      abTestVariant: variant as 'A' | 'B'
    };
  }

  /**
   * Generate nurturing action for customers not in immediate opportunity
   */
  private async generateNurturingAction(contact: Contact): Promise<NextBestAction> {
    const messages = {
      A: `${contact.name}, explore what's new in our catalog →`,
      B: `Personalized recommendations for you →`
    };

    const variant = Math.random() > 0.5 ? 'A' : 'B';

    return {
      contactId: contact.id,
      recommendedAction: 'EMAIL',
      actionType: 'NURTURE',
      priority: 30,
      expectedRevenue: 500,
      expectedConversionProbability: 15,
      timing: {
        sendImmediately: false,
        sendAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        optimalDayOfWeek: 'Wednesday',
        optimalTimeOfDay: '10:00 AM'
      },
      message: {
        channel: 'EMAIL',
        preview: messages[variant as 'A' | 'B'],
        psychologyLens: 'L8 (Habit) - Maintain engagement',
        personalizedElements: {
          name: contact.name || 'Valued Customer'
        }
      },
      reasoning: ['No immediate opportunity detected', 'Maintain engagement through nurturing'],
      ifConvertedExpectation: 'Maintain engagement + future opportunity creation',
      abTestVariant: variant as 'A' | 'B'
    };
  }

  /**
   * Batch generate NBA for multiple contacts
   */
  async generateNBABatch(organizationId: string, limit: number = 100): Promise<NextBestAction[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null
      },
      take: limit,
      orderBy: { lastPaymentAt: 'desc' }
    });

    const nbas = await Promise.all(
      contacts
        .map(c => this.generateNBA(c))
        .filter((p): p is Promise<NextBestAction> => p !== null)
    );

    // Sort by priority (highest first)
    nbas.sort((a, b) => b.priority - a.priority);

    return nbas;
  }

  /**
   * Get high-priority action queue
   */
  async getActionQueue(organizationId: string, limit: number = 50): Promise<NextBestAction[]> {
    const nbas = await this.generateNBABatch(organizationId, 200);
    return nbas
      .filter(a => a.priority > 50)
      .slice(0, limit);
  }
}
