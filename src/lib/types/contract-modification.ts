/**
 * Phase 5: Russell Brunson 심리학 기반 계약 수정요청 시스템
 * Grant Cardone 10렌즈 적용: L2(5단계중재), L6(손실회피), L7(동반자), L10(긴박감)
 *
 * @author Team Contract - Phase 5 Implementation
 * @date 2026-06-15
 */

/**
 * 수정 필드 정의
 * fieldModifications JSON 배열의 각 항목
 */
export interface FieldModification {
  fieldName: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
  reason: string; // SPIN 질문 기반: Situation, Problem, Implication, Need/Reward
  detectedLens?: string; // "L2"|"L6"|"L7"|"L10"
  complexity?: "LOW" | "MEDIUM" | "HIGH"; // 5단계 중재 복잡도
}

/**
 * 5단계 중재 검증 (L2 렌즈)
 * SPIN 질문 기법 기반
 */
export interface Mediation5Step {
  step: 1 | 2 | 3 | 4 | 5;
  question: string; // SPIN 질문 중 하나
  answer?: string; // 고객 응답
  validationPass: boolean; // 이 단계 통과 여부
}

/**
 * L6 손실회피 분석 결과
 */
export interface DealRiskAnalysis {
  riskScore: number; // 0-100, 높을수록 거래손실 위험 높음
  reason: string; // 위험 사유
  suggestedAction: string; // 권장 대응 (예: "대안제시")
}

/**
 * L7 가족설득 감지 결과
 */
export interface FamilySuggestionAnalysis {
  detected: boolean;
  keywords: string[]; // "배우자", "가족", "자녀" 등
  suggestion: string; // 자동생성 메시지: "배우자 설득" 전략
}

/**
 * L10 긴박감 메시지 (자동생성)
 */
export interface UrgencyMessage {
  message: string; // 예: "이 제안은 2026-06-22 23:59까지만 유효합니다"
  deadline: string; // ISO 형식 날짜
  tone: "COLLABORATIVE" | "WARNING" | "OPPORTUNITY";
}

/**
 * 렌즈 감지 상세 결과
 */
export interface LensDetectionResult {
  L2?: { complexity: number; reason: string };
  L6?: { riskScore: number; reason: string };
  L7?: { familyMention: boolean; keywords: string[] };
  L10?: { deadline: string; urgencyTone: string };
}

/**
 * 대안제시 항목
 */
export interface AlternativeProposal {
  fieldName: string;
  proposedValue: string | number | boolean;
  reason: string; // 왜 이 대안이 더 나은가?
  benefit?: string; // 고객에게 주는 이점
}

/**
 * 수정요청 상태 정의
 */
export type ModificationRequestStatus =
  | "REQUESTED" // 요청 제출됨 (초기)
  | "APPROVED" // 승인됨
  | "REJECTED" // 거절됨
  | "ALTERNATIVE_PROPOSED" // 대안제시됨
  | "COMPLETED" // 완료됨 (승인+계약업데이트 완료)
  | "EXPIRED"; // 만료됨 (7일 경과 응답없음)

/**
 * 요청자 타입
 */
export type RequestedByType = "AGENT" | "CONTACT" | "PARTNER";

/**
 * 감사 로그 항목
 */
export interface AuditLogEntry {
  timestamp: string; // ISO 형식
  action: string;
  status: ModificationRequestStatus;
  userId?: string;
  message?: string;
  ipAddress?: string;
}

/**
 * 수정요청 생성 요청 DTO
 */
export interface CreateModificationRequestDTO {
  contractId: string;
  fieldModifications: FieldModification[];
  additionalNotes?: string;
  requestedByUserId?: string;
  requestedByType?: RequestedByType;
  requestedByName?: string;
  requestedByEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 수정요청 응답 DTO (관리자)
 */
export interface ApproveModificationRequestDTO {
  responseMessage?: string; // 자동 또는 커스텀
  ipAddress?: string;
  userAgent?: string;
}

export interface RejectModificationRequestDTO {
  responseMessage: string; // 거절 사유 필수
  dealRiskReason?: string; // L6 손실회피 설명
  ipAddress?: string;
  userAgent?: string;
}

export interface ProposeAlternativeDTO {
  alternativeProposal: AlternativeProposal[];
  responseMessage?: string; // 대안 설명
  expiresInDays?: number; // 기본값 3일
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 심리학 메시지 템플릿
 * Russell Brunson (거래 재협상) + Grant Cardone (4렌즈)
 */
export const PSYCHOLOGY_TEMPLATES = {
  // L2: 5단계 중재 질문
  L2_SITUATION: "현재 상황을 설명해주실 수 있을까요?",
  L2_PROBLEM: "이 상황에서 어떤 문제가 있나요?",
  L2_IMPLICATION: "만약 이 문제가 계속되면 어떤 결과가 될까요?",
  L2_NEED: "이 문제를 해결하려면 뭐가 필요할까요?",
  L2_PAYOFF: "이게 해결되면 당신에게 어떤 이점이 있을까요?",

  // L6: 손실회피 응답
  L6_ALTERNATIVE_INTRO:
    "완벽한 요청이지만, 이 부분은 변경 불가한 이유가 있습니다. 그 대신 우리가 제안하는 것은...",
  L6_DEAL_RISK_WARNING:
    "이렇게 진행되면 거래 전체가 위험할 수 있습니다. 함께 다른 방법을 찾아봅시다.",

  // L7: 동반자/가족 설득
  L7_COLLABORATIVE_APPROVAL:
    "함께 이 문제를 해결했습니다. 당신의 신뢰에 감사합니다!",
  L7_FAMILY_PERSUASION: (relationName: string) =>
    `배우자분(${relationName})께도 이 변경사항이 도움이 될 거라고 확신합니다.`,

  // L10: 긴박감
  L10_DEADLINE_NOTICE: (deadline: string) =>
    `이 제안은 ${deadline} 23:59까지만 유효합니다. 그 후에는 원래 조건으로 돌아갑니다.`,
  L10_QUICK_DECISION:
    "지금 결정하면 추가 혜택을 드릴 수 있습니다. 시간이 제한되어 있습니다.",

  // Russell Brunson: 거래 재협상 (Hook)
  RUSSELL_HOOK: "계약을 더 나은 방향으로 조정하는 것을 도와드립니다.",
  RUSSELL_STORY_PRICE:
    "많은 고객들이 가격을 조정하고 싶어합니다. 우리가 할 수 있는 것과 없는 것을 함께 살펴봅시다.",
  RUSSELL_STORY_SCHEDULE:
    "여행 일정이 변경되는 것은 흔한 일입니다. 당신의 새로운 계획에 맞는 옵션이 있을 것입니다.",
  RUSSELL_CLOSE: "함께 최고의 거래를 만들어봅시다.",
};

/**
 * 심리학 렌즈 자동감지 규칙
 */
export const LENS_DETECTION_RULES = {
  // L2: 복잡도 점수 계산 규칙
  L2_COMPLEXITY_SCORE: {
    baseScore: 10,
    perField: 15, // 필드당 +15점
    perWord: 0.5, // 설명 글자당 +0.5점
    keywordBonus: { price: 20, schedule: 15, room: 10, family: 25 },
  },

  // L6: 거래손실 위험도 감지
  L6_RISK_KEYWORDS: [
    "price",
    "cost",
    "discount",
    "deal",
    "negotiation",
    "flexibility",
  ],
  L6_RISK_THRESHOLD: 50, // 50점 이상이면 dealRiskFlag = true

  // L7: 가족언급 감지
  L7_FAMILY_KEYWORDS: [
    "spouse",
    "배우자",
    "wife",
    "husband",
    "family",
    "가족",
    "children",
    "자녀",
  ],

  // L10: 기본 만료기간
  L10_DEFAULT_EXPIRY_DAYS: 7, // 요청 생성일 + 7일
  L10_ALTERNATIVE_EXPIRY_DAYS: 3, // 대안제시 시 +3일
};

/**
 * SPIN 질문 라이브러리 (L2 5단계 중재용)
 */
export const SPIN_QUESTIONS = {
  situation: [
    "현재 어떤 상황인가요?",
    "지금 계약의 어느 부분을 수정하고 싶으신가요?",
    "왜 이 필드를 변경해야 하나요?",
  ],
  problem: [
    "이 부분에서 어떤 어려움이 있나요?",
    "현재 값으로 어떤 문제가 생기나요?",
    "변경 없이는 진행할 수 없는 이유가 뭔가요?",
  ],
  implication: [
    "만약 이대로 진행되면 어떤 결과가 될까요?",
    "이 문제가 해결되지 않으면 거래에 어떤 영향을 미칠까요?",
    "다른 팀원들에게도 영향을 미칠까요?",
  ],
  need: [
    "이를 해결하려면 뭐가 필요할까요?",
    "우리가 뭘 도와드릴 수 있을까요?",
    "최고의 해결책이 뭐라고 생각하세요?",
  ],
  reward: [
    "이게 해결되면 당신에게 어떤 이점이 있을까요?",
    "이 변경으로 당신의 여행이 더 나아질까요?",
    "팀 전체에는 어떤 이점이 있을까요?",
  ],
};

/**
 * API 응답 포맷
 */
export interface ModificationRequestResponse {
  ok: boolean;
  data?: any;
  error?: string;
  message?: string;
}
