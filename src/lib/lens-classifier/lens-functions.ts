/**
 * Menu #38 Phase 4 Step 5-2: 10개 렌즈별 분류 로직
 *
 * 각 렌즈 함수는 0-100 점수를 반환합니다.
 * 점수가 높을수록 해당 렌즈일 가능성이 높음.
 *
 * @file src/lib/lens-classifier/lens-functions.ts
 */

import { QuestionnaireResponse, KeywordSignal, LensScorer } from './types';

/**
 * L1: 가격 오해형 (광고 불신 고객)
 *
 * 특징:
 * - Q1(광고신뢰도) 낮음 (1-2)
 * - Q2(가격민감도) 높음 (4-5)
 * - 키워드: "월 33,000", "비싸다", "실제 가격이", "광고가", "사기"
 *
 * 점수 계산:
 * - Q1 역점수 (5-Q1) × 20: 광고 불신 (최대 80점)
 * - Q2 점수 × 10: 가격 민감도 (최대 50점)
 * - 키워드 감지: +20점
 * = 최대 150점 (정규화 후 0-100)
 */
export const classifyL1: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // 광고 신뢰도 낮음 (역점수)
  const adTrustReverse = 5 - responses.q1_ad_trust;
  score += Math.max(0, adTrustReverse * 20);

  // 가격 민감도 높음
  score += responses.q2_price_sensitivity * 10;

  // L1 키워드 감지
  const hasL1Keyword = keywordSignals.some((signal) => signal.lenses.includes('L1'));
  if (hasL1Keyword) {
    score += 20;
  }

  // 신규 고객 + 인플루언서 광고 소스
  if (responses.source === 'INFLUENCER_AD' && !responses.lastPurchaseDate) {
    score += 15;
  }

  return Math.min(100, score);
};

/**
 * L2: 준비 부담형 (시간 부족 고객)
 *
 * 특징:
 * - Q3(준비부담감) 높음 (4-5)
 * - Q1(광고신뢰도) 또는 Q2(가격민감도) 낮음
 * - 키워드: "준비가", "복잡", "시간이", "바빠서", "일정이"
 *
 * 점수 계산:
 * - Q3(준비부담감) × 20: 준비 부담감 (최대 100점)
 * - Q1 역점수 × 10: 광고 불신 (최대 40점)
 * = 최대 140점 (정규화 후 0-100)
 */
export const classifyL2: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // 준비 부담감 높음
  score += responses.q3_preparation_burden * 20;

  // 광고 신뢰도 낮음 (또는 정보 부족)
  const adTrustReverse = 5 - responses.q1_ad_trust;
  score += Math.max(0, adTrustReverse * 10);

  // L2 키워드 감지
  const hasL2Keyword = keywordSignals.some((signal) => signal.lenses.includes('L2'));
  if (hasL2Keyword) {
    score += 20;
  }

  // 직업 기반 (맞벌이, 임원, 자영업)
  if (responses.buyerType === 'NEWLYWED' || responses.buyerType === 'FAMILY_40S') {
    score += 10;
  }

  return Math.min(100, score);
};

/**
 * L3: 차별성 미인지형 (새로운 경험 고객)
 *
 * 특징:
 * - Q4(크루즈경험) 없음 (1-2)
 * - 키워드: "배만 타는 거", "일반 여행이랑", "뭐가 달라", "호텔이랑"
 *
 * 점수 계산:
 * - Q4 역점수 (5-Q4) × 25: 크루즈 미경험 (최대 100점)
 * - 키워드 감지: +15점 (약화: L10과 구분)
 * = 최대 115점 (정규화 후 0-100)
 */
export const classifyL3: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // 크루즈 경험 없음 (역점수)
  const cruiseExperienceReverse = 5 - responses.q4_cruise_experience;
  score += cruiseExperienceReverse * 25;

  // L3 키워드 감지 (약화)
  const hasL3Keyword = keywordSignals.some((signal) => signal.lenses.includes('L3'));
  if (hasL3Keyword) {
    score += 15; // 20 → 15로 약화
  }

  // L10 키워드가 있으면 L3 점수를 줄임 (우선순위 조정)
  const hasL10Keyword = keywordSignals.some((signal) => signal.lenses.includes('L10'));
  if (hasL10Keyword) {
    score *= 0.5; // L10이 우선
  }

  // 신규 고객 (organic search 또는 referral)
  if ((responses.source === 'ORGANIC' || responses.source === 'REFERRAL') && !responses.lastPurchaseDate) {
    score += 10; // 15 → 10으로 감소
  }

  // 첫 크루즈 탈 가능성 높은 나이대 (30-60대)
  if (responses.age && responses.age >= 30 && responses.age <= 60) {
    score += 5; // 10 → 5로 감소
  }

  return Math.min(100, score);
};

/**
 * L4: 멤버십 저항형 (약정 불안 고객)
 *
 * 특징:
 * - 약정에 대한 불안감
 * - 키워드: "약정", "자동결제", "위약금", "자유로운", "필요할 때"
 *
 * 점수 계산:
 * - Q5(결정준비도) 관계없음 → 중립
 * - 키워드 감지: +40점
 * = 최대 40점 (낮은 우선순위)
 */
export const classifyL4: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // L4 키워드 감지 (강한 신호)
  const hasL4Keyword = keywordSignals.some((signal) => signal.lenses.includes('L4'));
  if (hasL4Keyword) {
    score += 40;
  }

  // 결정 준비도가 낮으면 L4 가능성 (약정 때문에 안 함)
  if (responses.q5_decision_readiness <= 2) {
    score += 15;
  }

  // 신규 고객 (이미 경험 있는 고객은 L4 확률 낮음)
  if (!responses.lastPurchaseDate) {
    score += 10;
  }

  return Math.min(100, score);
};

/**
 * L5: 적합성 의심형 (자신감 부족 고객)
 *
 * 특징:
 * - 본인이 적합한지 의심
 * - 혼자 또는 특정 동반자와만 가능 의심
 * - 키워드: "나 같은 사람", "맞을까", "혼자도", "가족이", "아이가"
 *
 * 점수 계산:
 * - 키워드 감지: +30점
 * - Q7(동반자) 정보가 없으면: +20점
 * = 최대 50점 (낮은 우선순위)
 */
export const classifyL5: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // L5 키워드 감지
  const hasL5Keyword = keywordSignals.some((signal) => signal.lenses.includes('L5'));
  if (hasL5Keyword) {
    score += 30;
  }

  // 크루즈 경험 없고 자신감 부족 신호
  if (responses.q4_cruise_experience <= 2) {
    score += 20;
  }

  return Math.min(100, score);
};

/**
 * L6: 타이밍 미결형 (일정 미정 고객)
 *
 * 특징:
 * - Q5(결정준비도) 중간 (2-4)
 * - "언제", "일정이", "다음달", "내년" 등의 표현
 * - 우선도: HIGH (손실 앵커 필요, 긴급 처리)
 *
 * 점수 계산:
 * - Q5 = 2-4점 → 기본점수 50-70점
 * - 키워드 감지: +20점
 * - 가격/준비 신호 없음: +15점
 * = 최대 105점 (정규화 후 0-100)
 */
export const classifyL6: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  const { q5_decision_readiness } = responses;

  // Q5가 2-4점 (중간: "언제 갈지 못 정했어요")
  if (q5_decision_readiness >= 2 && q5_decision_readiness <= 4) {
    // Q5 = 2 → 35점, Q5 = 3 → 45점, Q5 = 4 → 55점 (약화)
    score += (q5_decision_readiness - 1) * 10 + 25;
  }

  // L6 키워드 감지 (시간/일정 관련)
  const hasL6Keyword = keywordSignals.some((signal) => signal.lenses.includes('L6'));
  if (hasL6Keyword) {
    score += 20;
  }

  // L10 키워드가 있으면 L6 점수 줄임
  const hasL10Keyword = keywordSignals.some((signal) => signal.lenses.includes('L10'));
  if (hasL10Keyword) {
    score *= 0.6; // L10이 우선
  }

  // 가격/준비 부담 신호가 없으면 L6 확률 높음
  const hasL1L2Keyword = keywordSignals.some((signal) => signal.lenses.includes('L1') || signal.lenses.includes('L2'));
  if (!hasL1L2Keyword) {
    score += 10; // 15 → 10으로 감소
  }

  return Math.min(100, score);
};

/**
 * L7: 동반자 이슈형 (함께 갈 사람 필요)
 *
 * 특징:
 * - "함께 갈 사람", "배우자", "아이", "친구", "부모" 등
 * - 동반자 유무에 따라 의사결정 달라짐
 *
 * 점수 계산:
 * - 키워드 감지: +40점
 * - Q5(결정준비도) < 3이면서 L7 키워드: +20점
 * = 최대 60점 (중간 우선순위)
 */
export const classifyL7: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // L7 키워드 감지
  const hasL7Keyword = keywordSignals.some((signal) => signal.lenses.includes('L7'));
  if (hasL7Keyword) {
    score += 40;
  }

  // 동반자 미결정 + 낮은 결정 준비도
  if (responses.q5_decision_readiness < 3 && hasL7Keyword) {
    score += 20;
  }

  return Math.min(100, score);
};

/**
 * L8: 재구매 유보형 (부재중 고객)
 *
 * 특징:
 * - lastPurchaseDate가 1년 이상 전
 * - source = 'RETURNING' (부재중 DB 재접촉)
 * - 경험 있으면서도 미구매
 *
 * 점수 계산:
 * - lastPurchaseDate 1-2년 전: +50점
 * - lastPurchaseDate 2-5년 전: +40점
 * - source = 'RETURNING': +30점
 * = 최대 80점 (조건부 높음)
 */
export const classifyL8: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // 부재중 고객 신호
  if (responses.source === 'RETURNING' && responses.lastPurchaseDate) {
    const daysSincePurchase = Math.floor((Date.now() - responses.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const yearsSincePurchase = daysSincePurchase / 365;

    // 1-2년 미구매: 강한 신호
    if (yearsSincePurchase >= 1 && yearsSincePurchase < 2) {
      score += 50;
    }
    // 2-5년 미구매: 중간 신호
    else if (yearsSincePurchase >= 2 && yearsSincePurchase < 5) {
      score += 40;
    }
    // 5년 이상: 약한 신호 (새로운 고객에 가까움)
    else if (yearsSincePurchase >= 5) {
      score += 20;
    }
  }

  // L8 키워드 감지 (멤버십 필요성, 할인 등)
  const hasL8Keyword = keywordSignals.some((signal) => signal.lenses.includes('L8'));
  if (hasL8Keyword) {
    score += 20;
  }

  return Math.min(100, score);
};

/**
 * L9: 건강/안전 불안형 (건강 우려 고객)
 *
 * 특징:
 * - 멀미, 지병, 아이 안전 등 건강 관련 우려
 * - 키워드: "멀미", "배", "지병", "건강", "아이", "아기", "임신"
 * - 우선도: CRITICAL (의료팀 필요, 긴급)
 *
 * 점수 계산:
 * - 키워드 감지: +50점 (매우 강한 신호)
 * - 아이 있는 부모 + 안전 우려: +30점
 * = 최대 80점 (높은 우선순위)
 */
export const classifyL9: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  // L9 키워드 감지 (강한 신호)
  const hasL9Keyword = keywordSignals.some((signal) => signal.lenses.includes('L9'));
  if (hasL9Keyword) {
    score += 50;
  }

  // 가족/자녀 + 안전 우려
  if (responses.buyerType === 'FAMILY_40S' && hasL9Keyword) {
    score += 20;
  }

  // Q3(준비부담감) 높고 L9 신호 = 건강 때문일 가능성
  if (responses.q3_preparation_burden >= 4 && hasL9Keyword) {
    score += 10;
  }

  return Math.min(100, score);
};

/**
 * L10: 즉시 구매형 (결정 완료, 마지막 고민만 남은 고객)
 *
 * 특징:
 * - Q5(결정준비도) 높음 (4-5) → "이미 결정했다"
 * - 선택 제품 이미 정함 (배, 객실, 출발일)
 * - "마지막 고민만", "지금 할까", "뭘 더 확인해야" 등
 * - 우선도: CRITICAL (최우선, 신민형 5STEP 삼중선택)
 *
 * 점수 계산:
 * - Q5 = 4-5점: 60-80점 (고 준비도)
 * - 키워드 감지: +30점 (강한 신호)
 * - 콜 시간 < 5분: +10점 (충동구매 신호)
 * = 최대 120점 (정규화 후 0-100)
 */
export const classifyL10: LensScorer = (responses, keywordSignals) => {
  let score = 0;

  const { q5_decision_readiness } = responses;

  // Q5 = 4-5점 (높은 결정 준비도) - 강한 신호
  if (q5_decision_readiness >= 4) {
    // Q5 = 4 → 60점, Q5 = 5 → 80점
    score += (q5_decision_readiness - 3) * 20;
  }

  // L10 키워드 감지 ("마지막", "지금 예약", "선택 완료" 등) - 매우 강한 신호
  const hasL10Keyword = keywordSignals.some((signal) => signal.lenses.includes('L10'));
  if (hasL10Keyword) {
    score += 30; // 강화 (20 → 30)
  }

  // 이미 제품 선택했다는 신호 (배, 객실, 날짜)
  const hasDecisionSignal = keywordSignals.some((signal) => signal.category === 'DECISION' && signal.confidence > 0.7);
  if (hasDecisionSignal) {
    score += 15;
  }

  // Q5가 없지만 L10 키워드만 있는 경우도 강한 신호
  if (q5_decision_readiness < 4 && hasL10Keyword) {
    score += 25; // 키워드가 있으면 Q5 부족해도 더해줌
  }

  return Math.min(100, score);
};
