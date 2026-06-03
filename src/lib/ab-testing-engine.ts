import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface ABTest {
  id: string;
  name: string;
  type: "MESSAGE" | "OFFER" | "CHANNEL" | "TIMING";
  status: "PLANNING" | "RUNNING" | "COMPLETED" | "ARCHIVED";
  variants: ABVariant[];
  sampleSize: number;
  startDate: Date;
  endDate?: Date;
  winningVariant?: string;
  confidence: number; // 0-1 (95% = 0.95)
  statisticalSignificance?: boolean;
}

export interface ABVariant {
  id: string;
  name: string;
  content: string; // Message, offer, etc.
  allocation: number; // 0-1 (50% = 0.5)
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  };
}

/**
 * Determine statistical significance using Chi-Square test
 * Tests whether observed differences are due to chance or real effect
 */
export function calculateChiSquare(
  variant1: ABVariant,
  variant2: ABVariant
): { chiSquare: number; pValue: number; isSignificant: boolean } {
  // Chi-square formula for conversion rates
  const n1 = variant1.metrics.sent;
  const n2 = variant2.metrics.sent;
  const c1 = variant1.metrics.converted;
  const c2 = variant2.metrics.converted;

  if (n1 === 0 || n2 === 0) {
    return { chiSquare: 0, pValue: 1, isSignificant: false };
  }

  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const p = (c1 + c2) / (n1 + n2);

  const chiSquare =
    (n1 * n2 * Math.pow(p1 - p2, 2)) / (p * (1 - p) * (n1 + n2));

  // Approximate p-value using chi-square distribution
  // For 95% confidence, chi-square critical value is ~3.841
  const isSignificant = chiSquare > 3.841;
  const pValue = isSignificant ? 0.05 : 0.95;

  return { chiSquare, pValue, isSignificant };
}

/**
 * Calculate statistical power and required sample size
 */
export function calculateRequiredSampleSize(
  baselineConversionRate: number,
  minimumDetectableEffect: number = 0.2 // 20% relative improvement
): number {
  // Using Evan Miller's online A/B calculator formula
  // https://www.evanmiller.org/ab-testing/sample-size.html

  const z_alpha = 1.96; // 95% confidence
  const z_beta = 0.84; // 80% power
  const p1 = baselineConversionRate;
  const p2 = baselineConversionRate * (1 + minimumDetectableEffect);

  const s = Math.pow(z_alpha, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const d = Math.pow(p1 - p2, 2);

  return Math.ceil((s / d) * 2); // *2 for both variants
}

/**
 * Multi-armed bandit approach: adaptively allocate traffic to winning variant
 */
export function calculateAdaptiveAllocation(
  variants: ABVariant[]
): Record<string, number> {
  // Thompson Sampling: allocate more traffic to variants with higher success
  const allocation: Record<string, number> = {};

  // Calculate success rate (conversion rate) for each variant
  const successRates = variants.map((v) => v.metrics.conversionRate);
  const totalSuccessRate = successRates.reduce((a, b) => a + b, 0);

  // Allocate proportionally to success rate
  variants.forEach((v, i) => {
    const rate = successRates[i];
    allocation[v.id] = totalSuccessRate > 0 ? rate / totalSuccessRate : 1 / variants.length;
  });

  return allocation;
}

/**
 * Predict winner with confidence interval
 */
export function predictWinner(variants: ABVariant[]): {
  winnerId: string;
  confidence: number;
  estimatedLift: number;
} {
  // Find variant with highest conversion rate
  const winner = variants.reduce((prev, current) =>
    current.metrics.conversionRate > prev.metrics.conversionRate ? current : prev
  );

  const runner_up = variants.find((v) => v.id !== winner.id);
  if (!runner_up) {
    return { winnerId: winner.id, confidence: 1, estimatedLift: 0 };
  }

  const { isSignificant } = calculateChiSquare(winner, runner_up);
  const lift =
    (winner.metrics.conversionRate - runner_up.metrics.conversionRate) /
    runner_up.metrics.conversionRate;

  return {
    winnerId: winner.id,
    confidence: isSignificant ? 0.95 : 0.5,
    estimatedLift: lift,
  };
}

/**
 * Segment-specific testing: run different tests for different customer segments
 *
 * @param organizationId - 테넌트 격리용 조직 ID (필수)
 * @param testName       - 테스트 이름
 * @param segment        - 세그먼트 타입 ("age" | "gender" | "lens" | "reactivation")
 * @param variant1       - 변형 A
 * @param variant2       - 변형 B
 * @param durationDays   - 테스트 기간 (기본 7일)
 */
export async function runSegmentedABTest(
  organizationId: string,
  testName: string,
  segment: string,
  variant1: ABVariant,
  variant2: ABVariant,
  durationDays: number = 7
): Promise<ABTest> {
  const startDate = new Date();
  const endDate   = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const name      = `${testName} (${segment})`;
  const sampleSize = calculateRequiredSampleSize(0.1); // 10% baseline 가정

  // DB 저장: SegmentABTest 모델에 테스트 레코드 생성
  const dbRecord = await prisma.segmentABTest.create({
    data: {
      organizationId,
      name,
      segmentType:  segment,
      variantA:     { id: variant1.id, name: variant1.name, content: variant1.content, allocation: variant1.allocation },
      variantB:     { id: variant2.id, name: variant2.name, content: variant2.content, allocation: variant2.allocation },
      status:       "RUNNING",
      startedAt:    startDate,
      endedAt:      endDate,
      totalSent:    0,
      aConversions: 0,
      bConversions: 0,
    },
  });

  const test: ABTest = {
    id: dbRecord.id,
    name,
    type: "MESSAGE",
    status: "RUNNING",
    variants: [variant1, variant2],
    sampleSize,
    startDate,
    endDate,
    confidence: 0.95,
  };

  logger.log("[A/B Test] Segmented test started and saved to DB", {
    testId:   test.id,
    dbId:     dbRecord.id,
    segment,
    orgId:    organizationId,
    sampleSize,
    duration: `${durationDays}d`,
  });

  return test;
}

/**
 * Analyze test results and determine winner
 */
export async function analyzeTestResults(test: ABTest): Promise<{
  winner?: ABVariant;
  lift: number;
  confidence: number;
  recommendation: string;
}> {
  const { winnerId, confidence, estimatedLift } = predictWinner(test.variants);
  const winner = test.variants.find((v) => v.id === winnerId);

  let recommendation = "";

  if (confidence > 0.9) {
    recommendation = `${winner?.name} is the clear winner (+${(estimatedLift * 100).toFixed(1)}% lift). Implement immediately.`;
  } else if (confidence > 0.7) {
    recommendation = `${winner?.name} shows promise (+${(estimatedLift * 100).toFixed(1)}% lift). Continue testing or implement with caution.`;
  } else {
    recommendation = "No clear winner. Results are inconclusive. Continue testing or run new test.";
  }

  return {
    winner,
    lift: estimatedLift,
    confidence,
    recommendation,
  };
}

/**
 * Common A/B test templates for marketing
 */
export const TEST_TEMPLATES = {
  SUBJECT_LINE: {
    variant1: "특별한 제안이 있습니다",
    variant2: "🔥 한 번의 클릭으로 인생이 바뀝니다",
  },
  CTA_TEXT: {
    variant1: "예약하기",
    variant2: "지금 바로 예약 (한 번의 클릭)",
  },
  PRICE_FRAMING: {
    variant1: "월 250만원",
    variant2: "일일 8,333원 (배로 나누어 생각해보세요)",
  },
  SOCIAL_PROOF: {
    variant1: "100명이 이미 예약했습니다",
    variant2: "지난주 200명이 예약했고 98% 만족도 기록했습니다",
  },
  URGENCY: {
    variant1: "마감일: 다음주",
    variant2: "⏰ 남은 시간: 48시간 (오늘 자정까지 20% 할인)",
  },
};
