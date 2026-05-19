/**
 * Menu #38 Phase 4 Step 5-2: 렌즈 분류 가중치 및 상수
 *
 * P1 이슈 해결: 모든 점수 배수, 임계값, 우선순위를 중앙집중식으로 관리
 *
 * @file src/lib/lens-classifier/scoring-weights.ts
 */

import type { LensType } from './types';

/**
 * L1: 가격 오해형 점수 가중치
 */
export const L1_WEIGHTS = {
  AD_TRUST_REVERSE_MULTIPLIER: 20, // (5-Q1) × 20
  PRICE_SENSITIVITY_MULTIPLIER: 10, // Q2 × 10
  KEYWORD_BONUS: 20,
  INFLUENCER_AD_BONUS: 15,
} as const;

/**
 * L2: 준비 부담형 점수 가중치
 */
export const L2_WEIGHTS = {
  PREPARATION_BURDEN_MULTIPLIER: 20, // Q3 × 20
  AD_TRUST_REVERSE_MULTIPLIER: 10, // (5-Q1) × 10
  KEYWORD_BONUS: 20,
  BUYER_TYPE_BONUS: 10,
} as const;

/**
 * L3: 차별성 미인지형 점수 가중치
 */
export const L3_WEIGHTS = {
  CRUISE_EXPERIENCE_REVERSE_MULTIPLIER: 25, // (5-Q4) × 25
  KEYWORD_BONUS: 15, // 약화: L10과 구분
  L10_INTERFERENCE_MULTIPLIER: 0.5, // L10 키워드 있으면 × 0.5
  ORGANIC_BONUS: 10, // organic/referral 소스
  AGE_BONUS: 5, // 30-60대
} as const;

/**
 * L4: 멤버십 저항형 점수 가중치
 */
export const L4_WEIGHTS = {
  KEYWORD_BONUS: 40, // 강한 신호
  LOW_DECISION_BONUS: 15, // Q5 ≤ 2
  NEW_CUSTOMER_BONUS: 10,
} as const;

/**
 * L5: 적합성 의심형 점수 가중치
 */
export const L5_WEIGHTS = {
  KEYWORD_BONUS: 30,
  LOW_EXPERIENCE_BONUS: 20, // Q4 ≤ 2
} as const;

/**
 * L6: 타이밍 미결형 점수 가중치
 */
export const L6_WEIGHTS = {
  DECISION_READINESS_BASE: 25, // (Q5-1)*10 + 25
  DECISION_READINESS_MULTIPLIER: 10,
  KEYWORD_BONUS: 20,
  L10_INTERFERENCE_MULTIPLIER: 0.6, // L10 키워드 있으면 × 0.6
  NO_PRICE_PREP_BONUS: 10, // L1/L2 키워드 없으면
} as const;

/**
 * L7: 동반자 이슈형 점수 가중치
 */
export const L7_WEIGHTS = {
  KEYWORD_BONUS: 40,
  LOW_DECISION_WITH_KEYWORD_BONUS: 20,
} as const;

/**
 * L8: 재구매 유보형 점수 가중치
 */
export const L8_WEIGHTS = {
  RETURNING_1_2_YEARS: 50, // 1-2년 미구매
  RETURNING_2_5_YEARS: 40, // 2-5년 미구매
  RETURNING_5_PLUS_YEARS: 20, // 5년 이상
  KEYWORD_BONUS: 20,
} as const;

/**
 * L9: 건강/안전 불안형 점수 가중치
 */
export const L9_WEIGHTS = {
  KEYWORD_BONUS: 50, // 매우 강한 신호
  FAMILY_WITH_KEYWORD_BONUS: 20,
  HIGH_PREP_BURDEN_BONUS: 10, // Q3 ≥ 4
} as const;

/**
 * L10: 즉시 구매형 점수 가중치
 */
export const L10_WEIGHTS = {
  DECISION_READINESS_BASE: 0, // (Q5-3)*20 시작
  DECISION_READINESS_MULTIPLIER: 20,
  KEYWORD_BONUS: 30, // 강화 (20 → 30)
  DECISION_SIGNAL_BONUS: 15, // 제품 선택 신호
  KEYWORD_WITHOUT_Q5_BONUS: 25, // Q5 < 4인데 키워드 있으면
} as const;

/**
 * Bayesian 신뢰도 계산
 */
export const BAYESIAN_CONFIG = {
  // 사전확률 (Prior) - 렌즈별 시장점유율
  PRIORS: {
    L1: 0.25,
    L2: 0.1,
    L3: 0.2,
    L4: 0.08,
    L5: 0.07,
    L6: 0.08,
    L7: 0.08,
    L8: 0.02,
    L9: 0.03,
    L10: 0.01,
  } as const,
  // 신뢰도 정규화: posterior × 100 (범위: 0-100)
  CONFIDENCE_MULTIPLIER: 100,
  // 신뢰도 무결성 기준: maxScore - lensScore < CONFIDENCE_THRESHOLD
  CONFIDENCE_LOW_THRESHOLD: 5,
} as const;

/**
 * 키워드 강도 계산
 */
export const KEYWORD_CONFIG = {
  // 키워드 강도 계산: avgConfidence × signalCount × MULTIPLIER
  STRENGTH_MULTIPLIER: 50,
  // 최대 입력 길이 (ReDoS 방지)
  MAX_CALL_NOTES_LENGTH: 5000,
} as const;

/**
 * 캐시 설정
 */
export const CACHE_CONFIG = {
  // 메모리 캐시 최대 항목 수
  MAX_CACHED_CLASSIFICATIONS: 1000,
  // 정규식 캐시 크기 제한 (수동 정리 필요 없음, getOrCompileRegex에서 관리)
  REGEX_CACHE_AUTO_CLEANUP: true,
} as const;

/**
 * 우선도 설정
 */
export const PRIORITY_CONFIG = {
  CRITICAL_LENSES: ['L10', 'L9'] as const,
  HIGH_LENSES: ['L6'] as const,
  MEDIUM_LENSES: ['L1', 'L3', 'L8'] as const,
  LOW_LENSES: ['L2', 'L4', 'L5', 'L7'] as const,
} as const;

/**
 * 극단값 보호
 */
export const BOUNDARY_PROTECTION = {
  // 렌즈 점수 최소값 (점수 × multiplier 후 보호)
  MIN_LENS_SCORE_AFTER_INTERFERENCE: 10, // L6, L3에서 *0.6, *0.5 후 최소값
  // 신뢰도 범위
  MIN_CONFIDENCE: 0,
  MAX_CONFIDENCE: 100,
  // 나이 범위 검증
  MIN_AGE: 18,
  MAX_AGE: 120,
} as const;
