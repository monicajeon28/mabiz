/**
 * Upsell Prediction Engine
 * Identifies customers ready for higher tier or additional product purchases
 * Signals: Recent high-frequency purchases, engagement, segment alignment, complementary purchases
 * Output: Upsell opportunity score + recommended product + expected revenue
 */

import { prisma } from '@/lib/prisma';
import { Contact } from '@prisma/client';

export interface UpsellSignal {
  purchaseFrequency: number; // purchases per quarter
  purchaseTrend: number; // -100 to +100: declining vs accelerating
  engagementScore: number; // 0-100
  lastPurchaseRecency: number; // days ago
  totalSpend: number; // $
  customerSegment: string;
  complementaryProductInterest: string[]; // products customer has shown interest in
  vipStatus: string | null;
  timeAsCustomer: number; // days
}

export interface UpsellOpportunity {
  contactId: string;
  opportunityScore: number; // 0-100
  readinessLevel: 'NOT_READY' | 'READY' | 'HIGHLY_READY';
  signals: UpsellSignal;
  recommendedProduct: {
    name: string;
    currentPrice: number;
    discountedPrice?: number;
    expectedRevenue: number;
    reasoning: string[];
  };
  expectedConversionProbability: number; // 0-100
  suggestedOfferType: 'UPGRADE' | 'CROSS_SELL' | 'BUNDLE' | 'LOYALTY_REWARD';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class UpsellPredictor {
  private readonly FEATURE_WEIGHTS = {
    purchaseFrequency: 0.25,
    purchaseTrend: 0.20,
    engagement: 0.20,
    recency: 0.15,
    totalSpend: 0.20
  };

  private readonly PRODUCT_TIERS = [
    { name: 'Standard Cabin', minSpend: 0, maxSpend: 2000, nextTier: 'Balcony Cabin', revenue: 1000 },
    { name: 'Balcony Cabin', minSpend: 2000, maxSpend: 5000, nextTier: 'Suite', revenue: 2000 },
    { name: 'Suite', minSpend: 5000, maxSpend: 50000, nextTier: 'Penthouse', revenue: 5000 },
    { name: 'Penthouse', minSpend: 50000, maxSpend: Infinity, nextTier: 'Exclusive Experience', revenue: 10000 }
  ];

  /**
   * Extract upsell signals from contact data
   */
  private async extractSignals(contact: Contact): Promise<UpsellSignal> {
    // Calculate purchase frequency (purchases in last 90 days)
    const last90DaysStart = new Date();
    last90DaysStart.setDate(last90DaysStart.getDate() - 90);

    const recentPayments = await prisma.contact.count({
      where: {
        id: contact.id,
        lastPaymentDate: {
          gte: last90DaysStart
        }
      }
    });

    const purchaseFrequency = recentPayments / 0.25; // Annualize

    // Purchase trend: compare recent purchases vs historical
    const purchaseTrend = contact.cruiseCount > 2 ? 20 : -10; // Growing customer vs occasional

    // Engagement score
    const engagementScore = Math.min(100, Math.max(0, contact.lensMetadata?.['engagementScore'] || 50));

    // Recency
    const lastPurchaseRecency = contact.lastPaymentDate
      ? Math.floor((Date.now() - new Date(contact.lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Total spend
    const totalSpend = contact.ltvTotal || 0;

    // Time as customer
    const timeAsCustomer = Math.floor((Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Complementary products (based on segment and interests)
    const complementaryProducts = this.getComplementaryProducts(contact);

    return {
      purchaseFrequency,
      purchaseTrend,
      engagementScore,
      lastPurchaseRecency,
      totalSpend,
      customerSegment: contact.autoSegment || 'unclassified',
      complementaryProductInterest: complementaryProducts,
      vipStatus: contact.vipStatus,
      timeAsCustomer
    };
  }

  /**
   * Get complementary products based on segment
   */
  private getComplementaryProducts(contact: Contact): string[] {
    const products: string[] = [];

    if (contact.autoSegment === 'engaged' || contact.autoSegment === 'potential') {
      products.push('Travel Insurance', 'Shore Excursions', 'Beverage Package');
    }

    if (contact.familyWithKids) {
      products.push('Kids Club Package', 'Family Suite Upgrade');
    }

    if (contact.vipStatus === 'GOLD') {
      products.push('Exclusive Dining', 'Priority Onboarding');
    }

    if (contact.cruiseCount >= 3) {
      products.push('Loyalty Program Diamond Tier', 'Concierge Service');
    }

    return products;
  }

  /**
   * Calculate upsell opportunity score
   */
  private calculateOpportunityScore(signals: UpsellSignal): number {
    let score = 50; // Start at neutral

    // Recent purchases = readiness
    const recencyFactor = Math.max(0, 100 - (signals.lastPurchaseRecency / 180) * 100);
    score += recencyFactor * this.FEATURE_WEIGHTS.recency;

    // High purchase frequency = capacity and willingness
    const frequencyFactor = Math.min(100, signals.purchaseFrequency * 20);
    score += frequencyFactor * this.FEATURE_WEIGHTS.purchaseFrequency;

    // Positive trend = momentum
    const trendFactor = Math.max(0, signals.purchaseTrend + 50);
    score += trendFactor * this.FEATURE_WEIGHTS.purchaseTrend;

    // High engagement = responsiveness
    score += signals.engagementScore * this.FEATURE_WEIGHTS.engagement;

    // Total spend = customer value
    const spendFactor = Math.min(100, (signals.totalSpend / 5000) * 100);
    score += spendFactor * this.FEATURE_WEIGHTS.totalSpend;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get recommended product tier upgrade
   */
  private getRecommendedProduct(signals: UpsellSignal): { name: string; currentPrice: number; expectedRevenue: number; reasoning: string[] } {
    const currentTier = this.PRODUCT_TIERS.find(
      t => signals.totalSpend >= t.minSpend && signals.totalSpend <= t.maxSpend
    ) || this.PRODUCT_TIERS[0];

    const nextTierIndex = this.PRODUCT_TIERS.indexOf(currentTier) + 1;
    const nextTier = nextTierIndex < this.PRODUCT_TIERS.length ? this.PRODUCT_TIERS[nextTierIndex] : this.PRODUCT_TIERS[this.PRODUCT_TIERS.length - 1];

    const reasoning: string[] = [];

    if (signals.purchaseTrend > 10) {
      reasoning.push('Strong purchase momentum detected');
    }

    if (signals.engagementScore > 75) {
      reasoning.push('Highly engaged customer');
    }

    if (signals.complementaryProductInterest.length > 0) {
      reasoning.push(`Interest in ${signals.complementaryProductInterest[0]}`);
    }

    if (signals.vipStatus === 'GOLD') {
      reasoning.push('VIP customer - premium tier eligible');
    }

    return {
      name: nextTier.name,
      currentPrice: currentTier.revenue,
      expectedRevenue: nextTier.revenue,
      reasoning: reasoning.length > 0 ? reasoning : ['Established customer ready for upgrade']
    };
  }

  /**
   * Calculate expected conversion probability
   */
  private calculateConversionProbability(score: number, signals: UpsellSignal): number {
    let probability = score * 0.8; // Base probability from opportunity score

    // Adjust for recent activity
    if (signals.lastPurchaseRecency < 30) probability += 15;
    if (signals.lastPurchaseRecency > 120) probability = Math.max(0, probability - 20);

    // Adjust for high value
    if (signals.totalSpend > 5000) probability += 10;

    // Adjust for engagement
    if (signals.engagementScore > 80) probability += 5;

    return Math.min(100, probability);
  }

  /**
   * Recommend offer type based on signals
   */
  private recommendOfferType(signals: UpsellSignal, conversionProb: number): 'UPGRADE' | 'CROSS_SELL' | 'BUNDLE' | 'LOYALTY_REWARD' {
    if (signals.vipStatus === 'GOLD' && signals.purchaseFrequency > 2) {
      return 'LOYALTY_REWARD';
    }

    if (signals.complementaryProductInterest.length > 0) {
      return 'CROSS_SELL';
    }

    if (signals.totalSpend > 3000 && signals.purchaseTrend > 0) {
      return 'BUNDLE';
    }

    return 'UPGRADE';
  }

  /**
   * Determine urgency
   */
  private determineUrgency(score: number, recency: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score > 80 && recency < 30) return 'HIGH';
    if (score > 60 && recency < 60) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Predict upsell opportunity for single contact
   */
  async predictUpsell(contact: Contact): Promise<UpsellOpportunity> {
    const signals = await this.extractSignals(contact);
    const score = this.calculateOpportunityScore(signals);
    const readinessLevel = score > 75 ? 'HIGHLY_READY' : score > 50 ? 'READY' : 'NOT_READY';
    const recommendedProduct = this.getRecommendedProduct(signals);
    const conversionProbability = this.calculateConversionProbability(score, signals);
    const urgency = this.determineUrgency(score, signals.lastPurchaseRecency);

    return {
      contactId: contact.id,
      opportunityScore: Math.round(score),
      readinessLevel,
      signals,
      recommendedProduct,
      expectedConversionProbability: Math.round(conversionProbability),
      suggestedOfferType: this.recommendOfferType(signals, conversionProbability),
      urgency
    };
  }

  /**
   * Batch predict upsell opportunities
   */
  async predictUpsellBatch(organizationId: string, limit: number = 100): Promise<UpsellOpportunity[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        lastPaymentStatus: 'PAID',
        cruiseCount: { gte: 1 } // Has purchased at least once
      },
      take: limit,
      orderBy: { ltvTotal: 'desc' }
    });

    const opportunities = await Promise.all(
      contacts.map(contact => this.predictUpsell(contact))
    );

    // Sort by opportunity score (highest first)
    opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

    return opportunities.filter(o => o.readinessLevel !== 'NOT_READY');
  }

  /**
   * Get high-value upsell targets
   */
  async getHighPriorityUpsells(organizationId: string): Promise<UpsellOpportunity[]> {
    const opportunities = await this.predictUpsellBatch(organizationId, 300);
    return opportunities
      .filter(o => o.opportunityScore > 70 && o.expectedConversionProbability > 60)
      .slice(0, 50);
  }
}
