/**
 * Rate Limiter — Redis 기반 (폴백: 메모리)
 *
 * 1순위: Upstash Redis (INCR + EXPIRE sliding window)
 *   - Vercel 서버리스 인스턴스 간 상태 공유 가능
 *   - key: `rate_limit:<identifier>`, TTL: windowMs/1000
 * 2순위: 메모리 폴백 (Redis 연결 실패 시)
 *   - 단일 인스턴스 내 burst 방어용으로만 유효
 *   - 분산 환경에서 정확한 제한은 보장하지 않음
 *
 * Edge Runtime 호환: @upstash/redis는 fetch 기반으로 Edge 호환 가능
 */

import { rlIncr, rlTtl } from '@/lib/redis';

// ─── 메모리 폴백 저장소 ─────────────────────────────────────────────────────
interface RateLimitEntry {
  timestamps: number[];
}

const memStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function memCleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of memStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      memStore.delete(key);
    }
  }
}

function checkRateLimitMemory(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  memCleanup(windowMs);

  let entry = memStore.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    memStore.set(identifier, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.timestamps[0] + windowMs,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

/**
 * Redis 기반 rate limit 확인 (카운터 증가 포함)
 * Redis 실패 시 메모리 폴백으로 동작
 */
export async function checkRateLimitAsync(
  identifier: string,
  maxRequests: number,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const windowSec = Math.ceil(windowMs / 1000);
  const key = `rate_limit:${identifier}`;

  // 1순위: Redis
  const count = await rlIncr(key, windowSec);

  if (count !== null) {
    // Redis 성공
    if (count >= maxRequests) {
      const ttl = await rlTtl(key);
      const resetAt = ttl && ttl > 0
        ? Date.now() + ttl * 1000
        : Date.now() + windowMs;
      return { allowed: false, remaining: 0, resetAt };
    }
    return {
      allowed: true,
      remaining: maxRequests - count,
      resetAt: Date.now() + windowMs,
    };
  }

  // 2순위: 메모리 폴백 (Redis 오류)
  return checkRateLimitMemory(identifier, maxRequests, windowMs);
}

/**
 * 동기 메모리 기반 rate limit (기존 호환성 유지)
 * Edge/동기 컨텍스트에서만 사용. 가능하면 checkRateLimitAsync를 사용할 것.
 *
 * @deprecated 분산 환경에서는 checkRateLimitAsync를 사용하세요.
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  return checkRateLimitMemory(identifier, maxRequests, windowMs);
}

/**
 * 상태 조회 (카운터 증가 없음) — 메모리 기반
 */
export function getRateLimitStatus(
  identifier: string,
  maxRequests: number,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const entry = memStore.get(identifier);

  if (!entry) {
    return { allowed: true, remaining: maxRequests, resetAt: new Date(now + windowMs) };
  }

  const timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: new Date(timestamps[0] + windowMs) };
  }

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    resetAt: new Date(now + windowMs),
  };
}
