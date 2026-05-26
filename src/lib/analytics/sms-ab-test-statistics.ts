/**
 * SMS A/B Test Statistical Analysis Module
 * Phase 3 Track D: SMS Campaign A/B Testing
 * Author: CRM Analytics Team
 * Date: 2026-05-27
 *
 * Statistical methods:
 * - Chi-square test (χ²)
 * - Two-proportion Z-test
 * - 95% Confidence interval (Wilson Score)
 * - p-value calculation
 * - Relative risk (RR)
 */

import { erf } from "math";

/**
 * 2x2 Contingency table for statistical tests
 * [A converted, A not converted]
 * [B converted, B not converted]
 */
export interface ContingencyTable {
  aConverted: number;
  aNotConverted: number;
  bConverted: number;
  bNotConverted: number;
}

/**
 * A/B Test analysis result with comprehensive statistics
 */
export interface ABTestResult {
  // Sample sizes
  totalA: number;
  totalB: number;
  totalSent: number;

  // Conversions
  conversionsA: number;
  conversionsB: number;

  // Conversion rates (0.0 to 1.0)
  rateA: number;
  rateB: number;
  rateDifference: number;

  // Statistical tests
  chiSquare: number;
  zScore: number;
  pValue: number; // two-sided

  // Confidence intervals (95%)
  ciA_lower: number;
  ciA_upper: number;
  ciB_lower: number;
  ciB_upper: number;
  ciDifference_lower: number;
  ciDifference_upper: number;

  // Effect size
  relativeRisk: number; // RR = rateB / rateA
  oddsRatio: number; // OR = (bConverted * aNotConverted) / (aConverted * bNotConverted)
  absoluteRiskReduction: number; // ARR = rateA - rateB

  // Decision
  isStatisticallySignificant: boolean; // p < 0.05
  confidenceLevel: number; // 0.95 for 95% CI
  recommendation: string; // Auto-generated interpretation

  // Metadata
  timestamp: Date;
  testDays?: number;
}

/**
 * Calculate normal distribution CDF (Φ)
 * Using Hart's approximation
 */
function normCDF(z: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;

  const t = 1.0 / (1.0 + p * Math.abs(z));
  const tau =
    1.0 -
    (1.0 / Math.sqrt(2 * Math.PI)) *
      Math.exp(-0.5 * z * z) *
      (b1 * t + b2 * t * t + b3 * t * t * t + b4 * t * t * t * t + b5 * t * t * t * t * t);

  return z >= 0 ? tau : 1.0 - tau;
}

/**
 * Calculate p-value from Z-score (two-sided)
 */
function pValueFromZScore(z: number): number {
  const absZ = Math.abs(z);
  const tailProb = 1.0 - normCDF(absZ);
  return 2.0 * tailProb; // Two-sided test
}

/**
 * Chi-square test for 2x2 contingency table
 * Formula: χ² = n(ad - bc)² / [(a+b)(c+d)(a+c)(b+d)]
 */
function chiSquareTest(table: ContingencyTable): { chi2: number; pValue: number } {
  const { aConverted: a, aNotConverted: b, bConverted: c, bNotConverted: d } = table;
  const n = a + b + c + d;

  if (n === 0) return { chi2: 0, pValue: 1.0 };

  const numerator = n * Math.pow(a * d - b * c, 2);
  const denominator = (a + b) * (c + d) * (a + c) * (b + d);

  if (denominator === 0) return { chi2: 0, pValue: 1.0 };

  const chi2 = numerator / denominator;

  // Convert chi-square to p-value using Z-score approximation
  // For df=1, χ² ≈ z²
  const z = Math.sqrt(chi2);
  const pValue = pValueFromZScore(z);

  return { chi2, pValue };
}

/**
 * Two-proportion Z-test
 * Tests if rates are significantly different
 */
function twoProportionZTest(
  conversionsA: number,
  totalA: number,
  conversionsB: number,
  totalB: number
): { zScore: number; pValue: number; difference: number } {
  if (totalA === 0 || totalB === 0) {
    return { zScore: 0, pValue: 1.0, difference: 0 };
  }

  const rateA = conversionsA / totalA;
  const rateB = conversionsB / totalB;
  const difference = rateB - rateA;

  // Pooled proportion
  const pPool = (conversionsA + conversionsB) / (totalA + totalB);

  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / totalA + 1 / totalB));

  if (se === 0) {
    return { zScore: 0, pValue: 1.0, difference };
  }

  const zScore = difference / se;
  const pValue = pValueFromZScore(zScore);

  return { zScore, pValue, difference };
}

/**
 * Wilson Score Confidence Interval for single proportion
 * More accurate than normal approximation, especially for extreme values
 */
function wilsonScoreCI(
  successes: number,
  trials: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  if (trials === 0) return { lower: 0, upper: 1 };

  const z = 1.96; // 95% CI (two-sided α=0.05)
  const p = successes / trials;

  const denominator = 1 + (z * z) / trials;
  const centre = (p + (z * z) / (2 * trials)) / denominator;
  const adjustment = (z * Math.sqrt(p * (1 - p) / trials + (z * z) / (4 * trials * trials))) / denominator;

  const lower = Math.max(0, centre - adjustment);
  const upper = Math.min(1, centre + adjustment);

  return { lower, upper };
}

/**
 * Confidence interval for difference of two proportions
 */
function differenceOfProportionsCI(
  conversionsA: number,
  totalA: number,
  conversionsB: number,
  totalB: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  const z = 1.96; // 95% CI

  const rateA = conversionsA / totalA;
  const rateB = conversionsB / totalB;
  const difference = rateB - rateA;

  const varA = (rateA * (1 - rateA)) / totalA;
  const varB = (rateB * (1 - rateB)) / totalB;
  const se = Math.sqrt(varA + varB);

  const lower = difference - z * se;
  const upper = difference + z * se;

  return { lower, upper };
}

/**
 * Calculate relative risk (RR)
 * RR = rateB / rateA
 * RR > 1 means B is better, RR < 1 means A is better
 */
function calculateRelativeRisk(rateB: number, rateA: number): number {
  if (rateA === 0) return 0;
  return rateB / rateA;
}

/**
 * Calculate odds ratio (OR)
 * OR = (successes_B / failures_B) / (successes_A / failures_A)
 */
function calculateOddsRatio(
  conversionsA: number,
  notConversionsA: number,
  conversionsB: number,
  notConversionsB: number
): number {
  if (conversionsA === 0 || notConversionsA === 0 || conversionsB === 0 || notConversionsB === 0) {
    return 0;
  }
  return (conversionsB * notConversionsA) / (conversionsA * notConversionsB);
}

/**
 * Generate interpretation based on statistical test results
 */
function generateRecommendation(
  result: Partial<ABTestResult>,
  minSampleSize: number = 100
): string {
  const { rateA = 0, rateB = 0, pValue = 1, totalA = 0, totalB = 0, isStatisticallySignificant = false } = result;

  // Check sample size
  if (totalA < minSampleSize || totalB < minSampleSize) {
    return `Continue testing: Need more samples (A: ${totalA}/${minSampleSize}, B: ${totalB}/${minSampleSize})`;
  }

  const ratePercent_A = (rateA * 100).toFixed(1);
  const ratePercent_B = (rateB * 100).toFixed(1);

  if (!isStatisticallySignificant) {
    if (Math.abs(rateB - rateA) < 0.02) {
      return `No significant difference (A: ${ratePercent_A}%, B: ${ratePercent_B}%, p=${pValue.toFixed(3)}). Consider deploying either variant.`;
    } else if (rateB > rateA) {
      return `B shows trend of improvement (${ratePercent_B}% vs ${ratePercent_A}%, p=${pValue.toFixed(3)}) but not statistically significant yet. Continue testing.`;
    } else {
      return `A shows trend of improvement (${ratePercent_A}% vs ${ratePercent_B}%, p=${pValue.toFixed(3)}) but not statistically significant yet. Continue testing.`;
    }
  }

  // Statistically significant
  if (rateB > rateA) {
    const improvement = (((rateB - rateA) / rateA) * 100).toFixed(1);
    return `✅ B is significantly better: ${ratePercent_B}% vs ${ratePercent_A}% (+${improvement}%, p=${pValue.toFixed(4)}). Deploy B.`;
  } else {
    const improvement = (((rateA - rateB) / rateB) * 100).toFixed(1);
    return `✅ A is significantly better: ${ratePercent_A}% vs ${ratePercent_B}% (+${improvement}%, p=${pValue.toFixed(4)}). Deploy A.`;
  }
}

/**
 * Comprehensive A/B test analysis
 */
export function analyzeABTest(
  conversionsA: number,
  totalA: number,
  conversionsB: number,
  totalB: number,
  testDays: number = 7
): ABTestResult {
  // Safety checks
  if (totalA < 0 || totalB < 0 || conversionsA > totalA || conversionsB > totalB) {
    throw new Error("Invalid input: conversions cannot exceed totals");
  }

  const rateA = totalA > 0 ? conversionsA / totalA : 0;
  const rateB = totalB > 0 ? conversionsB / totalB : 0;
  const rateDifference = rateB - rateA;

  // Chi-square test
  const contingencyTable: ContingencyTable = {
    aConverted: conversionsA,
    aNotConverted: totalA - conversionsA,
    bConverted: conversionsB,
    bNotConverted: totalB - conversionsB,
  };
  const { chi2, pValue } = chiSquareTest(contingencyTable);

  // Two-proportion Z-test
  const { zScore } = twoProportionZTest(conversionsA, totalA, conversionsB, totalB);

  // Confidence intervals
  const { lower: ciA_lower, upper: ciA_upper } = wilsonScoreCI(conversionsA, totalA);
  const { lower: ciB_lower, upper: ciB_upper } = wilsonScoreCI(conversionsB, totalB);
  const { lower: ciDifference_lower, upper: ciDifference_upper } = differenceOfProportionsCI(
    conversionsA,
    totalA,
    conversionsB,
    totalB
  );

  // Effect sizes
  const relativeRisk = calculateRelativeRisk(rateB, rateA);
  const oddsRatio = calculateOddsRatio(conversionsA, totalA - conversionsA, conversionsB, totalB - conversionsB);
  const absoluteRiskReduction = rateA - rateB;

  // Decision
  const isStatisticallySignificant = pValue < 0.05;

  const result: ABTestResult = {
    totalA,
    totalB,
    totalSent: totalA + totalB,
    conversionsA,
    conversionsB,
    rateA,
    rateB,
    rateDifference,
    chiSquare: chi2,
    zScore,
    pValue,
    ciA_lower,
    ciA_upper,
    ciB_lower,
    ciB_upper,
    ciDifference_lower,
    ciDifference_upper,
    relativeRisk,
    oddsRatio,
    absoluteRiskReduction,
    isStatisticallySignificant,
    confidenceLevel: 0.95,
    recommendation: generateRecommendation({ rateA, rateB, pValue, totalA, totalB, isStatisticallySignificant }),
    timestamp: new Date(),
    testDays,
  };

  return result;
}

/**
 * Calculate required sample size for A/B test
 * Using Neyman allocation for two-proportion test
 */
export function calculateSampleSize(
  alpha: number = 0.05, // Type I error (significance level)
  beta: number = 0.20, // Type II error (1 - power)
  rateA: number = 0.45, // Expected baseline rate
  rateB: number = 0.55 // Expected variant rate
): { perGroup: number; total: number } {
  const z_alpha = 1.96; // Two-sided α/2 = 0.025
  const z_beta = 0.84; // Power = 0.80, so β = 0.20

  const pBar = (rateA + rateB) / 2;
  const delta = rateB - rateA;

  const numerator = 2 * Math.pow(z_alpha + z_beta, 2) * pBar * (1 - pBar);
  const denominator = Math.pow(delta, 2);

  const perGroup = Math.ceil(numerator / denominator);

  return {
    perGroup,
    total: perGroup * 2,
  };
}

/**
 * Format analysis result for display
 */
export function formatABTestResult(result: ABTestResult): string {
  const lines = [
    `========== A/B Test Analysis ==========`,
    ``,
    `GROUP A (Control):`,
    `  Sample: ${result.totalA}`,
    `  Conversions: ${result.conversionsA}`,
    `  Rate: ${(result.rateA * 100).toFixed(2)}% [${(result.ciA_lower * 100).toFixed(2)}% - ${(result.ciA_upper * 100).toFixed(2)}%]`,
    ``,
    `GROUP B (Variant):`,
    `  Sample: ${result.totalB}`,
    `  Conversions: ${result.conversionsB}`,
    `  Rate: ${(result.rateB * 100).toFixed(2)}% [${(result.ciB_lower * 100).toFixed(2)}% - ${(result.ciB_upper * 100).toFixed(2)}%]`,
    ``,
    `STATISTICS:`,
    `  Difference: ${(result.rateDifference * 100).toFixed(2)}% [${(result.ciDifference_lower * 100).toFixed(2)}% - ${(result.ciDifference_upper * 100).toFixed(2)}%]`,
    `  Chi-square: χ² = ${result.chiSquare.toFixed(4)}`,
    `  Z-score: z = ${result.zScore.toFixed(4)}`,
    `  p-value: ${result.pValue.toFixed(6)} (${result.isStatisticallySignificant ? "SIGNIFICANT" : "NOT SIGNIFICANT"})`,
    `  Relative Risk: ${result.relativeRisk.toFixed(2)}x`,
    `  Odds Ratio: ${result.oddsRatio.toFixed(2)}`,
    ``,
    `RECOMMENDATION:`,
    `  ${result.recommendation}`,
    ``,
    `Test Duration: ${result.testDays} days`,
    `Confidence Level: ${(result.confidenceLevel * 100).toFixed(0)}%`,
    `========================================`,
  ];

  return lines.join("\n");
}

/**
 * Calculate running statistics for timeline tracking
 */
export function calculateSnapshot(
  dayNumber: number,
  groupA_sent: number,
  groupA_converted: number,
  groupB_sent: number,
  groupB_converted: number
) {
  const result = analyzeABTest(groupA_converted, groupA_sent, groupB_converted, groupB_sent, dayNumber);

  return {
    dayNumber,
    groupA_rate: result.rateA,
    groupB_rate: result.rateB,
    pValue: result.pValue,
    isSignificant: result.isStatisticallySignificant,
    relativeRisk: result.relativeRisk,
    recommendation: result.recommendation,
  };
}

// Export for use in API routes and components
export default {
  analyzeABTest,
  calculateSampleSize,
  formatABTestResult,
  calculateSnapshot,
  chiSquareTest,
  twoProportionZTest,
  wilsonScoreCI,
  differenceOfProportionsCI,
  calculateRelativeRisk,
  calculateOddsRatio,
};
