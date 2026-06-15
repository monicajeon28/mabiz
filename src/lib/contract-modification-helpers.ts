/**
 * Phase 5: 계약 수정요청 헬퍼 함수
 * Russell Brunson 심리학 + Grant Cardone 4렌즈 적용
 *
 * @author Team Contract
 * @date 2026-06-15
 */

import {
  FieldModification,
  LensDetectionResult,
  PSYCHOLOGY_TEMPLATES,
  LENS_DETECTION_RULES,
  SPIN_QUESTIONS,
  UrgencyMessage,
} from "./types/contract-modification";

/**
 * 필드 수정가능 여부 검증 (보안)
 * 수정 가능한 필드: 여행일정, 객실타입, 가격, 탑승자명 등
 * 수정 불가능한 필드: 계약번호, 서명 타입, 결제조건 등
 */
const MODIFIABLE_FIELDS = [
  "tripDate",
  "roomType",
  "roomCategory",
  "price",
  "price_total",
  "passengerName",
  "passengerCount",
  "specialRequest",
  "dietaryRestriction",
  "pickupLocation",
  "returnDate",
];

const NON_MODIFIABLE_FIELDS = [
  "contractNumber",
  "signatureType",
  "paymentTerms",
  "cancellationPolicy",
  "contractId",
  "templateId",
];

/**
 * L2: 5단계 중재 복잡도 점수 계산
 */
export function calculateL2Complexity(
  fieldModifications: FieldModification[]
): { score: number; reason: string; mediation5Steps: any[] } {
  let score = LENS_DETECTION_RULES.L2_COMPLEXITY_SCORE.baseScore;

  // 1. 필드 개수별 점수
  score += fieldModifications.length * LENS_DETECTION_RULES.L2_COMPLEXITY_SCORE.perField;

  // 2. 설명 텍스트 길이별 점수
  const totalWords = fieldModifications.reduce(
    (sum, fm) => sum + (fm.reason?.split(" ").length || 0),
    0
  );
  score += totalWords * LENS_DETECTION_RULES.L2_COMPLEXITY_SCORE.perWord;

  // 3. 키워드별 보너스
  const allText = fieldModifications
    .map((fm) => `${fm.fieldName} ${fm.reason}`)
    .join(" ")
    .toLowerCase();

  Object.entries(LENS_DETECTION_RULES.L2_COMPLEXITY_SCORE.keywordBonus).forEach(
    ([keyword, bonus]) => {
      if (allText.includes(keyword)) {
        score += bonus;
      }
    }
  );

  // 4. Complexity 레벨별 추가점
  const hasHighComplexity = fieldModifications.some(
    (fm) => fm.complexity === "HIGH"
  );
  if (hasHighComplexity) score += 30;

  const reason =
    score > 70
      ? `매우 높은 복잡도 (${score}점) - 5단계 중재 필수`
      : score > 40
        ? `중간 복잡도 (${score}점) - 3-4단계 중재 권장`
        : `낮은 복잡도 (${score}점) - 빠른 승인 가능`;

  return {
    score: Math.min(score, 100),
    reason,
    mediation5Steps: generateMediation5Steps(fieldModifications, score),
  };
}

/**
 * 5단계 중재 질문 자동생성
 */
function generateMediation5Steps(
  fieldModifications: FieldModification[],
  complexity: number
): any[] {
  const steps = [];

  // Step 1: Situation
  steps.push({
    step: 1,
    question:
      SPIN_QUESTIONS.situation[
        Math.floor(Math.random() * SPIN_QUESTIONS.situation.length)
      ],
    validationPass: false,
  });

  // Step 2: Problem
  steps.push({
    step: 2,
    question:
      SPIN_QUESTIONS.problem[
        Math.floor(Math.random() * SPIN_QUESTIONS.problem.length)
      ],
    validationPass: false,
  });

  // Step 3: Implication (복잡도 높으면 필수)
  if (complexity > 50) {
    steps.push({
      step: 3,
      question:
        SPIN_QUESTIONS.implication[
          Math.floor(Math.random() * SPIN_QUESTIONS.implication.length)
        ],
      validationPass: false,
    });

    steps.push({
      step: 4,
      question:
        SPIN_QUESTIONS.need[
          Math.floor(Math.random() * SPIN_QUESTIONS.need.length)
        ],
      validationPass: false,
    });
  }

  // Step 4/5: Need-Payoff
  steps.push({
    step: steps.length === 4 ? 5 : 4,
    question:
      SPIN_QUESTIONS.reward[
        Math.floor(Math.random() * SPIN_QUESTIONS.reward.length)
      ],
    validationPass: false,
  });

  return steps;
}

/**
 * L6: 거래손실 위험도 분석
 */
export function analyzeL6DealRisk(
  fieldModifications: FieldModification[]
): { riskScore: number; riskFlag: boolean; reason: string; suggestion: string } {
  let riskScore = 0;
  const mentionedKeywords: string[] = [];

  const allText = fieldModifications
    .map((fm) => `${fm.fieldName} ${fm.reason}`)
    .join(" ")
    .toLowerCase();

  // 위험 키워드 감지
  LENS_DETECTION_RULES.L6_RISK_KEYWORDS.forEach((keyword) => {
    if (allText.includes(keyword)) {
      mentionedKeywords.push(keyword);
      riskScore += 15;
    }
  });

  // 가격 변경은 높은 위험
  const priceChanges = fieldModifications.filter(
    (fm) => fm.fieldName.includes("price") || fm.fieldName.includes("Price")
  );
  if (priceChanges.length > 0) {
    riskScore += 25; // 가격 변경 = 거래손실 위험 25점
  }

  // 여러 필드 동시 변경 = 위험 신호
  if (fieldModifications.length > 3) {
    riskScore += 10 * (fieldModifications.length - 3);
  }

  const riskFlag = riskScore >= LENS_DETECTION_RULES.L6_RISK_THRESHOLD;
  const reason = riskFlag
    ? `높은 위험도 (${riskScore}점) - ${mentionedKeywords.join(", ")} 키워드 감지`
    : `낮은 위험도 (${riskScore}점) - 안전한 협상`;

  const suggestion = riskFlag
    ? "대안제시 전략 추천: 부분 수정 가능성 제시"
    : "빠른 승인 가능";

  return {
    riskScore: Math.min(riskScore, 100),
    riskFlag,
    reason,
    suggestion,
  };
}

/**
 * L7: 가족설득 감지
 */
export function detectL7FamilyMention(
  fieldModifications: FieldModification[]
): { detected: boolean; keywords: string[]; suggestion: string } {
  const allText = fieldModifications
    .map((fm) => `${fm.fieldName} ${fm.reason}`)
    .join(" ")
    .toLowerCase();

  const detectedKeywords: string[] = [];

  LENS_DETECTION_RULES.L7_FAMILY_KEYWORDS.forEach((keyword) => {
    if (allText.includes(keyword.toLowerCase())) {
      detectedKeywords.push(keyword);
    }
  });

  const detected = detectedKeywords.length > 0;
  const suggestion = detected
    ? PSYCHOLOGY_TEMPLATES.L7_FAMILY_PERSUASION(
        detectedKeywords[0]
      )
    : "";

  return {
    detected,
    keywords: detectedKeywords,
    suggestion,
  };
}

/**
 * L10: 긴박감 메시지 생성
 */
export function generateL10UrgencyMessage(
  expiresAt: Date
): UrgencyMessage {
  const deadline = expiresAt.toLocaleDateString("ko-KR");
  const message = PSYCHOLOGY_TEMPLATES.L10_DEADLINE_NOTICE(deadline);

  return {
    message,
    deadline: expiresAt.toISOString(),
    tone: "OPPORTUNITY",
  };
}

/**
 * 종합 렌즈 감지 엔진
 */
export function detectAllLenses(
  fieldModifications: FieldModification[]
): LensDetectionResult {
  const l2Result = calculateL2Complexity(fieldModifications);
  const l6Result = analyzeL6DealRisk(fieldModifications);
  const l7Result = detectL7FamilyMention(fieldModifications);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + LENS_DETECTION_RULES.L10_DEFAULT_EXPIRY_DAYS);
  const l10Result = generateL10UrgencyMessage(expiresAt);

  return {
    L2: {
      complexity: l2Result.score,
      reason: l2Result.reason,
    },
    L6: {
      riskScore: l6Result.riskScore,
      reason: l6Result.reason,
    },
    L7: {
      familyMention: l7Result.detected,
      keywords: l7Result.keywords,
    },
    L10: {
      deadline: l10Result.deadline,
      urgencyTone: l10Result.tone,
    },
  };
}

/**
 * 필드 수정가능 여부 검증
 */
export function validateModifiableFields(
  fieldModifications: FieldModification[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  fieldModifications.forEach((fm) => {
    // 수정 불가능 필드 확인
    if (NON_MODIFIABLE_FIELDS.includes(fm.fieldName)) {
      errors.push(`필드 "${fm.fieldName}"는 수정 불가능합니다.`);
    }

    // 수정 가능 필드 목록 (기본적으로 whitelist 기반)
    if (!MODIFIABLE_FIELDS.includes(fm.fieldName)) {
      // 명확하지 않은 필드도 경고하지만 거부하지는 않음
      console.warn(
        `필드 "${fm.fieldName}"가 표준 목록에 없습니다. 관리자 검토 필요.`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Russell Brunson 거래 재협상 메시지 생성
 */
export function generateBrunsonHookMessage(
  fieldModifications: FieldModification[]
): string {
  const keywords = fieldModifications.map((fm) => fm.fieldName).join(", ");
  return `${PSYCHOLOGY_TEMPLATES.RUSSELL_HOOK} (${keywords} 검토 중)`;
}

/**
 * 승인 응답 메시지 자동생성
 */
export function generateApprovalMessage(
  fieldModifications: FieldModification[],
  appliedLenses: string[]
): string {
  // L7이 감지되었다면 "동반자" 톤 사용
  if (appliedLenses.includes("L7")) {
    return PSYCHOLOGY_TEMPLATES.L7_COLLABORATIVE_APPROVAL;
  }
  return PSYCHOLOGY_TEMPLATES.RUSSELL_CLOSE;
}

/**
 * 거절 응답 메시지 자동생성 (L6 기반)
 */
export function generateRejectionMessage(
  fieldModifications: FieldModification[],
  dealRiskReason?: string
): string {
  if (dealRiskReason) {
    return (
      PSYCHOLOGY_TEMPLATES.L6_ALTERNATIVE_INTRO +
      `\n\n사유: ${dealRiskReason}\n\n` +
      "우리와 함께 최고의 해결책을 찾아봅시다."
    );
  }
  return PSYCHOLOGY_TEMPLATES.L6_ALTERNATIVE_INTRO;
}

/**
 * 대안제시 메시지 생성
 */
export function generateAlternativeMessage(
  alternativeField: string,
  reason: string
): string {
  return (
    `${alternativeField}에 대해 다음과 같이 제안드립니다:\n` +
    `${reason}\n\n` +
    `이 방안이 당신의 상황을 더 잘 해결할 것이라고 생각합니다.`
  );
}

/**
 * 감사 로그 생성
 */
export function createAuditLogEntry(
  action: string,
  status: string,
  userId?: string,
  message?: string,
  ipAddress?: string
) {
  return {
    timestamp: new Date().toISOString(),
    action,
    status,
    userId,
    message,
    ipAddress,
  };
}
