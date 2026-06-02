/**
 * 스크립트 추천 스코어링 엔진
 * @date 2026-06-02
 * @description Contact 렌즈 + 성공률 + 최근성을 바탕으로 최적 스크립트 추천
 */

import { LensType } from "@/lib/types/lens";

/**
 * 스크립트 추천 정보
 */
export interface ScriptRecommendation {
  id: string;
  title: string;
  category: string;
  type: string;
  psychology: string | null;
  successRate: number; // 0-100
  usageCount: number;
  score: number; // 계산된 점수 (0-1)
  matchPercentage: number; // 렌즈 매칭 비율 (0-100)
  matchReason: string; // 추천 이유
  lastUsedAt: Date | null;
  priority: number;
}

/**
 * 렌즈별 스크립트 관련도 맵
 * 각 렌즈에 가장 효과적인 스크립트 카테고리 정의
 */
const LENS_SCRIPT_RELEVANCE: Record<LensType, Record<string, number>> = {
  L0: { // 재활성화
    "reactivation": 1.0,
    "comeback_offer": 0.9,
    "win_back": 0.8,
    "loss_aversion": 0.7,
  },
  L1: { // 가격 이의
    "price_justification": 1.0,
    "value_emphasis": 0.95,
    "payment_plan": 0.85,
    "discount_strategy": 0.8,
  },
  L2: { // 준비 복잡도
    "anxiety_relief": 1.0,
    "step_by_step": 0.9,
    "faq_handling": 0.85,
    "simplification": 0.8,
  },
  L3: { // 차별성/경쟁사
    "differentiation": 1.0,
    "competitive_advantage": 0.95,
    "unique_selling": 0.9,
    "comparison": 0.8,
  },
  L4: { // 세그먼트
    "segmented_approach": 1.0,
    "family_focus": 0.8,
    "age_appropriate": 0.75,
    "demographic_match": 0.7,
  },
  L5: { // 자기투영
    "health_benefits": 1.0,
    "lifestyle_improvement": 0.9,
    "personal_goals": 0.85,
    "aspiration": 0.8,
  },
  L6: { // 타이밍/손실회피
    "urgency": 1.0,
    "scarcity": 0.95,
    "deadline": 0.9,
    "fomo": 0.85,
  },
  L7: { // 동반자설득
    "family_persuasion": 1.0,
    "group_dynamics": 0.9,
    "social_proof": 0.85,
    "peer_influence": 0.8,
  },
  L8: { // 재구매/습관화
    "loyalty_program": 1.0,
    "upsell": 0.9,
    "repeat_benefit": 0.85,
    "retention": 0.8,
  },
  L9: { // 건강/신뢰
    "health_safety": 1.0,
    "medical_credibility": 0.95,
    "trust_building": 0.9,
    "certification": 0.85,
  },
  L10: { // 즉시 구매
    "closing": 1.0,
    "final_objection": 0.95,
    "purchase_trigger": 0.9,
    "call_to_action": 0.85,
  },
};

/**
 * Contact 상태별 스크립트 보조 점수
 */
const CONTEXT_BOOST: Record<string, number> = {
  "hot_lead": 0.15,
  "warm_lead": 0.1,
  "cold_lead": -0.05,
  "decision_maker": 0.12,
  "influencer": 0.08,
  "vip": 0.2,
  "at_risk": 0.1,
  "recently_contacted": -0.1, // 같은 스크립트 재사용 패널티
};

/**
 * 스크립트 점수 계산
 *
 * 점수 공식:
 * score = (lensMatch * 0.5) + (successRate * 0.3) + (recency * 0.2)
 *
 * @param script - SalesPlaybook 데이터
 * @param lens - 감지된 렌즈
 * @param lastScriptId - 마지막 사용한 스크립트 ID (재사용 패널티)
 * @param successRate - 해당 스크립트의 성공률 (0-100)
 * @returns 점수 (0-1.0)
 */
export function calculateScore(
  script: {
    id: string;
    category?: string;
    psychology?: string | null;
  },
  lens: LensType,
  lastScriptId: string | null,
  successRate: number
): number {
  // 렌즈 매칭 점수 (0-1.0)
  const lensMap = LENS_SCRIPT_RELEVANCE[lens];
  const category = script.category?.toLowerCase() || "";
  let lensMatch = lensMap[category] || 0.5; // 기본값 0.5

  // 심리학 원칙이 렌즈와 일치하면 추가 점수
  if (script.psychology) {
    const psychologyKeywords = script.psychology.toLowerCase();
    if (
      (lens === "L6" && psychologyKeywords.includes("urgency")) ||
      (lens === "L1" && psychologyKeywords.includes("value")) ||
      (lens === "L0" && psychologyKeywords.includes("reactivation"))
    ) {
      lensMatch = Math.min(1.0, lensMatch + 0.1);
    }
  }

  // 성공률 점수 (0-1.0)
  const successScore = Math.min(1.0, successRate / 100);

  // 최근성 점수 (0-1.0)
  // 마지막 사용한 스크립트 재사용 패널티
  let recencyScore = 0.5;
  if (script.id === lastScriptId) {
    recencyScore = 0.2; // 패널티
  } else {
    recencyScore = 0.8; // 새로운 스크립트 선호
  }

  // 가중치 계산: 렌즈 50% + 성공률 30% + 최근성 20%
  const score = lensMatch * 0.5 + successScore * 0.3 + recencyScore * 0.2;

  return Math.min(1.0, Math.max(0, score));
}

/**
 * 렌즈-스크립트 매칭율 계산
 * @param scriptCategory - 스크립트 카테고리
 * @param lens - 감지된 렌즈
 * @returns 매칭율 (0-100)
 */
export function calculateMatch(scriptCategory: string, lens: LensType): number {
  const lensMap = LENS_SCRIPT_RELEVANCE[lens];
  const category = scriptCategory.toLowerCase();
  const match = lensMap[category] || 0.5;
  return Math.round(match * 100);
}

/**
 * 추천 신뢰도 계산
 * @param recommendations - 추천 스크립트 배열 (상위 5개)
 * @returns 신뢰도 (0-100)
 */
export function calculateConfidence(recommendations: ScriptRecommendation[]): number {
  if (recommendations.length === 0) return 0;

  // 상위 5개 스크립트의 점수 평균
  const avgScore = recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length;

  // 상위 스크립트와 2위 스크립트의 점수 차이
  const scoreGap = recommendations.length > 1
    ? recommendations[0].score - recommendations[1].score
    : 0.3;

  // 신뢰도 = (평균점수 * 70%) + (점수차이 * 30%)
  const confidence = (avgScore * 0.7 + scoreGap * 0.3) * 100;

  return Math.min(100, Math.max(0, Math.round(confidence)));
}

/**
 * 컨텍스트 점수 추가 (선택)
 * @param baseScore - 기본 점수
 * @param context - Contact 컨텍스트 (태그, 상태 등)
 * @returns 조정된 점수
 */
export function applyContextBoost(baseScore: number, context: string[]): number {
  let boost = 0;

  for (const ctx of context) {
    const boost_ = CONTEXT_BOOST[ctx] || 0;
    boost += boost_;
  }

  return Math.min(1.0, Math.max(0, baseScore + boost));
}

/**
 * 추천 이유 텍스트 생성
 * @param lens - 감지된 렌즈
 * @param matchPercentage - 매칭율
 * @param successRate - 성공률
 * @returns 추천 이유
 */
export function generateMatchReason(
  lens: LensType,
  matchPercentage: number,
  successRate: number
): string {
  const lensLabels: Record<LensType, string> = {
    L0: "재활성화 필요",
    L1: "가격 이의",
    L2: "준비 불안",
    L3: "차별성 강조",
    L4: "세그먼트 맞춤",
    L5: "자기투영",
    L6: "시간 긴박감",
    L7: "동반자 설득",
    L8: "재구매 유도",
    L9: "건강 신뢰",
    L10: "즉시 클로징",
  };

  const reasons: string[] = [];

  reasons.push(`${lensLabels[lens]} 고객 (렌즈 매칭 ${matchPercentage}%)`);

  if (successRate > 80) {
    reasons.push(`높은 성공률 (${successRate}%)`);
  } else if (successRate > 60) {
    reasons.push(`중상 성공률 (${successRate}%)`);
  }

  return reasons.join(" + ");
}

/**
 * 렌즈별 기대 전환율 (참고용)
 */
export const LENS_EXPECTED_CONVERSION: Record<LensType, number> = {
  L0: 0.35, // 35%
  L1: 0.42, // 42%
  L2: 0.38, // 38%
  L3: 0.45, // 45%
  L4: 0.40, // 40%
  L5: 0.48, // 48%
  L6: 0.55, // 55% - 높은 긴박감
  L7: 0.50, // 50% - 동반자 설득
  L8: 0.60, // 60% - 재구매 (가장 높음)
  L9: 0.52, // 52% - 신뢰 기반
  L10: 0.95, // 95% - 즉시 구매 (거의 확정)
};
