/**
 * Kakao Channel Types
 * 카카오톡 알림톡 관련 타입 정의
 */

/**
 * Kakao 설정 타입
 */
export interface KakaoConfig {
  senderKey: string;
  isActive: boolean;
}

/**
 * Kakao 메시지 요청 타입
 */
export interface KakaoMessageRequest {
  title: string;
  message: string;
  dryRun?: boolean;
}

/**
 * Kakao 메시지 응답 타입
 */
export interface KakaoMessageResponse {
  ok: boolean;
  sentCount?: number;
  failedCount?: number;
  total?: number;
  message?: string;
  rateLimitStatus?: RateLimitStatus;
}

/**
 * Rate Limit 상태 타입
 */
export interface RateLimitStatus {
  used: number;
  remaining: number;
  resetAt: string;
}

/**
 * Kakao DRY RUN 응답 타입
 */
export interface KakaoDryRunResponse {
  ok: boolean;
  dryRun: true;
  groupName: string;
  total: number;
  willSend: number;
  sample: string;
  isOverLimit?: boolean;
  overLimitMsg?: string | null;
  rateLimitStatus?: RateLimitStatus;
}

/**
 * Kakao 템플릿 타입
 */
export interface KakaoTemplate {
  id: string;
  title: string;
  content: string;
  category?: string;
  templateCode?: string;
}

/**
 * Aligo Kakao API 응답 타입
 */
export interface AligoKakaoResponse {
  result_code: string | number;
  message: string;
  msg_id?: string;
}

/**
 * 메시지 치환 옵션
 */
export interface SubstitutionOption {
  label: string;
  desc: string;
}

/**
 * Kakao 발송 이력
 */
export interface KakaoMessageLog {
  id: string;
  organizationId: string;
  groupId?: string;
  title: string;
  content: string;
  sentCount: number;
  failedCount: number;
  sentAt: Date;
}
