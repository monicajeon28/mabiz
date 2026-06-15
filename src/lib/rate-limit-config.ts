/**
 * Rate Limiting Configuration (P0 Security Fix)
 * - User-based limits: Prevent slow/distributed DDoS
 * - IP-based limits: Prevent burst attacks
 * - Redis storage: Fast distributed lookup
 */

export const RATE_LIMIT_CONFIG = {
  // POST /api/contacts (고객 생성)
  contacts: {
    perUser: 10,        // 사용자당 1분 10회
    perUserWindow: 60,  // 60초
    perIp: 100,         // IP당 1분 100회
    perIpWindow: 60,
  },

  // POST /api/groups/[id]/members (그룹 멤버 추가)
  groupMembers: {
    perUser: 20,        // 사용자당 1분 20회
    perUserWindow: 60,
    perIp: 50,          // IP당 1분 50회
    perIpWindow: 60,
  },

  // POST /api/funnel-sms/*/send (SMS 발송)
  funnelSmsSend: {
    perUser: 5,         // 사용자당 1분 5회
    perUserWindow: 60,
    perIp: 20,          // IP당 1분 20회
    perIpWindow: 60,
  },

  // POST /api/groups (그룹 생성)
  groupCreate: {
    perUser: 30,        // 사용자당 1분 30회
    perUserWindow: 60,
    perIp: 100,
    perIpWindow: 60,
  },
};

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIG;

/**
 * Rate limit 에러 응답 헤더 생성
 */
export function createRateLimitHeaders(remaining: number, resetTime: number) {
  const now = Math.floor(Date.now() / 1000);
  const secondsUntilReset = Math.max(0, resetTime - now);

  return {
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(resetTime),
    'Retry-After': String(secondsUntilReset),
  };
}
