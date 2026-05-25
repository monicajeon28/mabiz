export const PSYCHOLOGY_LENSES = [
  "L0_REACTIVATION",
  "L1_PRICE_OBJECTION",
  "L2_COMPLEXITY_ANXIETY",
  "L3_DIFFERENTIATION",
  "L4_FEATURES",
  "L5_SELF_PROJECTION",
  "L6_TIMING_LOSS_AVERSION",
  "L7_COMPANION_PERSUASION",
  "L8_REPURCHASE_HABITUAL",
  "L9_HEALTH_MEDICAL_TRUST",
  "L10_IMMEDIATE_PURCHASE",
];

export const LENS_LABELS: Record<string, string> = {
  L0_REACTIVATION: "L0 - 부재고객 재활성화",
  L1_PRICE_OBJECTION: "L1 - 가격 이의 대응",
  L2_COMPLEXITY_ANXIETY: "L2 - 준비 불안감",
  L3_DIFFERENTIATION: "L3 - 차별성 강조",
  L4_FEATURES: "L4 - 기능",
  L5_SELF_PROJECTION: "L5 - 자기 투영",
  L6_TIMING_LOSS_AVERSION: "L6 - 타이밍 손실회피",
  L7_COMPANION_PERSUASION: "L7 - 동반자 설득",
  L8_REPURCHASE_HABITUAL: "L8 - 재구매 습관화",
  L9_HEALTH_MEDICAL_TRUST: "L9 - 의료 신뢰",
  L10_IMMEDIATE_PURCHASE: "L10 - 즉시 구매",
};

export const CATEGORY_LABEL: Record<string, string> = {
  CRUISE: "크루즈",
  RENTAL: "렌탈",
  HOTEL: "호텔",
  PACKAGE: "패키지",
  OTHER: "기타",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "활성",
  ARCHIVED: "보관됨",
  DRAFT: "임시저장",
};

export const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-700",
  DRAFT: "bg-yellow-100 text-yellow-700",
};
