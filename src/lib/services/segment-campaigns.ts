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
import { CustomerSegment } from "@prisma/client";

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
  const metrics = await prisma.segmentCampaignMetric.findMany({
    where: {
      segmentId,
      organizationId,
    },
  });

  if (metrics.length === 0) {
    // Default baseline performance
    return {
      channelPerformance: {
        SMS: 4.2,
        Kakao: 3.8,
        Email: 2.5,
      },
      tonePerformance: {
        Premium: 5.2,
        Encouraging: 4.1,
        Empathetic: 3.9,
        Urgent: 3.5,
        Supportive: 4.3,
      },
      timingPerformance: {
        morning: 3.8,
        afternoon: 3.2,
        evening: 4.5,
      },
    };
  }

  // Aggregate metrics by channel
  const channelMetrics: Record<string, { rate: number; count: number }> = {};
  const toneMetrics: Record<string, { rate: number; count: number }> = {};

  for (const metric of metrics) {
    // Channel performance
    if (metric.channel) {
      if (!channelMetrics[metric.channel]) {
        channelMetrics[metric.channel] = { rate: 0, count: 0 };
      }
      channelMetrics[metric.channel].rate +=
        (metric.conversionRate || 0) * metric.sent;
      channelMetrics[metric.channel].count += metric.sent;
    }
  }

  const channelPerformance: Record<string, number> = {};
  for (const [channel, data] of Object.entries(channelMetrics)) {
    channelPerformance[channel] =
      data.count > 0 ? (data.rate / data.count) * 100 : 0;
  }

  return {
    channelPerformance: {
      SMS: channelPerformance["SMS"] || 4.2,
      Kakao: channelPerformance["Kakao"] || 3.8,
      Email: channelPerformance["Email"] || 2.5,
    },
    tonePerformance: {
      Premium: 5.2,
      Encouraging: 4.1,
      Empathetic: 3.9,
      Urgent: 3.5,
      Supportive: 4.3,
    },
    timingPerformance: {
      morning: 3.8,
      afternoon: 3.2,
      evening: 4.5,
    },
  };
}

/**
 * PASONA-based message template generator
 */
function generatePasonaTemplate(
  stage: "P" | "A" | "S" | "O" | "N" | "A2",
  tone: "Premium" | "Encouraging" | "Empathetic" | "Urgent" | "Supportive",
  segmentName: string,
  expectedConversionRate: number
): string {
  const templates: Record<string, Record<string, string>> = {
    P: {
      Premium:
        "🎯 {{firstName}}님을 위한 특별한 크루즈 패키지가 준비되었습니다.",
      Encouraging:
        "✨ {{firstName}}님의 꿈의 크루즈를 현실로 만들어보세요!",
      Empathetic:
        "🌊 크루즈 여행을 꿈꾸신다면 바로 지금이 그 시작입니다.",
      Urgent: "⏰ {{firstName}}님을 위한 한정 오퍼가 마감 임박합니다!",
      Supportive: "💝 {{firstName}}님, 함께 행복한 여행을 떠나볼까요?",
    },
    A: {
      Premium:
        "💎 VIP 고객 {{firstName}}님께만 제공되는 프리미엄 경험입니다.",
      Encouraging:
        "🚀 지금 예약하면 {{discount}}% 특별 할인을 드립니다!",
      Empathetic:
        "❤️ 가족과 함께하는 특별한 시간, 우리가 도와드리겠습니다.",
      Urgent: "🔥 남은 자리: {{seatsLeft}}석만! 서둘러주세요!",
      Supportive: "🎁 예약 고객 전원에게 추가 서비스를 제공해드립니다.",
    },
    S: {
      Premium:
        "✅ 마비즈와 함께라면 모든 준비가 완벽합니다. 전문가 상담을 받아보세요.",
      Encouraging:
        "💬 {{firstName}}님의 모든 궁금증을 해결해드립니다. 지금 연락주세요!",
      Empathetic:
        "🤝 배멀미? 여권? 건강 걱정? 우리가 모두 챙겨드립니다.",
      Urgent: "⚡ 24시간 상담 가능합니다. 지금 바로 예약하세요!",
      Supportive:
        "👥 {{contactCount}}명의 만족한 고객들이 이미 마비즈와 함께했습니다.",
    },
    O: {
      Premium:
        "🌟 한정 오퍼: {{productName}} - {{originalPrice}}원 → {{discountedPrice}}원",
      Encouraging:
        "🎉 {{firstName}}님 맞춤 크루즈 패키지: {{bestOffer}} (가격: {{price}}원)",
      Empathetic:
        "💰 가족 모두가 함께 즐기는 크루즈, 합리적인 가격으로 준비했습니다.",
      Urgent:
        "🔔 긴급: {{discount}}% 할인 {{deadline}}까지만 유효합니다!",
      Supportive:
        "🎁 추가 혜택: {{benefit1}}, {{benefit2}} 완벽히 포함되어 있습니다.",
    },
    N: {
      Premium: "🏆 {{firstName}}님의 선택을 기다리고 있습니다.",
      Encouraging:
        "⏱️ 3가지 선택지 중 선택하세요: (1) 즉시 예약, (2) 내일 예약, (3) 주말 예약",
      Empathetic:
        "💚 우리는 당신의 최고의 경험을 약속합니다. 지금 확인해주세요!",
      Urgent:
        "🚨 남은 시간: {{hoursLeft}}시간만! 지금 결정해주세요!",
      Supportive:
        "📲 간단한 3단계로 예약 완료! 지금 바로 시작하세요.",
    },
    A2: {
      Premium:
        "👑 {{firstName}}님, 프리미엄 크루즈 패키지 예약이 완료되셨습니다!",
      Encouraging:
        "🎊 축하합니다! 이제 {{firstName}}님의 꿈의 크루즈 여행이 확정되었습니다!",
      Empathetic:
        "❤️ 감사합니다! {{firstName}}님과 함께하는 특별한 여행을 기대합니다.",
      Urgent: "✅ 예약 완료! 이제 준비를 시작하세요!",
      Supportive:
        "🌈 예약 완료 후 다음 단계를 안내해드리겠습니다. 고마워요!",
    },
  };

  const stageKey = stage === "A2" ? "A2" : stage;
  return (
    templates[stageKey]?.[tone] || templates["P"]?.[tone] || "크루즈 예약하기"
  );
}

// ============================================================================
// Segment-Based Campaign Recommender
// ============================================================================

export async function recommendCampaignBySegment(
  segmentId: string,
  organizationId: string
): Promise<CampaignRecommendation> {
  // 1. Load segment details
  const segment = await prisma.customerSegment.findUnique({
    where: { id: segmentId },
    include: {
      contactSegmentAssignments: {
        take: 1,
      },
    },
  });

  if (!segment) {
    throw new Error(`Segment not found: ${segmentId}`);
  }

  const profile = segment.profile as any;

  // 2. Analyze historical performance for this segment
  const performance = await analyzeSegmentPerformance(
    segmentId,
    organizationId
  );

  // 3. Determine best channel
  const channelScores = performance.channelPerformance;
  const bestChannel = Object.entries(channelScores).reduce((a, b) =>
    a[1] > b[1] ? a : b
  )[0] as "SMS" | "Kakao" | "Email";

  const channelConfidence = Math.min(
    100,
    70 + (channelScores[bestChannel] || 0) * 5
  );

  // 4. Determine message tone
  const messageTone = profile.messageTone ||
    (profile.churnRiskPercent > 60
      ? "Empathetic"
      : profile.avgEngagementRate > 60
        ? "Premium"
        : "Encouraging") as
    | "Premium"
    | "Encouraging"
    | "Empathetic"
    | "Urgent"
    | "Supportive";

  // 5. Generate PASONA sequence (Day 0-3)
  const day0Message = {
    stage: profile.churnRiskPercent > 60 ? ("Agitate" as const) : ("Problem" as const),
    tone: messageTone,
    messageTemplate: generatePasonaTemplate(
      profile.churnRiskPercent > 60 ? "A" : "P",
      messageTone,
      profile.name || "고객님",
      profile.avgEngagementRate
    ),
  };

  const day1Message = {
    stage: "Solution" as const,
    tone: messageTone,
    messageTemplate: generatePasonaTemplate("S", messageTone, profile.name || "고객님", profile.avgEngagementRate),
  };

  const day2Message = {
    stage: (profile.avgEngagementRate > 70 ? "Offer" : "Narrow") as
      | "Offer"
      | "Narrow",
    tone: messageTone,
    messageTemplate: generatePasonaTemplate("O", messageTone, profile.name || "고객님", profile.avgEngagementRate),
  };

  const day3Message = {
    stage: "Action" as const,
    tone: messageTone,
    messageTemplate: generatePasonaTemplate("A2", messageTone, profile.name || "고객님", profile.avgEngagementRate),
  };

  // 6. Optimal send times (based on segment engagement)
  const optimalSendTimes = [];
  if (profile.avgEngagementRate > 60) {
    // Highly engaged: morning and evening
    optimalSendTimes.push({ day: 0, hour: 8, minuteOffset: 0 });
    optimalSendTimes.push({ day: 1, hour: 8, minuteOffset: 15 });
    optimalSendTimes.push({ day: 2, hour: 14, minuteOffset: 0 });
    optimalSendTimes.push({ day: 3, hour: 20, minuteOffset: 0 });
  } else {
    // Less engaged: evening (higher open rates)
    optimalSendTimes.push({ day: 0, hour: 18, minuteOffset: 0 });
    optimalSendTimes.push({ day: 1, hour: 19, minuteOffset: 0 });
    optimalSendTimes.push({ day: 2, hour: 20, minuteOffset: 0 });
    optimalSendTimes.push({ day: 3, hour: 20, minuteOffset: 30 });
  }

  // 7. Predicted conversion rate
  let predictedConversionRate = profile.predictedConversionRate || 3.5;
  if (bestChannel === "SMS") predictedConversionRate *= 1.2; // SMS typically higher
  if (messageTone === "Premium") predictedConversionRate *= 1.15;
  if (profile.churnRiskPercent < 30) predictedConversionRate *= 1.1;

  // 8. Estimated revenue
  const estimatedRevenue = predictedConversionRate * 50 * 1000; // Rough estimate: 50 leads * 1000 per booking

  // 9. Reasoning
  const reasonForRecommendation: string[] = [];
  reasonForRecommendation.push(
    `${bestChannel} has highest conversion for this segment`
  );
  reasonForRecommendation.push(
    `${messageTone} tone matches segment profile`
  );
  reasonForRecommendation.push(
    `${profile.size} contacts in segment, ~${profile.size * (predictedConversionRate / 100)} expected conversions`
  );
  if (profile.churnRiskPercent > 60) {
    reasonForRecommendation.push("High churn risk - focus on reactivation");
  }

  return {
    segmentId,
    segmentName: profile.name || "Unknown",
    recommendedChannel: bestChannel,
    channelConfidence,
    day0MessageTemplate: day0Message,
    day1MessageTemplate: day1Message,
    day2MessageTemplate: day2Message,
    day3MessageTemplate: day3Message,
    optimalSendTimes,
    predictedConversionRate: Math.round(predictedConversionRate * 100) / 100,
    estimatedRevenue: Math.round(estimatedRevenue),
    confidence: Math.min(100, 60 + profile.avgEngagementRate * 0.4),
    reasonForRecommendation,
  };
}

/**
 * Generate A/B test suggestions for a segment
 */
export async function suggestABTestForSegment(
  segmentId: string,
  organizationId: string
): Promise<ABTestSuggestion> {
  const recommendation = await recommendCampaignBySegment(
    segmentId,
    organizationId
  );

  const segment = await prisma.customerSegment.findUnique({
    where: { id: segmentId },
  });

  const profile = segment?.profile as any;

  // Suggest testing variant of message tone
  const tones: Array<
    "Premium" | "Encouraging" | "Empathetic" | "Urgent" | "Supportive"
  > = ["Premium", "Encouraging", "Empathetic", "Urgent", "Supportive"];
  const variantBTone = tones.find(
    (t) => t !== recommendation.day0MessageTemplate.tone
  ) || "Encouraging";

  return {
    segmentId,
    testName: `Segment "${profile.name}" - Tone Test (${recommendation.day0MessageTemplate.tone} vs ${variantBTone})`,
    hypothesis: `${variantBTone} tone will increase conversion rate vs ${recommendation.day0MessageTemplate.tone} tone for ${profile.name} segment`,
    variantA: {
      name: `${recommendation.day0MessageTemplate.tone} (Control)`,
      config: {
        tone: recommendation.day0MessageTemplate.tone,
        timing: `Day 0 at ${recommendation.optimalSendTimes[0]?.hour}:00`,
        channel: recommendation.recommendedChannel,
      },
    },
    variantB: {
      name: `${variantBTone} (Variant)`,
      config: {
        tone: variantBTone,
        timing: `Day 0 at ${recommendation.optimalSendTimes[0]?.hour}:00`,
        channel: recommendation.recommendedChannel,
      },
    },
    successMetric: "conversion_rate",
    expectedSampleSize: Math.max(100, Math.floor(profile.size * 0.3)),
    estimatedTestDuration: 14,
  };
}

/**
 * Create and deploy A/B test for segment
 */
export async function createABTestForSegment(
  segmentId: string,
  organizationId: string
) {
  const suggestion = await suggestABTestForSegment(segmentId, organizationId);

  const abTest = await prisma.segmentABTest.create({
    data: {
      organizationId,
      segmentId,
      name: suggestion.testName,
      description: suggestion.hypothesis,
      variantAName: suggestion.variantA.name,
      variantAConfig: suggestion.variantA.config as any,
      variantBName: suggestion.variantB.name,
      variantBConfig: suggestion.variantB.config as any,
      status: "DRAFT",
      autoDeployIfSignificant: true,
    },
  });

  return abTest;
}
