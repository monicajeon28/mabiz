/**
 * Delta SMS 타입 정의
 * API 응답 및 내부 상태의 타입 안전성 확보
 */

/**
 * Campaign 스케줄 구성 (Day별 메시지 + 통계)
 */
export interface DeltaCampaignSchedule {
  day: number;
  message: string;
  sentCount?: number;
  openRate?: number;
  clickRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Delta 설정 API 응답 (GET /api/campaigns/[id]/delta)
 * 기존 Campaign의 Delta SMS 설정 조회
 */
export interface DeltaConfigResponse {
  ok: boolean;
  campaignId: string;
  triggerType: 'PURCHASE' | 'ABANDONED';
  schedule: DeltaCampaignSchedule[];
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 예상 발송 통계 (시간대별)
 * GET /api/campaigns/[id]/delta/stats 응답
 */
export interface DeltaCampaignStats {
  estimatesByHour: {
    [hour: number]: number;
  };
  totalEstimate: number;
  totalDays: number;
  lastUpdatedAt: string;
}

/**
 * API 에러 응답 (공통 형식)
 */
export interface DeltaErrorResponse {
  ok: false;
  error: string;
  message: string;
  errors?: Record<string, string>;
  code?: string;
  status: number;
}

/**
 * Trigger Type 타입 정의
 */
export type DeltaTriggerType = 'PURCHASE' | 'ABANDONED';

/**
 * Day 번호 타입 (0-3)
 */
export type DayNumber = 0 | 1 | 2 | 3;

/**
 * Message key 타입 (day0-day3)
 */
export type MessageKey = 'day0' | 'day1' | 'day2' | 'day3';

/**
 * 메시지 상태 타입
 */
export type MessageStatusType = 'safe' | 'warning' | 'danger';

/**
 * Delta 설정 저장 요청 (POST /api/campaigns/delta)
 */
export interface DeltaSaveRequest {
  campaignId: string;
  triggerType: DeltaTriggerType;
  deltaDay0Message: string;
  deltaDay1Message: string;
  deltaDay2Message: string;
  deltaDay3Message: string;
}

/**
 * Delta 설정 저장 응답 (POST /api/campaigns/delta)
 */
export interface DeltaSaveResponse {
  ok: boolean;
  message: string;
  campaignId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validation 결과
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}
