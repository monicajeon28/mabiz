/**
 * Contact Auto-Segmentation Engine
 * Domain A (CRM 거장): 렌즈 × 위험도 × 인구통계 자동 분류
 *
 * P0: Contact를 자동으로 세그먼트 분류
 * - 렌즈 조합 분류 (L0, L1, L2, L3, L5, L6, L7, L8, L10)
 * - 위험도 레벨 (Low, Medium, High, Critical)
 * - 인구통계 세그먼트 (나이, 가족, 구매력 등)
 * - 다음 액션 자동 스케줄링
 */

import { Contact } from '@prisma/client';
import { LensDetectionResult, detectContactLens } from './contact-lens-detection';
import { ContactRiskSummary, calculateContactRiskFlags } from './contact-risk-flags';

export interface AutoSegmentResult {
  segmentId: string; // e.g., "L0-HIGH-FAMILY-GOLDMEMBER"
  primaryLens: string; // L0, L1, L2, ...
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  demographicSegment: string; // SINGLE, COUPLE, FAMILY, BUSINESS
  valueSegment: string; // GOLD, SILVER, BRONZE, LEAD
  description: string;
  recommendedActions: string[];
  nextActionScheduledAt?: Date;
}

export interface ContactSegmentationSummary {
  contactId: string;
  autoSegment: AutoSegmentResult;
  lenses: LensDetectionResult[];
  riskSummary: ContactRiskSummary;
  segmentUpdatedAt: Date;
}

/**
 * 인구통계 세그먼트 판정
 * SINGLE, COUPLE, FAMILY, BUSINESS
 */
export function determineDemographicSegment(contact: Contact): string {
  // FAMILY: 자녀 있음 또는 가족 여행
  if (contact.childrenCount && contact.childrenCount > 0) {
    return 'FAMILY';
  }

  // COUPLE: 결혼 상태
  if (contact.marriageStatus === '기혼' || contact.maritalStatus === 'married') {
    return 'COUPLE';
  }

  // SINGLE: 미혼 또는 독신
  if (contact.marriageStatus === '미혼' || contact.maritalStatus === 'single') {
    return 'SINGLE';
  }

  // DEFAULT: 불명
  return 'UNKNOWN';
}

/**
 * 가치 세그먼트 판정
 * GOLD, SILVER, BRONZE, LEAD
 */
export function determineValueSegment(contact: Contact): string {
  const ltv = contact.ltvTotal ?? 0;
  const cruises = contact.cruiseCount ?? 0;

  // GOLD: VIP 회원 또는 LTV > $20,000
  if (contact.vipStatus === 'GOLD' || ltv > 20000) {
    return 'GOLD';
  }

  // SILVER: 재구매 경험 또는 LTV > $5,000
  if (cruises > 1 || ltv > 5000) {
    return 'SILVER';
  }

  // BRONZE: 1회 구매 또는 LTV > $1,000
  if (contact.purchasedAt || ltv > 1000) {
    return 'BRONZE';
  }

  // LEAD: 구매 경험 없음
  return 'LEAD';
}

/**
 * L0 기반 세그먼트 결정
 */
export function createL0Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  const baseRiskLevel = riskSummary.riskLevel;

  return {
    segmentId: `L0-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L0',
    riskLevel: baseRiskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `부재중 고객 재활성화 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '감정적 재연결 메시지 발송',
      'Day 0-3 재활성화 SMS 시퀀스 시작',
      '제한된 기간 특별 할인 제안 ($200-500)',
      '이전 크루즈 경험 회상 & 새로운 상품 제시',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2시간 후
  };
}

/**
 * L1 기반 세그먼트 결정
 */
export function createL1Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L1-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L1',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `가격 이의 민감도 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '가치 재정의 메시지 (ROI, 건강 이득, 추억)',
      '경쟁사 가격 비교 분석 제시',
      '분할 결제 옵션 제안',
      'Day 1-2 이의 대응 SMS (PASONA S단계)',
      '제한된 시간 무이자 할부 프로모션',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 1), // 1시간 후
  };
}

/**
 * L2 기반 세그먼트 결정
 */
export function createL2Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L2-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L2',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `준비 불안도 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '5단계 중재 질문으로 불안 해소',
      '필요 서류 체크리스트 제공',
      '건강 관련 의료진 인증 자료 제시',
      'Day 2 가치 강조 메시지',
      '전담 컨설턴트 배정 (복잡도 높을 경우)',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 3), // 3시간 후
  };
}

/**
 * L3 기반 세그먼트 결정
 */
export function createL3Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L3-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L3',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `차별성 미인지 - 경쟁사 비교 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '경쟁사 비교 분석 문서 발송',
      '우리만의 고유가치 3가지 강조',
      '고객 후기/사례 스토리 공유',
      'Day 2 차별성 강조 SMS',
      '크루즈라인 차별성 데모 영상',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2시간 후
  };
}

/**
 * L5 기반 세그먼트 결정
 */
export function createL5Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L5-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L5',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `자기투영 - 건강/가족 중심 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '건강 관련 의료진 자격증명 제시',
      '가족 건강 보험 혜택 강조',
      '배우자/부모 건강 권고 메시지',
      'L5+L6 통합 Day 0-3 SMS 시퀀스',
      '건강 증명 자료 (의료진 레터) 제시',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 1), // 1시간 후
  };
}

/**
 * L6 기반 세그먼트 결정
 */
export function createL6Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L6-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L6',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `타이밍/손실회피 - 긴박감 고취 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '가격 마감일 카운트다운 강조',
      '남은 좌석 수 실시간 표시',
      '손실 회피 메시지: "지금 신청하지 않으면..."',
      'Day 2-3 긴박감 강조 SMS',
      '긴급 결정 권유 전화 (2시간 이내)',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 30), // 30분 후 (긴급)
  };
}

/**
 * L7 기반 세그먼트 결정
 */
export function createL7Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L7-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L7',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `동반자 설득 - 가족/부모 동의 필요 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '배우자/부모에게 직접 연락',
      '가족 함께 즐기는 크루즈 경험 강조',
      '배우자/부모용 설득 자료 발송',
      'L7 Day 0-3 동반자 설득 SMS',
      '가족 회의 종료까지 기다렸다가 최종 결정 권유',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1일 후
  };
}

/**
 * L8 기반 세그먼트 결정
 */
export function createL8Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L8-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L8',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `재방문 습관화 - 신규 크루즈 제안 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '이전 경험 만족도 확인',
      '개인화된 신규 크루즈 추천',
      '재방문 고객 특별 할인 (10-15%)',
      '크루즈 클럽 Tier 업그레이드 안내',
      'Day 10/30/60/90 재방문 SMS 시퀀스',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 1주 후
  };
}

/**
 * L10 기반 세그먼트 결정
 */
export function createL10Segment(contact: Contact, riskSummary: ContactRiskSummary): AutoSegmentResult {
  const demographic = determineDemographicSegment(contact);
  const valueSegment = determineValueSegment(contact);

  return {
    segmentId: `L10-${riskSummary.riskLevel.toUpperCase()}-${demographic}-${valueSegment}`,
    primaryLens: 'L10',
    riskLevel: riskSummary.riskLevel,
    demographicSegment: demographic,
    valueSegment: valueSegment,
    description: `즉시 구매 클로징 - 최종 결정 촉구 (${riskSummary.riskLevel} 위험도)`,
    recommendedActions: [
      '3가지 선택지 (즉시, 내일, 주말) 제시',
      '감정적 피니시 (가족 추억, 꿈 달성)',
      'Triple Choice CTA 강조',
      'Day 3 최종 결정 SMS',
      '지사장 직접 통화로 감정적 연결',
    ],
    nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 30), // 30분 후 (긴급)
  };
}

/**
 * 주요 렌즈 기반 세그먼트 생성
 */
export function createAutoSegment(
  contact: Contact,
  lenses: LensDetectionResult[],
  riskSummary: ContactRiskSummary,
): AutoSegmentResult {
  // 가장 높은 신뢰도의 렌즈 선택
  const primaryLens = lenses.sort((a, b) => b.confidenceScore - a.confidenceScore)[0];

  if (!primaryLens) {
    // 렌즈 미감지시 일반 세그먼트
    return {
      segmentId: 'GENERAL-UNCLASSIFIED',
      primaryLens: 'NONE',
      riskLevel: riskSummary.riskLevel,
      demographicSegment: determineDemographicSegment(contact),
      valueSegment: determineValueSegment(contact),
      description: '일반 고객 (미분류)',
      recommendedActions: ['렌즈 재분석 필요', '기본 정보 수집 질문 시작'],
      nextActionScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    };
  }

  switch (primaryLens.lensType) {
    case 'L0':
      return createL0Segment(contact, riskSummary);
    case 'L1':
      return createL1Segment(contact, riskSummary);
    case 'L2':
      return createL2Segment(contact, riskSummary);
    case 'L3':
      return createL3Segment(contact, riskSummary);
    case 'L5':
      return createL5Segment(contact, riskSummary);
    case 'L6':
      return createL6Segment(contact, riskSummary);
    case 'L7':
      return createL7Segment(contact, riskSummary);
    case 'L8':
      return createL8Segment(contact, riskSummary);
    case 'L10':
      return createL10Segment(contact, riskSummary);
    default:
      return {
        segmentId: 'GENERAL-OTHER',
        primaryLens: primaryLens.lensType,
        riskLevel: riskSummary.riskLevel,
        demographicSegment: determineDemographicSegment(contact),
        valueSegment: determineValueSegment(contact),
        description: `기타 세그먼트: ${primaryLens.lensLabel}`,
        recommendedActions: [],
      };
  }
}

/**
 * Contact 전체 세그먼테이션 실행
 */
export async function segmentizeContact(contact: Contact, adminMemo?: string): Promise<ContactSegmentationSummary> {
  // 1. 렌즈 감지
  const lenses = detectContactLens(contact, adminMemo);

  // 2. 위험도 계산
  const riskSummary = calculateContactRiskFlags(contact, adminMemo);

  // 3. 자동 세그먼트 생성
  const autoSegment = createAutoSegment(contact, lenses, riskSummary);

  return {
    contactId: contact.id,
    autoSegment,
    lenses,
    riskSummary,
    segmentUpdatedAt: new Date(),
  };
}
