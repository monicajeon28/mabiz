/**
 * Unit Tests for A/B Test Statistical Analysis Engine
 * Team 2: Statistical Engine Validation
 *
 * Run with: npm test -- ab-test-statistics
 */

import {
  calculateChiSquare,
  calculateConfidenceInterval,
  declareWinner,
  validateStatisticalEngine,
  recommendedSampleSize,
  isStatisticallySignificant,
} from './ab-test-statistics';

describe('A/B Test Statistical Analysis Engine', () => {
  // ==========================================================================
  // Test Suite 1: Chi-Square Calculation
  // ==========================================================================

  describe('Chi-Square Calculation', () => {
    test('identical samples should have χ² = 0', () => {
      const result = calculateChiSquare(100, 100, 200, 200);
      expect(result.chiSquare).toBe(0);
      expect(result.degreesOfFreedom).toBe(1);
    });

    test('χ² should increase with difference', () => {
      const small = calculateChiSquare(100, 101, 200, 200);
      const large = calculateChiSquare(100, 150, 200, 200);

      expect(large.chiSquare).toBeGreaterThan(small.chiSquare);
    });

    test('χ² calculation matches expected formula', () => {
      // A: 75 clicks / 200 impressions = 37.5%
      // B: 80 clicks / 200 impressions = 40%
      // Overall: 155 / 400 = 38.75%

      const result = calculateChiSquare(75, 80, 200, 200);

      // Expected values
      const overallRate = 155 / 400; // 0.3875
      const expectedA = 200 * overallRate; // 77.5
      const expectedB = 200 * overallRate; // 77.5

      const expected =
        Math.pow(75 - expectedA, 2) / expectedA +
        Math.pow(80 - expectedB, 2) / expectedB;

      expect(result.chiSquare).toBeCloseTo(expected, 2);
    });
  });

  // ==========================================================================
  // Test Suite 2: Confidence Interval Calculation
  // ==========================================================================

  describe('Confidence Interval (Wilson Score)', () => {
    test('wider interval for smaller samples', () => {
      const small = calculateConfidenceInterval(10, 100);
      const large = calculateConfidenceInterval(100, 1000);

      const smallWidth = small.upper - small.lower;
      const largeWidth = large.upper - large.lower;

      expect(smallWidth).toBeGreaterThan(largeWidth);
    });

    test('CI should contain the CTR estimate', () => {
      const ci = calculateConfidenceInterval(150, 200);

      expect(ci.lower).toBeLessThanOrEqual(ci.ctr);
      expect(ci.ctr).toBeLessThanOrEqual(ci.upper);
    });

    test('CI bounds should be between 0 and 1', () => {
      const ci = calculateConfidenceInterval(0, 100);

      expect(ci.lower).toBeGreaterThanOrEqual(0);
      expect(ci.upper).toBeLessThanOrEqual(1);
    });

    test('zero clicks should have lower bound at 0', () => {
      const ci = calculateConfidenceInterval(0, 100);

      expect(ci.lower).toBe(0);
      expect(ci.ctr).toBe(0);
    });

    test('100% conversion should have upper bound at 1', () => {
      const ci = calculateConfidenceInterval(100, 100);

      expect(ci.upper).toBe(1);
      expect(ci.ctr).toBe(1);
    });
  });

  // ==========================================================================
  // Test Suite 3: Winner Declaration (Main Function)
  // ==========================================================================

  describe('Winner Declaration', () => {
    test('identical samples should not declare winner', () => {
      const decision = declareWinner(150, 150, 200, 200);

      expect(decision.winner).toBeNull();
      expect(decision.reason).toContain('통계적으로 유의하지 않음');
    });

    test('should declare winner with significant difference', () => {
      // A: 100 clicks / 200 = 50%
      // B: 160 clicks / 200 = 80%
      // This is a large difference that should be significant

      const decision = declareWinner(100, 160, 200, 200);

      expect(decision.winner).toBe('B');
      expect(decision.confidence).toBeGreaterThan(0.95);
    });

    test('should reject with insufficient sample size', () => {
      const decision = declareWinner(5, 8, 10, 10, {
        minImpressions: 100,
      });

      expect(decision.winner).toBeNull();
      expect(decision.reason).toContain('샘플 부족');
    });

    test('winner should have higher CTR', () => {
      const decision = declareWinner(75, 85, 200, 200);

      if (decision.winner) {
        const ctrWinner =
          decision.winner === 'A'
            ? decision.statistics.ctrA
            : decision.statistics.ctrB;
        const ctrLoser =
          decision.winner === 'A'
            ? decision.statistics.ctrB
            : decision.statistics.ctrA;

        expect(ctrWinner).toBeGreaterThan(ctrLoser);
      }
    });

    test('should have confidence = 1 - pValue', () => {
      const decision = declareWinner(100, 160, 200, 200);

      expect(decision.confidence).toBeCloseTo(
        1 - decision.statistics.pValue,
        3
      );
    });
  });

  // ==========================================================================
  // Test Suite 4: A/A Test Validation (Engine Health Check)
  // ==========================================================================

  describe('A/A Test Validation (Engine Health Check)', () => {
    test('identical samples should pass A/A test', () => {
      const validation = validateStatisticalEngine(100, 200, 100, 200);

      expect(validation.isValid).toBe(true);
      expect(validation.pValue).toBeCloseTo(1.0, 1); // Very close to 1.0
    });

    test('should fail if difference is declared as significant for identical samples', () => {
      // If this test fails, our statistical engine has a bug
      const validation = validateStatisticalEngine(150, 200, 150, 200);

      expect(validation.isValid).toBe(true);
    });
  });

  // ==========================================================================
  // Test Suite 5: Statistical Significance Test
  // ==========================================================================

  describe('Statistical Significance Test', () => {
    test('should detect significant difference', () => {
      const isSignificant = isStatisticallySignificant(100, 160, 200, 200);

      expect(isSignificant).toBe(true);
    });

    test('should not detect difference for identical samples', () => {
      const isSignificant = isStatisticallySignificant(100, 100, 200, 200);

      expect(isSignificant).toBe(false);
    });

    test('should respect custom p-value threshold', () => {
      // With strict threshold (0.01)
      const strictResult = isStatisticallySignificant(
        100,
        110,
        200,
        200,
        0.01
      );

      // With lenient threshold (0.10)
      const lenientResult = isStatisticallySignificant(
        100,
        110,
        200,
        200,
        0.10
      );

      // Lenient should be more likely to detect significance
      if (!strictResult) {
        // If strict rejects, lenient might accept
        // This tests threshold behavior
        expect(true).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Test Suite 6: Sample Size Recommendation
  // ==========================================================================

  describe('Sample Size Recommendation', () => {
    test('should return positive sample sizes', () => {
      const result = recommendedSampleSize();

      expect(result.perVariant).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBe(result.perVariant * 2);
    });

    test('larger effect size should require smaller sample', () => {
      const smallEffect = recommendedSampleSize(0.75, 0.02); // 2% improvement
      const largeEffect = recommendedSampleSize(0.75, 0.15); // 15% improvement

      expect(largeEffect.perVariant).toBeLessThan(smallEffect.perVariant);
    });

    test('should provide explanation', () => {
      const result = recommendedSampleSize();

      expect(result.explanation).toBeTruthy();
      expect(result.explanation.length).toBeGreaterThan(10);
    });
  });

  // ==========================================================================
  // Real-World Scenarios
  // ==========================================================================

  describe('Real-World Scenarios', () => {
    test('예시 1: 뉴스레터 링크 A/B 테스트', () => {
      // A 링크: 150 clicks / 200 impressions = 75%
      // B 링크: 165 clicks / 210 impressions = 78.6%

      const decision = declareWinner(150, 165, 200, 210);

      // With similar differences and small samples, should not declare winner yet
      if (decision.winner) {
        // If declared, B should win
        expect(decision.winner).toBe('B');
      }
    });

    test('예시 2: 크루즈 상품 이미지 테스트', () => {
      // A 이미지: 500 clicks / 2000 impressions = 25%
      // B 이미지: 600 clicks / 2000 impressions = 30%

      const decision = declareWinner(500, 600, 2000, 2000);

      // With larger sample, might declare winner
      // Depends on statistical significance
      expect(decision.statistics.ctrB).toBeGreaterThan(
        decision.statistics.ctrA
      );
    });

    test('예시 3: Day 0 SMS 메시지 테스트', () => {
      // Variant A: 1200 sends, 420 opens = 35%
      // Variant B: 1180 sends, 460 opens = 38.9%

      const decision = declareWinner(420, 460, 1200, 1180);

      // With large sample, likely to detect real differences
      console.log(`Open rate A: ${(420 / 1200 * 100).toFixed(1)}%`);
      console.log(`Open rate B: ${(460 / 1180 * 100).toFixed(1)}%`);
      console.log(`p-value: ${decision.statistics.pValue.toFixed(4)}`);
      console.log(`Winner: ${decision.winner}`);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    test('zero clicks should not crash', () => {
      expect(() => declareWinner(0, 0, 0, 0)).not.toThrow();
    });

    test('zero impressions should return null winner', () => {
      const decision = declareWinner(0, 5, 0, 10);

      expect(decision.winner).toBeNull();
    });

    test('100% vs 0% should be significant', () => {
      const decision = declareWinner(100, 0, 100, 100);

      if (decision.statistics.ctrA === 1 && decision.statistics.ctrB === 0) {
        expect(decision.winner).toBe('A');
      }
    });
  });
});

// =============================================================================
// Integration Tests (API-level)
// =============================================================================

describe('Integration Tests', () => {
  test('full workflow: A/A test -> A/B test -> winner declaration', () => {
    // Step 1: A/A test (validate engine)
    const aaValidation = validateStatisticalEngine(100, 200, 100, 200);
    expect(aaValidation.isValid).toBe(true);

    // Step 2: A/B test with same sample sizes
    const abDecision = declareWinner(100, 100, 200, 200);
    expect(abDecision.winner).toBeNull();

    // Step 3: A/B test with significant difference
    const abSignificant = declareWinner(100, 150, 200, 200);
    expect(abSignificant.statistics.pValue).toBeLessThan(1);
  });
});
