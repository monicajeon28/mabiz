/**
 * Menu #48: L2 렌즈 - 준비 불안도 계산 유틸리티
 *
 * 불안도 평가 알고리즘 (0-125점)
 * - visa_required: +40
 * - passport_days_left: +0-30 (180일 미만)
 * - first_time_cruise: +20
 * - family_with_kids: +20
 * - health_concerns: +15/항목
 * - preparation_complexity: 복잡도 × 5 (max 25)
 * - confidence_gap: (5 - confidence) × 8 (max 32)
 */

export interface AnxietyInputs {
  hasCruiseExperience: boolean;
  visaRequired: boolean;
  passportExpiryDays: number;
  hasKids: boolean;
  healthConcerns: string[]; // 배멀미, 당뇨, 고혈압 등
  preparationComplexity: number; // 1-5
  confidenceLevel: number; // 1-5
}

export interface AnxietyResult {
  score: number; // 0-125
  category: 'low' | 'medium' | 'high';
  preparationStage: string;
  breakdown: {
    visaRequired: number;
    passportDaysLeft: number;
    firstTimeCruise: number;
    familyWithKids: number;
    healthConcerns: number;
    preparationComplexity: number;
    confidenceGap: number;
  };
  interpretations: string[];
}

/**
 * 불안도 점수 계산
 */
export function calculateAnxietyScore(inputs: AnxietyInputs): AnxietyResult {
  let score = 0;
  const breakdown = {
    visaRequired: 0,
    passportDaysLeft: 0,
    firstTimeCruise: 0,
    familyWithKids: 0,
    healthConcerns: 0,
    preparationComplexity: 0,
    confidenceGap: 0,
  };

  // 1. 비자 필요 (+40)
  if (inputs.visaRequired) {
    score += 40;
    breakdown.visaRequired = 40;
  }

  // 2. 여권 유효기간 (+0-30)
  if (inputs.passportExpiryDays < 180) {
    const daysScore = Math.max(0, 30 - (inputs.passportExpiryDays / 6));
    score += daysScore;
    breakdown.passportDaysLeft = Math.ceil(daysScore);
  }

  // 3. 첫 크루즈 여행 (+20)
  if (!inputs.hasCruiseExperience) {
    score += 20;
    breakdown.firstTimeCruise = 20;
  }

  // 4. 자녀 동반 (+20)
  if (inputs.hasKids) {
    score += 20;
    breakdown.familyWithKids = 20;
  }

  // 5. 건강 관련 우려 (+15 per concern)
  if (inputs.healthConcerns && inputs.healthConcerns.length > 0) {
    const healthScore = inputs.healthConcerns.length * 15;
    score += healthScore;
    breakdown.healthConcerns = healthScore;
  }

  // 6. 준비 복잡도 점수 (복잡도 × 5, max 25)
  const complexityScore = Math.min(inputs.preparationComplexity * 5, 25);
  score += complexityScore;
  breakdown.preparationComplexity = complexityScore;

  // 7. 자신감 격차 점수 ((5 - confidence) × 8, max 32)
  const confidenceScore = Math.max(0, (5 - inputs.confidenceLevel) * 8);
  score += confidenceScore;
  breakdown.confidenceGap = confidenceScore;

  // 불안도 분류
  let category: 'low' | 'medium' | 'high';
  if (score >= 80) {
    category = 'high';
  } else if (score >= 40) {
    category = 'medium';
  } else {
    category = 'low';
  }

  // 준비 단계 파악
  let preparationStage = 'inquiry';
  if (inputs.visaRequired) preparationStage = 'visa_concern';
  if (inputs.healthConcerns?.length > 0) preparationStage = 'health_concern';
  if (inputs.passportExpiryDays < 180) preparationStage = 'passport_concern';
  if (score < 20) preparationStage = 'ready';

  // 해석
  const interpretations = generateInterpretations(score, category, inputs);

  return {
    score: Math.ceil(score),
    category,
    preparationStage,
    breakdown,
    interpretations,
  };
}

/**
 * 불안도 해석 및 추천사항 생성
 */
function generateInterpretations(
  score: number,
  category: 'low' | 'medium' | 'high',
  inputs: AnxietyInputs
): string[] {
  const interpretations: string[] = [];

  if (category === 'high') {
    interpretations.push('🔴 높은 불안도: 1:1 상담사 배정 권장');
    interpretations.push('Day 0-3 집중 SMS 시퀀스 필요');
  } else if (category === 'medium') {
    interpretations.push('🟡 중간 불안도: 이메일 + 가이드 자료로 충분');
    interpretations.push('필요시 상담 예약 가능');
  } else {
    interpretations.push('🟢 낮은 불안도: 기본 체크리스트로 충분');
    interpretations.push('자신감 있게 크루즈 준비');
  }

  // 세부 권장사항
  if (inputs.visaRequired) {
    if (inputs.passportExpiryDays < 90) {
      interpretations.push('⚠️ 급한 일정: 비자 신청 + 여권 갱신 동시 진행');
    } else {
      interpretations.push('비자 신청부터 시작 (소요: 평균 14일)');
    }
  }

  if (inputs.healthConcerns?.includes('배멀미')) {
    interpretations.push('선내 배멀미 관리 전문 가이드 제공');
  }

  if (inputs.healthConcerns?.includes('당뇨') || inputs.healthConcerns?.includes('고혈압')) {
    interpretations.push('의료진 사전 상담 권장');
  }

  if (!inputs.hasCruiseExperience) {
    interpretations.push('첫 탑승자 가이드 + 선배 영상 공유');
  }

  if (inputs.hasKids) {
    interpretations.push('가족 동반 팁 + 키즈 프로그램 안내');
  }

  return interpretations;
}

/**
 * 안주도별 권장 SMS 템플릿
 */
export function getRecommendedSmsTemplate(
  category: 'low' | 'medium' | 'high',
  preparationStage: string,
  inputs: AnxietyInputs
): string {
  if (category === 'high') {
    return 'high_anxiety_support';
  }

  if (inputs.visaRequired && inputs.passportExpiryDays < 180) {
    return 'visa_passport_urgent';
  }

  if (inputs.healthConcerns?.length > 0) {
    return 'health_concern_support';
  }

  if (!inputs.hasCruiseExperience) {
    return 'first_timer_guide';
  }

  return 'default';
}

/**
 * 점수별 다음 액션 추천
 */
export function getNextActions(
  score: number,
  category: 'low' | 'medium' | 'high',
  preparationStage: string
): string[] {
  const actions: string[] = [];

  if (category === 'high') {
    actions.push('1:1 상담사 배정 및 화상 상담 예약');
    actions.push('Day 0 SMS: 불안도 진단 봇 시작');
    actions.push('Day 1 SMS: 세그먼트별 가이드 PDF 발송');
    actions.push('Day 2 SMS: 선배 탑승자 후기 영상');
    actions.push('Day 3 SMS: 최종 확정 + 상담 마감');
  } else if (category === 'medium') {
    actions.push('이메일로 준비 가이드 발송');
    actions.push('FAQ 및 자료실 링크 제공');
    actions.push('필요시 상담 예약 가능 안내');
    actions.push('Day 1 SMS: 기본 준비물 체크리스트');
  } else {
    actions.push('예약 확정 축하 메시지');
    actions.push('기본 준비물 체크리스트 제공');
    actions.push('탑승 72시간 전 최종 안내');
  }

  return actions;
}

/**
 * 불안도 점수 범위 검증
 */
export function validateAnxietyInputs(inputs: AnxietyInputs): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (inputs.passportExpiryDays < 0) {
    errors.push('여권 유효기간은 음수일 수 없습니다');
  }

  if (inputs.preparationComplexity < 1 || inputs.preparationComplexity > 5) {
    errors.push('준비 복잡도는 1-5 사이의 값이어야 합니다');
  }

  if (inputs.confidenceLevel < 1 || inputs.confidenceLevel > 5) {
    errors.push('자신감 수준은 1-5 사이의 값이어야 합니다');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 건강 관련 우려사항을 카테고리별로 분류
 */
export function categorizeHealthConcerns(
  concerns: string[]
): Record<string, string[]> {
  const categories = {
    motionSickness: ['배멀미', 'motion sickness'],
    diabetes: ['당뇨', 'diabetes'],
    hypertension: ['고혈압', 'hypertension'],
    respiratory: ['천식', 'asthma'],
    cardiac: ['심장', 'heart'],
    gastrointestinal: ['소화', 'digestive'],
  };

  const result: Record<string, string[]> = {};

  concerns.forEach((concern) => {
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => concern.toLowerCase().includes(kw.toLowerCase()))) {
        if (!result[category]) {
          result[category] = [];
        }
        result[category].push(concern);
      }
    }
  });

  return result;
}

/**
 * 불안도별 예상 전환율 계산
 */
export function estimatedConversionRate(
  category: 'low' | 'medium' | 'high'
): { current: number; target: number; improvement: number } {
  const rates = {
    low: { current: 65, target: 82 },
    medium: { current: 42, target: 68 },
    high: { current: 25, target: 75 },
  };

  const { current, target } = rates[category];
  return {
    current,
    target,
    improvement: target - current,
  };
}

/**
 * 월별 예상 효과 계산
 */
export function estimateMonthlyImpact(
  highAnxietyCount: number,
  mediumAnxietyCount: number,
  lowAnxietyCount: number
): {
  additionalBookings: number;
  reducedCancellations: number;
  estimatedRevenue: number;
} {
  const high = estimatedConversionRate('high');
  const medium = estimatedConversionRate('medium');
  const low = estimatedConversionRate('low');

  // 추가 예약
  const highAdditional = Math.round(
    highAnxietyCount * ((high.target - high.current) / 100)
  );
  const mediumAdditional = Math.round(
    mediumAnxietyCount * ((medium.target - medium.current) / 100)
  );
  const lowAdditional = Math.round(
    lowAnxietyCount * ((low.target - low.current) / 100)
  );

  const additionalBookings = highAdditional + mediumAdditional + lowAdditional;

  // 환불/취소 감소 (불안도 해소로 인한 -15%)
  const reducedCancellations = Math.round(
    (highAnxietyCount + mediumAnxietyCount) * 0.15
  );

  // 예상 매출 (평균 객실료 $3000)
  const estimatedRevenue = (additionalBookings + reducedCancellations) * 3000;

  return {
    additionalBookings,
    reducedCancellations,
    estimatedRevenue,
  };
}
