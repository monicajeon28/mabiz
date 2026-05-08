import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 캐시 조회 (실패 시 null 반환)
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch {
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
