/**
 * A/B Test Statistical Analysis Engine
 * Team 2 Implementation: Chi-Square Test + Confidence Intervals
 *
 * 🎯 Key Features:
 * - Chi-Square goodness-of-fit test (1 degree of freedom)
 * - Wilson Score Interval for confidence bounds
 * - Statistical significance detection (p-value < 0.05)
 * - Winner declaration with confidence metrics
 */

// =============================================================================
// 1️⃣ CHI-SQUARE TEST (Goodness-of-fit test, A vs B)
// =============================================================================

/**
 * Calculate Chi-Square statistic for A/B test
 *
 * Formula:
 *   χ² = Σ [(observed - expected)² / expected]
 *
 * For A/B test with binary outcomes (click/no-click):
 *   null hypothesis: both A and B have same conversion rate
 *   expected = total_conversions * (individual_impressions / total_impressions)
 */
export function calculateChiSquare(
  clicksA: number,
  clicksB: number,
  impressionsA: number,
  impressionsB: number
): { chiSquare: number; degreesOfFreedom: number } {
  const totalClicks = clicksA + clicksB;
  const totalImpressions = impressionsA + impressionsB;

  if (totalImpressions === 0) {
    return { chiSquare: 0, degreesOfFreedom: 1 };
  }

  // Overall click rate (null hypothesis)
  const overallCTR = totalClicks / totalImpressions;

  // Expected number of clicks for each variant under null hypothesis
  const expectedA = impressionsA * overallCTR;
  const expectedB = impressionsB * overallCTR;

  // Avoid division by zero
  if (expectedA === 0 || expectedB === 0) {
    return { chiSquare: 0, degreesOfFreedom: 1 };
  }

  // Chi-square calculation
  const chiSquare =
    Math.pow(clicksA - expectedA, 2) / expectedA +
    Math.pow(clicksB - expectedB, 2) / expectedB;

  return { chiSquare, degreesOfFreedom: 1 };
}

// =============================================================================
// 2️⃣ P-VALUE CALCULATION (From Chi-Square)
// =============================================================================

/**
 * Approximate p-value from Chi-Square statistic using Q-function
 * For 1 degree of freedom (A vs B test)
 *
 * Reference: Standard Chi-Square distribution table
 * χ²(0.05, df=1) ≈ 3.841 (critical value)
 */
function approximateChiSquarePValue(chiSquare: number): number {
  // Lookup table for chi-square p-values (df = 1)
  // χ² value -> p-value (two-tailed)
  const lookupTable: Array<[number, number]> = [
    [0, 1.0],
    [0.455, 0.5],
    [1.074, 0.3],
    [1.642, 0.2],
    [2.706, 0.1],
    [3.841, 0.05],
    [5.412, 0.02],
    [6.635, 0.01],
    [7.879, 0.005],
    [10.828, 0.001],
  ];

  // Find p-value by interpolation
  for (let i = 0; i < lookupTable.length - 1; i++) {
    if (chiSquare >= lookupTable[i][0] && chiSquare <= lookupTable[i + 1][0]) {
      const x0 = lookupTable[i][0];
      const y0 = lookupTable[i][1];
      const x1 = lookupTable[i + 1][0];
      const y1 = lookupTable[i + 1][1];

      // Linear interpolation
      return y0 + ((chiSquare - x0) / (x1 - x0)) * (y1 - y0);
    }
  }

  // If chi-square exceeds all values, return very small p-value
  if (chiSquare > 10.828) {
    return 0.001;
  }

  return 1.0;
}

/**
 * Get Z-score for given confidence level (two-tailed)
 * Common values:
 *   0.90 -> 1.645
 *   0.95 -> 1.96
 *   0.99 -> 2.576
 */
function getZScore(confidenceLevel: number): number {
  const zScores: Record<number, number> = {
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  return zScores[confidenceLevel] || 1.96; // Default to 95%
}

// =============================================================================
// 3️⃣ CONFIDENCE INTERVAL (Wilson Score Interval)
// =============================================================================

/**
 * Calculate 95% confidence interval using Wilson Score method
 * More accurate than normal approximation, especially for small samples
 *
 * Reference: Wilson, E. B. (1927). "Probable inference..."
 */
export function calculateConfidenceInterval(
  clicks: number,
  impressions: number,
  confidenceLevel: number = 0.95
): {
  ctr: number;
  lower: number;
  upper: number;
  marginOfError: number;
} {
  if (impressions === 0) {
    return { ctr: 0, lower: 0, upper: 1, marginOfError: 0 };
  }

  const ctr = clicks / impressions;
  const z = getZScore(confidenceLevel);
  const z2 = z * z;

  const denominator = 1 + z2 / impressions;

  const center = (ctr + (z2 / (2 * impressions))) / denominator;

  const sqrtComponent = Math.sqrt(
    (ctr * (1 - ctr)) / impressions + (z2 / (4 * impressions * impressions))
  );

  const margin = (z * sqrtComponent) / denominator;

  return {
    ctr: ctr,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    marginOfError: margin,
  };
}

// =============================================================================
// 4️⃣ STATISTICAL SIGNIFICANCE TEST
// =============================================================================

/**
 * Check if A/B test result is statistically significant
 * Returns: true if p-value < pValueThreshold (default 0.05)
 */
export function isStatisticallySignificant(
  clicksA: number,
  clicksB: number,
  impressionsA: number,
  impressionsB: number,
  pValueThreshold: number = 0.05
): boolean {
  const { chiSquare } = calculateChiSquare(
    clicksA,
    clicksB,
    impressionsA,
    impressionsB
  );
  const pValue = approximateChiSquarePValue(chiSquare);
  return pValue < pValueThreshold;
}

// =============================================================================
// 5️⃣ WINNER DECLARATION
// =============================================================================

export interface DecisionResult {
  winner: 'A' | 'B' | null;
  reason: string;
  confidence: number; // 0-1, where 1 = 100% confidence
  statistics: {
    chiSquare: number;
    pValue: number;
    ctrA: number;
    ctrB: number;
    ciA: { lower: number; upper: number };
    ciB: { lower: number; upper: number };
  };
}

/**
 * Declare A/B test winner with statistical validation
 *
 * Conditions for winner declaration:
 * 1. Minimum sample size: impressions >= minImpressions (default 100)
 * 2. Statistical significance: p-value < pValueThreshold (default 0.05)
 * 3. Higher CTR wins
 *
 * Returns:
 * - winner: 'A', 'B', or null (no winner yet)
 * - reason: human-readable explanation
 * - confidence: 1 - pValue (our confidence in the result)
 */
export function declareWinner(
  clicksA: number,
  clicksB: number,
  impressionsA: number,
  impressionsB: number,
  options: {
    minImpressions?: number;
    pValueThreshold?: number;
    confidenceLevel?: number;
  } = {}
): DecisionResult {
  const minImpressions = options.minImpressions ?? 100;
  const pValueThreshold = options.pValueThreshold ?? 0.05;
  const confidenceLevel = options.confidenceLevel ?? 0.95;

  // Condition 1: Minimum sample size check
  if (impressionsA < minImpressions || impressionsB < minImpressions) {
    const currentSample = Math.max(impressionsA, impressionsB);
    return {
      winner: null,
      reason: `샘플 부족 (현재: ${currentSample}, 필요: ${minImpressions})`,
      confidence: 0,
      statistics: {
        chiSquare: 0,
        pValue: 1,
        ctrA: clicksA / (impressionsA || 1),
        ctrB: clicksB / (impressionsB || 1),
        ciA: { lower: 0, upper: 1 },
        ciB: { lower: 0, upper: 1 },
      },
    };
  }

  // Calculate all statistics
  const { chiSquare } = calculateChiSquare(
    clicksA,
    clicksB,
    impressionsA,
    impressionsB
  );
  const pValue = approximateChiSquarePValue(chiSquare);

  const ctrA = clicksA / impressionsA;
  const ctrB = clicksB / impressionsB;

  const ciA = calculateConfidenceInterval(
    clicksA,
    impressionsA,
    confidenceLevel
  );
  const ciB = calculateConfidenceInterval(
    clicksB,
    impressionsB,
    confidenceLevel
  );

  // Condition 2: Statistical significance check
  if (pValue > pValueThreshold) {
    const percentageChance = Math.round((1 - pValue) * 100);
    return {
      winner: null,
      reason: `통계적으로 유의하지 않음 (p-value: ${pValue.toFixed(3)}) - ${percentageChance}% 신뢰도로 계속 수집 필요`,
      confidence: 1 - pValue,
      statistics: {
        chiSquare,
        pValue,
        ctrA,
        ctrB,
        ciA: { lower: ciA.lower, upper: ciA.upper },
        ciB: { lower: ciB.lower, upper: ciB.upper },
      },
    };
  }

  // Condition 3: Declare winner (higher CTR)
  const winner = ctrB > ctrA ? 'B' : 'A';
  const betterCTR = Math.max(ctrA, ctrB);
  const worseCTR = Math.min(ctrA, ctrB);
  const improvement = ((betterCTR - worseCTR) / worseCTR * 100).toFixed(1);

  return {
    winner,
    reason: `통계적으로 유의함 (p-value: ${pValue.toFixed(4)}) - ${winner} 변형이 ${improvement}% 더 높은 CTR (${(betterCTR * 100).toFixed(2)}% vs ${(worseCTR * 100).toFixed(2)}%)`,
    confidence: 1 - pValue,
    statistics: {
      chiSquare,
      pValue,
      ctrA,
      ctrB,
      ciA: { lower: ciA.lower, upper: ciA.upper },
      ciB: { lower: ciB.lower, upper: ciB.upper },
    },
  };
}

// =============================================================================
// 6️⃣ POWER ANALYSIS (Sample Size Recommendation)
// =============================================================================

/**
 * Calculate recommended minimum sample size for A/B test
 * Based on:
 *   - baseline conversion rate
 *   - desired minimum detectable effect (MDE)
 *   - power (1 - Type II error) typically 0.8
 *   - significance level (α) typically 0.05
 *
 * Reference: Two-proportion z-test power analysis
 */
export function recommendedSampleSize(
  baselineRate: number = 0.75, // 75% baseline CTR
  mde: number = 0.05, // 5% relative improvement
  power: number = 0.8, // 80% power
  alpha: number = 0.05 // 5% significance level
): {
  perVariant: number;
  total: number;
  explanation: string;
} {
  // Simplified power analysis formula for two-proportion test
  // n = (z_alpha + z_beta)² * [p1(1-p1) + p2(1-p2)] / (p1 - p2)²

  const zAlpha = getZScore(1 - alpha / 2); // Two-tailed
  const zBeta = getZScore(power);

  const p1 = baselineRate;
  const p2 = baselineRate * (1 + mde); // Effect size

  if (p2 >= 1 || p2 <= 0) {
    return {
      perVariant: 100, // Fallback
      total: 200,
      explanation: '계산 오류: 비율이 0-1 범위를 벗어남',
    };
  }

  const numerator =
    Math.pow(zAlpha + zBeta, 2) *
    (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p1 - p2, 2);

  const perVariant = Math.ceil(numerator / denominator);

  return {
    perVariant,
    total: perVariant * 2,
    explanation: `베이스라인 ${(p1 * 100).toFixed(1)}% → 목표 ${(p2 * 100).toFixed(1)}% (${(mde * 100).toFixed(1)}% 개선). 각 변형당 ${perVariant.toLocaleString()} 노출 필요.`,
  };
}

// =============================================================================
// 7️⃣ A/A TEST (Validation)
// =============================================================================

/**
 * Validate that two identical samples have no significant difference
 * This tests if our statistical engine is working correctly
 *
 * Expected result: p-value > 0.05 (no significant difference)
 * If p-value < 0.05 for identical samples, there's a bug in our engine
 */
export function validateStatisticalEngine(
  sample1Clicks: number,
  sample1Impressions: number,
  sample2Clicks: number,
  sample2Impressions: number
): {
  isValid: boolean;
  pValue: number;
  explanation: string;
} {
  const decision = declareWinner(
    sample1Clicks,
    sample2Clicks,
    sample1Impressions,
    sample2Impressions
  );

  const isValid = decision.winner === null; // Should not declare a winner for identical samples

  return {
    isValid,
    pValue: decision.statistics.pValue,
    explanation: isValid
      ? `✅ 엔진 정상: 동일한 샘플에서 우승자 선정 안 함 (p-value: ${decision.statistics.pValue.toFixed(3)})`
      : `❌ 엔진 오류: 동일한 샘플에서 우승자를 선정함 - 통계 계산 검토 필요`,
  };
}

// =============================================================================
// 8️⃣ BATCH RESULTS (Multiple Tests)
// =============================================================================

export interface ABTestBatchResult {
  testId: string;
  variantAMetrics: {
    clicks: number;
    impressions: number;
    ctr: number;
  };
  variantBMetrics: {
    clicks: number;
    impressions: number;
    ctr: number;
  };
  decision: DecisionResult;
}

/**
 * Analyze multiple A/B tests in batch
 * Useful for dashboard updates, scheduled reports
 */
export function analyzeBatchTests(
  tests: Array<{
    testId: string;
    clicksA: number;
    impressionsA: number;
    clicksB: number;
    impressionsB: number;
  }>,
  options?: {
    minImpressions?: number;
    pValueThreshold?: number;
  }
): ABTestBatchResult[] {
  return tests.map((test) => ({
    testId: test.testId,
    variantAMetrics: {
      clicks: test.clicksA,
      impressions: test.impressionsA,
      ctr: test.clicksA / (test.impressionsA || 1),
    },
    variantBMetrics: {
      clicks: test.clicksB,
      impressions: test.impressionsB,
      ctr: test.clicksB / (test.impressionsB || 1),
    },
    decision: declareWinner(
      test.clicksA,
      test.clicksB,
      test.impressionsA,
      test.impressionsB,
      options
    ),
  }));
}

// =============================================================================
// Export types for TypeScript usage
// =============================================================================

// DecisionResult is already exported via the interface declaration above
