/**
 * SMS Rate Limiter (Token Bucket — Redis 우선, 인메모리 폴백)
 *
 * 목적: Aligo API 초당 3건 제한 준수
 * 알고리즘: Token Bucket (토큰 버킷 알고리즘)
 * - 초당 3개 토큰 재충전
 * - 토큰 1개 = SMS 1건 발송 권리
 * - 토큰 부족 시 필요한 시간만큼 대기
 *
 * 서버리스 호환:
 * - 모듈 싱글톤은 서버리스(Vercel) 환경에서 요청마다 콜드-스타트될 수 있어
 *   초당 카운터가 정확하지 않음.
 * - Redis(UPSTASH_REDIS_REST_URL)가 설정된 경우 Redis INCR+EXPIRE 기반
 *   슬라이딩 윈도우 카운터를 사용하여 인스턴스 간 정확한 rate limit 보장.
 * - Redis 미설정/장애 시 인메모리 Token Bucket으로 투명하게 폴백.
 *
 * 용도:
 * - executeCampaignMessages() 내 루프에서 호출
 * - Aligo API 호출 전 Rate Limit 확인
 *
 * 예시:
 * ```
 * // SMS 발송 전 호출
 * await waitForSmsCapacity();
 * // SMS 발송
 * const result = await sendSms(...);
 * ```
 */

import { rlIncr, rlTtl } from '@/lib/redis';

// ─── 설정 상수 ──────────────────────────────────────────────────────────────
const MAX_TOKENS_PER_SECOND = 3; // Aligo 초당 3건 제한
const REDIS_WINDOW_SEC = 1;      // 1초 슬라이딩 윈도우
const REDIS_KEY = 'sms_rate_limiter:tokens'; // Redis 키 (고정, 전역 공유)

// ─── 인메모리 폴백용 Token Bucket ────────────────────────────────────────────
class InMemoryTokenBucket {
  private tokens = MAX_TOKENS_PER_SECOND;
  private readonly maxTokens = MAX_TOKENS_PER_SECOND;
  private readonly refillRate = MAX_TOKENS_PER_SECOND; // 초당 토큰 수
  private lastRefill = Date.now();

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // 초 단위
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /** 토큰 소비 시도. @returns 대기 시간(ms), 0이면 즉시 가능 */
  acquire(): number {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000);
  }

  getStatus() {
    this.refill();
    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      backend: 'memory' as const,
    };
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

// 인메모리 폴백 인스턴스
// 서버리스에서는 콜드-스타트마다 리셋되지만, Redis가 주 경로이므로 허용.
// Redis 장애 시에도 단일 인스턴스 내에서는 올바르게 동작한다.
const _fallbackBucket = new InMemoryTokenBucket();

// ─── Redis 기반 슬라이딩 윈도우 카운터 ──────────────────────────────────────

/**
 * Redis INCR 기반으로 1초 윈도우 내 카운트를 증가시킨 뒤
 * 허용 여부와 대기 시간을 반환한다.
 *
 * @returns { allowed: true, waitMs: 0 } | { allowed: false, waitMs: number }
 */
async function redisAcquire(): Promise<{ allowed: boolean; waitMs: number }> {
  const count = await rlIncr(REDIS_KEY, REDIS_WINDOW_SEC);

  // Redis 미사용(null) → 폴백 신호
  if (count === null) {
    return { allowed: false, waitMs: -1 }; // -1 = 폴백 지시
  }

  if (count <= MAX_TOKENS_PER_SECOND) {
    return { allowed: true, waitMs: 0 };
  }

  // 초과: 현재 윈도우가 끝날 때까지 대기
  const ttl = await rlTtl(REDIS_KEY);
  const remainMs = ttl !== null && ttl > 0 ? ttl * 1000 : REDIS_WINDOW_SEC * 1000;
  return { allowed: false, waitMs: remainMs };
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

/**
 * SMS 발송 전 capacity 획득. 필요 시 대기.
 *
 * - UPSTASH_REDIS_REST_URL 환경변수가 설정된 경우 Redis 사용
 * - 미설정 또는 Redis 장애 시 인메모리 Token Bucket 폴백
 */
export async function waitForSmsCapacity(): Promise<void> {
  // 1차 시도: Redis 슬라이딩 윈도우
  const result = await redisAcquire();

  if (result.waitMs === -1) {
    // Redis 미사용 → 인메모리 폴백
    const waitMs = _fallbackBucket.acquire();
    if (waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
    return;
  }

  if (!result.allowed && result.waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, result.waitMs));
    // 대기 후 재시도 (1회)
    const retry = await redisAcquire();
    if (!retry.allowed && retry.waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, retry.waitMs));
    }
  }
}

/**
 * 현재 Rate Limiter 상태 조회 (디버깅/모니터링용)
 */
export async function getSmsRateLimiterStatus(): Promise<{
  backend: 'redis' | 'memory';
  availableTokens?: number;
  maxTokens: number;
  refillRate: number;
}> {
  const count = await rlIncr(REDIS_KEY, REDIS_WINDOW_SEC);
  if (count === null) {
    return _fallbackBucket.getStatus();
  }
  // INCR은 호출 자체가 1 소비이므로 보정 (조회 목적 아님을 감안)
  const used = Math.min(count, MAX_TOKENS_PER_SECOND);
  return {
    backend: 'redis',
    availableTokens: Math.max(0, MAX_TOKENS_PER_SECOND - used),
    maxTokens: MAX_TOKENS_PER_SECOND,
    refillRate: MAX_TOKENS_PER_SECOND,
  };
}

/**
 * 인메모리 폴백 버킷 직접 접근 (테스트용)
 * @deprecated 프로덕션에서 직접 사용 금지. waitForSmsCapacity() 사용.
 */
export function getSmsRateLimiter(): InMemoryTokenBucket {
  return _fallbackBucket;
}
