/**
 * Auto-Approval Decision Engine
 * ContractModificationRequest POST 요청 시 자동 판정 및 심리학 렌즈 탐지
 *
 * 피로 과정:
 * 1. 규칙 엔진 실행 (evaluateAutoApproval)
 * 2. L2 중재 5단계 질문 생성
 * 3. 심리학 렌즈 탐지 (L0-L10)
 * 4. 최종 상태 결정 (AUTO_APPROVED vs PENDING)
 */

import { prisma } from "./prisma";
import { evaluateAutoApproval } from "./contract-modification-rules";
import { logger } from '@/lib/logger';

export interface MediationQuestion {
  situation: string; // "상황 이해" - 현재 상태 파악
  problem: string; // "문제 정의" - 변경 이유
  implication: string; // "영향 분석" - 파급 효과
  needsPayoff: string; // "필요/보상" - 기대 이득
  successCriteria: string; // "성공 기준" - 완료 조건
}

export interface PsychologyLensDetection {
  detectedLenses: string[];
  reasoning: Record<string, string>;
  recommendations: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH"; // 거래 위험도
}

export interface AutoApprovalDecision {
  status: "PENDING" | "AUTO_APPROVED";
  evaluation: any;
  lensDetectionDetails: PsychologyLensDetection;
  mediation5Steps: MediationQuestion;
  summary: {
    isRiskFlag: boolean;
    estimatedApprovalTime: string; // "즉시" or "24시간" or "영업일 2-3일"
    recommendation: string; // 운영팀 가이드
  };
}

/**
 * 최종 자동 승인 판정 로직
 */
export async function makeAutoApprovalDecision(
  request: {
    id: string;
    contractId: string;
    fieldName: string;
    newValue: string;
    currentValue: string;
    requestedByUserId: string;
    requestedAt: Date;
  },
  context?: {
    organizationId?: string;
    contactId?: string;
  }
): Promise<AutoApprovalDecision> {
  try {
    // 1. 규칙 엔진 실행
    const evaluation = await evaluateAutoApproval(request);

    // 2. L2 중재 질문 생성 (SPIN 기법)
    const mediation5Steps = generateMediationQuestions(request.fieldName, request.currentValue);

    // 3. 심리학 렌즈 탐지
    const lensDetectionDetails = detectPsychologyLenses(
      request.fieldName,
      request.newValue,
      request.currentValue,
      evaluation.dealRiskFlag,
      evaluation.complexity
    );

    // 4. 최종 상태 결정
    const status = evaluation.isAutoApprovable ? "AUTO_APPROVED" : "PENDING";

    // 5. 요약 정보 생성
    const summary = generateSummary(
      evaluation.isAutoApprovable,
      evaluation.complexity,
      lensDetectionDetails.riskLevel,
      evaluation.appliedLenses
    );

    return {
      status,
      evaluation,
      lensDetectionDetails,
      mediation5Steps,
      summary,
    };
  } catch (error) {
    // 오류 발생 시 안전하게 PENDING으로 처리
    logger.error("[AutoApprovalDecision] Error:", error);
    return {
      status: "PENDING",
      evaluation: {
        isAutoApprovable: false,
        reason: "자동 판정 중 오류 발생",
        complexity: 100,
        dealRiskFlag: true,
        appliedLenses: ["ERROR_UNKNOWN"],
      },
      lensDetectionDetails: {
        detectedLenses: ["ERROR"],
        reasoning: { ERROR: "자동 판정 실패" },
        recommendations: ["수동 검토 필요"],
        riskLevel: "HIGH",
      },
      mediation5Steps: {
        situation: "자동 판정 실패",
        problem: "시스템 오류로 인해 자동 판정이 불가능합니다",
        implication: "수동 검토가 필요합니다",
        needsPayoff: "지원팀의 빠른 처리",
        successCriteria: "영업일 1-2일 내 승인 또는 거절",
      },
      summary: {
        isRiskFlag: true,
        estimatedApprovalTime: "영업일 2-3일",
        recommendation: "지원팀 수동 검토 필요",
      },
    };
  }
}

/**
 * SPIN 질문 기법 기반 L2 중재 질문 생성
 * S(상황) → P(문제) → I(함의) → N(필요/보상)
 */
function generateMediationQuestions(
  fieldName: string,
  currentValue: string
): MediationQuestion {
  const templates: Record<string, MediationQuestion> = {
    tripDate: {
      situation: `현재 예정된 여행 날짜는 ${formatDate(currentValue)}입니다. 맞나요?`,
      problem: "새로운 날짜로 변경하면 어떤 어려움이 생길까요?",
      implication:
        "이 변경이 항공, 호텔, 기타 예약에 영향을 미칠까요? 그렇다면 어떻게요?",
      needsPayoff: "새로운 날짜가 당신에게 더 좋은 이유는 무엇인가요?",
      successCriteria:
        "이 변경이 완료되면 모든 기대를 만족할 것 같습니까? 다른 조건은 없나요?",
    },
    roomType: {
      situation: `현재 배정된 객실은 ${currentValue}입니다. 맞나요?`,
      problem: "다른 객실로 변경해야 하는 구체적인 이유가 뭔가요?",
      implication:
        "객실 변경이 여행 경험에 어떤 긍정적/부정적 영향을 미칠까요?",
      needsPayoff: "새로운 객실이 당신의 기대를 더 충족할 것 같은 이유는 뭔가요?",
      successCriteria: "객실 변경 후에 다른 수정 요청은 없을 것 같습니까?",
    },
    contactInfo: {
      situation: `현재 연락처 정보는 ${maskContactInfo(currentValue)}입니다. 맞나요?`,
      problem: "연락처를 변경해야 하는 이유가 뭔가요?",
      implication:
        "새로운 연락처로 변경하면 우리가 당신에게 연락할 때 문제가 없을까요?",
      needsPayoff:
        "새로운 연락처가 당신에게 더 편리한 이유는 뭔가요? (예: 직장에서 휴대폰 확인 가능 등)",
      successCriteria:
        "이 연락처로 여행 전 안내, 일정 변경 공지 등을 받을 준비가 되어 있으신가요?",
    },
    specialRequest: {
      situation: `현재 특별 요청사항은 "${currentValue || "(없음)"}"입니다. 맞나요?`,
      problem: "새로운 특별 요청사항을 추가/변경해야 하는 이유가 뭔가요?",
      implication: "이 요청사항이 우리 크루즈 운영에 추가 비용이나 불편을 초래할까요?",
      needsPayoff: "이 특별 요청사항이 당신의 여행 경험을 어떻게 향상시킬까요?",
      successCriteria:
        "우리가 이 특별 요청사항을 충족하면 완전히 만족하실 것 같습니까?",
    },
    dietaryRestriction: {
      situation: `현재 식이 제한은 "${currentValue || "(없음)"}"입니다. 맞나요?`,
      problem: "식이 제한을 변경해야 하는 이유가 뭔가요?",
      implication:
        "이 제한사항으로 인해 식사 옵션이 제한될 것 같은데, 괜찮으신가요?",
      needsPayoff:
        "이 변경으로 당신의 건강이나 음식 선호도가 어떻게 더 나아질까요?",
      successCriteria:
        "우리가 이 식이 제한을 충족하면 모든 식사에서 만족하실 것 같습니까?",
    },
    price: {
      situation: `현재 가격은 ${formatPrice(currentValue)}입니다. 맞나요?`,
      problem: "가격을 조정해야 하는 이유가 구체적으로 뭔가요?",
      implication:
        "이 가격 조정으로 인해 예산에 영향을 미치는지, 얼마나 미치는지 말씀해주시겠어요?",
      needsPayoff: "새로운 가격이 당신에게 더 공정하다고 느끼는 이유는 뭔가요?",
      successCriteria:
        "이 가격으로 최종 결정하시면 이후 추가 협상 요청은 없으실 것 같습니까?",
    },
    paymentTerms: {
      situation: `현재 결제 조건은 "${currentValue}"입니다. 맞나요?`,
      problem: "결제 조건을 변경해야 하는 구체적인 이유가 뭔가요?",
      implication:
        "새로운 결제 조건으로 인해 당신의 현금 흐름이나 계획에 영향을 미칠까요?",
      needsPayoff: "새로운 결제 조건이 당신의 재무 계획에 얼마나 도움이 될까요?",
      successCriteria:
        "이 결제 조건으로 최종 결정하면, 여행까지 별도의 결제 관련 이의는 없을 것 같습니까?",
    },
  };

  return (
    templates[fieldName] || {
      situation: `현재 ${fieldName}은 "${currentValue}"입니다. 맞나요?`,
      problem: `${fieldName}을 변경해야 하는 이유가 뭔가요?`,
      implication: "이 변경이 여행 경험에 어떤 영향을 미칠까요?",
      needsPayoff: "이 변경이 당신에게 어떻게 더 좋을 것 같습니까?",
      successCriteria: "이 변경이 완료되면 완전히 만족할 것 같으신가요?",
    }
  );
}

/**
 * 심리학 렌즈 자동 탐지 (L0-L10 매핑)
 * 필드, 값, 위험도를 기반으로 발동할 심리 메커니즘 파악
 */
function detectPsychologyLenses(
  fieldName: string,
  newValue: string,
  currentValue: string,
  dealRiskFlag: boolean,
  complexity: number
): PsychologyLensDetection {
  const lenses: string[] = [];
  const reasoning: Record<string, string> = {};
  const recommendations: string[] = [];
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  // L0: 불완전한 정보 (필드 누락)
  if (!newValue || newValue.trim() === "") {
    lenses.push("L0_INCOMPLETE");
    reasoning.L0 = "고객이 정보를 미제공하여 거래 진행 불가";
    recommendations.push("고객에게 필수 정보 입력 요청");
    riskLevel = "HIGH";
  }

  // L1: 재활성화 신호 (고객이 정보 추가/변경 시도)
  if (!currentValue && newValue) {
    lenses.push("L1_REACTIVATION");
    reasoning.L1 = "고객이 누락된 정보를 적극 추가하려고 함 (재활성화 신호)";
    recommendations.push("긍정적 톤으로 빠르게 응답 (환영감)");
    recommendations.push("추가 요청사항 적극 수용");
    riskLevel = "LOW";
  }

  // L2: 복잡도 점수 (거래 복잡성)
  if (complexity > 70) {
    lenses.push("L2_HIGH_COMPLEXITY");
    reasoning.L2 = `거래 복잡도가 높음 (${complexity}/100): 운영 제약 또는 금액 영향`;
    recommendations.push("운영팀/재무팀 검토 필수");
    recommendations.push("고객 의도 충분히 이해 후 대안 제시");
    riskLevel = "HIGH";
  } else if (complexity > 40) {
    lenses.push("L2_MEDIUM_COMPLEXITY");
    reasoning.L2 = `거래 복잡도가 중간 (${complexity}/100): 일부 제약 있음`;
    recommendations.push("기본 규칙 검토 후 처리");
    riskLevel = "MEDIUM";
  }

  // L3: 차별화 + 오해 해소 (고객 경험 개선)
  if (fieldName === "specialRequest" && newValue.length > 20) {
    lenses.push("L3_DIFFERENTIATION");
    reasoning.L3 = "고객이 맞춤형 경험을 요청함 (차별화 기회)";
    recommendations.push("특별 요청을 VIP 서비스로 마케팅");
    recommendations.push("고객이 느낀 제약/오해 확인 및 해소");
  }

  // L6: 손실회피 (금액, 중요 변경)
  if (dealRiskFlag || fieldName === "price" || fieldName === "paymentTerms") {
    lenses.push("L6_LOSS_AVERSION");
    reasoning.L6 = "재정적 또는 중요 변경으로 인한 고객 불안감";
    recommendations.push("변경 사유를 충분히 이해하기");
    recommendations.push("대안 3가지 이상 제시");
    recommendations.push("위험 최소화 방안 강조 (예: 환불 정책)");
    if (riskLevel === "LOW") riskLevel = "MEDIUM";
  }

  // L7: 동반자 설득 (가족/함께하는 사람)
  if (
    fieldName === "passengerCount" ||
    fieldName === "specialRequest" ||
    (newValue.includes("가족") || newValue.includes("friend"))
  ) {
    lenses.push("L7_COMPANION");
    reasoning.L7 = "함께 여행하는 사람들과의 조화 및 동의";
    recommendations.push("'함께' 만족도 높이는 톤으로 응답");
    recommendations.push("모든 탑승객에게 공평한 영향 확인");
  }

  // L10: 긴박감 + 시간 제약 (여행 일정)
  if (fieldName === "tripDate") {
    lenses.push("L10_URGENCY");
    reasoning.L10 = "여행 일정의 시간 제한성 (출발 D-day 임박)";
    recommendations.push("가능한 한 빠른 승인/거절 판정 (24시간 이내)");
    recommendations.push("시간 제약 이유 고객에게 명확히 전달");
    recommendations.push("조기 결정 인센티브 제시");
  }

  return {
    detectedLenses: [...new Set(lenses)],
    reasoning,
    recommendations,
    riskLevel,
  };
}

/**
 * 자동 승인 판정 요약 생성
 */
function generateSummary(
  isAutoApprovable: boolean,
  complexity: number,
  riskLevel: string,
  appliedLenses: string[]
): {
  isRiskFlag: boolean;
  estimatedApprovalTime: string;
  recommendation: string;
} {
  const isRiskFlag = !isAutoApprovable || riskLevel === "HIGH" || complexity > 70;

  let estimatedApprovalTime = "즉시";
  let recommendation = "자동 승인 가능";

  if (isAutoApprovable && complexity < 40) {
    estimatedApprovalTime = "즉시";
    recommendation = "자동 승인 가능 - 별도 검토 불필요";
  } else if (isAutoApprovable && complexity < 70) {
    estimatedApprovalTime = "1-2시간 (업무 시간)";
    recommendation = "자동 승인 예정 - 운영팀 최종 확인";
  } else if (!isAutoApprovable && complexity < 70) {
    estimatedApprovalTime = "24시간 (영업일)";
    recommendation = "수동 검토 - 지원팀 면밀 검토 필요";
  } else {
    estimatedApprovalTime = "2-3일 (영업일)";
    recommendation = "고도의 검토 필요 - 재무팀/운영팀 협의 필수";
  }

  // 렌즈별 추가 권고
  if (appliedLenses.includes("L6_LOSS_AVERSION")) {
    recommendation += " | L6 손실회피: 고객 불안감 먼저 해소";
  }
  if (appliedLenses.includes("L10_URGENCY")) {
    recommendation += " | L10 긴박감: 빠른 처리 필수";
  }
  if (appliedLenses.includes("L1_REACTIVATION")) {
    recommendation += " | L1 재활성화: 긍정적 톤 유지";
  }

  return {
    isRiskFlag,
    estimatedApprovalTime,
    recommendation,
  };
}

/**
 * 유틸리티: 날짜 포맷팅
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  } catch {
    return dateStr;
  }
}

/**
 * 유틸리티: 가격 포맷팅
 */
function formatPrice(priceStr: string): string {
  try {
    const price = parseInt(priceStr, 10) || 0;
    return `${price.toLocaleString()}원`;
  } catch {
    return priceStr;
  }
}

/**
 * 유틸리티: 연락처 마스킹 (개인정보 보호)
 */
function maskContactInfo(contact: string): string {
  if (!contact) return "미제공";

  // 이메일 마스킹
  if (contact.includes("@")) {
    const [user, domain] = contact.split("@");
    const maskedUser = user.substring(0, 2) + "*".repeat(Math.max(0, user.length - 2));
    return `${maskedUser}@${domain}`;
  }

  // 휴대폰 마스킹
  if (contact.length >= 10) {
    return contact.substring(0, 3) + "*".repeat(contact.length - 6) + contact.substring(-3);
  }

  return contact;
}

/**
 * 일괄 결정 엔진 (여러 수정 요청 한번에 처리)
 */
export async function batchAutoApprovalDecisions(
  requests: Array<{
    id: string;
    contractId: string;
    fieldName: string;
    newValue: string;
    currentValue: string;
    requestedByUserId: string;
    requestedAt: Date;
  }>
): Promise<Array<{ requestId: string; decision: AutoApprovalDecision }>> {
  const results = [];

  for (const request of requests) {
    const decision = await makeAutoApprovalDecision(request);
    results.push({
      requestId: request.id,
      decision,
    });
  }

  return results;
}
