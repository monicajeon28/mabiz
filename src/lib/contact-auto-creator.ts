import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Loop 6 - Agent D: Contact 자동생성 엔진
 *
 * Webhook 수신 (Payment/Inquiry) → Contact 자동 생성/업데이트
 * Segment 분류 (A-E) + Lens 감지 (L0-L10) + Risk Score 계산
 *
 * 기대 효과:
 * - 수동 입력 0 → 100% 자동화
 * - 신규 Contact 100명/일 처리
 * - Segment 정확도 90%+ (나이 기반)
 * - Lens 감지 정확도 85%+ (신호 기반)
 * - Risk Score 자동 계산 (0-100)
 * - 즉시 Day 0 SMS 발송
 */

// ============================================
// Type Definitions
// ============================================

export type Segment = 'A' | 'B' | 'C' | 'D' | 'E';
export type Lens = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10';
export type Source = 'cruisedot_payment' | 'cruisedot_inquiry' | 'form_submission' | 'phone_call' | 'manual_entry';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface WebhookPayload {
  // 필수 필드
  name: string;
  phone: string;
  email?: string;

  // 선택 필드 (Segment 분류용)
  age?: number;
  ageRange?: string; // "20-30", "40-50", etc.
  preferenceType?: string; // "romantic", "family", "culture", "luxury", "senior", "cruise", "hotel", "tour"
  familyComposition?: string; // "single", "couple", "family_with_kids", "multi_generation"

  // Cruise 관련
  cruiseInterest?: string;
  budgetRange?: string;
  departureDate?: string;

  // 추적용
  paymentId?: string;
  inquiryId?: string;
  source: Source;
  orderId?: string;
  timestamp?: string;

  // 심리학 렌즈 감지 힌트
  healthConcerns?: string[];
  pastCruiseCount?: number;
  competitorMentioned?: string[];
  familyObjections?: string[];
  inquiryMessage?: string; // 고객 문의 메시지
  depositAmount?: number; // 선금 금액
  totalPrice?: number; // 총 가격
}

export interface LensDetectionResult {
  currentLens: Lens;
  confidence: number; // 0-100
  triggers: string[]; // 감지 신호 (왜 이 렌즈를 감지했나)
}

export interface RiskScoringResult {
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  signals: string[];
  recommendedAction: string;
}

export interface ContactAutoCreateResult {
  success: boolean;
  contactId?: string;
  isNew: boolean;
  segment: Segment;
  lens: Lens;
  lensConfidence: number;
  riskScore: number;
  riskLevel: RiskLevel;
  tags: string[];
  error?: string;
}

// ============================================
// Segment 분류 로직 (나이 + 취향 기반)
// ============================================

/**
 * 세그먼트 분류 (우선순위)
 * A: 20-30, 로맨틱, 신혼 (20-30세, 혼인/로맨틱 여행)
 * B: 31-50, 가족, 단란 (30-50세, 가족동반, 아이 있음)
 * C: 40-60, 문화/경험, 여행 (40-60세, 문화체험, 투어 선호)
 * D: 50-70, 럭셀리, 프리미엄 (50-70세, 럭셀리 크루즈, 프리미엄)
 * E: 60+, 시니어, 의료 (60세+, 시니어, 건강/의료 관심)
 *
 * 매칭 우선순위:
 * 1. 명시적 preferenceType
 * 2. 나이 + familyComposition
 * 3. 나이만 사용
 * 4. 기본값 B
 */
export function detectSegmentByAge(
  age?: number,
  ageRange?: string,
  preferenceType?: string,
  familyComposition?: string
): Segment {
  // 1. preferenceType으로 명시적 세그먼트 분류 (최우선)
  if (preferenceType) {
    const pref = preferenceType.toLowerCase();

    // Segment A: 신혼/로맨틱
    if (pref.includes('romantic') || pref.includes('honeymoon') || pref.includes('couple')) {
      return 'A';
    }

    // Segment B: 가족
    if (pref.includes('family') || pref.includes('kids')) {
      return 'B';
    }

    // Segment C: 문화/투어
    if (pref.includes('culture') || pref.includes('experience') || pref.includes('tour')) {
      return 'C';
    }

    // Segment D: 럭셀리
    if (pref.includes('luxury') || pref.includes('premium') || pref.includes('vip')) {
      return 'D';
    }

    // Segment E: 시니어/의료
    if (pref.includes('senior') || pref.includes('medical') || pref.includes('health')) {
      return 'E';
    }
  }

  // 2. familyComposition으로 세그먼트 분류
  if (familyComposition) {
    const family = familyComposition.toLowerCase();

    if (family.includes('couple') && !family.includes('kids')) {
      // 자녀 없는 부부 → A
      return 'A';
    }

    if (family.includes('family_with_kids') || family.includes('kids')) {
      // 자녀 있는 가족 → B
      return 'B';
    }

    if (family.includes('multi_generation')) {
      // 3세대 이상 → C/D
      return age && age >= 60 ? 'D' : 'C';
    }
  }

  // 3. 나이 기반 분류
  if (age) {
    if (age >= 20 && age < 31) return 'A'; // 신혼 (20-30)
    if (age >= 31 && age < 41) return 'B'; // 가족 초기 (31-40)
    if (age >= 41 && age < 51) return 'B'; // 가족 (41-50)
    if (age >= 51 && age < 61) return 'C'; // 문화 (51-60)
    if (age >= 61 && age < 71) return 'D'; // 럭셀리 (61-70)
    if (age >= 71) return 'E'; // 시니어 (71+)
  }

  // 4. ageRange 문자열 파싱
  if (ageRange) {
    const rangeLower = parseInt(ageRange.split('-')[0], 10);
    if (rangeLower >= 20 && rangeLower < 31) return 'A';
    if (rangeLower >= 31 && rangeLower < 41) return 'B';
    if (rangeLower >= 41 && rangeLower < 51) return 'B';
    if (rangeLower >= 51 && rangeLower < 61) return 'C';
    if (rangeLower >= 61 && rangeLower < 71) return 'D';
    if (rangeLower >= 71) return 'E';
  }

  // 기본값: B (40-50 가족)
  return 'B';
}

// ============================================
// Lens 감지 로직 (심리학 렌즈 + 신호 감지)
// ============================================

/**
 * 심리학 렌즈 자동 감지 (L0-L10)
 *
 * L0: 부재중 고객 재활성화 (6개월+ 미연락)
 * L1: 가격 이의형 ("비싼", "할인", "저렴" 언급)
 * L2: 준비 불안형 ("여권", "준비", "불안" 언급)
 * L3: 차별성 미인지형 (경쟁사 언급)
 * L4: 피처/가격 비중비교형 (객실/기항지/시설 상세 문의)
 * L5: 자기투영 + 의료신뢰형 (개인화 + 건강관심)
 * L6: 타이밍 손실회피형 (출발임박, 결정 시간 부족) - DEFAULT
 * L7: 동반자 설득형 (가족/배우자 동의 필요)
 * L8: 재방문 습관화형 (과거 크루즈 경험자)
 * L9: 건강/안전/의료신뢰형 (배멀미, 당뇨, 고혈압, 의료 관심)
 * L10: 희소성 + 즉시구매형 ("지금", "오늘", "즉시" + 업셀 기회)
 *
 * @returns LensDetectionResult { currentLens, confidence (0-100), triggers }
 */
export function detectLens(payload: WebhookPayload): LensDetectionResult {
  const scores: Record<Lens, { score: number; triggers: string[] }> = {
    L0: { score: 0, triggers: [] },
    L1: { score: 0, triggers: [] },
    L2: { score: 0, triggers: [] },
    L3: { score: 0, triggers: [] },
    L4: { score: 0, triggers: [] },
    L5: { score: 0, triggers: [] },
    L6: { score: 0, triggers: [] },
    L7: { score: 0, triggers: [] },
    L8: { score: 0, triggers: [] },
    L9: { score: 0, triggers: [] },
    L10: { score: 0, triggers: [] },
  };

  // L8: 재방문 습관화 (과거 크루즈 경험)
  if (payload.pastCruiseCount && payload.pastCruiseCount > 0) {
    scores.L8.score += 35;
    scores.L8.triggers.push(`past_${payload.pastCruiseCount}_cruises`);
    if (payload.pastCruiseCount >= 3) {
      scores.L8.score += 20; // VIP 재방문자
      scores.L8.triggers.push('vip_repeat_customer');
    }
  }

  // L9: 건강/안전/의료 신뢰
  if (payload.healthConcerns && payload.healthConcerns.length > 0) {
    scores.L9.score += 40;
    scores.L9.triggers.push(...payload.healthConcerns);
    // 건강 관심도 높음
    scores.L9.score += 10;
    scores.L9.triggers.push('health_priority');
  }

  // L3: 경쟁사 언급 (차별성 미인지)
  if (payload.competitorMentioned && payload.competitorMentioned.length > 0) {
    scores.L3.score += 45;
    scores.L3.triggers.push(...payload.competitorMentioned.map(c => `competitor_${c}`));
    scores.L3.triggers.push('strong_competitor_interest');
  }

  // L7: 동반자/가족 설득 필요
  if (payload.familyComposition && payload.familyComposition.includes('couple')) {
    scores.L7.score += 20;
    scores.L7.triggers.push('couple_family_unit');
  }
  if (payload.familyComposition && payload.familyComposition.includes('multi_generation')) {
    scores.L7.score += 25;
    scores.L7.triggers.push('multi_generation');
  }
  if (payload.familyObjections && payload.familyObjections.length > 0) {
    scores.L7.score += 30;
    scores.L7.triggers.push(...payload.familyObjections.map(o => `family_objection_${o}`));
  }

  // L2: 준비 불안 (여권, 준비, 복잡, 불안)
  const prepKeywords = ['visa', 'passport', 'preparation', 'nervous', 'worried', 'complex'];
  if (payload.preferenceType && prepKeywords.some(kw => payload.preferenceType!.toLowerCase().includes(kw))) {
    scores.L2.score += 30;
    scores.L2.triggers.push('preparation_concerns');
  }
  if (payload.inquiryMessage) {
    const msgLower = payload.inquiryMessage.toLowerCase();
    if (msgLower.includes('준비') || msgLower.includes('여권') || msgLower.includes('불안') || msgLower.includes('어렵')) {
      scores.L2.score += 25;
      scores.L2.triggers.push('preparation_anxiety_keywords');
    }
  }

  // L1: 가격 이의 (비싸, 비용, 가격, 할인)
  const priceKeywords = ['비싸', '비용', '가격', '할인', '저렴', '원가', '비싼'];
  if (payload.inquiryMessage) {
    const msgLower = payload.inquiryMessage.toLowerCase();
    if (priceKeywords.some(kw => msgLower.includes(kw))) {
      scores.L1.score += 35;
      scores.L1.triggers.push('price_objection_keywords');
    }
  }
  if (payload.budgetRange) {
    scores.L1.score += 15;
    scores.L1.triggers.push(`budget_range_${payload.budgetRange}`);
  }

  // L6: 타이밍 손실회피 (출발 30일 이내)
  if (payload.departureDate) {
    const daysUntilDeparture = Math.floor((new Date(payload.departureDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDeparture <= 30) {
      scores.L6.score += 40;
      scores.L6.triggers.push(`departure_urgent_${daysUntilDeparture}_days`);
    } else if (daysUntilDeparture <= 60) {
      scores.L6.score += 20;
      scores.L6.triggers.push(`departure_soon_${daysUntilDeparture}_days`);
    }
  }

  // L10: 즉시 구매 기회 (신규 + 고가 구매 의지)
  if (payload.source === 'cruisedot_payment' && payload.depositAmount) {
    scores.L10.score += 30;
    scores.L10.triggers.push(`payment_deposit_${payload.depositAmount}`);

    // 고가 구매 (200만원 이상)
    if (payload.totalPrice && payload.totalPrice >= 2000000) {
      scores.L10.score += 20;
      scores.L10.triggers.push(`premium_booking_${payload.totalPrice}`);
    }
  }

  // L4: 피처 중심 (객실, 기항지, 시설 상세 문의)
  const featureKeywords = [
    '객실', '발코니', '기항지', '항구', '식사', '다이닝', '시설', '수영장',
    '로비', '엔터테인먼트', '카바레', '쇼',
  ];
  if (payload.inquiryMessage) {
    const msgLower = payload.inquiryMessage.toLowerCase();
    const featureMatches = featureKeywords.filter(kw => msgLower.includes(kw));
    if (featureMatches.length > 0) {
      scores.L4.score += 25 + featureMatches.length * 5;
      scores.L4.triggers.push(...featureMatches.map(f => `feature_${f}`));
    }
  }

  // L5: 자기투영 + 의료 신뢰 (개인화된 관심)
  if (payload.age && payload.age >= 60) {
    scores.L5.score += 15;
    scores.L5.triggers.push('senior_age_self_projection');
  }
  if (payload.preferenceType && (payload.preferenceType.includes('medical') || payload.preferenceType.includes('health'))) {
    scores.L5.score += 20;
    scores.L5.triggers.push('health_self_projection');
  }

  // L0: 부재중 고객 (신규 Contact이므로 스킵, 나중에 업데이트 시 감지)
  // 기존 고객 업데이트 시에만 활용

  // 최고 점수 렌즈 찾기
  let primaryLens: Lens = 'L6'; // 기본값
  let maxScore = scores.L6.score;

  for (const [lens, data] of Object.entries(scores)) {
    if (data.score > maxScore) {
      maxScore = data.score;
      primaryLens = lens as Lens;
    }
  }

  // L6이 기본값이므로 다른 렌즈들과 어느 정도 격차 필요
  const primaryData = scores[primaryLens];
  const confidence = Math.min(100, maxScore);

  // L6 기본값에 기본 점수 추가 (다른 신호 없을 때)
  if (maxScore === 0) {
    scores.L6.score = 25; // 기본 신규 고객
    scores.L6.triggers.push('default_new_customer');
    primaryLens = 'L6';
  }

  return {
    currentLens: primaryLens,
    confidence: Math.min(100, Math.max(scores[primaryLens].score, 25)), // 최소 25점
    triggers: scores[primaryLens].triggers,
  };
}

// ============================================
// Risk Score 계산 (10가지 신호 기반)
// ============================================

/**
 * Risk Score 계산 (0-100)
 *
 * 신호별 가중치:
 * - 부재중 6개월+: +30
 * - 의료 이슈: +25
 * - 가격 민감: +20
 * - 준비도 낮음: +20
 * - 경쟁사 비교: +15
 * - 고령자 (70+): +10
 * - 예약금 미입금: +15
 * - 출발 30일 이내 미확인: +20
 * - 가족 동의 미확보: +10
 * - 재구매 위험: +15
 */
export function calculateRiskScore(
  payload: WebhookPayload,
  lens: Lens,
  segment: Segment
): RiskScoringResult {
  let riskScore = 0;
  const signals: string[] = [];

  // 신호 1: 의료/건강 이슈 (L9)
  if (payload.healthConcerns && payload.healthConcerns.length > 0) {
    riskScore += 25;
    signals.push('health_concerns');
  }

  // 신호 2: 가격 민감도 (L1)
  if (lens === 'L1' || payload.inquiryMessage?.toLowerCase().includes('비싼')) {
    riskScore += 20;
    signals.push('price_sensitive');
  }

  // 신호 3: 준비도 낮음 (L2)
  if (lens === 'L2' || (payload.inquiryMessage?.toLowerCase().match(/준비|여권|불안|어렵/) || []).length > 0) {
    riskScore += 20;
    signals.push('low_preparation_readiness');
  }

  // 신호 4: 경쟁사 비교 (L3)
  if (lens === 'L3' || (payload.competitorMentioned && payload.competitorMentioned.length > 0)) {
    riskScore += 15;
    signals.push('competitor_comparison');
  }

  // 신호 5: 고령자 (70+) - Segment E
  if (segment === 'E' || (payload.age && payload.age >= 70)) {
    riskScore += 10;
    signals.push('senior_age_segment');
  }

  // 신호 6: 예약금 미입금 (Payment 없을 때)
  if (payload.source === 'cruisedot_inquiry' && !payload.paymentId) {
    riskScore += 15;
    signals.push('no_deposit_payment');
  }

  // 신호 7: 출발 30일 이내 미최종 확인
  if (payload.departureDate) {
    const daysUntilDeparture = Math.floor(
      (new Date(payload.departureDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDeparture <= 30 && daysUntilDeparture > 0) {
      riskScore += 20;
      signals.push(`urgent_departure_${daysUntilDeparture}_days`);
    }
  }

  // 신호 8: 가족 동의 미확보 (L7)
  if (
    lens === 'L7' ||
    (payload.familyObjections && payload.familyObjections.length > 0)
  ) {
    riskScore += 10;
    signals.push('family_objections_pending');
  }

  // 신호 9: 재구매 위험 (신규 고객 중 신호 부족)
  if (payload.source === 'form_submission' && !payload.pastCruiseCount) {
    riskScore += 8;
    signals.push('new_customer_unknown_intent');
  }

  // 신호 10: 크루즈 관심도 낮음 (inquiry only, no interaction)
  if (payload.source === 'cruisedot_inquiry' && !payload.cruiseInterest) {
    riskScore += 5;
    signals.push('low_cruise_interest_clarity');
  }

  // 기본 신규 고객 점수
  if (signals.length === 0) {
    riskScore = 15; // 기본 신규 고객 위험도 (정보 부족)
    signals.push('insufficient_information');
  }

  // Risk Level 결정
  let riskLevel: RiskLevel = 'LOW';
  if (riskScore >= 70) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 50) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 30) {
    riskLevel = 'MEDIUM';
  }

  // 추천 액션
  const recommendedAction = getRecommendedRiskAction(riskLevel, signals, lens);

  return {
    riskScore: Math.min(100, riskScore),
    riskLevel,
    signals,
    recommendedAction,
  };
}

/**
 * Risk Level별 추천 액션
 */
function getRecommendedRiskAction(riskLevel: RiskLevel, signals: string[], lens: Lens): string {
  if (riskLevel === 'CRITICAL') {
    if (signals.includes('health_concerns')) {
      return 'URGENT_HEALTH_SCREENING'; // 의료 상담 긴급
    }
    if (signals.includes('urgent_departure_0_days')) {
      return 'EMERGENCY_LAST_MINUTE_CALL'; // 긴급 콜
    }
    if (signals.includes('price_sensitive')) {
      return 'PRICE_NEGOTIATION_CALL'; // 가격 협상
    }
    return 'IMMEDIATE_INTERVENTION'; // 즉시 개입
  }

  if (riskLevel === 'HIGH') {
    if (signals.includes('low_preparation_readiness')) {
      return 'PREPARATION_GUIDANCE_SMS'; // 준비 가이드
    }
    if (signals.includes('family_objections_pending')) {
      return 'FAMILY_PERSUASION_CALL'; // 가족 설득
    }
    if (signals.includes('competitor_comparison')) {
      return 'DIFFERENTIATION_MESSAGE'; // 차별성 강조
    }
    return 'ESCALATE_TO_MANAGER'; // 매니저 에스컬레이션
  }

  if (riskLevel === 'MEDIUM') {
    if (signals.includes('no_deposit_payment')) {
      return 'PAYMENT_REMINDER_SMS'; // 결제 상기
    }
    if (signals.includes('low_cruise_interest_clarity')) {
      return 'INTEREST_CLARIFICATION_SMS'; // 관심도 확인
    }
    return 'NURTURE_SEQUENCE_DAY0'; // 양육 SMS Day 0
  }

  // LOW: 정상
  return 'STANDARD_DAY0_SMS'; // 표준 Day 0 SMS
}

// ============================================
// 전화번호 정규화
// ============================================

/**
 * 한국 전화번호 정규화
 * 010-1234-5678 → 01012345678
 * 010 1234 5678 → 01012345678
 * 8801012345678 (국제) → 01012345678
 */
export function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\D/g, ''); // 숫자만 추출

  // 국제 코드 제거
  if (normalized.startsWith('8882')) {
    normalized = normalized.slice(2); // 882 제거
  }

  // 0으로 시작하지 않으면 0 추가
  if (!normalized.startsWith('0')) {
    normalized = '0' + normalized;
  }

  return normalized;
}

// ============================================
// Contact 자동 생성 / 업데이트
// ============================================

export async function createOrUpdateContact(
  organizationId: string,
  payload: WebhookPayload
): Promise<ContactAutoCreateResult> {
  try {
    // 1. 전화번호 정규화 및 검증
    const normalizedPhone = normalizePhoneNumber(payload.phone);
    if (!normalizedPhone.startsWith('0') || normalizedPhone.length < 10) {
      logger.error('[ContactAutoCreator] 유효하지 않은 전화번호', {
        originalPhone: payload.phone,
        normalizedPhone,
      });
      return {
        success: false,
        isNew: false,
        segment: 'B',
        lens: 'L6',
        lensConfidence: 0,
        riskScore: 100,
        riskLevel: 'CRITICAL',
        tags: [],
        error: 'Invalid phone number',
      };
    }

    // 2. Segment 분류
    const segment = detectSegmentByAge(
      payload.age,
      payload.ageRange,
      payload.preferenceType,
      payload.familyComposition
    );

    // 3. Lens 감지 (신호 + 신뢰도)
    const lensResult = detectLens(payload);

    // 4. Risk Score 계산
    const riskResult = calculateRiskScore(payload, lensResult.currentLens, segment);

    // 5. Tags 자동 생성 (segment_lens_risk_priority 형식)
    const tags = generateTags(segment, lensResult.currentLens, riskResult.riskLevel, payload.source);

    // 6. 기존 Contact 조회 (phone 기반)
    let existingContact = await prisma.contact.findFirst({
      where: {
        organizationId,
        phone: normalizedPhone,
        deletedAt: null, // 삭제되지 않은 것만
      },
    });

    // 7. Contact 생성 또는 업데이트
    const contact = existingContact
      ? await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            // 기존 Contact 업데이트 (중요 필드만)
            name: payload.name,
            email: payload.email || existingContact.email,
            age: payload.age || existingContact.age,
            segment: segment,
            autoSegment: segment,
            segmentUpdatedAt: new Date(),

            // Cruise 관련 정보
            cruiseInterest: payload.cruiseInterest || existingContact.cruiseInterest,
            budgetRange: payload.budgetRange || existingContact.budgetRange,
            departureDate: payload.departureDate ? new Date(payload.departureDate) : existingContact.departureDate,

            // Risk Score 업데이트
            riskScore: riskResult.riskScore,
            riskLevel: riskResult.riskLevel,
            riskSignals: riskResult.signals,
            riskAssessmentAt: new Date(),

            // 추적용 태그
            tags: Array.from(new Set([
              ...(existingContact.tags || []),
              ...tags,
            ])),

            // 마지막 연락 시간 업데이트
            lastContactedAt: new Date(),

            // 심리학 메타데이터
            lensMetadata: {
              ...(existingContact.lensMetadata || {}),
              currentLens: lensResult.currentLens,
              confidence: lensResult.confidence,
              triggers: lensResult.triggers,
              detectedAt: new Date().toISOString(),
              detectionMethod: 'auto_webhook',
              recommendedAction: riskResult.recommendedAction,
            },

            // Lens별 특수 필드
            ...(lensResult.currentLens === 'L2' && {
              anxietyScore: 70,
              anxietyCategory: 'high',
              preparationStage: 'inquiry',
              anxietyAssessmentAt: new Date(),
            }),
            ...(lensResult.currentLens === 'L3' && {
              competitorMentioned: payload.competitorMentioned?.[0] ? true : false,
              competitorNames: payload.competitorMentioned || [],
              lastCompetitorMentionAt: new Date(),
            }),
            ...(lensResult.currentLens === 'L7' && {
              familyComposition: payload.familyComposition,
              familyObjections: payload.familyObjections || [],
              familyAssessmentCompletedAt: new Date(),
            }),
            ...(lensResult.currentLens === 'L8' && {
              cruiseCount: (payload.pastCruiseCount || 0) + 1,
              cruiseReturnInterestLevel: 80,
            }),
            ...(lensResult.currentLens === 'L9' && {
              healthConcerns: payload.healthConcerns?.join(',') || null,
            }),
          },
        })
      : await prisma.contact.create({
          data: {
            // 신규 Contact 생성
            organizationId,
            phone: normalizedPhone,
            name: payload.name,
            email: payload.email || null,

            // 기본 정보
            age: payload.age,
            segment: segment,
            autoSegment: segment,
            channel: 'webhook',
            type: 'LEAD',

            // Cruise 관련
            cruiseInterest: payload.cruiseInterest,
            budgetRange: payload.budgetRange,
            departureDate: payload.departureDate ? new Date(payload.departureDate) : null,

            // Risk Score 초기화
            riskScore: riskResult.riskScore,
            riskLevel: riskResult.riskLevel,
            riskSignals: riskResult.signals,
            riskAssessmentAt: new Date(),

            // 추적용 태그
            tags: [...tags, 'loop6-agent-d'],

            // 심리학 메타데이터
            lensMetadata: {
              currentLens: lensResult.currentLens,
              confidence: lensResult.confidence,
              triggers: lensResult.triggers,
              detectedAt: new Date().toISOString(),
              detectionMethod: 'auto_webhook',
              recommendedAction: riskResult.recommendedAction,
            },

            // Lens별 특수 필드 초기화
            ...(lensResult.currentLens === 'L2' && {
              anxietyScore: 70,
              anxietyCategory: 'high',
              preparationStage: 'inquiry',
              anxietyAssessmentAt: new Date(),
            }),
            ...(lensResult.currentLens === 'L3' && {
              competitorMentioned: payload.competitorMentioned?.[0] ? true : false,
              competitorNames: payload.competitorMentioned || [],
              lastCompetitorMentionAt: new Date(),
            }),
            ...(lensResult.currentLens === 'L7' && {
              familyComposition: payload.familyComposition,
              familyObjections: payload.familyObjections || [],
              familyAssessmentCompletedAt: new Date(),
            }),
            ...(lensResult.currentLens === 'L8' && {
              cruiseCount: payload.pastCruiseCount || 1,
              cruiseReturnInterestLevel: 80,
              ltvTotal: 2500, // 예상 LTV
            }),
            ...(lensResult.currentLens === 'L9' && {
              healthConcerns: payload.healthConcerns?.join(',') || null,
            }),
          },
        });

    logger.log('[ContactAutoCreator] Contact 생성/업데이트 완료', {
      contactId: contact.id,
      phone: normalizedPhone,
      segment,
      lens: lensResult.currentLens,
      lensConfidence: lensResult.confidence,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      isNew: !existingContact,
      source: payload.source,
    });

    return {
      success: true,
      contactId: contact.id,
      isNew: !existingContact,
      segment,
      lens: lensResult.currentLens,
      lensConfidence: lensResult.confidence,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      tags,
    };
  } catch (error: unknown) {
    logger.error('[ContactAutoCreator] 오류 발생', {
      error: error instanceof Error ? error.message : String(error),
      payload: {
        ...payload,
        phone: payload.phone ? payload.phone.slice(-4) : 'unknown', // 마지막 4자리만
      },
    });

    return {
      success: false,
      isNew: false,
      segment: 'B',
      lens: 'L6',
      lensConfidence: 0,
      riskScore: 100,
      riskLevel: 'CRITICAL',
      tags: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Tags 자동 생성
// ============================================

/**
 * Tags 자동 생성 (segment_lens_risk 형식)
 * 예: "A_L1_HIGH_URGENT", "B_L2_MEDIUM_NORMAL", "C_L9_LOW_CAREFUL"
 */
export function generateTags(
  segment: Segment,
  lens: Lens,
  riskLevel: RiskLevel,
  source: Source
): string[] {
  const tags: string[] = [];

  // 기본 태그
  tags.push(`source:${source}`);
  tags.push(`segment:${segment}`);
  tags.push(`lens:${lens}`);
  tags.push(`risk:${riskLevel}`);

  // 복합 태그 (segment_lens_risk 형식)
  const riskShort = riskLevel === 'CRITICAL' ? 'CRITICAL' : riskLevel === 'HIGH' ? 'HIGH' : riskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  const priorityShort = riskLevel === 'CRITICAL' ? 'URGENT' : riskLevel === 'HIGH' ? 'PRIORITY' : 'NORMAL';
  tags.push(`${segment}_${lens}_${riskShort}_${priorityShort}`);

  // Lens 특수 태그
  if (lens === 'L0') tags.push('reactivation_needed');
  if (lens === 'L1') tags.push('price_sensitive');
  if (lens === 'L2') tags.push('prep_anxiety');
  if (lens === 'L3') tags.push('competitor_aware');
  if (lens === 'L4') tags.push('feature_focused');
  if (lens === 'L5') tags.push('health_conscious');
  if (lens === 'L6') tags.push('timing_conscious');
  if (lens === 'L7') tags.push('family_decision');
  if (lens === 'L8') tags.push('repeat_customer');
  if (lens === 'L9') tags.push('trust_seeking');
  if (lens === 'L10') tags.push('urgent_buyer');

  return tags;
}

// ============================================
// Batch 처리 (대량 Contact 생성)
// ============================================

export interface BatchCreatePayload {
  organizationId: string;
  payloads: WebhookPayload[];
}

export async function createContactsBatch(batch: BatchCreatePayload) {
  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const payload of batch.payloads) {
    const result = await createOrUpdateContact(batch.organizationId, payload);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  logger.log('[ContactAutoCreator] Batch 처리 완료', {
    total: batch.payloads.length,
    success: successCount,
    error: errorCount,
  });

  return {
    total: batch.payloads.length,
    success: successCount,
    error: errorCount,
    results,
  };
}
