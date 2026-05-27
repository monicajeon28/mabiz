/**
 * Lens Detector Engine
 *
 * Automatically detects and classifies customers into Grant Cardone 10-lens framework:
 * - L0: Reactivation (부재중 고객)
 * - L1: Price objection (가격 민감도)
 * - L2: Preparation anxiety (준비 불안)
 * - L3: Differentiation (차별성 미인지)
 * - L4: Feature structure (피처 구조)
 * - L5: Self-projection (자기투영)
 * - L6: Timing/Loss aversion (타이밍/손실회피)
 * - L7: Companion persuasion (동반자 설득)
 * - L8: Repurchase habituation (재방문 습관화)
 * - L9: Medical/health trust (의료 신뢰)
 * - L10: Immediate purchase closing (즉시 구매 클로징)
 *
 * Detection methods:
 * 1. Rule-based: Contact field triggers (30-40 signals)
 * 2. Message analysis: SMS/email content keyword detection
 * 3. Behavioral: Purchase history, interaction patterns
 * 4. Temporal: Time-based signals (decision windows, seasonality)
 */

import { prisma } from "@/lib/prisma";
import { Contact } from "@prisma/client";

export interface LensDetectionResult {
  lensType: string;
  label: string;
  confidenceScore: number; // 0-100
  readinessScore: number; // 0-100
  detectionMethod: "rule" | "message" | "behavioral" | "temporal";
  signals: string[]; // Triggering signals
  recommendedAction: string;
  targetSegment: string;
}

/**
 * Main lens detection function
 * Returns all detected lenses ranked by confidence
 */
export async function detectCustomerLenses(
  contact: Contact,
  organizationId: string
): Promise<LensDetectionResult[]> {
  const results: LensDetectionResult[] = [];

  // Fetch supporting data in parallel
  const [memos, calls, messages] = await Promise.all([
    prisma.contactMemo.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.callLog.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.crmMarketingMessage.findMany({
      where: { contact_id: contact.id },
      orderBy: { created_at: "desc" },
      take: 20,
    }),
  ]);

  // L0: Reactivation - Inactive customers
  const l0 = detectL0Reactivation(contact);
  if (l0) results.push(l0);

  // L1: Price objection - Price sensitivity
  const l1 = detectL1PriceObjection(contact, memos);
  if (l1) results.push(l1);

  // L2: Preparation anxiety - Preparation complexity
  const l2 = detectL2PreparationAnxiety(contact);
  if (l2) results.push(l2);

  // L3: Differentiation - Competitor mention
  const l3 = detectL3Differentiation(contact, memos);
  if (l3) results.push(l3);

  // L5: Self-projection - Health/family concerns
  const l5 = detectL5SelfProjection(contact);
  if (l5) results.push(l5);

  // L6: Timing/Loss aversion - Decision window closing
  const l6 = detectL6TimingLossAversion(contact);
  if (l6) results.push(l6);

  // L7: Companion persuasion - Family influence
  const l7 = detectL7CompanionPersuasion(contact);
  if (l7) results.push(l7);

  // L8: Repurchase habituation - Repeat customer
  const l8 = detectL8Repurchase(contact);
  if (l8) results.push(l8);

  // L9: Medical/Health trust - Health concerns
  const l9 = detectL9HealthTrust(contact);
  if (l9) results.push(l9);

  // L10: Immediate purchase closing - Ready to close
  const l10 = detectL10ImmediatePurchase(contact, calls);
  if (l10) results.push(l10);

  // Sort by confidence score (descending)
  return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * L0: Reactivation - Inactive customers (3-6m, 6-12m, 1y+)
 */
function detectL0Reactivation(contact: Contact): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (!contact.lastContactedAt) {
    // Never contacted
    confidence = 40;
    signals.push("never_contacted");
  } else {
    const daysSinceContact = Math.floor(
      (Date.now() - contact.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceContact > 365) {
      confidence = 95;
      signals.push("inactive_1year_plus");
    } else if (daysSinceContact > 180) {
      confidence = 85;
      signals.push("inactive_6_12months");
    } else if (daysSinceContact > 90) {
      confidence = 70;
      signals.push("inactive_3_6months");
    } else if (daysSinceContact > 30) {
      confidence = 40;
      signals.push("inactive_1month");
    }
  }

  // Boost if previously purchased (shows prior interest)
  if (contact.purchasedAt) {
    confidence = Math.min(100, confidence + 15);
    signals.push("previous_purchaser");
  }

  // Boost if has cruise history
  if (contact.cruiseCount > 0) {
    confidence = Math.min(100, confidence + 10);
    signals.push("repeat_cruiser");
  }

  if (confidence < 40) return null;

  return {
    lensType: "L0",
    label: "Reactivation (부재중 고객)",
    confidenceScore: confidence,
    readinessScore: Math.min(70, confidence - 20),
    detectionMethod: "rule",
    signals,
    recommendedAction: "5-7회 재접촉 + Grant Cardone Follow-up 적용",
    targetSegment: "Inactive / Lapsed",
  };
}

/**
 * L1: Price objection - Price sensitivity signals
 */
function detectL1PriceObjection(contact: Contact, memos: any[]): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  // Tag-based detection
  if (contact.tags?.includes("price_sensitive")) {
    confidence = 80;
    signals.push("tagged_price_sensitive");
  }

  // Memo content analysis
  const priceKeywords = [
    "비싸",
    "가격",
    "비용",
    "할인",
    "저렴",
    "싼",
    "예산",
    "비용대비",
    "비교",
    "더 싼",
  ];

  const priceMemos = memos.filter((m) =>
    priceKeywords.some((kw) => m.content?.toLowerCase().includes(kw))
  );

  if (priceMemos.length > 2) {
    confidence = Math.min(100, confidence + 40);
    signals.push(`price_mentions_${priceMemos.length}_times`);
  }

  // Re-engagement count (many attempts needed = price resistance)
  if (contact.reEngageCount > 5) {
    confidence = Math.min(100, confidence + 20);
    signals.push("high_reengagement_attempts");
  }

  if (confidence < 40) return null;

  return {
    lensType: "L1",
    label: "Price Objection (가격 민감도)",
    confidenceScore: confidence,
    readinessScore: Math.max(20, confidence - 40),
    detectionMethod: "rule",
    signals,
    recommendedAction: "가치 재정의 + 3단계 가격 앵커링 + Payment Plan 제시",
    targetSegment: "Budget-conscious",
  };
}

/**
 * L2: Preparation anxiety - Preparation complexity signals
 */
function detectL2PreparationAnxiety(contact: Contact): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  // Anxiety assessment
  if (contact.anxietyScore && contact.anxietyScore > 60) {
    confidence = 85;
    signals.push(`anxiety_score_${contact.anxietyScore}`);

    if (contact.anxietyCategory) {
      signals.push(`anxiety_category_${contact.anxietyCategory}`);
    }
  }

  // Specific preparation concerns
  if (contact.visaRequired) {
    confidence = Math.min(100, confidence + 20);
    signals.push("visa_required");
  }

  if (contact.firstTimeCruise) {
    confidence = Math.min(100, confidence + 15);
    signals.push("first_time_cruiser");
  }

  if (contact.familyWithKids) {
    confidence = Math.min(100, confidence + 10);
    signals.push("family_with_kids");
  }

  if (contact.passportDaysLeft !== null && contact.passportDaysLeft < 180) {
    confidence = Math.min(100, confidence + 25);
    signals.push(`passport_expires_${contact.passportDaysLeft}_days`);
  }

  if (confidence < 40) return null;

  return {
    lensType: "L2",
    label: "Preparation Anxiety (준비 불안)",
    confidenceScore: confidence,
    readinessScore: Math.max(30, 100 - contact.anxietyScore!),
    detectionMethod: "rule",
    signals,
    recommendedAction: "5단계 중재 질문 + 단계별 체크리스트 제공 + 전문가 권위성 활용",
    targetSegment: "First-time / Complex cases",
  };
}

/**
 * L3: Differentiation - Competitor mention signals
 */
function detectL3Differentiation(contact: Contact, memos: any[]): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (contact.competitorMentioned) {
    confidence = 85;
    signals.push("competitor_mentioned_flag");

    if (contact.lastCompetitorName) {
      signals.push(`competitor_${contact.lastCompetitorName}`);
    }

    if (contact.competitorNames && contact.competitorNames.length > 0) {
      confidence = Math.min(100, confidence + 10);
      signals.push(`multiple_competitors_${contact.competitorNames.length}`);
    }
  }

  // Memo analysis for competitor mentions
  const competitorKeywords = contact.competitorNames || [
    "Royal",
    "MSC",
    "Disney",
    "Carnival",
    "Norwegian",
    "Celebrity",
  ];
  const competitorMemos = memos.filter((m) =>
    competitorKeywords.some((comp) =>
      m.content?.toLowerCase().includes(comp.toLowerCase())
    )
  );

  if (competitorMemos.length > 0) {
    confidence = Math.min(100, confidence + 20);
    signals.push(`competitor_mentions_${competitorMemos.length}_times`);
  }

  if (confidence < 40) return null;

  return {
    lensType: "L3",
    label: "Differentiation (차별성 미인지)",
    confidenceScore: confidence,
    readinessScore: 40, // Lower readiness if comparing
    detectionMethod: "message",
    signals,
    recommendedAction: "경쟁사 비교 문서 + 차별성 강조 SMS 3부 시리즈 + 전문가 의견",
    targetSegment: "Competitor evaluators",
  };
}

/**
 * L5: Self-projection - Health/family concerns
 */
function detectL5SelfProjection(contact: Contact): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (contact.selfProjectionScore && contact.selfProjectionScore > 60) {
    confidence = 80;
    signals.push(`self_projection_score_${contact.selfProjectionScore}`);
  }

  if (contact.personalHealthConcern) {
    confidence = Math.min(100, confidence + 30);
    signals.push(`personal_health_${contact.personalHealthConcern}`);
  }

  if (contact.spouseHealthConcern) {
    confidence = Math.min(100, confidence + 25);
    signals.push(`spouse_health_${contact.spouseHealthConcern}`);
  }

  if (contact.compoundHealthRisk) {
    confidence = Math.min(100, confidence + 20);
    signals.push("compound_health_risk");
  }

  if (contact.selfProjectionType) {
    signals.push(`projection_type_${contact.selfProjectionType}`);
  }

  if (confidence < 40) return null;

  return {
    lensType: "L5",
    label: "Self-projection (자기투영)",
    confidenceScore: confidence,
    readinessScore: 50,
    detectionMethod: "rule",
    signals,
    recommendedAction: "건강/의료 권위성 강조 + 가족 건강 사례 스토리 + 의료 전문가 추천",
    targetSegment: "Health-conscious families",
  };
}

/**
 * L6: Timing/Loss aversion - Decision window signals
 */
function detectL6TimingLossAversion(contact: Contact): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (contact.timingUrgencyScore && contact.timingUrgencyScore > 60) {
    confidence = 80;
    signals.push(`timing_urgency_${contact.timingUrgencyScore}`);
  }

  // Decision window expiration
  if (contact.decisionWindowExpiresAt) {
    const hoursUntilExpire =
      (contact.decisionWindowExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilExpire <= 0) {
      confidence = 95; // Missed window
      signals.push("decision_window_expired");
    } else if (hoursUntilExpire < 24) {
      confidence = 90; // Urgent
      signals.push(`decision_window_urgent_${Math.floor(hoursUntilExpire)}_hours`);
    } else if (hoursUntilExpire < 72) {
      confidence = 75;
      signals.push(`decision_window_soon_${Math.floor(hoursUntilExpire / 24)}_days`);
    }
  }

  // Price deadline
  if (contact.priceDeadlineDate) {
    const dayUntilDeadline = Math.floor(
      (contact.priceDeadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (dayUntilDeadline < 7 && dayUntilDeadline > 0) {
      confidence = Math.min(100, confidence + 25);
      signals.push(`price_deadline_${dayUntilDeadline}_days`);
    }
  }

  // Seat scarcity
  if (contact.seatAvailability !== null && contact.seatAvailability < 5) {
    confidence = Math.min(100, confidence + 20);
    signals.push(`low_seat_availability_${contact.seatAvailability}`);
  }

  if (confidence < 40) return null;

  return {
    lensType: "L6",
    label: "Timing/Loss Aversion (타이밍/손실회피)",
    confidenceScore: confidence,
    readinessScore: Math.min(100, confidence + 10),
    detectionMethod: "temporal",
    signals,
    recommendedAction: "CountdownTimer 컴포넌트 + 긴박감 SMS + 최종 결정 촉구",
    targetSegment: "Time-sensitive decisions",
  };
}

/**
 * L7: Companion persuasion - Family influence signals
 */
function detectL7CompanionPersuasion(contact: Contact): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (contact.familyInfluenceScore && contact.familyInfluenceScore > 60) {
    confidence = 80;
    signals.push(`family_influence_${contact.familyInfluenceScore}`);
  }

  if (contact.familyComposition) {
    confidence = Math.min(100, confidence + 20);
    signals.push(`family_composition_${contact.familyComposition}`);
  }

  if (contact.decisionMaker && contact.decisionMaker !== "self") {
    confidence = Math.min(100, confidence + 25);
    signals.push(`decision_maker_${contact.decisionMaker}`);
  }

  // Spouse engagement signals
  if (contact.spouseName) {
    signals.push("spouse_identified");
    if (contact.spousePhone) {
      confidence = Math.min(100, confidence + 15);
      signals.push("spouse_contact_available");
    }
    if (contact.spouseEngagement && contact.spouseEngagement !== "not_contacted") {
      confidence = Math.min(100, confidence + 10);
      signals.push(`spouse_engagement_${contact.spouseEngagement}`);
    }
  }

  if (contact.familyObjections && contact.familyObjections.length > 0) {
    confidence = Math.min(100, confidence + 20);
    signals.push(`family_objections_${contact.familyObjections.length}`);
  }

  if (confidence < 40) return null;

  return {
    lensType: "L7",
    label: "Companion Persuasion (동반자 설득)",
    confidenceScore: confidence,
    readinessScore: Math.max(30, 100 - contact.familyInfluenceScore!),
    detectionMethod: "rule",
    signals,
    recommendedAction: "배우자/가족 다이렉트 SMS + 가족 혜택 강조 + 동반자 설득 스크립트",
    targetSegment: "Family decision-makers",
  };
}

/**
 * L8: Repurchase habituation - Repeat customer signals
 */
function detectL8Repurchase(contact: Contact): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (contact.cruiseCount > 0) {
    confidence = 70 + Math.min(20, contact.cruiseCount * 10); // Up to 90
    signals.push(`repeat_cruiser_${contact.cruiseCount}_times`);

    if (contact.cruiseClubTier) {
      confidence = Math.min(100, confidence + 15);
      signals.push(`cruise_tier_${contact.cruiseClubTier}`);
    }
  }

  if (contact.ltvTotal && contact.ltvTotal > 0) {
    confidence = Math.min(100, confidence + 20);
    signals.push(`ltv_${Math.floor(contact.ltvTotal)}`);
  }

  if (contact.lastCruiseEndDate) {
    const daysSinceLastCruise = Math.floor(
      (Date.now() - contact.lastCruiseEndDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastCruise < 365) {
      confidence = Math.min(100, confidence + 25);
      signals.push(`recent_cruise_${daysSinceLastCruise}_days_ago`);
    }
  }

  if (contact.cruiseReturnInterestLevel && contact.cruiseReturnInterestLevel > 60) {
    confidence = Math.min(100, confidence + 15);
    signals.push(`return_interest_${contact.cruiseReturnInterestLevel}`);
  }

  if (confidence < 40) return null;

  return {
    lensType: "L8",
    label: "Repurchase Habituation (재방문 습관화)",
    confidenceScore: confidence,
    readinessScore: Math.min(100, confidence + 15),
    detectionMethod: "behavioral",
    signals,
    recommendedAction: "VIP 대우 + 특별 할인 + 재구매 추천 상품 + LTV 기반 보상",
    targetSegment: "Loyal repeat customers",
  };
}

/**
 * L9: Medical/Health trust - Health concern signals
 */
function detectL9HealthTrust(contact: Contact): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (contact.healthConcerns) {
    confidence = 80;
    const concerns = contact.healthConcerns.split(",").map((c) => c.trim());
    signals.push(`health_concerns_${concerns.length}`);
    concerns.forEach((c) => signals.push(`concern_${c}`));
  }

  if (contact.vipStatus) {
    confidence = Math.min(100, confidence + 15);
    signals.push(`vip_status_${contact.vipStatus}`);
  }

  if (contact.age && contact.age > 65) {
    confidence = Math.min(100, confidence + 20);
    signals.push(`senior_age_${contact.age}`);
  }

  if (confidence < 40) return null;

  return {
    lensType: "L9",
    label: "Medical/Health Trust (의료 신뢰)",
    confidenceScore: confidence,
    readinessScore: Math.max(40, confidence - 20),
    detectionMethod: "rule",
    signals,
    recommendedAction: "의료 전문가 추천 + 배멀미/건강 관리 가이드 + 의료 증명",
    targetSegment: "Health-conscious seniors",
  };
}

/**
 * L10: Immediate purchase closing - Ready to buy signals
 */
function detectL10ImmediatePurchase(contact: Contact, calls: any[]): LensDetectionResult | null {
  const signals: string[] = [];
  let confidence = 0;

  if (contact.closingStage === "ready_close" || contact.closingStage === "qualified") {
    confidence = 85;
    signals.push(`closing_stage_${contact.closingStage}`);
  }

  if (contact.l10ClosingScore && contact.l10ClosingScore > 70) {
    confidence = 80;
    signals.push(`l10_closing_score_${contact.l10ClosingScore}`);
  }

  if (contact.emotionalConnectionScore && contact.emotionalConnectionScore > 60) {
    confidence = Math.min(100, confidence + 20);
    signals.push(`emotional_connection_${contact.emotionalConnectionScore}`);
  }

  if (contact.urgencyLevel && contact.urgencyLevel > 70) {
    confidence = Math.min(100, confidence + 25);
    signals.push(`urgency_level_${contact.urgencyLevel}`);
  }

  if (contact.emotionalTriggers && contact.emotionalTriggers.length > 0) {
    confidence = Math.min(100, confidence + 15);
    signals.push(`emotional_triggers_${contact.emotionalTriggers.length}`);
  }

  // Call quality signals
  const recentCalls = calls.filter(
    (c) => Date.now() - c.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000
  );
  if (recentCalls.some((c) => c.convictionScore && c.convictionScore > 75)) {
    confidence = Math.min(100, confidence + 20);
    signals.push("high_conviction_calls_recent");
  }

  if (contact.tripleChoiceOffered) {
    confidence = Math.min(100, confidence + 15);
    signals.push("triple_choice_offered");

    if (contact.tripleChoiceSelectedAt) {
      confidence = 95;
      signals.push("triple_choice_selected");
    }
  }

  if (confidence < 50) return null;

  return {
    lensType: "L10",
    label: "Immediate Purchase Closing (즉시 구매 클로징)",
    confidenceScore: confidence,
    readinessScore: Math.min(100, confidence + 10),
    detectionMethod: "behavioral",
    signals,
    recommendedAction: "Triple Choice CTA + 감정적 마무리 + 즉시 결정 촉구 + 클로징 스크립트",
    targetSegment: "Ready to close",
  };
}
