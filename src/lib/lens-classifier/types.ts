/**
 * Menu #38 Phase 4 Step 5-2: 자동분류 알고리즘 타입 정의
 *
 * @file src/lib/lens-classifier/types.ts
 */

/**
 * L1-L10 렌즈 타입
 */
export type LensType = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10';

/**
 * 고객 질문지 응답
 *
 * Q1: 광고 신뢰도 (1=광고를 잘 안 믿음, 5=광고를 잘 믿음)
 * Q2: 가격 민감도 (1=가격에 둔감, 5=매우 민감)
 * Q3: 준비 부담감 (1=부담 없음, 5=매우 부담스러움)
 * Q4: 크루즈 경험 (1=경험 없음, 5=많이 경험함)
 * Q5: 결정 준비도 (1=아직 멀음, 5=즉시 결정 가능)
 */
export interface QuestionnaireResponse {
  contactId: string;
  q1_ad_trust: number; // 1-5
  q2_price_sensitivity: number; // 1-5
  q3_preparation_burden: number; // 1-5
  q4_cruise_experience: number; // 1-5
  q5_decision_readiness: number; // 1-5
  // 선택적 고객 정보
  source?: 'INFLUENCER_AD' | 'ORGANIC' | 'REFERRAL' | 'RETURNING' | 'PHONE_INQUIRY';
  lastPurchaseDate?: Date;
  age?: number;
  buyerType?: 'NEWLYWED' | 'FAMILY_40S' | 'MIDDLE_AGED_COUPLE' | 'ELDERLY' | 'UNKNOWN';
}

/**
 * 자동분류 결과
 */
export interface ClassificationResult {
  // 기본 분류
  primary_lens: LensType;
  secondary_lens?: LensType; // 차순위 렌즈 (신뢰도가 유사할 때)

  // 신뢰도
  confidence_score: number; // 0-100 (Bayesian 확률)

  // 우선도
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  // 설명
  reasoning: string; // 자연어로 분류 근거 설명

  // 실행 정보
  recommended_script: string; // 예: 'L1_PRICE_RESISTANCE_MAIN'
  sms_sequence_key: string; // 예: 'l1_standard_3day'
}

/**
 * 렌즈별 점수 계산 함수 시그니처
 */
export type LensScorer = (responses: QuestionnaireResponse, keywordSignals: KeywordSignal[]) => number;

/**
 * 키워드 감지 신호
 */
export interface KeywordSignal {
  keyword: string;
  lenses: LensType[]; // 이 키워드가 신호하는 렌즈들
  confidence: number; // 0-1
  category: 'PRICE' | 'PREPARATION' | 'EXPERIENCE' | 'MEMBERSHIP' | 'DECISION' | 'COMPANION' | 'HEALTH' | 'TIME';
}

/**
 * L1 렌즈 세부 정보
 * 가격 오해형 - "월 33,000원이라고 했는데 왜 150만원이?"
 */
export interface LensL1Details {
  adSource: 'INFLUENCER_AD' | 'ORGANIC_SEARCH' | 'DIRECT' | 'REFERRAL';
  expectedPrice: number;
  actualPrice: number;
  priceSensitivity: 1 | 2 | 3 | 4 | 5;
  adTrustLevel: 1 | 2 | 3 | 4 | 5;
}

/**
 * L6 렌즈 세부 정보
 * 타이밍 미결 - "언제 갈지 못 정했어요"
 */
export interface LensL6Details {
  decisionReadiness: 1 | 2 | 3 | 4 | 5;
  preferredTravelMonth?: number;
  constraints: ('WEATHER' | 'BUDGET' | 'SCHEDULE' | 'COMPANIONS')[];
  decisionDeadline?: Date;
}

/**
 * L9 렌즈 세부 정보
 * 건강/안전 불안 - "배타면 멀미 안 할까?"
 */
export interface LensL9Details {
  hasSeaSickness: boolean;
  hasMedicalCondition: boolean;
  hasChildren: boolean;
  childrenAges?: number[];
  medicalConcerns?: string[];
}

/**
 * L10 렌즈 세부 정보
 * 즉시 구매형 - "이미 결정 했는데 마지막 고민"
 */
export interface LensL10Details {
  decisionLevel: 1 | 2 | 3 | 4 | 5; // 1=아직, 5=완전히 결정
  selectedShip?: string;
  selectedRoomType?: string;
  selectedDepartureDate?: Date;
  decisionDelay: 'PAYMENT' | 'TIMELINE' | 'COMPANION' | 'FINAL_CONFIRMATION' | 'UNKNOWN';
}

/**
 * SMS 시퀀스 설정
 * Day 0/1/2/3 × 최대 3개 이벤트 = 최대 12개 메시지
 */
export interface SmsSequenceConfig {
  day: 0 | 1 | 2 | 3;
  eventIndex: 0 | 1 | 2; // Day 내 이벤트 인덱스
  templateKey: string; // 예: 'L1_DAY0_EVENT0'
  sendDelayMinutes: number; // Day 0 = 10분, Day 1 = 24시간, Day 2 = 48시간, Day 3 = 72시간
  retryOnFailure: boolean;
  maxRetries: number;
}
