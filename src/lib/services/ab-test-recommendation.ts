/**
 * A/B Test Recommendation Engine
 * Generates actionable recommendations for test results
 * Author: CRM Analytics Team
 * Date: 2026-05-27
 */

import { ABTestResult } from "@/lib/analytics/sms-ab-test-statistics";

/**
 * Color-coded recommendation status
 */
export enum RecommendationStatus {
  DEPLOY_A = "deploy-a", // Green: Deploy A
  DEPLOY_B = "deploy-b", // Green: Deploy B
  CONTINUE = "continue", // Yellow: Continue testing
  EQUIVALENT = "equivalent", // Gray: Either variant acceptable
  INSUFFICIENT_DATA = "insufficient", // Gray: Not enough data
}

/**
 * Recommendation output
 */
export interface Recommendation {
  status: RecommendationStatus;
  text: string;
  color: "green" | "yellow" | "gray";
  actionItems: string[];
  nextSteps?: string;
}

/**
 * Generate human-readable recommendation from A/B test result
 */
export function generateRecommendation(result: ABTestResult, minSampleSize: number = 100): Recommendation {
  const { rateA, rateB, pValue, totalA, totalB, isStatisticallySignificant } = result;

  // Check data sufficiency
  if (totalA < minSampleSize || totalB < minSampleSize) {
    return {
      status: RecommendationStatus.INSUFFICIENT_DATA,
      text: `Not enough data yet. Current: A=${totalA}, B=${totalB}. Target: ${minSampleSize} per variant.`,
      color: "gray",
      actionItems: [
        `Continue sending messages to reach ${minSampleSize} samples per variant`,
        `Expected completion: in ${Math.ceil((minSampleSize - Math.min(totalA, totalB)) / ((totalA + totalB) / Math.max(1, Math.floor((new Date().getTime() - result.timestamp.getTime()) / (1000 * 60 * 60 * 24)))))} days`,
      ],
    };
  }

  const ratePercent_A = (rateA * 100).toFixed(1);
  const ratePercent_B = (rateB * 100).toFixed(1);

  // Statistically significant result
  if (isStatisticallySignificant) {
    if (rateB > rateA) {
      const improvement = (((rateB - rateA) / rateA) * 100).toFixed(1);
      return {
        status: RecommendationStatus.DEPLOY_B,
        text: `✅ Deploy B immediately. B is ${improvement}% better (${ratePercent_B}% vs ${ratePercent_A}%, p=${pValue.toFixed(4)})`,
        color: "green",
        actionItems: [
          `Deploy variant B to 100% of audience`,
          `Save conversion lift: +${improvement}% = ${((rateB - rateA) * 100).toFixed(0)} additional conversions per 10,000 messages`,
          `Update template library with winning copy`,
          `Archive variant A for reference`,
        ],
        nextSteps: `After deployment, monitor for 7 days to confirm performance consistency.`,
      };
    } else {
      const improvement = (((rateA - rateB) / rateB) * 100).toFixed(1);
      return {
        status: RecommendationStatus.DEPLOY_A,
        text: `✅ Deploy A immediately. A is ${improvement}% better (${ratePercent_A}% vs ${ratePercent_B}%, p=${pValue.toFixed(4)})`,
        color: "green",
        actionItems: [
          `Deploy variant A to 100% of audience`,
          `Save conversion lift: +${improvement}% = ${((rateA - rateB) * 100).toFixed(0)} additional conversions per 10,000 messages`,
          `Update template library with winning copy`,
          `Archive variant B for reference`,
        ],
        nextSteps: `After deployment, monitor for 7 days to confirm performance consistency.`,
      };
    }
  }

  // Not significant, but shows trend
  if (Math.abs(rateB - rateA) >= 0.02) {
    if (rateB > rateA) {
      return {
        status: RecommendationStatus.CONTINUE,
        text: `B shows promise (${ratePercent_B}% vs ${ratePercent_A}%, p=${pValue.toFixed(3)}) but not yet significant. Continue testing.`,
        color: "yellow",
        actionItems: [
          `Continue A/B test for 3-5 more days`,
          `Monitor daily to watch for statistical significance`,
          `If B reaches p < 0.05, deploy immediately`,
          `Expected sample size per group: 200-300`,
        ],
        nextSteps: `Check again tomorrow. If trend continues, B will likely become significant.`,
      };
    } else {
      return {
        status: RecommendationStatus.CONTINUE,
        text: `A shows promise (${ratePercent_A}% vs ${ratePercent_B}%, p=${pValue.toFixed(3)}) but not yet significant. Continue testing.`,
        color: "yellow",
        actionItems: [
          `Continue A/B test for 3-5 more days`,
          `Monitor daily to watch for statistical significance`,
          `If A reaches p < 0.05, deploy immediately`,
          `Expected sample size per group: 200-300`,
        ],
        nextSteps: `Check again tomorrow. If trend continues, A will likely become significant.`,
      };
    }
  }

  // No significant difference and similar rates
  return {
    status: RecommendationStatus.EQUIVALENT,
    text: `No significant difference (A: ${ratePercent_A}%, B: ${ratePercent_B}%, p=${pValue.toFixed(3)}). Either variant acceptable.`,
    color: "gray",
    actionItems: [
      `Deploy either variant (A or B) - performance is equivalent`,
      `Consider secondary factors: brand alignment, user feedback, resource efficiency`,
      `If no preference, default to variant A (control)`,
      `Document learning: no improvement found for this messaging variation`,
    ],
    nextSteps: `Move to next A/B test experiment. Consider testing different copy angles or psychology lenses.`,
  };
}

/**
 * Generate short-form recommendation for dashboard display
 */
export function generateShortRecommendation(result: ABTestResult): string {
  const { rateA, rateB, pValue, totalA, totalB, isStatisticallySignificant } = result;

  if (totalA < 100 || totalB < 100) {
    return `Continue testing (A: ${totalA}, B: ${totalB})`;
  }

  if (isStatisticallySignificant) {
    if (rateB > rateA) {
      const improvement = (((rateB - rateA) / rateA) * 100).toFixed(0);
      return `✅ Deploy B (+${improvement}%, p=${pValue.toFixed(4)})`;
    } else {
      const improvement = (((rateA - rateB) / rateB) * 100).toFixed(0);
      return `✅ Deploy A (+${improvement}%, p=${pValue.toFixed(4)})`;
    }
  }

  if (Math.abs(rateB - rateA) >= 0.02) {
    return `📊 Trending (p=${pValue.toFixed(3)}). Continue testing.`;
  }

  return `No difference (p=${pValue.toFixed(3)}). Either OK.`;
}

/**
 * Get CSS color class for recommendation status
 */
export function getStatusColor(status: RecommendationStatus): string {
  const colorMap: Record<RecommendationStatus, string> = {
    [RecommendationStatus.DEPLOY_A]: "text-green-600 bg-green-50",
    [RecommendationStatus.DEPLOY_B]: "text-green-600 bg-green-50",
    [RecommendationStatus.CONTINUE]: "text-yellow-600 bg-yellow-50",
    [RecommendationStatus.EQUIVALENT]: "text-gray-600 bg-gray-50",
    [RecommendationStatus.INSUFFICIENT_DATA]: "text-gray-600 bg-gray-50",
  };
  return colorMap[status];
}

/**
 * Get icon emoji for recommendation status
 */
export function getStatusIcon(status: RecommendationStatus): string {
  const iconMap: Record<RecommendationStatus, string> = {
    [RecommendationStatus.DEPLOY_A]: "✅",
    [RecommendationStatus.DEPLOY_B]: "✅",
    [RecommendationStatus.CONTINUE]: "📊",
    [RecommendationStatus.EQUIVALENT]: "⚪",
    [RecommendationStatus.INSUFFICIENT_DATA]: "⏳",
  };
  return iconMap[status];
}
