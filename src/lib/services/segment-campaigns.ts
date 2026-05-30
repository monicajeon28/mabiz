/**
 * Segment-Based Campaign Recommendation Service
 *
 * Automatically recommend optimal channels, message tone, timing, and sequences
 * based on segment characteristics and historical performance.
 *
 * Returns:
 * - Best channel (SMS/Kakao/Email)
 * - Day 0-3 sequence template
 * - Message tone (5 variants)
 * - Optimal send time
 * - Predicted conversion rate
 */

import { prisma } from "@/lib/prisma";
// NOTE: CustomerSegment import removed - table does not exist in schema

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CampaignRecommendation {
  segmentId: string;
  segmentName: string;
  recommendedChannel: "SMS" | "Kakao" | "Email";
  channelConfidence: number; // 0-100
  day0MessageTemplate: {
    stage: "Problem" | "Agitate"; // PASONA first two stages
    tone: "Premium" | "Encouraging" | "Empathetic" | "Urgent" | "Supportive";
    messageTemplate: string;
  };
  day1MessageTemplate: {
    stage: "Solution";
    tone: string;
    messageTemplate: string;
  };
  day2MessageTemplate: {
    stage: "Offer" | "Narrow";
    tone: string;
    messageTemplate: string;
  };
  day3MessageTemplate: {
    stage: "Action";
    tone: string;
    messageTemplate: string;
  };
  optimalSendTimes: {
    day: number;
    hour: number;
    minuteOffset?: number;
  }[];
  predictedConversionRate: number; // %
  estimatedRevenue: number; // $ for typical offer
  confidence: number; // 0-100
  reasonForRecommendation: string[];
}

export interface ABTestSuggestion {
  segmentId: string;
  testName: string;
  hypothesis: string;
  variantA: {
    name: string;
    config: {
      tone: string;
      timing: string;
      channel: string;
    };
  };
  variantB: {
    name: string;
    config: {
      tone: string;
      timing: string;
      channel: string;
    };
  };
  successMetric: "conversion_rate" | "open_rate" | "click_rate";
  expectedSampleSize: number;
  estimatedTestDuration: number; // Days
}

// ============================================================================
// Campaign Recommendation Logic
// ============================================================================

async function analyzeSegmentPerformance(
  segmentId: string,
  organizationId: string
): Promise<{
  channelPerformance: Record<string, number>;
  tonePerformance: Record<string, number>;
  timingPerformance: Record<string, number>;
}> {
  throw new Error("CustomerSegment functionality has been disabled");
}

/**
 * PASONA-based message template generator
 *
 * @deprecated CustomerSegment functionality disabled
 */
function generatePasonaTemplate(
  stage: "P" | "A" | "S" | "O" | "N" | "A2",
  tone: "Premium" | "Encouraging" | "Empathetic" | "Urgent" | "Supportive",
  segmentName: string,
  expectedConversionRate: number
): string {
  throw new Error("CustomerSegment functionality has been disabled");
}

// ============================================================================
// Segment-Based Campaign Recommender
// ============================================================================

export async function recommendCampaignBySegment(
  segmentId: string,
  organizationId: string
): Promise<CampaignRecommendation> {
  throw new Error("CustomerSegment functionality has been disabled");
}

/**
 * Generate A/B test suggestions for a segment
 *
 * @deprecated CustomerSegment functionality disabled
 */
export async function suggestABTestForSegment(
  segmentId: string,
  organizationId: string
): Promise<ABTestSuggestion> {
  throw new Error("CustomerSegment functionality has been disabled");
}

/**
 * Create and deploy A/B test for segment
 *
 * @deprecated CustomerSegment functionality disabled
 */
export async function createABTestForSegment(
  segmentId: string,
  organizationId: string
) {
  throw new Error("CustomerSegment functionality has been disabled");
}
