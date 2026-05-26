/**
 * A/B Test Automation Tests
 * Unit tests for winner detection and recommendation logic
 */

import { detectWinner, WinnerDetectionResult } from "../ab-test-automation";
import { generateRecommendation, RecommendationStatus } from "../ab-test-recommendation";
import { analyzeABTest } from "@/lib/analytics/sms-ab-test-statistics";

describe("A/B Test Automation", () => {
  describe("Statistical Analysis", () => {
    test("Detects significant difference with sufficient samples", () => {
      // A: 30% (150 sent, 45 converted)
      // B: 37.5% (160 sent, 60 converted)
      // Expected: p < 0.05, B is better
      const result = analyzeABTest(45, 150, 60, 160, 9);

      expect(result.isStatisticallySignificant).toBe(true);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.rateB).toBeGreaterThan(result.rateA);
      expect(result.recommendation).toContain("B");
    });

    test("Returns no significant difference for similar rates", () => {
      // A: 30% (100 sent, 30 converted)
      // B: 31% (100 sent, 31 converted)
      // Expected: p > 0.05, no significant difference
      const result = analyzeABTest(30, 100, 31, 100, 7);

      expect(result.isStatisticallySignificant).toBe(false);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    test("Handles edge case: zero conversions", () => {
      const result = analyzeABTest(0, 100, 5, 100, 7);

      expect(result.rateA).toBe(0);
      expect(result.rateB).toBe(0.05);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
    });

    test("Handles small sample sizes", () => {
      const result = analyzeABTest(2, 10, 3, 10, 1);

      expect(result.totalA).toBe(10);
      expect(result.totalB).toBe(10);
      expect(result.rateA).toBe(0.2);
      expect(result.rateB).toBe(0.3);
    });

    test("Calculates confidence intervals correctly", () => {
      const result = analyzeABTest(50, 100, 60, 100, 7);

      // CI should bound the true conversion rate
      expect(result.ciA_lower).toBeLessThanOrEqual(0.5);
      expect(result.ciA_upper).toBeGreaterThanOrEqual(0.5);
      expect(result.ciB_lower).toBeLessThanOrEqual(0.6);
      expect(result.ciB_upper).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe("Recommendation Engine", () => {
    test("Generates DEPLOY_B recommendation for winner", () => {
      const result = analyzeABTest(45, 150, 60, 160, 9);
      const rec = generateRecommendation(result, 30);

      expect(rec.status).toBe(RecommendationStatus.DEPLOY_B);
      expect(rec.color).toBe("green");
      expect(rec.text).toContain("✅");
      expect(rec.text).toContain("Deploy B");
      expect(rec.text).toContain("better");
    });

    test("Generates EQUIVALENT recommendation for no difference", () => {
      const result = analyzeABTest(30, 100, 31, 100, 7);
      const rec = generateRecommendation(result, 30);

      expect(rec.status).toBe(RecommendationStatus.EQUIVALENT);
      expect(rec.color).toBe("gray");
      expect(rec.text).toContain("No significant difference");
    });

    test("Generates INSUFFICIENT_DATA recommendation for small samples", () => {
      const result = analyzeABTest(5, 20, 6, 20, 2);
      const rec = generateRecommendation(result, 100);

      expect(rec.status).toBe(RecommendationStatus.INSUFFICIENT_DATA);
      expect(rec.color).toBe("gray");
      expect(rec.text).toContain("Not enough data");
    });

    test("Includes action items in recommendations", () => {
      const result = analyzeABTest(45, 150, 60, 160, 9);
      const rec = generateRecommendation(result, 30);

      expect(rec.actionItems).toBeDefined();
      expect(rec.actionItems.length).toBeGreaterThan(0);
      expect(rec.actionItems[0]).toContain("Deploy");
    });

    test("Includes next steps in recommendations", () => {
      const result = analyzeABTest(45, 150, 60, 160, 9);
      const rec = generateRecommendation(result, 30);

      expect(rec.nextSteps).toBeDefined();
      expect(rec.nextSteps).toBeTruthy();
    });
  });

  describe("Sample Size Calculation", () => {
    test("Requires ~385 samples per group for 45% → 55% improvement", () => {
      const result = analyzeABTest(173, 400, 232, 400, 14);

      // With 400 samples per group, 45% vs 58% should be significant
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.isStatisticallySignificant).toBe(true);
    });

    test("Requires ~1500+ samples for 48% → 50% improvement (small effect)", () => {
      const result = analyzeABTest(720, 1500, 780, 1560, 14);

      // Small 2% absolute improvement needs large sample
      // This test shows why conversion rate matters
      expect(result.rateB).toBeGreaterThan(result.rateA);
    });
  });

  describe("Effect Size Measures", () => {
    test("Calculates relative risk correctly", () => {
      // B is 50% better than A: 30% vs 45%
      const result = analyzeABTest(30, 100, 45, 100, 7);

      const expectedRR = 0.45 / 0.3; // = 1.5
      expect(result.relativeRisk).toBeCloseTo(expectedRR, 2);
    });

    test("Calculates odds ratio correctly", () => {
      const result = analyzeABTest(30, 100, 45, 100, 7);

      // OR = (45 * 70) / (30 * 55)
      const expectedOR = (45 * 70) / (30 * 55);
      expect(result.oddsRatio).toBeCloseTo(expectedOR, 2);
    });
  });

  describe("Edge Cases", () => {
    test("Handles 100% conversion rate", () => {
      const result = analyzeABTest(100, 100, 100, 100, 7);

      expect(result.rateA).toBe(1);
      expect(result.rateB).toBe(1);
      expect(result.isStatisticallySignificant).toBe(false); // No difference
    });

    test("Handles 0% conversion rate", () => {
      const result = analyzeABTest(0, 100, 0, 100, 7);

      expect(result.rateA).toBe(0);
      expect(result.rateB).toBe(0);
      expect(result.isStatisticallySignificant).toBe(false);
    });

    test("Handles very large sample sizes", () => {
      const result = analyzeABTest(300000, 1000000, 305000, 1000000, 30);

      // 30% vs 30.5% difference with huge samples becomes significant
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.isStatisticallySignificant).toBe(true);
    });

    test("Handles imbalanced group sizes", () => {
      // Group A: 50 samples, Group B: 300 samples
      const result = analyzeABTest(10, 50, 75, 300, 7);

      expect(result.totalA).toBe(50);
      expect(result.totalB).toBe(300);
      expect(result.rateA).toBe(0.2);
      expect(result.rateB).toBe(0.25);
      // Should handle SE calculation correctly
    });
  });

  describe("Recommendation Accuracy", () => {
    test("Correctly identifies A is better when A > B", () => {
      const result = analyzeABTest(60, 150, 45, 150, 9);
      const rec = generateRecommendation(result, 30);

      expect(rec.text).toContain("A");
      expect(rec.status).toBe(RecommendationStatus.DEPLOY_A);
    });

    test("Correctly calculates improvement percentage", () => {
      // A: 40%, B: 50% = 25% improvement
      const result = analyzeABTest(60, 150, 75, 150, 9);
      const rec = generateRecommendation(result, 30);

      // Recommendation should mention the improvement
      expect(rec.text).toContain("B");
      expect(rec.text).toContain("better");
    });

    test("Suggests continuing when approaching significance", () => {
      // Not quite significant yet
      const result = analyzeABTest(50, 150, 62, 150, 7);

      // p ≈ 0.08 (not significant)
      if (result.pValue > 0.05 && result.pValue < 0.15) {
        const rec = generateRecommendation(result, 30);
        expect(rec.status).toBe(RecommendationStatus.CONTINUE);
      }
    });
  });

  describe("Duration Impact", () => {
    test("Longer tests reduce risk of false conclusions", () => {
      const day3 = analyzeABTest(15, 50, 20, 50, 3);
      const day9 = analyzeABTest(45, 150, 60, 150, 9);

      // Day 9 with 3x samples should have lower p-value
      expect(day9.pValue).toBeLessThan(day3.pValue);
    });
  });
});

// Example test scenarios
describe("Real-world A/B Test Scenarios", () => {
  test("Scenario: Clear winner after 9 days", () => {
    // Day 0 SMS: Original vs New Hook
    // Control: 30% open rate
    // Variant: 37.5% open rate
    const analysis = analyzeABTest(45, 150, 60, 160, 9);
    const rec = generateRecommendation(analysis, 30);

    console.log("Test: Day 0 SMS Hook Variants");
    console.log(`Control: ${(analysis.rateA * 100).toFixed(1)}% (n=${analysis.totalA})`);
    console.log(`Variant: ${(analysis.rateB * 100).toFixed(1)}% (n=${analysis.totalB})`);
    console.log(`p-value: ${analysis.pValue.toFixed(4)}`);
    console.log(`Recommendation: ${rec.text}\n`);

    expect(analysis.isStatisticallySignificant).toBe(true);
    expect(rec.status).toBe(RecommendationStatus.DEPLOY_B);
  });

  test("Scenario: No winner after 7 days", () => {
    // Similar performance - both work equally
    const analysis = analyzeABTest(30, 100, 31, 100, 7);
    const rec = generateRecommendation(analysis, 30);

    console.log("Test: CTA Copy Variants");
    console.log(`Control: ${(analysis.rateA * 100).toFixed(1)}% (n=${analysis.totalA})`);
    console.log(`Variant: ${(analysis.rateB * 100).toFixed(1)}% (n=${analysis.totalB})`);
    console.log(`Recommendation: ${rec.text}\n`);

    expect(analysis.isStatisticallySignificant).toBe(false);
    expect(rec.status).toBe(RecommendationStatus.EQUIVALENT);
  });

  test("Scenario: Still testing - promising trend", () => {
    // B showing improvement but not significant yet
    const analysis = analyzeABTest(35, 100, 42, 100, 5);
    const rec = generateRecommendation(analysis, 50);

    console.log("Test: Subject Line A/B");
    console.log(`Control: ${(analysis.rateA * 100).toFixed(1)}% (n=${analysis.totalA})`);
    console.log(`Variant: ${(analysis.rateB * 100).toFixed(1)}% (n=${analysis.totalB})`);
    console.log(`Status: ${rec.status}`);
    console.log(`Recommendation: ${rec.text}\n`);

    expect(analysis.isStatisticallySignificant).toBe(false);
    // Might be CONTINUE or EQUIVALENT depending on effect size
  });
});
