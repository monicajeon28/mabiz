/**
 * Risk Score 계산 엔진
 * 10가지 신호 + 심리학 렌즈 기반 위험도 평가
 */

import { Contact360RiskProfile, RiskFlag, RecommendedAction } from './types';

interface ContactData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt: Date | null;
  type: string;
  segment: string | null;

  // L0: 부재중 재활성화
  reactivationSegment?: string;
  lastCruiseDate?: Date;
  cruiseCount?: number;
  lastSatisfactionScore?: number;

  // L2: 준비 불안도
  anxietyScore?: number;
  anxietyCategory?: string;
  preparationStage?: string;
  visaRequired?: boolean;
  passportDaysLeft?: number;
  familyWithKids?: boolean;
  healthConcerns?: string;

  // L3: 차별성 미인지
  competitorMentioned?: boolean;
  competitorNames?: string[];
  lastCompetitorMentionAt?: Date;
  differentiationScore?: number;
  differentiationResponseSent?: boolean;

  // L5: 자기투영 + L6: 타이밍
  l5l6CombinedScore?: number;
  l5l6MedicalRiskLevel?: string;
  timingType?: string;
  priceDeadlineDate?: Date;
  decisionWindowExpiresAt?: Date;
  seatAvailability?: number;

  // L7: 동반자 설득
  familyComposition?: string;
  spouseEngagement?: string;
  companionPersuasionStage?: string;
  familyObjections?: string[];

  // L8: 재방문 습관화
  ltvTotal?: number;
  cruiseReturnInterestLevel?: number;
  lastCruiseEndDate?: Date;

  // L9: 의료/건강
  personalHealthConcern?: string;
  spouseHealthConcern?: string;
  compoundHealthRisk?: boolean;

  // L10: 즉시 구매 클로징
  closingStage?: string;
  l10ClosingScore?: number;
  tripleChoiceOffered?: boolean;
  urgencyLevel?: number;

  // 활동 통계
  leadScore?: number;
  callCount?: number;
  memoCount?: number;
  lastPaymentStatus?: string;
  lastPaymentAt?: Date;
  lastRefundedAt?: Date;
  reEngageCount?: number;
}

/**
 * Risk Score 10가지 신호
 */
interface RiskSignal {
  name: string;
  weight: number; // 0-100
  description: string;
  detector: (contact: ContactData) => { detected: boolean; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };
}

const riskSignals: RiskSignal[] = [
  {
    name: 'INACTIVITY_3MONTH',
    weight: 30,
    description: '3개월 이상 부재중',
    detector: (c) => {
      const daysSinceLastContact = c.lastContactedAt
        ? Math.floor((Date.now() - new Date(c.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastContact > 90) {
        return {
          detected: true,
          severity: daysSinceLastContact > 180 ? 'CRITICAL' : 'HIGH'
        };
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'PREPARATION_ANXIETY',
    weight: 20,
    description: '준비 단계 불안도 높음',
    detector: (c) => {
      const anxietyScore = c.anxietyScore || 0;
      if (anxietyScore > 70) {
        return { detected: true, severity: anxietyScore > 85 ? 'CRITICAL' : 'HIGH' };
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'COMPETITOR_UNADDRESSED',
    weight: 25,
    description: '경쟁사 언급 대응 미완료',
    detector: (c) => {
      if (c.competitorMentioned && !c.differentiationResponseSent) {
        return { detected: true, severity: 'HIGH' };
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'FAMILY_PERSUASION_PENDING',
    weight: 30,
    description: '배우자/동반자 동의 미결정',
    detector: (c) => {
      if (c.familyComposition === 'spouse' && c.spouseEngagement !== 'convinced' && c.spouseEngagement !== 'aware') {
        return { detected: true, severity: 'MEDIUM' };
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'DECISION_WINDOW_CLOSING',
    weight: 35,
    description: '결정 윈도우 임박 (72시간 이내)',
    detector: (c) => {
      if (!c.decisionWindowExpiresAt) return { detected: false, severity: 'LOW' };

      const hoursLeft = (new Date(c.decisionWindowExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft > 0 && hoursLeft < 72) {
        return {
          detected: true,
          severity: hoursLeft < 24 ? 'CRITICAL' : 'HIGH'
        };
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'HEALTH_RISK',
    weight: 25,
    description: '의료 신뢰 필요 (본인/배우자 건강 문제)',
    detector: (c) => {
      const hasHealthRisk = c.compoundHealthRisk ||
        (c.l5l6MedicalRiskLevel === 'high' || c.l5l6MedicalRiskLevel === 'critical');

      if (hasHealthRisk) {
        return {
          detected: true,
          severity: c.l5l6MedicalRiskLevel === 'critical' ? 'CRITICAL' : 'MEDIUM'
        };
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'REFUND_HISTORY',
    weight: 20,
    description: '환불/취소 이력',
    detector: (c) => {
      if (c.lastRefundedAt) {
        const daysSinceRefund = (Date.now() - new Date(c.lastRefundedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRefund < 180) {
          return { detected: true, severity: daysSinceRefund < 30 ? 'HIGH' : 'MEDIUM' };
        }
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'MEDICAL_ELIGIBILITY',
    weight: 20,
    description: '고령자 (65세 이상) 의료 신뢰 필요',
    detector: (c) => {
      // Note: ageInYears 필드가 있다고 가정
      // 실제로는 Contact에 age 필드를 참조해야 함
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'PRICE_DEADLINE',
    weight: 15,
    description: '가격 마감일 임박',
    detector: (c) => {
      if (!c.priceDeadlineDate) return { detected: false, severity: 'LOW' };

      const daysLeft = Math.floor((new Date(c.priceDeadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft < 7) {
        return {
          detected: true,
          severity: daysLeft < 2 ? 'CRITICAL' : 'HIGH'
        };
      }
      return { detected: false, severity: 'LOW' };
    }
  },

  {
    name: 'NO_ENGAGEMENT_RESPONSE',
    weight: 15,
    description: '예약 후 미응답/미연락 (5일+)',
    detector: (c) => {
      // reEngageCount를 기반으로 판단
      if ((c.reEngageCount || 0) >= 3) {
        return { detected: true, severity: 'MEDIUM' };
      }
      return { detected: false, severity: 'LOW' };
    }
  }
];

/**
 * Contact 기반 Risk Score 계산
 */
export async function calculateRiskScore(contact: ContactData): Promise<Contact360RiskProfile> {
  let riskScore = 0;
  const flags: RiskFlag[] = [];

  // 각 신호별로 평가
  for (const signal of riskSignals) {
    const { detected, severity } = signal.detector(contact);

    if (detected) {
      // Risk Score 누적
      const severityWeight: Record<string, number> = {
        LOW: 0.3,
        MEDIUM: 0.6,
        HIGH: 0.85,
        CRITICAL: 1.0
      };

      riskScore += signal.weight * severityWeight[severity];

      // Flag 추가
      flags.push({
        type: signal.name,
        severity,
        detectedAt: new Date(),
        description: signal.description
      });
    }
  }

  // Risk Score 정규화 (0-100)
  riskScore = Math.min(Math.round(riskScore), 100);

  // 권장 액션 생성
  const recommendedActions = generateRecommendedActions(flags, contact);

  return {
    riskScore,
    flags,
    recommendedActions
  };
}

/**
 * Risk Flag 기반 권장 액션 생성
 */
function generateRecommendedActions(
  flags: RiskFlag[],
  contact: ContactData
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  flags.forEach(flag => {
    switch (flag.type) {
      case 'INACTIVITY_3MONTH':
        actions.push({
          action: 'SEND_REACTIVATION_SMS',
          priority: flag.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          reason: `부재중 고객 재활성화 (전환율 +22%)`,
          resources: ['reactivation_sms_template', 'grant_cardone_followup'],
          nextScheduledAt: addHours(new Date(), 2)
        });
        break;

      case 'PREPARATION_ANXIETY':
        actions.push({
          action: 'PROVIDE_PREPARATION_GUIDE',
          priority: 'HIGH',
          reason: '준비 불안 해소로 전환율 +18%',
          resources: ['visa_guide_pdf', 'health_tips', 'packing_checklist']
        });
        break;

      case 'COMPETITOR_UNADDRESSED':
        actions.push({
          action: 'SEND_DIFFERENTIATION_SMS',
          priority: 'CRITICAL',
          reason: '경쟁사 대비 차별성 강조로 전환율 +40%',
          nextScheduledAt: addHours(new Date(), 1)
        });
        break;

      case 'FAMILY_PERSUASION_PENDING':
        actions.push({
          action: 'SEND_SPOUSE_ENGAGEMENT_SMS',
          priority: 'HIGH',
          reason: '배우자 동의 필수 (구매 전환율 +35%)',
          resources: ['spouse_engagement_template', 'family_persuasion_guide'],
          nextScheduledAt: addHours(new Date(), 4)
        });
        break;

      case 'DECISION_WINDOW_CLOSING':
        actions.push({
          action: 'SEND_URGENCY_SMS',
          priority: 'CRITICAL',
          reason: '타이밍 손실회피 극대화로 전환율 +50%',
          nextScheduledAt: new Date() // 즉시
        });
        break;

      case 'HEALTH_RISK':
        actions.push({
          action: 'PROVIDE_MEDICAL_ASSURANCE',
          priority: 'HIGH',
          reason: '의료 신뢰 구축 (전환율 +25%)',
          resources: ['medical_guide', 'doctor_credential', 'health_faq']
        });
        break;

      case 'REFUND_HISTORY':
        actions.push({
          action: 'CONDUCT_SATISFACTION_CALL',
          priority: 'MEDIUM',
          reason: '환불 원인 분석 및 신뢰 회복',
          resources: ['satisfaction_script', 'objection_handling']
        });
        break;

      case 'MEDICAL_ELIGIBILITY':
        actions.push({
          action: 'HIGHLIGHT_MEDICAL_BENEFITS',
          priority: 'MEDIUM',
          reason: '고령자 대상 의료 편의성 강조',
          resources: ['senior_friendly_guide', 'medical_support_info']
        });
        break;

      case 'PRICE_DEADLINE':
        actions.push({
          action: 'SEND_PRICE_DEADLINE_SMS',
          priority: 'CRITICAL',
          reason: '가격 마감 긴박감으로 전환율 +45%',
          nextScheduledAt: new Date()
        });
        break;

      case 'NO_ENGAGEMENT_RESPONSE':
        actions.push({
          action: 'TRIGGER_MANUAL_CALL',
          priority: 'HIGH',
          reason: '3회 이상 재접근으로 80% 판매 확률 (Grant Cardone)',
          resources: ['call_script_v13', 'objection_handling']
        });
        break;
    }
  });

  // 우선순위 정렬 (CRITICAL > HIGH > MEDIUM > LOW)
  return actions.sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * 시간 더하기 헬퍼
 */
function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Risk Score 대시보드 요약
 */
export interface RiskScoreSummary {
  overallScore: number;
  category: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  flagCount: number;
  criticalFlagCount: number;
  actionCount: number;
  recommendedPriority: string;
}

/**
 * Risk Score를 카테고리로 변환
 */
export function categorizeRiskScore(riskScore: number): RiskScoreSummary['category'] {
  if (riskScore < 20) return 'GREEN'; // 안전
  if (riskScore < 40) return 'YELLOW'; // 주의
  if (riskScore < 70) return 'ORANGE'; // 경고
  return 'RED'; // 위험
}

/**
 * Risk Profile 요약 생성
 */
export function summarizeRiskProfile(profile: Contact360RiskProfile): RiskScoreSummary {
  const criticalFlags = profile.flags.filter(f => f.severity === 'CRITICAL').length;

  return {
    overallScore: profile.riskScore,
    category: categorizeRiskScore(profile.riskScore),
    flagCount: profile.flags.length,
    criticalFlagCount: criticalFlags,
    actionCount: profile.recommendedActions.length,
    recommendedPriority: profile.recommendedActions[0]?.priority || 'NONE'
  };
}
