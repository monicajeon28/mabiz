/**
 * Menu #38 Phase 3-β: Rate Limiting 설정
 *
 * 목적:
 * - SMS (Aligo API: 100/분) 제한
 * - Email (Gmail API: 50/분) 제한
 * - Contact별 일일 제한 (10/일) - 스팸 방지
 * - Organization별 월간 제한 (설정)
 *
 * 적용:
 * - execute-campaigns.ts: executeCampaignMessages() 호출 전 검증
 * - retrySendingMessage(): Rate limit 초과 시 재시도 연기
 * - sendToContactByTemplate(): Contact별 제한 검증
 *
 * 구현:
 * - Redis 기반 토큰 버킷 알고리즘 (분산 환경 호환)
 * - Sliding Window 또는 Fixed Window (성능)
 * - 초과 시: RATE_LIMITED 상태 저장, 나중에 재시도
 */

export interface RateLimitPolicy {
  // API/Channel별 제한
  SMS_PER_MINUTE: number;        // Aligo API: 100/분
  EMAIL_PER_MINUTE: number;       // Gmail API: 50/분
  CONTACT_PER_DAY: number;        // Contact별: 10/일 (스팸 방지)
  ORGANIZATION_PER_MONTH: number; // Org별: 설정 필요 (대량 발송용)

  // 재시도 전략
  RATE_LIMITED_RETRY_DELAY_MS: number; // Rate limit 초과 시 재시도 지연 (15분)
}

// 기본 정책
export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  SMS_PER_MINUTE: 100,           // Aligo 공식 스펙
  EMAIL_PER_MINUTE: 50,          // Gmail 공식 스펙 (per user)
  CONTACT_PER_DAY: 10,           // 스팸 방지 (일인 최대 10건/일)
  ORGANIZATION_PER_MONTH: 100000, // 기본값 (조직별 설정 필요)
  RATE_LIMITED_RETRY_DELAY_MS: 15 * 60 * 1000, // 15분 후 재시도
};

// 프리미엄 조직용 (설정 필요)
export const PREMIUM_RATE_LIMIT_POLICY: RateLimitPolicy = {
  SMS_PER_MINUTE: 200,           // 2배 증가 (Aligo 협상)
  EMAIL_PER_MINUTE: 100,         // 2배 증가
  CONTACT_PER_DAY: 20,           // 2배 증가
  ORGANIZATION_PER_MONTH: 1000000, // 대량 발송
  RATE_LIMITED_RETRY_DELAY_MS: 5 * 60 * 1000, // 5분 후 재시도
};

/**
 * 조직 ID에 따른 정책 조회
 * TODO: DB에서 조직 정책 로드 (현재는 하드코딩)
 */
export function getRateLimitPolicy(organizationId: string): RateLimitPolicy {
  // 향후 DB에서 조직의 구독 등급(BASIC/PREMIUM) 조회 후 정책 반환
  // 현재: 모든 조직에 기본 정책 적용
  return DEFAULT_RATE_LIMIT_POLICY;
}

/**
 * Redis 키 형식 정의
 */
export const RATE_LIMIT_KEYS = {
  // 채널별 제한 (minute window)
  SMS_CHANNEL: (organizationId: string) => `ratelimit:sms:${organizationId}:${Math.floor(Date.now() / 60000)}`,
  EMAIL_CHANNEL: (organizationId: string) => `ratelimit:email:${organizationId}:${Math.floor(Date.now() / 60000)}`,

  // Contact별 제한 (day window)
  CONTACT_PER_DAY: (contactId: string) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `ratelimit:contact:${contactId}:${today}`;
  },

  // Organization별 제한 (month window)
  ORGANIZATION_PER_MONTH: (organizationId: string) => {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    return `ratelimit:org:${organizationId}:${month}`;
  },
};

/**
 * Rate Limit 스테이터스 (DB 저장용)
 */
export type RateLimitStatus = "RATE_LIMITED";

/**
 * Rate Limit 초과 시 처리 전략
 */
export interface RateLimitExceededAction {
  action: "DEFER" | "SKIP" | "FAIL";
  delayMs?: number;
  message: string;
}

/**
 * 채널별 Rate Limit 초과 시 처리
 */
export function getRateLimitExceededAction(
  channel: "SMS" | "EMAIL",
  organizationId: string
): RateLimitExceededAction {
  const policy = getRateLimitPolicy(organizationId);

  return {
    action: "DEFER", // 나중에 재시도
    delayMs: policy.RATE_LIMITED_RETRY_DELAY_MS,
    message: `${channel} rate limit 초과. ${policy.RATE_LIMITED_RETRY_DELAY_MS / 1000 / 60}분 후 재시도`,
  };
}
