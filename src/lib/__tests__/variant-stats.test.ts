import {
  calculateChiSquare,
  calculateCramersV,
  calculateSuccessRate,
  determineConfidenceLevel,
  generateInterpretation,
  getSampleSizeRecommendation,
} from '../variant-stats';

describe('Variant Statistics Library', () => {
  describe('calculateChiSquare()', () => {
    it('should detect significant difference (95% confidence)', () => {
      // A: 100 success, 10 failure (91% success rate)
      // B: 50 success, 50 failure (50% success rate)
      // 명백한 차이 → p < 0.05

      const result = calculateChiSquare(100, 10, 50, 50);
      expect(result.chi2).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.isSignificant).toBe(true);
      expect(result.degreesOfFreedom).toBe(1);
    });

    it('should not detect difference when rates are similar', () => {
      // A: 50 success, 50 failure (50%)
      // B: 52 success, 48 failure (52%)
      // 차이 미미 → p > 0.05

      const result = calculateChiSquare(50, 50, 52, 48);
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.isSignificant).toBe(false);
    });

    it('should handle perfect separation (100% vs 0%)', () => {
      const result = calculateChiSquare(100, 0, 0, 100);
      expect(result.chi2).toBeGreaterThan(50);
      expect(result.isSignificant).toBe(true);
    });

    it('should handle zero samples gracefully', () => {
      const result = calculateChiSquare(0, 0, 10, 10);
      expect(result.chi2).toBeDefined();
      expect(result.pValue).toBeDefined();
      expect(result.degreesOfFreedom).toBe(1);
    });

    it('should be symmetric (order independent)', () => {
      const result1 = calculateChiSquare(100, 20, 60, 40);
      const result2 = calculateChiSquare(60, 40, 100, 20);

      // Chi-square는 대칭
      expect(result1.chi2).toBeCloseTo(result2.chi2);
      expect(result1.isSignificant).toBe(result2.isSignificant);
    });

    it('should return exactly 4 decimal places', () => {
      const result = calculateChiSquare(85, 15, 70, 30);
      expect(result.chi2.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
      expect(result.pValue.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
    });
  });

  describe('calculateCramersV()', () => {
    it('should return 0 for identical distributions', () => {
      const v = calculateCramersV(50, 50, 50, 50);
      expect(v).toBeCloseTo(0, 2);
    });

    it('should return greater than 0 for different distributions', () => {
      const v = calculateCramersV(100, 0, 50, 50);
      expect(v).toBeGreaterThan(0);
    });

    it('should be between 0 and 1', () => {
      const v = calculateCramersV(90, 10, 60, 40);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });

    it('should scale with effect size', () => {
      // 작은 차이
      const smallEffect = calculateCramersV(55, 45, 50, 50);
      // 큰 차이
      const largeEffect = calculateCramersV(100, 0, 50, 50);

      expect(largeEffect).toBeGreaterThan(smallEffect);
    });

    it('should be symmetric', () => {
      const v1 = calculateCramersV(100, 20, 60, 40);
      const v2 = calculateCramersV(60, 40, 100, 20);

      expect(v1).toBeCloseTo(v2);
    });

    it('should return 4 decimal places', () => {
      const v = calculateCramersV(85, 15, 70, 30);
      expect(v.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
    });
  });

  describe('calculateSuccessRate()', () => {
    it('should calculate correct rate', () => {
      expect(calculateSuccessRate(80, 100)).toBe(0.8);
      expect(calculateSuccessRate(0, 100)).toBe(0);
      expect(calculateSuccessRate(100, 100)).toBe(1);
    });

    it('should handle zero total', () => {
      expect(calculateSuccessRate(0, 0)).toBe(0);
    });

    it('should return 4 decimal places', () => {
      const rate = calculateSuccessRate(333, 1000);
      expect(rate.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
    });
  });

  describe('determineConfidenceLevel()', () => {
    it('should return LOW when not significant', () => {
      const confidence = determineConfidenceLevel(false, 0.2);
      expect(confidence).toBe('LOW');
    });

    it('should return HIGH when significant with large effect', () => {
      const confidence = determineConfidenceLevel(true, 0.4);
      expect(confidence).toBe('HIGH');
    });

    it('should return MEDIUM when significant with small effect', () => {
      const confidence = determineConfidenceLevel(true, 0.15);
      expect(confidence).toBe('MEDIUM');
    });

    it('should return HIGH at boundary (V=0.3)', () => {
      const confidence = determineConfidenceLevel(true, 0.3);
      expect(confidence).toBe('HIGH');
    });
  });

  describe('generateInterpretation()', () => {
    it('should generate interpretation for significant A win', () => {
      const text = generateInterpretation('A', true, 0.001, 'HIGH');
      expect(text).toContain('A');
      expect(text).toContain('유의미');
      expect(text).toContain('0.001');
    });

    it('should generate interpretation for non-significant', () => {
      const text = generateInterpretation(null, false, 0.5, 'LOW');
      expect(text).toContain('의미 있는 차이가 없습니다');
      expect(text).toContain('샘플');
    });

    it('should include confidence level', () => {
      const textHigh = generateInterpretation('A', true, 0.001, 'HIGH');
      const textMed = generateInterpretation('A', true, 0.01, 'MEDIUM');

      expect(textHigh).toContain('높은');
      expect(textMed).toContain('중간');
    });
  });

  describe('getSampleSizeRecommendation()', () => {
    it('should warn for very small samples', () => {
      const rec = getSampleSizeRecommendation(20, 25);
      expect(rec).toContain('매우 낮');
      expect(rec).toContain('30');
    });

    it('should recommend 100 for medium samples', () => {
      const rec = getSampleSizeRecommendation(50, 60);
      expect(rec).toContain('100');
    });

    it('should recommend 500 for good samples', () => {
      const rec = getSampleSizeRecommendation(200, 250);
      expect(rec).toContain('500');
    });

    it('should return null for large samples', () => {
      const rec = getSampleSizeRecommendation(600, 700);
      expect(rec).toBeNull();
    });

    it('should use minimum sample size', () => {
      const rec = getSampleSizeRecommendation(10, 1000);
      expect(rec).toContain('매우 낮');  // Uses min (10)
    });
  });

  describe('Integration: A/B Test Scenarios', () => {
    it('Scenario 1: A 명백히 우수 (85% vs 50%)', () => {
      const result = calculateChiSquare(85, 15, 50, 50);
      expect(result.isSignificant).toBe(true);
      expect(result.chi2).toBeGreaterThan(10);
    });

    it('Scenario 2: 완전히 동등 (50% vs 50%)', () => {
      const result = calculateChiSquare(500, 500, 500, 500);
      expect(result.isSignificant).toBe(false);
      expect(result.chi2).toBeCloseTo(0, 1);
    });

    it('Scenario 3: 샘플 부족 (10명씩)', () => {
      const result = calculateChiSquare(9, 1, 7, 3);
      // 통계적으로 의미 있더라도 신뢰도 낮음
      expect(result.degreesOfFreedom).toBe(1);
      expect(typeof result.chi2).toBe('number');
    });

    it('Scenario 4: 대규모 샘플 (1000명씩)', () => {
      const result = calculateChiSquare(510, 490, 480, 520);
      const confidence = determineConfidenceLevel(result.isSignificant, calculateCramersV(510, 490, 480, 520));
      expect(confidence).toBeDefined();
    });

    it('Scenario 5: End-to-end 전체 분석', () => {
      // A: 850명 성공, 150명 실패 (85%)
      // B: 700명 성공, 300명 실패 (70%)

      const successRateA = calculateSuccessRate(850, 1000);
      const successRateB = calculateSuccessRate(700, 1000);

      expect(successRateA).toBe(0.85);
      expect(successRateB).toBe(0.7);

      const chi2Result = calculateChiSquare(850, 150, 700, 300);
      const cramersV = calculateCramersV(850, 150, 700, 300);
      const confidence = determineConfidenceLevel(chi2Result.isSignificant, cramersV);

      const recommendation = successRateA > successRateB ? 'A' : 'B';
      const interpretation = generateInterpretation(recommendation, chi2Result.isSignificant, chi2Result.pValue, confidence);
      const sampleRec = getSampleSizeRecommendation(1000, 1000);

      expect(chi2Result.isSignificant).toBe(true);
      expect(recommendation).toBe('A');
      // Cramer's V ≈ 0.12이므로 MEDIUM (0.1 ~ 0.3 범위)
      expect(confidence).toBe('MEDIUM');
      expect(interpretation).toContain('A');
      expect(sampleRec).toBeNull();  // 충분한 샘플
    });
  });

  describe('Edge Cases', () => {
    it('should handle single success', () => {
      const result = calculateChiSquare(1, 99, 0, 100);
      expect(result.chi2).toBeGreaterThan(0);
    });

    it('should handle floating point precision', () => {
      const result = calculateChiSquare(1, 1, 1, 1);
      expect(result.chi2).toBeDefined();
      expect(result.pValue).toBeDefined();
    });

    it('should handle large numbers', () => {
      const result = calculateChiSquare(100000, 10000, 50000, 50000);
      expect(result.chi2).toBeGreaterThan(0);
      expect(result.isSignificant).toBe(true);
    });
  });
});
