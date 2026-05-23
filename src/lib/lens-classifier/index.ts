/**
 * Menu #38 Phase 4 Step 5-2: 자동분류 알고리즘
 *
 * 신규 고객 입력 시 L1~L10 중 정확한 렌즈를 자동 분류하는 알고리즘
 * + 신뢰도 점수(Bayesian) 계산
 *
 * @file src/lib/lens-classifier/index.ts
 * @version 1.0.0
 */

import { LensType, ClassificationResult, QuestionnaireResponse, KeywordSignal } from './types';
import {
  classifyL1,
  classifyL2,
  classifyL3,
  classifyL4,
  classifyL5,
  classifyL6,
  classifyL7,
  classifyL8,
  classifyL9,
  classifyL10,
} from './lens-functions';
import { detectKeywords } from './keyword-detector';
import {
  BAYESIAN_CONFIG,
  CACHE_CONFIG,
  PRIORITY_CONFIG,
} from './scoring-weights';

/**
 * 신규 고객의 질문지 답변과 선택적 콜 노트를 기반으로
 * L1-L10 중 가장 적합한 렌즈를 자동 분류합니다.
 *
 * @param responses - Q1-Q5 답변 (각 1-5점) 및 고객 정보
 * @param callNotes - 선택적 콜 노트 (키워드 감지용)
 * @returns 분류 결과 (렌즈 타입, 신뢰도, 이유, 추천 스크립트)
 *
 * @example
 * const result = classifyCustomerLens({
 *   contactId: 'cus_123',
 *   q1_ad_trust: 2,      // 광고 신뢰도 (1=낮음, 5=높음)
 *   q2_price_sensitivity: 4, // 가격 민감도 (1=낮음, 5=높음)
 *   q3_preparation_burden: 3, // 준비 부담감 (1=낮음, 5=높음)
 *   q4_cruise_experience: 1,  // 크루즈 경험 (1=없음, 5=많음)
 *   q5_decision_readiness: 3, // 결정 준비도 (1=아직, 5=즉시)
 * }, 'Wants to know if payment plan is available...');
 *
 * // Returns:
 * // {
 * //   primary_lens: 'L6',
 * //   secondary_lens: 'L4',
 * //   confidence_score: 78,
 * //   reasoning: 'Q5 점수가 3점(중간), "언제 예약할까" 신호 감지',
 * //   recommended_script: 'L6_TIMING_UNCERTAINTY_MAIN',
 * //   sms_sequence_key: 'l6_standard_3day'
 * // }
 */
export function classifyCustomerLens(
  responses: QuestionnaireResponse,
  callNotes?: string
): ClassificationResult {
  // 1. 입력 유효성 검증
  validateResponses(responses);

  // 2. 키워드 감지 (콜 노트에서 신호 추출)
  const keywordSignals: KeywordSignal[] = [];
  if (callNotes) {
    keywordSignals.push(...detectKeywords(callNotes));
  }

  // 3. 10개 렌즈 병렬 분류 (O(1) 시간복잡도)
  const scores: Record<LensType, number> = {
    L1: classifyL1(responses, keywordSignals),
    L2: classifyL2(responses, keywordSignals),
    L3: classifyL3(responses, keywordSignals),
    L4: classifyL4(responses, keywordSignals),
    L5: classifyL5(responses, keywordSignals),
    L6: classifyL6(responses, keywordSignals),
    L7: classifyL7(responses, keywordSignals),
    L8: classifyL8(responses, keywordSignals),
    L9: classifyL9(responses, keywordSignals),
    L10: classifyL10(responses, keywordSignals),
  };

  // 4. 점수 기반 순위 매기기
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([lens, score]) => ({ lens: lens as LensType, score }));

  const primaryLens = sorted[0].lens;
  // P0: 배열 경계 안전성 (10개 렌즈 항상 존재하지만 방어 코드)
  const secondaryLens = sorted.length > 1 ? sorted[1].lens : sorted[0].lens;
  const primaryScore = sorted[0].score;

  // 5. Bayesian 신뢰도 계산 (사후확률)
  const confidenceScore = calculateBayesianConfidence(primaryLens, primaryScore, scores);

  // 6. 우선도 결정 (L10 > L9 > L6 > L1/L3/L8 > L2 > L4 > L5)
  const priority = calculatePriority(primaryLens);

  // 7. 권장 스크립트 + SMS 시퀀스 키 결정
  const scriptTemplate = getScriptTemplate(primaryLens);
  const smsSequenceKey = getSmsSequenceKey(primaryLens);

  // 8. 분류 이유 생성
  const reasoning = generateReasoning(primaryLens, responses, keywordSignals, scores);

  return {
    primary_lens: primaryLens,
    secondary_lens: secondaryLens,
    confidence_score: confidenceScore,
    priority,
    reasoning,
    recommended_script: scriptTemplate,
    sms_sequence_key: smsSequenceKey,
  };
}

/**
 * 입력 유효성 검증
 * - Q1-Q5가 1-5 범위?
 * - 모든 필수 필드 존재?
 */
function validateResponses(responses: QuestionnaireResponse): void {
  const { q1_ad_trust, q2_price_sensitivity, q3_preparation_burden, q4_cruise_experience, q5_decision_readiness } =
    responses;

  if (
    typeof q1_ad_trust !== 'number' ||
    typeof q2_price_sensitivity !== 'number' ||
    typeof q3_preparation_burden !== 'number' ||
    typeof q4_cruise_experience !== 'number' ||
    typeof q5_decision_readiness !== 'number'
  ) {
    throw new Error('모든 질문(Q1-Q5)에 숫자 답변이 필요합니다.');
  }

  const scores = [q1_ad_trust, q2_price_sensitivity, q3_preparation_burden, q4_cruise_experience, q5_decision_readiness];
  for (const score of scores) {
    if (score < 1 || score > 5 || !Number.isInteger(score)) {
      throw new Error(`모든 질문은 1-5 사이의 정수여야 합니다. (받은 값: ${score})`);
    }
  }
}

/**
 * Bayesian 신뢰도 계산 (0-100)
 *
 * P0 이슈 해결:
 * - Bayesian 오버플로우: posterior * 100 (200 → 100)
 * - 0점 케이스 처리: totalScore === 0일 때 명시적 반환
 * - posterior 정규화: 0-1 범위 보장
 *
 * 공식:
 * - 사전확률 (Prior): 각 렌즈별 시장점유율
 * - 우도확률 (Likelihood): 점수 기반 확률
 * - 사후확률 (Posterior): Bayes' Theorem 적용
 *
 * @param lens - 선택된 렌즈
 * @param lensScore - 선택된 렌즈 점수 (0-100)
 * @param allScores - 모든 렌즈 점수
 * @returns 신뢰도 (0-100)
 */
function calculateBayesianConfidence(lens: LensType, lensScore: number, allScores: Record<LensType, number>): number {
  // 1. 사전확률 (Prior) - 렌즈별 시장점유율
  const priors = BAYESIAN_CONFIG.PRIORS;

  // 2. 우도확률 (Likelihood) - 모든 렌즈에 대한 상대적 점수
  const totalScore = Object.values(allScores).reduce((a, b) => a + b, 0);

  // P0: 0점 케이스 명시적 처리
  if (totalScore === 0) {
    return 50; // 신뢰도 없음 = 중간 신뢰도
  }

  const likelihoods = Object.entries(allScores).reduce(
    (acc, [lensKey, score]) => ({
      ...acc,
      [lensKey]: score / totalScore,
    }),
    {} as Record<LensType, number>
  );

  // 3. 사후확률 (Posterior) - Bayes' Theorem
  // P(Lens|Score) = P(Score|Lens) * P(Lens) / P(Score)
  const likelihood = likelihoods[lens];
  const prior = priors[lens];
  const evidence = Object.keys(priors).reduce(
    (acc, key) => acc + likelihoods[key as LensType] * priors[key as LensType],
    0
  );

  // P0: posterior 정규화 (0-1 범위 보장)
  const rawPosterior = (likelihood * prior) / (evidence || 0.01);
  const posterior = Math.min(1, Math.max(0, rawPosterior));

  // P0: 신뢰도를 0-100으로 변환 (200 → 100)
  const confidence = Math.round(posterior * BAYESIAN_CONFIG.CONFIDENCE_MULTIPLIER);

  return confidence;
}

/**
 * 렌즈별 우선도 결정
 * 우선순위: L10(즉시) > L9(건강) > L6(타이밍) > L1/L3/L8(일반) > L2 > L4 > L5
 */
function calculatePriority(lens: LensType): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if ((PRIORITY_CONFIG.CRITICAL_LENSES as unknown as string[]).includes(lens)) return 'CRITICAL';
  if ((PRIORITY_CONFIG.HIGH_LENSES as unknown as string[]).includes(lens)) return 'HIGH';
  if ((PRIORITY_CONFIG.MEDIUM_LENSES as unknown as string[]).includes(lens)) return 'MEDIUM';
  return 'LOW';
}

/**
 * 렌즈별 권장 콜 스크립트 템플릿 반환
 */
function getScriptTemplate(lens: LensType): string {
  const templates: Record<LensType, string> = {
    L1: 'L1_PRICE_RESISTANCE_MAIN',
    L2: 'L2_PREPARATION_BURDEN_MAIN',
    L3: 'L3_DIFFERENTIATION_MAIN',
    L4: 'L4_MEMBERSHIP_RESISTANCE_MAIN',
    L5: 'L5_SUITABILITY_DOUBT_MAIN',
    L6: 'L6_TIMING_UNCERTAINTY_MAIN',
    L7: 'L7_COMPANION_ISSUE_MAIN',
    L8: 'L8_RETURNING_CUSTOMER_MAIN',
    L9: 'L9_HEALTH_SAFETY_MAIN',
    L10: 'L10_IMMEDIATE_PURCHASE_MAIN',
  };
  return templates[lens];
}

/**
 * 렌즈별 SMS 시퀀스 키 반환
 * 형식: l{n}_{표준|긴급}_3day 또는 4day
 */
function getSmsSequenceKey(lens: LensType): string {
  const sequenceMap: Record<LensType, string> = {
    L1: 'l1_standard_3day', // 3일 시퀀스
    L2: 'l2_standard_3day',
    L3: 'l3_standard_3day',
    L4: 'l4_standard_3day',
    L5: 'l5_standard_3day',
    L6: 'l6_urgent_4day', // 긴급 (타이밍 유리 + 손실앵커)
    L7: 'l7_standard_3day',
    L8: 'l8_standard_3day', // 부재중 고객 재활성화
    L9: 'l9_urgent_4day', // 긴급 (건강 문제 + 의료팀)
    L10: 'l10_urgent_immediate', // 초긴급 (즉시 액션)
  };
  return sequenceMap[lens];
}

/**
 * 분류 이유 생성 (자연어)
 */
function generateReasoning(
  lens: LensType,
  responses: QuestionnaireResponse,
  keywordSignals: KeywordSignal[],
  scores: Record<LensType, number>
): string {
  const lensNames: Record<LensType, string> = {
    L1: '가격 오해형',
    L2: '준비 부담형',
    L3: '차별성 미인지형',
    L4: '멤버십 저항형',
    L5: '적합성 의심형',
    L6: '타이밍 미결형',
    L7: '동반자 이슈형',
    L8: '재구매 유보형',
    L9: '건강/안전 불안형',
    L10: '즉시 구매형',
  };

  const reasons: string[] = [];

  // Q1-Q5 점수 기반 설명
  if (lens === 'L1') {
    reasons.push(`Q2(가격민감도: ${responses.q2_price_sensitivity}점) + Q1(광고신뢰도: ${responses.q1_ad_trust}점 낮음)`);
  } else if (lens === 'L2') {
    reasons.push(`Q1(광고신뢰도: ${responses.q1_ad_trust}점 낮음) + Q3(준비부담: ${responses.q3_preparation_burden}점 높음)`);
  } else if (lens === 'L3') {
    reasons.push(`Q4(크루즈경험: ${responses.q4_cruise_experience}점 없음) → 차별성 미인지`);
  } else if (lens === 'L10') {
    reasons.push(`Q5(결정준비도: ${responses.q5_decision_readiness}점 높음) → 즉시 구매 신호`);
  } else if (lens === 'L6') {
    reasons.push(`Q5(결정준비도: ${responses.q5_decision_readiness}점 중간) → 타이밍 미결 신호`);
  }

  // 키워드 신호 반영
  if (keywordSignals.length > 0) {
    const topKeyword = keywordSignals[0];
    reasons.push(`키워드 감지: "${topKeyword.keyword}"`);
  }

  // 신뢰도 부족 경고
  const allScores = Object.values(scores);
  const maxScore = Math.max(...allScores);
  const lensScore = scores[lens];
  if (maxScore - lensScore < 5) {
    reasons.push('⚠️ 신뢰도 낮음 (다른 렌즈와 유사) - 콜 중 재분류 권장');
  }

  return reasons.join(' + ');
}

/**
 * 캐시 메모리 (성능 최적화용)
 * Redis 또는 메모리 캐시로 구현 가능
 */
const classificationCache = new Map<string, ClassificationResult>();

/**
 * 캐시된 분류 결과 조회
 * 동일한 응답에 대해 재계산을 피함 (O(1))
 */
function getCachedClassification(cacheKey: string): ClassificationResult | null {
  return classificationCache.get(cacheKey) || null;
}

/**
 * 분류 결과를 캐시에 저장
 */
function setCachedClassification(cacheKey: string, result: ClassificationResult): void {
  // 최대 캐시 크기 초과 시 FIFO 방식으로 제거
  if (classificationCache.size > CACHE_CONFIG.MAX_CACHED_CLASSIFICATIONS) {
    const firstKey = classificationCache.keys().next().value;
    if (firstKey) classificationCache.delete(firstKey);
  }
  classificationCache.set(cacheKey, result);
}

/**
 * 캐시 키 생성
 */
function generateCacheKey(responses: QuestionnaireResponse): string {
  return `${responses.q1_ad_trust}:${responses.q2_price_sensitivity}:${responses.q3_preparation_burden}:${responses.q4_cruise_experience}:${responses.q5_decision_readiness}`;
}

// 재내보내기
export * from './types';
export * from './keyword-detector';
