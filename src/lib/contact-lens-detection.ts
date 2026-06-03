/**
 * Contact Lens Detection Engine
 * Domain A (CRM 거장): L0-L10 자동 분류 엔진
 *
 * P0: Grant Cardone 10렌즈를 자동으로 감지하고 Contact를 분류
 * - L0: 부재중 고객 재활성화 (3-6m, 6-12m, 1y+)
 * - L1: 가격 이의 민감도
 * - L2: 준비 복잡도 (불안 점수)
 * - L3: 차별성 미인지 (경쟁사 언급)
 * - L4-L10: 세그먼트별 추가 렌즈
 */

import { Contact } from '@prisma/client';

export interface LensDetectionResult {
  lensType: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10';
  lensLabel: string;
  confidenceScore: number; // 0-100
  detectedAt: Date;
  trigger?: string; // 감지 트리거
}

export interface ContactRiskFlag {
  flagType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  description: string;
  suggestedAction?: string;
}

/**
 * L0: 부재중 고객 재활성화 감지
 * 마지막 접촉이 오래된 고객을 자동 감지
 */
export function detectL0Reactivation(contact: Contact): LensDetectionResult | null {
  const now = new Date();
  const lastContacted = contact.lastContactedAt || contact.createdAt;
  const daysSinceLastContact = Math.floor((now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24));

  let trigger: string | undefined;
  let confidenceScore = 0;

  // 부재중 구간 판정
  if (daysSinceLastContact >= 365) {
    trigger = '1년 이상 부재중';
    confidenceScore = 95;
  } else if (daysSinceLastContact >= 180) {
    trigger = '6-12개월 부재중';
    confidenceScore = 85;
  } else if (daysSinceLastContact >= 90) {
    trigger = '3-6개월 부재중';
    confidenceScore = 75;
  } else {
    return null; // L0 미적용
  }

  return {
    lensType: 'L0',
    lensLabel: '부재중 고객 재활성화',
    confidenceScore,
    detectedAt: now,
    trigger,
  };
}

/**
 * L1: 가격 이의 민감도 감지
 * 이전 접촉 노트나 태그에서 "가격", "비싸다", "경쟁사" 키워드 감지
 */
export function detectL1PriceObjection(contact: Contact, adminMemo?: string): LensDetectionResult | null {
  const keywords = ['가격', '비싸', '경쟁사', '싸다', '할인', '비용', '예산', '저렴'];
  const memoText = (adminMemo || contact.adminMemo || '').toLowerCase();
  const hasKeyword = keywords.some(k => memoText.includes(k));
  const hasPriceTag = contact.tags.some(t => t.toLowerCase().includes('price') || t.toLowerCase().includes('가격'));

  if (!hasKeyword && !hasPriceTag) {
    return null;
  }

  return {
    lensType: 'L1',
    lensLabel: '가격 이의 민감도',
    confidenceScore: hasPriceTag ? 90 : 60,
    detectedAt: new Date(),
    trigger: '가격 관련 키워드/태그 감지',
  };
}

/**
 * L2: 준비 불안도 감지
 * 불안 점수, 비자 문제, 건강 문제, 여권 유효기간 등으로 판정
 */
export function detectL2PreparationAnxiety(contact: Contact): LensDetectionResult | null {
  let riskFactors = 0;
  let trigger = '';

  if (contact.anxietyScore && contact.anxietyScore > 50) {
    riskFactors++;
    trigger += `불안도 ${contact.anxietyScore}점 `;
  }

  if (contact.visaRequired) {
    riskFactors++;
    trigger += '비자 필요 ';
  }

  if (contact.passportDaysLeft && contact.passportDaysLeft < 90) {
    riskFactors++;
    trigger += `여권 유효기간 ${contact.passportDaysLeft}일 `;
  }

  if (contact.healthConcerns) {
    riskFactors++;
    trigger += `건강 문제: ${contact.healthConcerns} `;
  }

  if (contact.preparationStage && !['ready', 'none'].includes(contact.preparationStage)) {
    riskFactors++;
  }

  if (riskFactors === 0) {
    return null;
  }

  const confidenceScore = Math.min(100, 40 + riskFactors * 15);

  return {
    lensType: 'L2',
    lensLabel: '준비 복잡도 불안',
    confidenceScore,
    detectedAt: new Date(),
    trigger: trigger.trim(),
  };
}

/**
 * L3: 차별성 미인지 감지
 * 경쟁사 언급, 비교 문의 등으로 판정
 */
export function detectL3Differentiation(contact: Contact): LensDetectionResult | null {
  if (contact.competitorMentioned === false) {
    return null;
  }

  const confidenceScore = contact.differentiationScore > 0 ? contact.differentiationScore : 70;

  return {
    lensType: 'L3',
    lensLabel: '차별성 미인지',
    confidenceScore,
    detectedAt: new Date(),
    trigger: `경쟁사 언급: ${(contact.competitorNames ?? []).join(', ')}`,
  };
}

/**
 * L5: 자기투영 감지
 * 자신의 건강 상태, 가족 건강 문제 등으로 판정
 */
export function detectL5SelfProjection(contact: Contact): LensDetectionResult | null {
  let riskFactors = 0;
  let trigger = '';

  if (contact.selfProjectionScore && contact.selfProjectionScore > 50) {
    riskFactors++;
    trigger += `자기투영도 ${contact.selfProjectionScore}점 `;
  }

  if (contact.personalHealthConcern) {
    riskFactors++;
    trigger += `본인 건강 문제: ${contact.personalHealthConcern} `;
  }

  if (contact.compoundHealthRisk) {
    riskFactors++;
    trigger += '배우자+본인 건강 위험 ';
  }

  if (riskFactors === 0) {
    return null;
  }

  const confidenceScore = Math.min(100, 50 + riskFactors * 15);

  return {
    lensType: 'L5',
    lensLabel: '자기투영 (건강/가족)',
    confidenceScore,
    detectedAt: new Date(),
    trigger: trigger.trim(),
  };
}

/**
 * L6: 타이밍/손실회피 감지
 * 가격 마감일, 좌석 부족, 시간 제한 등으로 판정
 */
export function detectL6TimingUrgency(contact: Contact): LensDetectionResult | null {
  let riskFactors = 0;
  let trigger = '';

  if (contact.timingUrgencyScore && contact.timingUrgencyScore > 50) {
    riskFactors++;
    trigger += `타이밍 긴급도 ${contact.timingUrgencyScore}점 `;
  }

  if (contact.priceDeadlineDate && new Date() < contact.priceDeadlineDate) {
    const daysLeft = Math.floor((contact.priceDeadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    riskFactors++;
    trigger += `가격 마감 ${daysLeft}일 `;
  }

  if (contact.seatAvailability && contact.seatAvailability < 5) {
    riskFactors++;
    trigger += `좌석 부족 (${contact.seatAvailability}개) `;
  }

  if (riskFactors === 0) {
    return null;
  }

  const confidenceScore = Math.min(100, 50 + riskFactors * 15);

  return {
    lensType: 'L6',
    lensLabel: '타이밍/손실회피',
    confidenceScore,
    detectedAt: new Date(),
    trigger: trigger.trim(),
  };
}

/**
 * L7: 동반자 설득 감지
 * 배우자, 부모, 친구 등 동반자의 동의 필요 여부로 판정
 */
export function detectL7CompanionPersuasion(contact: Contact): LensDetectionResult | null {
  let riskFactors = 0;
  let trigger = '';

  if (contact.familyComposition && contact.familyComposition !== 'single') {
    riskFactors++;
    trigger += `가족 구성: ${contact.familyComposition} `;
  }

  if (contact.decisionMaker && contact.decisionMaker !== 'self') {
    riskFactors++;
    trigger += `의사결정자: ${contact.decisionMaker} `;
  }

  if (contact.familyInfluenceScore && contact.familyInfluenceScore > 50) {
    riskFactors++;
    trigger += `가족 영향력 ${contact.familyInfluenceScore}점 `;
  }

  if (contact.companionPersuasionStage && contact.companionPersuasionStage !== 'agreed') {
    riskFactors++;
  }

  if (riskFactors === 0) {
    return null;
  }

  const confidenceScore = Math.min(100, 50 + riskFactors * 12);

  return {
    lensType: 'L7',
    lensLabel: '동반자 설득',
    confidenceScore,
    detectedAt: new Date(),
    trigger: trigger.trim(),
  };
}

/**
 * L8: 재방문 습관화 감지
 * 이전 크루즈 경험, 만족도, LTV로 판정
 */
export function detectL8RepurchaseHabit(contact: Contact): LensDetectionResult | null {
  let confidenceScore = 0;
  let trigger = '';

  if (contact.cruiseCount && contact.cruiseCount > 0) {
    confidenceScore += Math.min(30, contact.cruiseCount * 10);
    trigger += `크루즈 경험 ${contact.cruiseCount}회 `;
  }

  if (contact.lastCruiseSatisfactionScore && contact.lastCruiseSatisfactionScore >= 8) {
    confidenceScore += 30;
    trigger += `만족도 ${contact.lastCruiseSatisfactionScore}/10 `;
  }

  if (contact.ltvTotal && contact.ltvTotal > 10000) {
    confidenceScore += 20;
    trigger += `LTV $${contact.ltvTotal} `;
  }

  if (contact.cruiseReturnInterestLevel && contact.cruiseReturnInterestLevel > 60) {
    confidenceScore += 20;
  }

  if (confidenceScore < 30) {
    return null;
  }

  return {
    lensType: 'L8',
    lensLabel: '재방문 습관화',
    confidenceScore: Math.min(100, confidenceScore),
    detectedAt: new Date(),
    trigger: trigger.trim(),
  };
}

/**
 * L10: 즉시 구매 클로징 준비 감지
 * 의사결정 단계, 감정적 연결, 긴박감으로 판정
 */
export function detectL10ImmediatePurchaseClosing(contact: Contact): LensDetectionResult | null {
  let riskFactors = 0;
  let trigger = '';

  if (contact.closingStage && contact.closingStage === 'ready_close') {
    riskFactors += 2;
    trigger += '클로징 준비 완료 ';
  }

  if (contact.emotionalConnectionScore && contact.emotionalConnectionScore > 70) {
    riskFactors++;
    trigger += `감정적 연결 ${contact.emotionalConnectionScore}점 `;
  }

  if (contact.urgencyLevel && contact.urgencyLevel > 70) {
    riskFactors++;
    trigger += `긴박감 ${contact.urgencyLevel}점 `;
  }

  if (contact.urgencyExpiresAt && new Date() < contact.urgencyExpiresAt) {
    riskFactors++;
  }

  if (contact.l10ClosingScore && contact.l10ClosingScore > 70) {
    riskFactors++;
    trigger += `클로징 준비도 ${contact.l10ClosingScore}점 `;
  }

  if (riskFactors === 0) {
    return null;
  }

  const confidenceScore = Math.min(100, 40 + riskFactors * 15);

  return {
    lensType: 'L10',
    lensLabel: '즉시 구매 클로징',
    confidenceScore,
    detectedAt: new Date(),
    trigger: trigger.trim(),
  };
}

/**
 * Contact 렌즈 자동 감지 (모든 L0-L10 확인)
 */
export function detectContactLens(contact: Contact, adminMemo?: string): LensDetectionResult[] {
  const detections: LensDetectionResult[] = [];

  const l0 = detectL0Reactivation(contact);
  if (l0) detections.push(l0);

  const l1 = detectL1PriceObjection(contact, adminMemo);
  if (l1) detections.push(l1);

  const l2 = detectL2PreparationAnxiety(contact);
  if (l2) detections.push(l2);

  const l3 = detectL3Differentiation(contact);
  if (l3) detections.push(l3);

  const l5 = detectL5SelfProjection(contact);
  if (l5) detections.push(l5);

  const l6 = detectL6TimingUrgency(contact);
  if (l6) detections.push(l6);

  const l7 = detectL7CompanionPersuasion(contact);
  if (l7) detections.push(l7);

  const l8 = detectL8RepurchaseHabit(contact);
  if (l8) detections.push(l8);

  const l10 = detectL10ImmediatePurchaseClosing(contact);
  if (l10) detections.push(l10);

  return detections;
}
