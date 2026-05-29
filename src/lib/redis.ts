import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error('Missing required Redis configuration: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// 캐시 조회 (실패 시 null 반환)
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch (err) {
    logger.warn('[Redis getCache error]', { key, error: (err as Error).message });
    return null;
  }
}

// 캐시 저장
export async function setCache(
  key: string,
  data: unknown,
  ttlSeconds = 60
) {
  try {
    await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
  } catch {
    /* silent fail */
  }
}

// 캐시 무효화
export async function invalidateCache(pattern: string) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* silent fail */
  }
}

// ─── Rate Limit 전용 (sliding window, INCR + EXPIRE) ───────────────────────
/**
 * Redis 기반 rate limit 카운터 증가
 * @param key Redis 키 (예: "rate_limit:ip:1.2.3.4")
 * @param windowSec 윈도우 초 (처음 생성 시 TTL 설정)
 * @returns 현재 카운트 (실패 시 null → 메모리 폴백 유도)
 */
export async function rlIncr(key: string, windowSec: number): Promise<number | null> {
  try {
    const count = await redis.incr(key);
    // 처음 생성된 키에만 TTL 설정 (레이스컨디션 방지: INCR 결과가 1이면 처음)
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    return count;
  } catch (err) {
    logger.warn('[Redis rlIncr error]', { key, error: (err as Error).message });
    return null;
  }
}

/**
 * Redis 키 TTL 조회
 * @returns 남은 초 (키 없으면 -2, TTL 없으면 -1, 실패 시 null)
 */
export async function rlTtl(key: string): Promise<number | null> {
  try {
    return await redis.ttl(key);
  } catch (err) {
    logger.warn('[Redis rlTtl error]', { key, error: (err as Error).message });
    return null;
  }
}

// ─── CSRF Token 전용 (SET NX EX / GET / DEL) ───────────────────────────────
/**
 * CSRF 토큰 저장 (NX: 이미 존재하면 덮어쓰기)
 * @param sessionId 세션 ID
 * @param token CSRF 토큰
 * @param ttlSec TTL 초 (기본 3600 = 1시간)
 */
export async function csrfSet(
  sessionId: string,
  token: string,
  ttlSec = 3600
): Promise<boolean> {
  try {
    await redis.set(`csrf:${sessionId}`, token, { ex: ttlSec });
    return true;
  } catch (err) {
    logger.warn('[Redis csrfSet error]', { error: (err as Error).message });
    return false;
  }
}

/**
 * CSRF 토큰 조회
 * @returns 토큰 문자열 또는 null (없거나 실패)
 */
export async function csrfGet(sessionId: string): Promise<string | null> {
  try {
    return await redis.get<string>(`csrf:${sessionId}`);
  } catch (err) {
    logger.warn('[Redis csrfGet error]', { error: (err as Error).message });
    return null;
  }
}

/**
 * CSRF 토큰 삭제 (로그아웃 시)
 */
export async function csrfDel(sessionId: string): Promise<void> {
  try {
    await redis.del(`csrf:${sessionId}`);
  } catch {
    /* silent fail */
  }
}

export { redis };
