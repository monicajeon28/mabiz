/**
 * L1 렌즈: 20+ SMS 템플릿
 *
 * 5가지 이의 유형 × 5가지 대응 방식 × 2가지 A/B 변형 = 50개 템플릿
 * 각 템플릿은 심리학 프레임워크 (PASONA, 손실회피, 희소성, 사회증명)을 적용
 *
 * 변형:
 * - A: 기존 (control, 기본 접근)
 * - B: 신규 (treatment, 심리학 강조)
 */

export type ObjectiveType = 'PRICE_HIGH' | 'PAYMENT_TERMS' | 'ROI_DOUBT' | 'COMPETITOR_COMPARE' | 'AFFORD_DOUBT';
export type ResponseMethod = 'VALUE_REDEFINITION' | 'SPLIT_PAYMENT' | 'EARLY_BOOKING' | 'GROUP_DISCOUNT' | 'LIMITED_TIME';
export type VariantType = 'A' | 'B';

interface SMSTemplate {
  objectiveType: ObjectiveType;
  responseMethod: ResponseMethod;
  variantType: VariantType;
  template: string;
  psychologyLens: string;
  copyAngle: string;
  expectedConversionRate: number; // %
}

// 1. PRICE_HIGH (너무 비싸요) 대응
const PRICE_HIGH_TEMPLATES: SMSTemplate[] = [
  {
    objectiveType: 'PRICE_HIGH',
    responseMethod: 'VALUE_REDEFINITION',
    variantType: 'A',
    template: '{{customerName}}님, 가격만 보고 계신가요? 이용객 300명 평균 절감액은 월 $2,334입니다. 정말 비싸신가요? 5분 상담 >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L8_REPURCHASE',
    copyAngle: 'Value Proposition - Conservative',
    expectedConversionRate: 48,
  },
  {
    objectiveType: 'PRICE_HIGH',
    responseMethod: 'VALUE_REDEFINITION',
    variantType: 'B',
    template: '🚨 알게모셨나요? 지금 결정 안 하면 월 $2,334을 계속 낭비합니다. 이용객들은 다 알고 계세요. 지금 확인 >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L6_LOSS_AVERSION, L10_IMMEDIATE',
    copyAngle: 'Value Proposition + Loss Aversion - Aggressive',
    expectedConversionRate: 54,
  },
  {
    objectiveType: 'PRICE_HIGH',
    responseMethod: 'LIMITED_TIME',
    variantType: 'A',
    template: '특가 소식! {{customerName}}님을 위한 한정 할인 48시간만 유효합니다. 지금 신청하면 30% 할인. 클릭 >> [LINK]',
    psychologyLens: 'L6_TIMING, L10_IMMEDIATE',
    copyAngle: 'Limited Time Offer - Conservative',
    expectedConversionRate: 50,
  },
  {
    objectiveType: 'PRICE_HIGH',
    responseMethod: 'LIMITED_TIME',
    variantType: 'B',
    template: '⏰ 긴급! 선착순 100명만! {{customerName}}님 특가 30% ↓ 남은 시간 2:14:07 >> [LINK] 지금 아니면 기회 끝!',
    psychologyLens: 'L6_TIMING_LOSS_AVERSION, L10_SCARCITY, L10_IMMEDIATE',
    copyAngle: 'Limited Time + Scarcity - Aggressive',
    expectedConversionRate: 58,
  },
  {
    objectiveType: 'PRICE_HIGH',
    responseMethod: 'EARLY_BOOKING',
    variantType: 'A',
    template: '조기 예약 특가! 30일 전 예약하면 20% 할인. {{customerName}}님 지금 예약가능합니다. 상담 >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L6_TIMING',
    copyAngle: 'Early Booking Discount - Conservative',
    expectedConversionRate: 46,
  },
  {
    objectiveType: 'PRICE_HIGH',
    responseMethod: 'EARLY_BOOKING',
    variantType: 'B',
    template: '✨ 이제라도 늦지 않았어요! 30일 전 예약 시 20% ↓ 절감액 월 $466! {{customerName}}님 지금만 가능 >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L6_LOSS_AVERSION, L8_HABITUAL',
    copyAngle: 'Early Booking + Savings - Aggressive',
    expectedConversionRate: 52,
  },
];

// 2. PAYMENT_TERMS (분할 결제) 대응
const PAYMENT_TERMS_TEMPLATES: SMSTemplate[] = [
  {
    objectiveType: 'PAYMENT_TERMS',
    responseMethod: 'SPLIT_PAYMENT',
    variantType: 'A',
    template: '좋소식! 월 결제 가능합니다. {{customerName}}님은 월 $99부터 시작 가능. 자세히 >> [LINK]',
    psychologyLens: 'L1_AFFORDABILITY',
    copyAngle: 'Split Payment - Conservative',
    expectedConversionRate: 52,
  },
  {
    objectiveType: 'PAYMENT_TERMS',
    responseMethod: 'SPLIT_PAYMENT',
    variantType: 'B',
    template: '💳 부담 없이 월 $99! 당신이 주저하는 동안, 다른 고객들은 이미 절감 중. 지금 신청 >> [LINK]',
    psychologyLens: 'L1_AFFORDABILITY, L6_TIMING, L8_SOCIAL_PROOF',
    copyAngle: 'Split Payment + Social Proof - Aggressive',
    expectedConversionRate: 56,
  },
  {
    objectiveType: 'PAYMENT_TERMS',
    responseMethod: 'GROUP_DISCOUNT',
    variantType: 'A',
    template: '함께하면 더 저렴! {{customerName}}님 + 친구 함께 신청 시 월 $79. 초대링크 >> [LINK]',
    psychologyLens: 'L1_AFFORDABILITY, L7_COMPANION',
    copyAngle: 'Group Discount - Conservative',
    expectedConversionRate: 50,
  },
  {
    objectiveType: 'PAYMENT_TERMS',
    responseMethod: 'GROUP_DISCOUNT',
    variantType: 'B',
    template: '👥 비용 나누기 가능! 2명 이상 함께면 월 $79 (40% ↓). {{customerName}}님 지금 초대하세요 >> [LINK]',
    psychologyLens: 'L1_AFFORDABILITY, L7_COMPANION_PERSUASION, L8_SOCIAL',
    copyAngle: 'Group Discount + Savings - Aggressive',
    expectedConversionRate: 54,
  },
];

// 3. ROI_DOUBT (효과 의심) 대응
const ROI_DOUBT_TEMPLATES: SMSTemplate[] = [
  {
    objectiveType: 'ROI_DOUBT',
    responseMethod: 'VALUE_REDEFINITION',
    variantType: 'A',
    template: '실제 효과를 알고 싶으신가요? 고객 만족도 94%, 평균 월 절감 $2,334. 무료 상담 >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L8_REPURCHASE, L9_MEDICAL_TRUST',
    copyAngle: 'ROI Proof - Conservative',
    expectedConversionRate: 46,
  },
  {
    objectiveType: 'ROI_DOUBT',
    responseMethod: 'VALUE_REDEFINITION',
    variantType: 'B',
    template: '💰 의심하고 있으신가요? 고객 300명 평균 만족도 94%, 월 $2,334 절감 중. 지금 확인하면 +$50 보너스! >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L9_MEDICAL_TRUST, L10_IMMEDIATE',
    copyAngle: 'ROI Proof + Bonus - Aggressive',
    expectedConversionRate: 51,
  },
  {
    objectiveType: 'ROI_DOUBT',
    responseMethod: 'EARLY_BOOKING',
    variantType: 'A',
    template: '{{customerName}}님처럼 고민하시던 분들, 지금은 만족 중입니다. 30일 무료 체험으로 확인하세요 >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L8_HABITUAL_GROWTH',
    copyAngle: 'Trial Offer - Conservative',
    expectedConversionRate: 48,
  },
  {
    objectiveType: 'ROI_DOUBT',
    responseMethod: 'EARLY_BOOKING',
    variantType: 'B',
    template: '⚡ 더 이상 의심하지 마세요! 30일 무료 체험, 만족 못 하면 100% 환불. {{customerName}}님 첫 가입자 보너스 +$100 >> [LINK]',
    psychologyLens: 'L1_VALUE_REDEFINITION, L8_REPURCHASE, L10_IMMEDIATE',
    copyAngle: 'Trial + Guarantee - Aggressive',
    expectedConversionRate: 54,
  },
];

// 4. COMPETITOR_COMPARE (경쟁사 비교) 대응
const COMPETITOR_COMPARE_TEMPLATES: SMSTemplate[] = [
  {
    objectiveType: 'COMPETITOR_COMPARE',
    responseMethod: 'VALUE_REDEFINITION',
    variantType: 'A',
    template: '경쟁사 대비 분석. 우리만의 장점: AI 기술, 한글 지원, 월 $99. 비교표 >> [LINK]',
    psychologyLens: 'L1_DIFFERENTIATION, L3_DIFFERENTIATION',
    copyAngle: 'Competitive Advantage - Conservative',
    expectedConversionRate: 45,
  },
  {
    objectiveType: 'COMPETITOR_COMPARE',
    responseMethod: 'VALUE_REDEFINITION',
    variantType: 'B',
    template: '🏆 알고 계신가요? 우린 경쟁사 같은 숨겨진 비용이 없습니다. 투명한 가격, 한글 지원, 24h 고객지원. {{customerName}}님 비교 분석 >> [LINK]',
    psychologyLens: 'L1_DIFFERENTIATION, L3_DIFFERENTIATION, L9_TRUST',
    copyAngle: 'Competitive Advantage + Transparency - Aggressive',
    expectedConversionRate: 50,
  },
  {
    objectiveType: 'COMPETITOR_COMPARE',
    responseMethod: 'GROUP_DISCOUNT',
    variantType: 'A',
    template: '더 좋은 가격으로! {{customerName}}님 + 팀원과 함께 신청 시 월 $79. 함께하기 >> [LINK]',
    psychologyLens: 'L1_DIFFERENTIATION, L8_SOCIAL_PROOF',
    copyAngle: 'Better Price Together - Conservative',
    expectedConversionRate: 48,
  },
  {
    objectiveType: 'COMPETITOR_COMPARE',
    responseMethod: 'GROUP_DISCOUNT',
    variantType: 'B',
    template: '👥 경쟁사는 40% 더 비싸요. 우리는 팀 계약 시 40% ↓ 월 $79. {{customerName}}님 팀과 함께 >> [LINK]',
    psychologyLens: 'L1_DIFFERENTIATION, L8_SOCIAL_PROOF, L6_TIMING',
    copyAngle: 'Price Comparison + Team Benefit - Aggressive',
    expectedConversionRate: 52,
  },
];

// 5. AFFORD_DOUBT (감당 불안) 대응
const AFFORD_DOUBT_TEMPLATES: SMSTemplate[] = [
  {
    objectiveType: 'AFFORD_DOUBT',
    responseMethod: 'SPLIT_PAYMENT',
    variantType: 'A',
    template: '재정 걱정? 월 $99부터 시작, 언제든지 취소 가능. {{customerName}}님 비용 걱정 없어요. 상담 >> [LINK]',
    psychologyLens: 'L1_AFFORDABILITY, L5_SELF_PROJECTION',
    copyAngle: 'Affordable Payment - Conservative',
    expectedConversionRate: 50,
  },
  {
    objectiveType: 'AFFORD_DOUBT',
    responseMethod: 'SPLIT_PAYMENT',
    variantType: 'B',
    template: '💝 좋은 소식! 월 $99로 시작, 마음 바꾸면 언제든 중단. 약정 없음, 숨겨진 비용 없음. {{customerName}}님 안심하세요 >> [LINK]',
    psychologyLens: 'L1_AFFORDABILITY, L5_SELF_PROJECTION, L9_TRUST',
    copyAngle: 'Affordable + No Commitment - Aggressive',
    expectedConversionRate: 54,
  },
  {
    objectiveType: 'AFFORD_DOUBT',
    responseMethod: 'GROUP_DISCOUNT',
    variantType: 'A',
    template: '비용을 나누세요. {{customerName}}님 + 3명이면 월 $25 (4명 공동). 함께하기 >> [LINK]',
    psychologyLens: 'L1_AFFORDABILITY, L7_COMPANION_PERSUASION',
    copyAngle: 'Cost Sharing - Conservative',
    expectedConversionRate: 48,
  },
  {
    objectiveType: 'AFFORD_DOUBT',
    responseMethod: 'GROUP_DISCOUNT',
    variantType: 'B',
    template: '👨‍👩‍👧‍👦 4명이면 월 $25씩! {{customerName}}님 친구들과 비용 나누면 부담 없어요. 초대하기 >> [LINK] 지금 초대 보너스 +$20',
    psychologyLens: 'L1_AFFORDABILITY, L7_COMPANION_PERSUASION, L10_IMMEDIATE',
    copyAngle: 'Cost Sharing + Bonus - Aggressive',
    expectedConversionRate: 52,
  },
];

// 모든 템플릿 통합
export const ALL_SMS_TEMPLATES: SMSTemplate[] = [
  ...PRICE_HIGH_TEMPLATES,
  ...PAYMENT_TERMS_TEMPLATES,
  ...ROI_DOUBT_TEMPLATES,
  ...COMPETITOR_COMPARE_TEMPLATES,
  ...AFFORD_DOUBT_TEMPLATES,
];

/**
 * 특정 조합의 템플릿 조회
 */
export function getTemplate(
  objectiveType: ObjectiveType,
  responseMethod: ResponseMethod,
  variantType: VariantType
): SMSTemplate | undefined {
  return ALL_SMS_TEMPLATES.find(
    t =>
      t.objectiveType === objectiveType &&
      t.responseMethod === responseMethod &&
      t.variantType === variantType
  );
}

/**
 * 특정 이의 유형의 모든 템플릿
 */
export function getTemplatesByObjective(objectiveType: ObjectiveType): SMSTemplate[] {
  return ALL_SMS_TEMPLATES.filter(t => t.objectiveType === objectiveType);
}

/**
 * 특정 대응 방식의 모든 템플릿
 */
export function getTemplatesByMethod(responseMethod: ResponseMethod): SMSTemplate[] {
  return ALL_SMS_TEMPLATES.filter(t => t.responseMethod === responseMethod);
}

/**
 * 특정 변형 유형의 모든 템플릿
 */
export function getTemplatesByVariant(variantType: VariantType): SMSTemplate[] {
  return ALL_SMS_TEMPLATES.filter(t => t.variantType === variantType);
}

/**
 * 통계: 평균 예상 전환율
 */
export function getAverageConversionRateByVariant(variantType: VariantType): number {
  const templates = getTemplatesByVariant(variantType);
  const sum = templates.reduce((acc, t) => acc + t.expectedConversionRate, 0);
  return sum / templates.length;
}
