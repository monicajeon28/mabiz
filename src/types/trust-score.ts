/**
 * 신뢰도 시스템 타입 정의
 * @see docs/TRUST_SCORE_API_SPEC.md
 */

// ============================================================================
// 1. 신뢰도 점수 (TrustScore)
// ============================================================================

export type TrustStatus = 'GOOD' | 'WARNING' | 'RESTRICTED' | 'SUSPENDED';

export interface TrustScore {
  id: string;
  userId: string;

  // 환불 통계
  totalSales: number; // 총 판매건수
  totalRefunds: number; // 총 환불건수
  refundRate: number; // 환불율 (%)

  // 신뢰도 점수
  trustScore: number; // 0-100 점수
  status: TrustStatus; // GOOD / WARNING / RESTRICTED / SUSPENDED

  // 임계값 추적
  nextThreshold: number; // 다음 상태까지 남은 환불율
  warningCount: number; // 경고 받은 횟수

  // 타임스탬프
  lastCalculatedAt: Date | string;
  statusChangedAt?: Date | string | null;
}

// ============================================================================
// 2. 신뢰도 이의 제기 (TrustAppeal)
// ============================================================================

export type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AppealReason =
  | 'PRODUCT_DEFECT' // 상품이 나빴어요
  | 'CUSTOMER_REQUESTED' // 고객이 환불해달라고 했어요
  | 'LOGISTICS_ERROR' // 배송 문제였어요
  | 'MISUNDERSTANDING' // 착오가 있었어요
  | 'SPECIAL_REQUEST'; // 특별한 사정이 있었어요

export interface TrustAppeal {
  id: string;
  trustScoreId: string;

  // 이의 내용
  reason: AppealReason | string;
  evidenceUrls: string[]; // 증거 URL 배열

  // 상태
  status: AppealStatus;
  adminReview?: string | null;

  // 결과
  requestedAction?: string | null; // "RESTORE" 등
  appliedAction?: string | null; // 실제 적용된 조치

  // 타임스탐프
  createdAt: Date | string;
  reviewedAt?: Date | string | null;
  reviewedBy?: string | null;
}

// ============================================================================
// 3. 신뢰도 감사 로그 (TrustAuditLog)
// ============================================================================

export type AuditEventType =
  | 'REFUND' // 환불 처리
  | 'STATUS_CHANGE' // 상태 변경
  | 'APPEAL' // 이의 제기
  | 'APPEAL_APPROVED' // 이의 승인
  | 'APPEAL_REJECTED' // 이의 거부
  | 'ADMIN_ACTION'; // 관리자 조치

export interface TrustAuditLog {
  id: string;
  userId: string;

  // 변경 내용
  eventType: AuditEventType;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;

  // 설명
  description: string;

  // 누가 했는가
  triggeredBy?: string | null; // 시스템 또는 사용자 ID

  // 타임스탐프
  createdAt: Date | string;
}

// ============================================================================
// 4. API 요청/응답 타입
// ============================================================================

// API 1: 신뢰도 조회 응답
export interface GetTrustScoreResponse {
  id: string;
  userId: string;
  refundRate: number;
  trustScore: number;
  status: TrustStatus;
  nextThreshold: number;
  warningCount: number;
  message: string; // "훌륭해요! 계속 잘해주세요" 등
  lastCalculatedAt: string;
}

// API 2: 신뢰도 계산 요청
export interface CalculateTrustScoreRequest {
  force?: boolean;
}

// API 2: 신뢰도 계산 응답
export interface CalculateTrustScoreResponse {
  id: string;
  userId: string;
  refundRate: number;
  trustScore: number;
  status: TrustStatus;
  nextThreshold: number;
  message: string;
  statusChanged: boolean;
  previousStatus?: TrustStatus;
  notification?: {
    type: 'WARNING' | 'CRITICAL' | 'INFO';
    message: string;
  };
}

// API 3: 상태 변경 요청
export interface UpdateTrustStatusRequest {
  status: TrustStatus;
  reason: string;
  note?: string;
}

// API 3: 상태 변경 응답
export interface UpdateTrustStatusResponse {
  id: string;
  userId: string;
  status: TrustStatus;
  reason: string;
  changedAt: string;
  changedBy: string;
}

// API 4: 이의 제기 요청
export interface SubmitAppealRequest {
  reason: AppealReason | string;
  evidenceUrls: string[];
  requestedAction?: string;
}

// API 4: 이의 제기 응답
export interface SubmitAppealResponse {
  id: string;
  userId: string;
  trustScoreId: string;
  status: 'PENDING';
  reason: AppealReason | string;
  evidenceCount: number;
  requestedAction?: string;
  createdAt: string;
  message: string;
}

// API 5: 이의 검토 요청 (승인)
export interface ReviewAppealApproveRequest {
  status: 'APPROVED';
  adminReview: string;
  appliedAction?: string;
  trustScoreAdjustment?: number;
}

// API 5: 이의 검토 요청 (거부)
export interface ReviewAppealRejectRequest {
  status: 'REJECTED';
  adminReview: string;
  appliedAction?: null;
}

export type ReviewAppealRequest =
  | ReviewAppealApproveRequest
  | ReviewAppealRejectRequest;

// API 5: 이의 검토 응답
export interface ReviewAppealResponse {
  id: string;
  status: AppealStatus;
  adminReview: string;
  appliedAction?: string | null;
  reviewedAt: string;
  reviewedBy: string;
  result?: {
    trustScoreUpdated: boolean;
    previousScore?: number;
    newScore?: number;
    previousRefundRate?: number;
    newRefundRate?: number;
  };
}

// API 6: 감사 로그 응답
export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  description: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  triggeredBy?: string | null;
  createdAt: string;
}

export interface GetAuditLogsResponse {
  total: number;
  logs: AuditLog[];
}

// ============================================================================
// 5. 내부 계산 타입
// ============================================================================

export interface TrustScoreCalculation {
  totalSales: number;
  totalRefunds: number;
  refundRate: number;
  trustScore: number;
  status: TrustStatus;
  nextThreshold: number;
}

export interface StatusChangeEvent {
  userId: string;
  previousStatus: TrustStatus;
  newStatus: TrustStatus;
  refundRate: number;
  triggeredAt: Date;
}

// ============================================================================
// 6. UI 표시용 타입
// ============================================================================

export interface TrustScoreDisplay {
  // 숫자
  score: number; // 0-100
  rate: number; // 0-100 (환불율)

  // 상태
  status: TrustStatus;
  message: string;
  color: 'green' | 'yellow' | 'red' | 'dark'; // UI 색상

  // 액션
  canSell: boolean; // 판매 가능?
  canRegisterProduct: boolean; // 새 상품 등록 가능?
  canLogin: boolean; // 로그인 가능?

  // 다음 단계
  nextThreshold: number;
  remainingPercent: number; // 다음 단계까지 남은 %
}

// ============================================================================
// 7. 에러 타입
// ============================================================================

export interface TrustScoreError {
  code:
    | 'USER_NOT_FOUND'
    | 'TRUST_SCORE_NOT_FOUND'
    | 'APPEAL_NOT_FOUND'
    | 'INVALID_STATUS'
    | 'INSUFFICIENT_EVIDENCE'
    | 'UNAUTHORIZED';
  message: string;
}

// ============================================================================
// 8. 상수
// ============================================================================

export const TRUST_SCORE_THRESHOLDS = {
  GOOD: { min: 0, max: 30 }, // 환불율 0-30% = GOOD
  WARNING: { min: 30, max: 35 }, // 환불율 30-35% = WARNING
  RESTRICTED: { min: 35, max: 40 }, // 환불율 35-40% = RESTRICTED
  SUSPENDED: { min: 40, max: 100 }, // 환불율 40%+ = SUSPENDED
} as const;

export const TRUST_SCORE_MESSAGES = {
  GOOD: '훌륭해요! 계속 잘해주세요.',
  WARNING: '조금 더 신경 써주세요.',
  RESTRICTED: '개선이 필요합니다. 관리자와 상담하세요.',
  SUSPENDED: '계정이 일시 중지되었습니다. 관리자에게 문의하세요.',
} as const;

export const APPEAL_REASON_LABELS = {
  PRODUCT_DEFECT: '상품이 나빴어요',
  CUSTOMER_REQUESTED: '고객이 환불해달라고 했어요',
  LOGISTICS_ERROR: '배송 문제였어요',
  MISUNDERSTANDING: '착오가 있었어요',
  SPECIAL_REQUEST: '특별한 사정이 있었어요',
} as const;
