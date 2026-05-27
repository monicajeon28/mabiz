/**
 * Contact Enrichment Utilities for GraphQL
 * Provides lens detection, risk scoring, and psychological profiling
 *
 * Used by GraphQL resolvers to enrich contact data with:
 * - Lens detection (Grant Cardone 10 lenses)
 * - Risk scoring (0-100 based on multiple signals)
 * - Segment classification (automatic assignment)
 * - Churn prediction
 */

// ═════════════════════════════════════════════════════════════
// LENS DETECTION
// ═════════════════════════════════════════════════════════════

export interface LensProfile {
  lens: string;
  confidence: number; // 0-100
  signals: string[];
  recommendedMessage: string;
  expectedConversionRate: number;
}

/**
 * Detect contact's psychological lens based on behavior signals
 *
 * Returns one of Grant Cardone's 10 lenses:
 * - L0: Inactive/Reactivation needed
 * - L1: Price sensitive
 * - L2: Anxious about preparation
 * - L3: Aware of competitors
 * - L4: Feature-focused
 * - L5: Health/suitability concerns
 * - L6: Time-sensitive with loss aversion
 * - L7: Family/companion influenced
 * - L8: Habitual repurchaser
 * - L9: Trust-based buyer
 * - L10: Immediate/urgent buyer
 */
export function detectContactLens(contact: any): LensProfile {
  const signals: string[] = [];
  const scores: Record<string, number> = {
    L0: 0,
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
    L5: 0,
    L6: 0,
    L7: 0,
    L8: 0,
    L9: 0,
    L10: 0,
  };

  // ─────────────── L0: Reactivation ───────────────
  // Signal: No contact in 6+ months
  const lastContactedAt = contact.lastContactedAt
    ? new Date(contact.lastContactedAt).getTime()
    : 0;
  const daysSinceContact =
    (Date.now() - lastContactedAt) / (24 * 60 * 60 * 1000);

  if (daysSinceContact > 180) {
    scores.L0 += 40;
    signals.push("No contact in 6+ months");
  }
  if (contact.optOutAt) {
    scores.L0 += 30;
    signals.push("Opted out");
  }

  // ─────────────── L1: Price Objection ───────────────
  // Signal: Budget range is low, previous price objection
  if (contact.budgetRange && contact.budgetRange.includes("LOW")) {
    scores.L1 += 35;
    signals.push("Low budget range");
  }
  if (contact.lastPaymentStatus === "DECLINED_PRICE") {
    scores.L1 += 40;
    signals.push("Previous price objection");
  }

  // ─────────────── L2: Preparation Anxiety ───────────────
  // Signal: Long time between inquiry and booking
  const createdAt = new Date(contact.createdAt).getTime();
  const departureDate = contact.departureDate
    ? new Date(contact.departureDate).getTime()
    : 0;
  const daysBetweenInquiryAndDeparture =
    (departureDate - createdAt) / (24 * 60 * 60 * 1000);

  if (
    daysBetweenInquiryAndDeparture > 0 &&
    daysBetweenInquiryAndDeparture < 14
  ) {
    scores.L2 += 40;
    signals.push("Short time to departure - possible anxiety");
  }
  if (!contact.purchasedAt && daysSinceContact > 30) {
    scores.L2 += 25;
    signals.push("No purchase despite multiple contacts");
  }

  // ─────────────── L3: Differentiation ───────────────
  // Signal: Multiple products mentioned, competitor awareness
  if (contact.cruiseInterest) {
    const interests = contact.cruiseInterest.split(",").length;
    if (interests > 1) {
      scores.L3 += 30;
      signals.push("Multiple product interests");
    }
  }

  // ─────────────── L4: Feature-Focused ───────────────
  // Signal: Detailed product questions, specific requirements
  if (contact.adminMemo && contact.adminMemo.length > 200) {
    scores.L4 += 25;
    signals.push("Detailed inquiry history");
  }

  // ─────────────── L5: Health/Suitability ───────────────
  // Signal: Age >60, health-related concerns in memo
  if (contact.adminMemo) {
    const healthKeywords = [
      "health",
      "medical",
      "condition",
      "medication",
      "allergy",
      "elderly",
    ];
    if (
      healthKeywords.some((kw) =>
        contact.adminMemo.toLowerCase().includes(kw)
      )
    ) {
      scores.L5 += 45;
      signals.push("Health/suitability concerns mentioned");
    }
  }

  // ─────────────── L6: Timing & Loss Aversion ───────────────
  // Signal: Departure soon, previous payment success
  if (departureDate && daysBetweenInquiryAndDeparture < 30) {
    scores.L6 += 45;
    signals.push("Departure within 30 days");
  }
  if (
    contact.lastPaymentStatus === "SUCCESS" &&
    contact.lastPaymentAt
  ) {
    scores.L6 += 25;
    signals.push("Previous successful purchase");
  }

  // ─────────────── L7: Companion Persuasion ───────────────
  // Signal: Group booking, family references
  if (contact.adminMemo) {
    const familyKeywords = [
      "spouse",
      "family",
      "kids",
      "children",
      "husband",
      "wife",
      "partner",
      "group",
    ];
    if (
      familyKeywords.some((kw) =>
        contact.adminMemo.toLowerCase().includes(kw)
      )
    ) {
      scores.L7 += 40;
      signals.push("Family/group context detected");
    }
  }

  // ─────────────── L8: Repurchase/Habitual ───────────────
  // Signal: Multiple purchases, repeat customer
  if (contact.purchasedAt && contact.lastPaymentAt) {
    const purchasedDate = new Date(contact.purchasedAt).getTime();
    const lastPaymentDate = new Date(contact.lastPaymentAt).getTime();
    if (lastPaymentDate > purchasedDate) {
      scores.L8 += 40;
      signals.push("Repeat customer");
    }
  }
  if (contact.leadScore >= 70) {
    scores.L8 += 20;
    signals.push("High lead score indicates engagement");
  }

  // ─────────────── L9: Health/Safety Trust ───────────────
  // Signal: Age >65, explicit trust concerns
  if (contact.adminMemo) {
    const trustKeywords = [
      "trust",
      "safe",
      "security",
      "insurance",
      "guarantee",
      "certified",
    ];
    if (
      trustKeywords.some((kw) =>
        contact.adminMemo.toLowerCase().includes(kw)
      )
    ) {
      scores.L9 += 40;
      signals.push("Trust/safety concerns mentioned");
    }
  }

  // ─────────────── L10: Immediate/Urgent Buying ───────────────
  // Signal: High lead score, multiple contacts, time-sensitive
  if (contact.leadScore >= 80) {
    scores.L10 += 35;
    signals.push("Very high engagement level");
  }
  if (daysSinceContact < 2) {
    scores.L10 += 30;
    signals.push("Recent contact activity");
  }
  if (contact.lastContactedAt) {
    const hoursSinceContact = daysSinceContact * 24;
    if (hoursSinceContact < 24) {
      scores.L10 += 35;
      signals.push("Contacted within 24 hours");
    }
  }

  // ─────────────── Find dominant lens ───────────────
  let dominantLens = "L0";
  let maxScore = 0;

  for (const [lens, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominantLens = lens;
    }
  }

  // If no clear signals, default based on behavior
  if (maxScore === 0) {
    if (daysSinceContact > 90) {
      dominantLens = "L0";
      maxScore = 30;
      signals.push("No strong signals - treating as reactivation opportunity");
    } else {
      dominantLens = "L4";
      maxScore = 20;
      signals.push("No strong signals - treating as feature-focused");
    }
  }

  return {
    lens: dominantLens,
    confidence: Math.min(100, Math.max(0, maxScore)),
    signals,
    recommendedMessage: getRecommendedMessage(dominantLens),
    expectedConversionRate: getExpectedConversionRate(dominantLens),
  };
}

// ═════════════════════════════════════════════════════════════
// RISK SCORING
// ═════════════════════════════════════════════════════════════

export interface RiskProfile {
  score: number; // 0-100
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
  recommendation: string;
}

export interface RiskFactor {
  name: string;
  score: number; // Contribution to risk score
  description: string;
}

/**
 * Calculate contact's risk score (0-100)
 * Higher = more at risk of churn or non-conversion
 *
 * Factors:
 * - Inactivity (days since last contact)
 * - Lead score decay
 * - Failed payments
 * - Opt-out behavior
 * - Segment-specific risks
 */
export function calculateContactRiskScore(contact: any): RiskProfile {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // ─────────────── Inactivity Risk ───────────────
  const lastContactedAt = contact.lastContactedAt
    ? new Date(contact.lastContactedAt).getTime()
    : 0;
  const daysSinceContact =
    (Date.now() - lastContactedAt) / (24 * 60 * 60 * 1000);

  let inactivityScore = 0;
  if (daysSinceContact > 180) {
    inactivityScore = 40;
    factors.push({
      name: "Critical Inactivity",
      score: inactivityScore,
      description: `No contact in ${Math.floor(daysSinceContact)} days`,
    });
  } else if (daysSinceContact > 90) {
    inactivityScore = 25;
    factors.push({
      name: "Inactivity",
      score: inactivityScore,
      description: `No contact in ${Math.floor(daysSinceContact)} days`,
    });
  } else if (daysSinceContact > 30) {
    inactivityScore = 10;
    factors.push({
      name: "Low Recency",
      score: inactivityScore,
      description: `Last contact ${Math.floor(daysSinceContact)} days ago`,
    });
  }

  totalScore += inactivityScore;

  // ─────────────── Lead Score Decay ───────────────
  if (contact.leadScore < 30) {
    const leadScoreFactor = Math.max(0, 30 - contact.leadScore);
    totalScore += Math.min(25, leadScoreFactor);
    factors.push({
      name: "Low Lead Score",
      score: Math.min(25, leadScoreFactor),
      description: `Lead score only ${contact.leadScore}`,
    });
  }

  // ─────────────── Failed Payments ───────────────
  if (contact.lastPaymentStatus === "FAILED") {
    totalScore += 30;
    factors.push({
      name: "Payment Failure",
      score: 30,
      description: "Last payment failed - possible churn risk",
    });
  } else if (contact.lastPaymentStatus === "DECLINED_PRICE") {
    totalScore += 20;
    factors.push({
      name: "Price Objection",
      score: 20,
      description: "Declined due to price - affordability concerns",
    });
  }

  // ─────────────── Refund History ───────────────
  if (contact.lastRefundedAt) {
    const dayssinceRefund =
      (Date.now() - new Date(contact.lastRefundedAt).getTime()) /
      (24 * 60 * 60 * 1000);
    if (dayssinceRefund < 30) {
      totalScore += 25;
      factors.push({
        name: "Recent Refund",
        score: 25,
        description: `Refunded ${Math.floor(dayssinceRefund)} days ago`,
      });
    }
  }

  // ─────────────── Opted Out ───────────────
  if (contact.optOutAt) {
    totalScore += 50;
    factors.push({
      name: "Opted Out",
      score: 50,
      description: "Contact opted out of communications",
    });
  }

  // ─────────────── No Purchase Yet ───────────────
  const createdAt = new Date(contact.createdAt).getTime();
  const daysSinceInquiry = (Date.now() - createdAt) / (24 * 60 * 60 * 1000);

  if (!contact.purchasedAt && daysSinceInquiry > 60) {
    totalScore += 20;
    factors.push({
      name: "No Purchase",
      score: 20,
      description: `No purchase after ${Math.floor(daysSinceInquiry)} days`,
    });
  }

  // ─────────────── Departure Date Passed ───────────────
  if (contact.departureDate) {
    const departureDate = new Date(contact.departureDate).getTime();
    if (departureDate < Date.now()) {
      totalScore += 30;
      factors.push({
        name: "Missed Departure",
        score: 30,
        description: "Departure date has passed",
      });
    }
  }

  // ─────────────── Determine Risk Level ───────────────
  const finalScore = Math.min(100, Math.max(0, totalScore));
  let level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  if (finalScore >= 80) {
    level = "CRITICAL";
  } else if (finalScore >= 60) {
    level = "HIGH";
  } else if (finalScore >= 40) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  // ─────────────── Recommendation ───────────────
  let recommendation = "";

  if (level === "CRITICAL") {
    recommendation =
      "Immediate intervention required. High churn risk. Assign to senior account manager.";
  } else if (level === "HIGH") {
    recommendation =
      "Schedule urgent follow-up. Offer incentive or payment plan.";
  } else if (level === "MEDIUM") {
    recommendation =
      "Monitor closely. Send nurture campaign targeting identified pain points.";
  } else {
    recommendation = "Low risk. Standard follow-up and nurturing.";
  }

  return {
    score: finalScore,
    level,
    factors: factors.sort((a, b) => b.score - a.score),
    recommendation,
  };
}

// ═════────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════

/**
 * Get recommended message based on lens type
 */
function getRecommendedMessage(lens: string): string {
  const messages: Record<string, string> = {
    L0: "We miss you! Come back with 20% off your next cruise.",
    L1: "Budget-friendly options available starting at $999.",
    L2: "Everything is handled for you. Relax and let us prepare the details.",
    L3: "Compare us to the competition. Our exclusive perks set us apart.",
    L4: "Flexible cabin options, premium amenities, and world-class service.",
    L5: "Medical assistance available 24/7. Your health is our priority.",
    L6: "Limited time: Book now and save $500 for departures this summer!",
    L7: "Create unforgettable memories with your family.",
    L8: "Welcome back! VIP loyalty rewards for our best customers.",
    L9: "Trusted by 500K+ travelers. Certified safe and secure.",
    L10: "Book today and get priority cabin selection!",
  };

  return messages[lens] || "Let us help you plan your perfect getaway.";
}

/**
 * Get expected conversion rate for lens type
 */
function getExpectedConversionRate(lens: string): number {
  const rates: Record<string, number> = {
    L0: 0.15, // 15% - reactivation is harder
    L1: 0.22, // 22% - price-sensitive but interested
    L2: 0.28, // 28% - anxious but close to converting
    L3: 0.25, // 25% - comparing options
    L4: 0.3, // 30% - engaged, feature-focused
    L5: 0.35, // 35% - trust is key, will convert
    L6: 0.45, // 45% - time-sensitive, high intent
    L7: 0.32, // 32% - family decision, moderate conversion
    L8: 0.65, // 65% - repeat customers convert easily
    L9: 0.5, // 50% - trust-based, reliable buyers
    L10: 0.8, // 80% - ready to buy!
  };

  return rates[lens] || 0.25;
}

/**
 * Segment classification based on lens and risk
 */
export function classifySegment(lens: string, riskLevel: string): string {
  if (riskLevel === "CRITICAL") {
    return "AT_RISK_CRITICAL";
  }

  return lens;
}
