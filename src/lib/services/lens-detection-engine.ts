/**
 * 렌즈 감지 엔진 (L0-L10) - Grant Cardone 심리학 자동 분류
 * @date 2026-05-27
 */

import { PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";
import { LensType, LensDetectionResult, LensScore, ContactLensData } from "@/lib/types/lens";

export class LensDetectionEngine {
  private readonly prisma: PrismaClient;
  private readonly redis?: Redis | null;
  private readonly CACHE_TTL = 86400;
  private readonly CACHE_KEY_PREFIX = "lens:";

  constructor(prisma: PrismaClient, redis?: Redis | null) {
    this.prisma = prisma;
    this.redis = redis;
  }

  async detectLens(contactId: string, organizationId: string, force: boolean = false): Promise<LensDetectionResult> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}${organizationId}:${contactId}`;
      if (!force && this.redis) {
        const cached = await this.getCachedResult(cacheKey);
        if (cached) {
          logger.debug(`[LensDetection] Cache hit: ${contactId}`);
          return cached;
        }
      }

      const contact = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true, organizationId: true, createdAt: true, updatedAt: true, lastContactedAt: true,
          purchasedAt: true, lastCruiseDate: true, cruiseCount: true, vipStatus: true, tags: true,
          lensMetadata: true, anxietyScore: true, preparationStage: true, healthConcerns: true,
          competitorMentioned: true, competitorNames: true, selfProjectionScore: true,
          selfProjectionType: true, familyComposition: true, decisionMaker: true, ltvTotal: true,
          cruiseReturnInterestLevel: true, timingUrgencyScore: true, l10ClosingScore: true,
        },
      });

      if (!contact) throw new Error(`Contact not found: ${contactId}`);

      const lensData = this.contactToLensData(contact);
      const allScores = {
        L0: this.detectL0Reactivation(lensData),
        L1: this.detectL1PriceObjection(lensData),
        L2: this.detectL2PreparationAnxiety(lensData),
        L3: this.detectL3Differentiation(lensData),
        L4: this.detectL4Segment(lensData),
        L5: this.detectL5SelfProjection(lensData),
        L6: this.detectL6Timing(lensData),
        L7: this.detectL7Companion(lensData),
        L8: this.detectL8Repurchase(lensData),
        L9: this.detectL9HealthTrust(lensData),
        L10: this.detectL10ImmediatePurchase(lensData),
      };

      let primaryLens: LensType = "L0";
      let maxScore = 0;
      for (const [lens, lensScore] of Object.entries(allScores)) {
        if (lensScore.score > maxScore) {
          maxScore = lensScore.score;
          primaryLens = lens as LensType;
        }
      }

      const result: LensDetectionResult = {
        primaryLens,
        confidenceScore: Math.min(100, maxScore),
        allScores: Object.entries(allScores).reduce((acc, [lens, score]) => {
          acc[lens as LensType] = score.score;
          return acc;
        }, {} as Record<LensType, number>),
        detectedSignals: Object.entries(allScores).reduce((acc, [lens, score]) => {
          acc[lens as LensType] = score.signals;
          return acc;
        }, {} as Record<LensType, string[]>),
        metadata: {
          identificationMethod: "automated_rules_based",
          dataPoints: this.countDataPoints(lensData),
          lastUpdated: new Date(),
        },
      };

      if (this.redis) {
        await this.cacheResult(cacheKey, result);
      }

      logger.info(`[LensDetection] Detected ${primaryLens} for ${contactId} (confidence: ${result.confidenceScore})`);
      return result;
    } catch (error) {
      logger.error(`[LensDetection] Error: ${error}`);
      throw error;
    }
  }

  async saveClassification(contactId: string, organizationId: string, result: LensDetectionResult) {
    try {
      const label = this.getLensLabel(result.primaryLens);
      await this.prisma.contactLensClassification.upsert({
        where: { organizationId_contactId_lensType: { organizationId, contactId, lensType: result.primaryLens } },
        create: {
          organizationId, contactId, lensType: result.primaryLens, lensLabel: label,
          confidenceScore: result.confidenceScore, identificationMethod: "automated_rules_based",
          tags: Object.entries(result.detectedSignals).flatMap(([_, signals]) => signals).slice(0, 50),
          status: "ACTIVE",
        },
        update: {
          lensLabel: label, confidenceScore: result.confidenceScore, lastUpdated: new Date(),
          tags: Object.entries(result.detectedSignals).flatMap(([_, signals]) => signals).slice(0, 50),
        },
      });
      logger.info(`[LensDetection] Saved ${result.primaryLens} for ${contactId}`);
    } catch (error) {
      logger.error(`[LensDetection] Save error: ${error}`);
      throw error;
    }
  }

  private detectL0Reactivation(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    const daysSinceLastContact = data.lastContactedAt ? this.daysSince(data.lastContactedAt) : this.daysSince(data.createdAt);
    if (daysSinceLastContact > 365) { score += 15; signals.push("inactive_1y_plus"); }
    else if (daysSinceLastContact > 180) { score += 10; signals.push("inactive_6_12m"); }
    else if (daysSinceLastContact > 90) { score += 5; signals.push("inactive_3_6m"); }
    if (data.purchasedAt) {
      const daysSincePurchase = this.daysSince(data.purchasedAt);
      if (daysSincePurchase > 365) { score += 8; signals.push("last_purchase_1y_ago"); }
      else if (daysSincePurchase > 180) { score += 4; signals.push("last_purchase_6m_ago"); }
    }
    if (data.cruiseCount > 0) { score += 3; signals.push(`cruise_${data.cruiseCount}trips`); }
    if (data.vipStatus) { score += 5; signals.push(`vip_${data.vipStatus}`); }
    return { score, signals, threshold: 5 };
  }

  private detectL1PriceObjection(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    const priceKeywords = ["비싸", "비용", "가격", "cheap", "expensive", "cost", "discount", "할인"];
    const priceTags = data.tags.filter(tag => priceKeywords.some(kw => tag.toLowerCase().includes(kw)));
    if (priceTags.length > 0) { score += 10; signals.push("price_tags"); }
    if ((data.lensMetadata?.decisionLevel || 0) <= 1) { score += 5; signals.push("low_decision"); }
    return { score, signals, threshold: 5 };
  }

  private detectL2PreparationAnxiety(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    if (data.anxietyScore >= 50) { score += 10; signals.push("high_anxiety"); }
    else if (data.anxietyScore >= 25) { score += 5; signals.push("medium_anxiety"); }
    const stages = ["inquiry", "visa_concern", "health_concern", "passport_concern"];
    if (data.preparationStage && stages.includes(data.preparationStage)) { score += 5; signals.push(`stage_${data.preparationStage}`); }
    if (data.healthConcerns) { score += 5; signals.push("health_concern"); }
    return { score, signals, threshold: 5 };
  }

  private detectL3Differentiation(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    if (data.competitorMentioned) { score += 15; signals.push("competitor_mention"); }
    if (data.competitorNames?.length > 0) { score += 10; signals.push("competitor_names"); }
    if ((data.lensMetadata?.decisionLevel || 0) < 3) { score += 5; signals.push("low_differentiation"); }
    return { score, signals, threshold: 5 };
  }

  private detectL4Segment(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    if (data.lensMetadata?.segment && data.lensMetadata.segment !== "unclassified") { score += 5; signals.push("segment_classified"); }
    if ((data.lensMetadata?.childrenCount || 0) > 0) { score += 3; signals.push("has_children"); }
    const age = data.lensMetadata?.age;
    if (age && age >= 55) { score += 3; signals.push("age_55plus"); }
    else if (age && age >= 35 && age < 55) { score += 2; signals.push("age_35_54"); }
    return { score, signals, threshold: 5 };
  }

  private detectL5SelfProjection(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    if (data.selfProjectionScore >= 50) { score += 10; signals.push("high_projection"); }
    else if (data.selfProjectionScore >= 25) { score += 5; signals.push("medium_projection"); }
    if (data.selfProjectionType) { score += 3; signals.push("projection_type"); if (data.selfProjectionType.includes("health")) { score += 5; signals.push("health_projection"); } }
    return { score, signals, threshold: 5 };
  }

  private detectL6Timing(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    if (data.lastContactedAt) {
      const daysSince = this.daysSince(data.lastContactedAt);
      if (daysSince <= 7) { score += 10; signals.push("very_recent"); }
      else if (daysSince <= 30) { score += 5; signals.push("recent"); }
    }
    const decisionLevel = data.lensMetadata?.decisionLevel || 0;
    if (decisionLevel >= 7) { score += 10; signals.push("high_decision"); }
    else if (decisionLevel >= 4) { score += 5; signals.push("medium_decision"); }
    const timeTags = data.tags.filter(tag => ["urgent", "time", "limited", "soon"].some(kw => tag.includes(kw)));
    if (timeTags.length > 0) { score += 5; signals.push("time_sensitive"); }
    return { score, signals, threshold: 5 };
  }

  private detectL7Companion(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    const familyComps = ["spouse", "parents", "friends", "mixed"];
    if (data.familyComposition && familyComps.includes(data.familyComposition)) { score += 10; signals.push("family_member"); }
    const decisionMakers = ["spouse", "parent", "friend"];
    if (data.decisionMaker && decisionMakers.includes(data.decisionMaker)) { score += 10; signals.push("needs_persuasion"); }
    if ((data.lensMetadata?.childrenCount || 0) > 0) { score += 5; signals.push("has_children"); }
    return { score, signals, threshold: 5 };
  }

  private detectL8Repurchase(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    if (data.cruiseCount >= 2) { score += 10; signals.push("repeat_cruiser"); }
    if (data.ltvTotal > 0) { score += 5; signals.push("positive_ltv"); }
    if (data.cruiseReturnInterestLevel >= 70) { score += 10; signals.push("high_return_intent"); }
    else if (data.cruiseReturnInterestLevel >= 40) { score += 5; signals.push("medium_return_intent"); }
    return { score, signals, threshold: 5 };
  }

  private detectL9HealthTrust(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    if (data.healthConcerns) {
      if (["배멀미", "당뇨", "고혈압"].some(kw => data.healthConcerns!.includes(kw))) { score += 10; signals.push("critical_health"); }
      else { score += 5; signals.push("health_concern"); }
    }
    if (data.selfProjectionType?.includes("health")) { score += 10; signals.push("health_projection"); }
    return { score, signals, threshold: 5 };
  }

  private detectL10ImmediatePurchase(data: ContactLensData): LensScore {
    const signals: string[] = [];
    let score = 0;
    const decisionLevel = data.lensMetadata?.decisionLevel || 0;
    if (decisionLevel >= 8) { score += 15; signals.push("very_high_decision"); }
    else if (decisionLevel >= 6) { score += 10; signals.push("high_decision"); }
    if (data.lastContactedAt && this.daysSince(data.lastContactedAt) <= 3) { score += 10; signals.push("ultra_recent"); }
    if ((data.lensMetadata?.readinessScore || 0) >= 70) { score += 10; signals.push("high_readiness"); }
    return { score, signals, threshold: 5 };
  }

  private contactToLensData(contact: any): ContactLensData {
    return {
      id: contact.id, organizationId: contact.organizationId, createdAt: contact.createdAt,
      updatedAt: contact.updatedAt, lastContactedAt: contact.lastContactedAt, purchasedAt: contact.purchasedAt,
      lastCruiseDate: contact.lastCruiseDate, cruiseCount: contact.cruiseCount || 0, vipStatus: contact.vipStatus,
      tags: contact.tags || [], lensMetadata: contact.lensMetadata || {}, anxietyScore: contact.anxietyScore || 0,
      preparationStage: contact.preparationStage, healthConcerns: contact.healthConcerns,
      competitorMentioned: contact.competitorMentioned || false, competitorNames: contact.competitorNames || [],
      selfProjectionScore: contact.selfProjectionScore || 0, selfProjectionType: contact.selfProjectionType,
      familyComposition: contact.familyComposition, decisionMaker: contact.decisionMaker, ltvTotal: contact.ltvTotal || 0,
      cruiseReturnInterestLevel: contact.cruiseReturnInterestLevel || 0, timingUrgencyScore: contact.timingUrgencyScore || 0,
      l10ClosingScore: contact.l10ClosingScore || 0,
    };
  }

  private daysSince(date: Date | null): number {
    if (!date) return 999999;
    return Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private countDataPoints(data: ContactLensData): number {
    let count = 0;
    if (data.lastContactedAt) count++;
    if (data.purchasedAt) count++;
    if (data.lastCruiseDate) count++;
    if (data.cruiseCount > 0) count++;
    if (data.competitorMentioned) count++;
    if (data.anxietyScore > 0) count++;
    if (data.healthConcerns) count++;
    if (data.selfProjectionScore > 0) count++;
    if (data.familyComposition) count++;
    if (data.ltvTotal > 0) count++;
    if (data.tags?.length > 0) count++;
    if (data.lensMetadata && Object.keys(data.lensMetadata).length > 0) count++;
    return count;
  }

  private getLensLabel(lens: LensType): string {
    const labels: Record<LensType, string> = {
      L0: "부재중 재활성화", L1: "가격이의", L2: "준비복잡", L3: "경쟁사언급", L4: "세그먼트",
      L5: "자기투영", L6: "타이밍/손실회피", L7: "동반자설득", L8: "재구매/습관화", L9: "건강신뢰", L10: "즉시구매",
    };
    return labels[lens];
  }

  private async getCachedResult(key: string): Promise<LensDetectionResult | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached as string) : null;
    } catch (error) {
      logger.warn(`[LensDetection] Cache read error: ${error}`);
      return null;
    }
  }

  private async cacheResult(key: string, result: LensDetectionResult): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      logger.warn(`[LensDetection] Cache write error: ${error}`);
    }
  }
}
