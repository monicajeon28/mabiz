/**
 * Menu #48: L2 렌즈 - 불안도 계산 유닛 테스트
 */

import {
  calculateAnxietyScore,
  getRecommendedSmsTemplate,
  getNextActions,
  validateAnxietyInputs,
  categorizeHealthConcerns,
  estimateMonthlyImpact,
  AnxietyInputs,
} from './anxiety-assessment-utils';

describe('Anxiety Assessment Utils', () => {
  describe('calculateAnxietyScore', () => {
    it('should calculate low anxiety score (<40)', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.score).toBeLessThan(40);
      expect(result.category).toBe('low');
      expect(result.preparationStage).toBe('inquiry');
    });

    it('should calculate medium anxiety score (40-79)', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 150,
        hasKids: true,
        healthConcerns: [],
        preparationComplexity: 3,
        confidenceLevel: 3,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(80);
      expect(result.category).toBe('medium');
    });

    it('should calculate high anxiety score (>=80)', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: false,
        visaRequired: true,
        passportExpiryDays: 100,
        hasKids: true,
        healthConcerns: ['배멀미', '고혈압'],
        preparationComplexity: 5,
        confidenceLevel: 1,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.category).toBe('high');
    });

    it('should correctly score visa requirement (+40)', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: true,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.breakdown.visaRequired).toBe(40);
    });

    it('should correctly score first time cruise (+20)', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: false,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.breakdown.firstTimeCruise).toBe(20);
    });

    it('should correctly score family with kids (+20)', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: true,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.breakdown.familyWithKids).toBe(20);
    });

    it('should correctly score health concerns (+15 per concern)', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: ['배멀미', '당뇨', '고혈압'],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.breakdown.healthConcerns).toBe(45); // 3 * 15
    });

    it('should correctly score passport days left', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 90, // <180
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.breakdown.passportDaysLeft).toBeGreaterThan(0);
      expect(result.breakdown.passportDaysLeft).toBeLessThanOrEqual(30);
    });

    it('should identify visa_concern preparation stage', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: true,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.preparationStage).toBe('visa_concern');
    });

    it('should identify health_concern preparation stage', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: ['배멀미'],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const result = calculateAnxietyScore(inputs);
      expect(result.preparationStage).toBe('health_concern');
    });
  });

  describe('getRecommendedSmsTemplate', () => {
    it('should recommend high_anxiety_support for high category', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const template = getRecommendedSmsTemplate('high', 'inquiry', inputs);
      expect(template).toBe('high_anxiety_support');
    });

    it('should recommend visa_passport_urgent for visa + low passport days', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: true,
        passportExpiryDays: 100,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const template = getRecommendedSmsTemplate('medium', 'visa_concern', inputs);
      expect(template).toBe('visa_passport_urgent');
    });

    it('should recommend health_concern_support for health concerns', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: ['배멀미'],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const template = getRecommendedSmsTemplate('medium', 'health_concern', inputs);
      expect(template).toBe('health_concern_support');
    });

    it('should recommend first_timer_guide for first time cruise', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: false,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 1,
        confidenceLevel: 5,
      };

      const template = getRecommendedSmsTemplate('low', 'inquiry', inputs);
      expect(template).toBe('first_timer_guide');
    });
  });

  describe('validateAnxietyInputs', () => {
    it('should validate correct inputs', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 3,
        confidenceLevel: 3,
      };

      const result = validateAnxietyInputs(inputs);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative passport days', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: -10,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 3,
        confidenceLevel: 3,
      };

      const result = validateAnxietyInputs(inputs);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('여권 유효기간은 음수일 수 없습니다');
    });

    it('should reject invalid complexity score', () => {
      const inputs: AnxietyInputs = {
        hasCruiseExperience: true,
        visaRequired: false,
        passportExpiryDays: 365,
        hasKids: false,
        healthConcerns: [],
        preparationComplexity: 10,
        confidenceLevel: 3,
      };

      const result = validateAnxietyInputs(inputs);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        '준비 복잡도는 1-5 사이의 값이어야 합니다'
      );
    });
  });

  describe('categorizeHealthConcerns', () => {
    it('should categorize motion sickness', () => {
      const result = categorizeHealthConcerns(['배멀미']);
      expect(result.motionSickness).toContain('배멀미');
    });

    it('should categorize diabetes', () => {
      const result = categorizeHealthConcerns(['당뇨']);
      expect(result.diabetes).toContain('당뇨');
    });

    it('should categorize multiple concerns', () => {
      const result = categorizeHealthConcerns(['배멀미', '당뇨', '고혈압']);
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });
  });

  describe('estimateMonthlyImpact', () => {
    it('should calculate additional bookings', () => {
      const result = estimateMonthlyImpact(100, 100, 100);
      expect(result.additionalBookings).toBeGreaterThan(0);
    });

    it('should calculate reduced cancellations', () => {
      const result = estimateMonthlyImpact(100, 100, 100);
      expect(result.reducedCancellations).toBeGreaterThan(0);
    });

    it('should calculate estimated revenue', () => {
      const result = estimateMonthlyImpact(100, 100, 100);
      expect(result.estimatedRevenue).toBeGreaterThan(0);
    });

    it('should show zero impact with no customers', () => {
      const result = estimateMonthlyImpact(0, 0, 0);
      expect(result.additionalBookings).toBe(0);
      expect(result.reducedCancellations).toBe(0);
      expect(result.estimatedRevenue).toBe(0);
    });
  });

  describe('getNextActions', () => {
    it('should return high priority actions for high anxiety', () => {
      const actions = getNextActions(85, 'high', 'visa_concern');
      expect(actions).toContain('1:1 상담사 배정 및 화상 상담 예약');
      expect(actions).toContain('Day 0 SMS: 불안도 진단 봇 시작');
    });

    it('should return medium priority actions for medium anxiety', () => {
      const actions = getNextActions(50, 'medium', 'inquiry');
      expect(actions).toContain('이메일로 준비 가이드 발송');
      expect(actions).toContain('필요시 상담 예약 가능 안내');
    });

    it('should return low priority actions for low anxiety', () => {
      const actions = getNextActions(20, 'low', 'inquiry');
      expect(actions).toContain('예약 확정 축하 메시지');
      expect(actions).toContain('기본 준비물 체크리스트 제공');
    });
  });
});
