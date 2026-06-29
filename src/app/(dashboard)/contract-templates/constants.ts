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
  L0_REACTIVATION: "오랫동안 안 온 고객",
  L1_PRICE_OBJECTION: "비용 상담 필요",
  L2_COMPLEXITY_ANXIETY: "준비 방법 설명 필요",
  L3_DIFFERENTIATION: "우리 특장점 설명",
  L4_FEATURES: "상품 정보 제공",
  L5_SELF_PROJECTION: "고객 상황 맞춤",
  L6_TIMING_LOSS_AVERSION: "지금이 최적 시기",
  L7_COMPANION_PERSUASION: "가족과 함께 결정",
  L8_REPURCHASE_HABITUAL: "단골 고객 케어",
  L9_HEALTH_MEDICAL_TRUST: "안전성 확인",
  L10_IMMEDIATE_PURCHASE: "지금 바로 결정",
};

export const CATEGORY_LABEL: Record<string, string> = {
  CRUISE: "크루즈",
  RENTAL: "렌탈",
  HOTEL: "호텔",
  PACKAGE: "패키지",
  OTHER: "기타",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "사용 중",
  ARCHIVED: "보관됨",
  DRAFT: "작성 중",
};

export const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-700",
  DRAFT: "bg-yellow-100 text-yellow-700",
};

export const VISIBILITY_LABEL: Record<string, string> = {
  PERSONAL: "개인",
  MANAGER_ONLY: "매니저만",
  ORGANIZATION: "조직 전체",
};
