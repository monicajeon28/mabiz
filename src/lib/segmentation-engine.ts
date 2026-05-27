import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface Segment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  contactCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentCriteria {
  field: string; // "lens", "revenue", "inactivity", "segment", "tag", "age"
  operator: "=" | "!=" | ">" | "<" | "includes" | "excludes";
  value: any;
  weight?: number; // For scoring-based segmentation
}

/**
 * Pre-built segments for common marketing scenarios
 */
export const BUILT_IN_SEGMENTS = {
  // Psychology lens-based segments
  L0_INACTIVE: {
    name: "L0 부재중 고객 (3-6개월)",
    criteria: [
      { field: "lens", operator: "includes", value: "L0" },
      { field: "inactivity", operator: ">", value: 90 },
    ],
  },

  L6_TIME_SENSITIVE: {
    name: "L6 타이밍 중요 고객",
    criteria: [
      { field: "lens", operator: "includes", value: "L6" },
      { field: "tag", operator: "excludes", value: "PURCHASED" },
    ],
  },

  L10_READY_TO_BUY: {
    name: "L10 구매 준비 완료 고객",
    criteria: [
      { field: "lens", operator: "includes", value: "L10" },
      { field: "tag", operator: "excludes", value: "OBJECTION" },
    ],
  },

  // Revenue-based segments
  HIGH_VALUE: {
    name: "고가치 고객 (월 500만원+)",
    criteria: [{ field: "revenue", operator: ">", value: 5000000 }],
  },

  MEDIUM_VALUE: {
    name: "중간 가치 고객 (월 100-500만원)",
    criteria: [
      { field: "revenue", operator: ">", value: 1000000 },
      { field: "revenue", operator: "<", value: 5000000 },
    ],
  },

  LOW_VALUE: {
    name: "저가치 고객 (월 100만원 이하)",
    criteria: [{ field: "revenue", operator: "<", value: 1000000 }],
  },

  // Engagement segments
  HIGHLY_ENGAGED: {
    name: "높은 참여도 고객",
    criteria: [
      { field: "callCount", operator: ">", value: 10 },
      { field: "memoCount", operator: ">", value: 5 },
      { field: "inactivity", operator: "<", value: 7 },
    ],
  },

  AT_RISK: {
    name: "유실 위험 고객 (60일+ 미연락)",
    criteria: [{ field: "inactivity", operator: ">", value: 60 }],
  },

  // Demographic segments
  YOUNG_PROFESSIONALS: {
    name: "직장인 (25-40세)",
    criteria: [
      { field: "age", operator: ">", value: 25 },
      { field: "age", operator: "<", value: 40 },
      { field: "tag", operator: "includes", value: "PROFESSIONAL" },
    ],
  },

  FAMILY_ORIENTED: {
    name: "가족 동반 여행객",
    criteria: [
      { field: "tag", operator: "includes", value: "FAMILY" },
      { field: "childrenCount", operator: ">", value: 0 },
    ],
  },

  HEALTH_CONSCIOUS: {
    name: "건강 관심 고객 (의료 보험 추천)",
    criteria: [
      { field: "tag", operator: "includes", value: "HEALTH_CONCERN" },
    ],
  },

  // Behavior segments
  EARLY_ADOPTER: {
    name: "신제품 수용 고객",
    criteria: [
      { field: "tag", operator: "includes", value: "BETA_TESTER" },
      { field: "purchaseCount", operator: ">", value: 2 },
    ],
  },

  BARGAIN_HUNTER: {
    name: "가격민감 고객 (할인 선호)",
    criteria: [
      { field: "tag", operator: "includes", value: "PRICE_SENSITIVE" },
    ],
  },

  LOYAL_REPEAT_CUSTOMER: {
    name: "충성도 높은 재구매 고객",
    criteria: [
      { field: "purchaseCount", operator: ">", value: 3 },
      { field: "monthsSinceLast Purchase", operator: "<", value: 12 },
    ],
  },
};

/**
 * Build segment dynamically from criteria
 */
export async function buildSegment(
  organizationId: string,
  criteria: SegmentCriteria[]
): Promise<{ contactIds: string[]; count: number }> {
  let query = prisma.contact.findMany({
    where: { organizationId },
    select: { id: true },
  });

  // Apply all criteria as AND filters
  const contacts = await query;
  let filtered = contacts;

  for (const criterion of criteria) {
    filtered = applySegmentCriterion(filtered, criterion);
  }

  return {
    contactIds: filtered.map((c) => c.id),
    count: filtered.length,
  };
}

function applySegmentCriterion(
  contacts: Array<{ id: string }>,
  criterion: SegmentCriteria
): Array<{ id: string }> {
  // Simplified filtering logic - would need to enhance based on contact data
  // For production, this would use Prisma filters at DB level for performance

  return contacts;
}

/**
 * RFM Segmentation (Recency, Frequency, Monetary Value)
 * Classic retail segmentation for customer lifetime value prediction
 */
export async function segmentByRFM(
  organizationId: string
): Promise<Map<string, string[]>> {
  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    include: {
      affiliateSales: { select: { confirmedAmount: true, createdAt: true } },
      callLogs: { select: { createdAt: true } },
    },
  });

  const rfmSegments = new Map<string, string[]>();

  for (const contact of contacts) {
    // R: Recency (days since last contact)
    const lastContact = contact.callLogs[0]?.createdAt || contact.createdAt;
    const daysSinceContact = Math.floor(
      (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
    );
    const recency = daysSinceContact < 30 ? "High" : "Low";

    // F: Frequency (number of purchases)
    const frequency = contact.affiliateSales.length > 2 ? "High" : "Low";

    // M: Monetary Value (total spent)
    const monetaryValue =
      contact.affiliateSales.reduce((sum, s) => sum + (s.confirmedAmount || 0), 0) >
      2000000
        ? "High"
        : "Low";

    const rfmScore = `${recency}-${frequency}-${monetaryValue}`;

    if (!rfmSegments.has(rfmScore)) {
      rfmSegments.set(rfmScore, []);
    }
    rfmSegments.get(rfmScore)!.push(contact.id);
  }

  return rfmSegments;
}

/**
 * Predictive segmentation: ML-based clustering
 * Identifies customer groups by behavior patterns
 */
export async function predictiveSegmentation(
  organizationId: string,
  numClusters: number = 5
): Promise<Map<number, { size: number; characteristics: string[] }>> {
  // TODO: Implement K-means clustering or similar
  // For now, return a template structure

  const clusters = new Map<number, { size: number; characteristics: string[] }>();

  for (let i = 0; i < numClusters; i++) {
    clusters.set(i, {
      size: 0,
      characteristics: [`Cluster ${i}`, "TBD characteristics"],
    });
  }

  logger.log("[Segmentation] Predictive segmentation", {
    organizationId,
    numClusters,
  });

  return clusters;
}

/**
 * Lookalike segmentation: find customers similar to top performers
 * Used for targeted marketing to high-potential prospects
 */
export async function findLookalikeSegment(
  organizationId: string,
  seedContactId: string,
  similarityThreshold: number = 0.7
): Promise<string[]> {
  const seedContact = await prisma.contact.findUnique({
    where: { id: seedContactId },
    include: { callLogs: true, memos: true },
  });

  if (!seedContact) return [];

  // Extract seed contact features
  const seedFeatures = {
    age: seedContact.age,
    segment: seedContact.segment,
    tags: seedContact.tags || [],
    callLogCount: seedContact.callLogs?.length || 0,
  };

  // Find contacts with similar features
  const candidates = await prisma.contact.findMany({
    where: {
      organizationId,
      age: seedContact.age ? { gte: (seedContact.age || 0) - 5, lte: (seedContact.age || 0) + 5 } : undefined,
      segment: seedContact.segment,
    },
    select: { id: true },
  });

  return candidates.map((c) => c.id);
}

/**
 * Segment engagement scoring
 * Rank segments by conversion potential
 */
export function scoreSegment(segment: Segment): {
  score: number;
  tier: "TIER_1" | "TIER_2" | "TIER_3";
  recommendation: string;
} {
  let score = 0;

  // Score based on criteria
  for (const criterion of segment.criteria) {
    if (criterion.field === "lens" && criterion.value === "L10") score += 40;
    if (criterion.field === "revenue" && criterion.operator === ">") score += 30;
    if (criterion.field === "inactivity" && criterion.operator === "<") score += 20;
    if (criterion.field === "tag" && criterion.value === "READY_TO_BUY") score += 35;
  }

  score = Math.min(100, score);

  let tier: "TIER_1" | "TIER_2" | "TIER_3";
  let recommendation: string;

  if (score >= 80) {
    tier = "TIER_1";
    recommendation = "🔥 High priority: Aggressive outreach recommended";
  } else if (score >= 50) {
    tier = "TIER_2";
    recommendation = "⭐ Medium priority: Regular nurturing sequence";
  } else {
    tier = "TIER_3";
    recommendation = "📊 Low priority: Educational content & awareness";
  }

  return { score, tier, recommendation };
}
