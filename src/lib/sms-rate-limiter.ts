/**
 * SMS Rate Limiter (Token Bucket Algorithm)
 *
 * 목적: Aligo API 초당 3건 제한 준수
 * 알고리즘: Token Bucket (토큰 버킷 알고리즘)
 * - 초당 3개 토큰 재충전
 * - 토큰 1개 = SMS 1건 발송 권리
 * - 토큰 부족 시 필요한 시간만큼 대기
 *
 * 용도:
 * - executeCampaignMessages() 내 루프에서 호출
 * - Aligo API 호출 전 Rate Limit 확인
 *
 * 예시:
 * ```
 * const limiter = getSmsRateLimiter();
 * const waitMs = limiter.acquire();  // 0 또는 대기시간(ms)
 * if (waitMs > 0) {
 *   await new Promise(resolve => setTimeout(resolve, waitMs));
 * }
 * // 발송 코드
 * ```
 */

class SmsRateLimiter {
  private tokens = 3;           // 초기 토큰 3개 (초당 3건)
  private maxTokens = 3;
  private refillRate = 3;       // 초당 3개 토큰 재충전
  private lastRefill = Date.now();

  /**
   * 토큰 재충전 (시간 경과에 따라)
   */
  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;  // 초 단위
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * 토큰 소비 시도
   * @returns 대기 시간 (ms), 0이면 즉시 발송 가능
   */
  public acquire(): number {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;  // 즉시 발송 가능
    }

    // 토큰 부족: 다음 토큰 준비까지 대기
    const tokensNeeded = 1 - this.tokens;
    const waitMs = (tokensNeeded / this.refillRate) * 1000;
    return Math.ceil(waitMs);
  }

  /**
   * 토큰 상태 확인 (디버깅용)
   */
  public getStatus() {
    this.refill();
    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      refillRate: this.refillRate
    };
  }

  /**
   * 토큰 리셋 (테스트용)
   */
  public reset() {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

// Singleton 인스턴스
let limiter: SmsRateLimiter | null = null;

export function getSmsRateLimiter(): SmsRateLimiter {
  if (!limiter) {
    limiter = new SmsRateLimiter();
  }
  return limiter;
}

/**
 * SMS 발송 제한 (사용자 코드)
 *
 * 사용례:
 * ```
 * // SMS 발송 전 호출
 * await waitForSmsCapacity();
 * // SMS 발송
 * const result = await sendSms(...);
 * ```
 */
export async function waitForSmsCapacity(): Promise<void> {
  const limiter = getSmsRateLimiter();
  const waitMs = limiter.acquire();

  if (waitMs > 0) {
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}
