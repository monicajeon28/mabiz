/**
 * Contact Risk Flag System
 * Domain A (CRM 거장): 10가지 Risk Flag 자동 생성
 *
 * P0: Contact의 위험 신호를 자동 감지하고 Risk Score 계산
 * - 부재중 신호 (3-6m, 6-12m, 1y+)
 * - 가격 민감도
 * - 준비 복잡도
 * - 경쟁사 언급
 * - 건강 리스크
 * - 의료 신뢰도
 * - 시간 압박
 * - 가족 설득 어려움
 * - 약속 이행 가능성
 * - Churn 신호
 */

import { Contact } from '@prisma/client';

export interface RiskFlagResult {
  flagType: string;
  flagCode: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  description: string;
  suggestedAction?: string;
  triggeredAt: Date;
}

export interface ContactRiskSummary {
  totalRiskScore: number; // 0-100 (가중 평균)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: RiskFlagResult[];
  lastCalculatedAt: Date;
}

/**
 * Risk Flag 1: 부재중 3-6개월
 */
export function flagInactivity3_6M(contact: Contact): RiskFlagResult | null {
  const now = new Date();
  const lastContacted = contact.lastContactedAt || contact.createdAt;
  const daysSinceLastContact = Math.floor((now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastContact < 90 || daysSinceLastContact >= 180) {
    return null;
  }

  return {
    flagType: '부재중 신호 (3-6개월)',
    flagCode: 'INACTIVITY_3M_6M',
    severity: 'medium',
    riskScore: 40 + Math.floor((daysSinceLastContact - 90) / 90 * 20),
    description: `${daysSinceLastContact}일 동안 접촉 없음`,
    suggestedAction: '재활성화 SMS 시퀀스 시작 (Day 0-3)',
    triggeredAt: now,
  };
}

/**
 * Risk Flag 2: 부재중 6-12개월
 */
export function flagInactivity6_12M(contact: Contact): RiskFlagResult | null {
  const now = new Date();
  const lastContacted = contact.lastContactedAt || contact.createdAt;
  const daysSinceLastContact = Math.floor((now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastContact < 180 || daysSinceLastContact >= 365) {
    return null;
  }

  return {
    flagType: '부재중 신호 (6-12개월)',
    flagCode: 'INACTIVITY_6M_12M',
    severity: 'high',
    riskScore: 60 + Math.floor((daysSinceLastContact - 180) / 185 * 20),
    description: `${daysSinceLastContact}일 동안 접촉 없음`,
    suggestedAction: '긴급 재활성화 캠페인 + 특별 할인 제안',
    triggeredAt: now,
  };
}

/**
 * Risk Flag 3: 부재중 1년 이상
 */
export function flagInactivity1YearPlus(contact: Contact): RiskFlagResult | null {
  const now = new Date();
  const lastContacted = contact.lastContactedAt || contact.createdAt;
  const daysSinceLastContact = Math.floor((now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastContact < 365) {
    return null;
  }

  return {
    flagType: '부재중 신호 (1년 이상)',
    flagCode: 'INACTIVITY_1Y_PLUS',
    severity: 'critical',
    riskScore: 85,
    description: `${daysSinceLastContact}일(${Math.floor(daysSinceLastContact / 365)}년) 동안 접촉 없음 - Churn 위험 매우 높음`,
    suggestedAction: 'Win-Back 캠페인 + 지사장 직접 연락',
    triggeredAt: now,
  };
}

/**
 * Risk Flag 4: 가격 민감도 높음
 */
export function flagPriceSensitivity(contact: Contact, adminMemo?: string): RiskFlagResult | null {
  const memoText = (adminMemo || contact.adminMemo || '').toLowerCase();
  const keywords = ['가격', '비싸', '할인', '경쟁사', '싸다', '예산', '비용'];
  const hasKeyword = keywords.some(k => memoText.includes(k));
  const hasPriceTag = contact.tags.some(t => t.toLowerCase().includes('price'));

  if (!hasKeyword && !hasPriceTag) {
    return null;
  }

  return {
    flagType: '가격 민감도',
    flagCode: 'PRICE_SENSITIVITY',
    severity: 'medium',
    riskScore: hasPriceTag ? 70 : 50,
    description: '고객이 가격에 민감한 신호 감지',
    suggestedAction: '가치 재정의 (ROI, 건강 이득, 경험의 무가치성) SMS 시퀀스',
    triggeredAt: new Date(),
  };
}

/**
 * Risk Flag 5: 준비 복잡도 높음 (불안도 > 60)
 */
export function flagPreparationComplexity(contact: Contact): RiskFlagResult | null {
  let complexityScore = 0;
  let triggers: string[] = [];

  if (contact.anxietyScore && contact.anxietyScore > 50) {
    complexityScore += Math.floor(contact.anxietyScore / 2);
    triggers.push(`불안도 ${contact.anxietyScore}점`);
  }

  if (contact.visaRequired) {
    complexityScore += 30;
    triggers.push('비자 필요');
  }

  if (contact.passportDaysLeft && contact.passportDaysLeft < 90) {
    complexityScore += 25;
    triggers.push(`여권 ${contact.passportDaysLeft}일`);
  }

  if (contact.healthConcerns) {
    complexityScore += 20;
    triggers.push(`건강 문제: ${contact.healthConcerns}`);
  }

  if (complexityScore < 50) {
    return null;
  }

  return {
    flagType: '준비 복잡도',
    flagCode: 'PREPARATION_COMPLEXITY',
    severity: complexityScore > 70 ? 'high' : 'medium',
    riskScore: Math.min(100, complexityScore),
    description: `고객의 준비 과정이 복잡함: ${triggers.join(', ')}`,
    suggestedAction: '5단계 중재 질문으로 불안 해소',
    triggeredAt: new Date(),
  };
}

/**
 * Risk Flag 6: 경쟁사 언급
 */
export function flagCompetitorMention(contact: Contact): RiskFlagResult | null {
  if (!contact.competitorMentioned) {
    return null;
  }

  return {
    flagType: '경쟁사 비교',
    flagCode: 'COMPETITOR_MENTION',
    severity: 'high',
    riskScore: 65,
    description: `경쟁사 언급: ${(contact.competitorNames ?? []).join(', ')} - 차별성 이해도 ${contact.differentiationScore}%`,
    suggestedAction: '경쟁사 비교 분석 + 우리 고유가치 강조 (L3 차별성 SMS)',
    triggeredAt: new Date(),
  };
}

/**
 * Risk Flag 7: 건강/의료 신뢰도 부족
 */
export function flagMedicalTrustGap(contact: Contact): RiskFlagResult | null {
  if (
    !contact.personalHealthConcern &&
    !contact.spouseHealthConcern &&
    !contact.healthConcerns &&
    !contact.compoundHealthRisk
  ) {
    return null;
  }

  let riskScore = 0;
  let triggers: string[] = [];

  if (contact.personalHealthConcern) {
    riskScore += 30;
    triggers.push(`본인: ${contact.personalHealthConcern}`);
  }

  if (contact.spouseHealthConcern) {
    riskScore += 20;
    triggers.push(`배우자: ${contact.spouseHealthConcern}`);
  }

  if (contact.compoundHealthRisk) {
    riskScore += 25;
  }

  if (!contact.medicalAuthorityCredential) {
    riskScore += 10;
    triggers.push('의료 권위성 미제시');
  }

  return {
    flagType: '의료 신뢰도 부족',
    flagCode: 'MEDICAL_TRUST_GAP',
    severity: riskScore > 60 ? 'high' : 'medium',
    riskScore: Math.min(100, riskScore),
    description: `건강 관련 우려: ${triggers.join(', ')}`,
    suggestedAction: '의료진 인증 + 건강 증명 자료 제시',
    triggeredAt: new Date(),
  };
}

/**
 * Risk Flag 8: 시간 압박 (결정 윈도우 임박)
 */
export function flagTimeUrgency(contact: Contact): RiskFlagResult | null {
  let riskScore = 0;
  let triggers: string[] = [];

  if (contact.priceDeadlineDate && new Date() < contact.priceDeadlineDate) {
    const daysLeft = Math.floor((contact.priceDeadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) {
      riskScore += 70;
      triggers.push(`가격 마감 ${daysLeft}일`);
    }
  }

  if (contact.decisionWindowExpiresAt && new Date() < contact.decisionWindowExpiresAt) {
    const daysLeft = Math.floor((contact.decisionWindowExpiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3) {
      riskScore += 50;
      triggers.push(`결정 윈도우 ${daysLeft}일`);
    }
  }

  if (riskScore === 0) {
    return null;
  }

  return {
    flagType: '시간 압박',
    flagCode: 'TIME_URGENCY',
    severity: riskScore > 70 ? 'critical' : 'high',
    riskScore: Math.min(100, riskScore),
    description: `시간 제약 임박: ${triggers.join(', ')}`,
    suggestedAction: '긴박감 강조 SMS + 최종 결정 촉구 전화',
    triggeredAt: new Date(),
  };
}

/**
 * Risk Flag 9: 가족 설득 어려움
 */
export function flagFamilyDisagreement(contact: Contact): RiskFlagResult | null {
  let riskScore = 0;
  let triggers: string[] = [];

  if (contact.decisionMaker && contact.decisionMaker !== 'self') {
    riskScore += 20;
    triggers.push(`의사결정자: ${contact.decisionMaker}`);
  }

  if (contact.spouseEngagement && !['convinced', 'interested'].includes(contact.spouseEngagement)) {
    riskScore += 30;
    triggers.push(`배우자: ${contact.spouseEngagement}`);
  }

  if (contact.parentEngagement && !['convinced', 'interested'].includes(contact.parentEngagement)) {
    riskScore += 25;
    triggers.push(`부모: ${contact.parentEngagement}`);
  }

  if (contact.familyObjections && contact.familyObjections.length > 0) {
    riskScore += 20;
    triggers.push(`가족 이의: ${contact.familyObjections.join(', ')}`);
  }

  if (riskScore === 0) {
    return null;
  }

  return {
    flagType: '가족 설득 어려움',
    flagCode: 'FAMILY_DISAGREEMENT',
    severity: riskScore > 60 ? 'high' : 'medium',
    riskScore: Math.min(100, riskScore),
    description: `가족 동의 부족: ${triggers.join(', ')}`,
    suggestedAction: '배우자/부모 동의 획득 (L7 동반자 설득)',
    triggeredAt: new Date(),
  };
}

/**
 * Risk Flag 10: 약속 불이행 신호
 */
export function flagCommitmentDefault(contact: Contact): RiskFlagResult | null {
  let riskScore = 0;
  let triggers: string[] = [];

  // 여러 번 약속했지만 구매 안 함
  if (contact.l10ClosingAttempts && contact.l10ClosingAttempts > 2 && !contact.l10ConversionAt) {
    riskScore += 50;
    triggers.push(`${contact.l10ClosingAttempts}회 클로징 실패`);
  }

  // SMS Day 0-3 전부 발송했지만 응답 없음
  if (
    contact.smsDay0Sent &&
    contact.smsDay1Sent &&
    contact.smsDay2Sent &&
    contact.smsDay3Sent &&
    !contact.purchasedAt
  ) {
    riskScore += 30;
    triggers.push('Day 0-3 SMS 무응답');
  }

  // 렌즈 시퀀스 시작했지만 진전 없음
  if (contact.differentiationSequenceStartedAt) {
    const daysSinceSequence = Math.floor((new Date().getTime() - contact.differentiationSequenceStartedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceSequence > 14) {
      riskScore += 30;
      triggers.push(`시퀀스 ${daysSinceSequence}일 진전 없음`);
    }
  }

  if (riskScore === 0) {
    return null;
  }

  return {
    flagType: '약속 불이행',
    flagCode: 'COMMITMENT_DEFAULT',
    severity: riskScore > 60 ? 'high' : 'medium',
    riskScore: Math.min(100, riskScore),
    description: `고객의 구매 약속 불이행: ${triggers.join(', ')}`,
    suggestedAction: '이의 대응 재검토 + 새로운 렌즈 적용 시도',
    triggeredAt: new Date(),
  };
}

/**
 * 모든 Risk Flag 계산
 */
export function calculateContactRiskFlags(contact: Contact, adminMemo?: string): ContactRiskSummary {
  const flags: RiskFlagResult[] = [];

  const flag1 = flagInactivity3_6M(contact);
  if (flag1) flags.push(flag1);

  const flag2 = flagInactivity6_12M(contact);
  if (flag2) flags.push(flag2);

  const flag3 = flagInactivity1YearPlus(contact);
  if (flag3) flags.push(flag3);

  const flag4 = flagPriceSensitivity(contact, adminMemo);
  if (flag4) flags.push(flag4);

  const flag5 = flagPreparationComplexity(contact);
  if (flag5) flags.push(flag5);

  const flag6 = flagCompetitorMention(contact);
  if (flag6) flags.push(flag6);

  const flag7 = flagMedicalTrustGap(contact);
  if (flag7) flags.push(flag7);

  const flag8 = flagTimeUrgency(contact);
  if (flag8) flags.push(flag8);

  const flag9 = flagFamilyDisagreement(contact);
  if (flag9) flags.push(flag9);

  const flag10 = flagCommitmentDefault(contact);
  if (flag10) flags.push(flag10);

  // 총 Risk Score 계산 (가중 평균)
  let totalRiskScore = 0;
  if (flags.length > 0) {
    const weights: { [key in 'critical' | 'high' | 'medium' | 'low']: number } = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    flags.forEach(flag => {
      const weight = weights[flag.severity];
      weightedSum += flag.riskScore * weight;
      totalWeight += weight;
    });

    totalRiskScore = Math.floor(weightedSum / totalWeight);
  }

  const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
    totalRiskScore < 30 ? 'low' : totalRiskScore < 60 ? 'medium' : totalRiskScore < 80 ? 'high' : 'critical';

  return {
    totalRiskScore,
    riskLevel,
    flags,
    lastCalculatedAt: new Date(),
  };
}
