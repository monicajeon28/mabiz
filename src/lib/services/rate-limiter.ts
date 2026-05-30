/**
 * Menu #38 Phase 3-β: 통합 Rate Limiter 서비스
 *
 * 목적:
 * - SMS (Aligo): 100/분 제한
 * - Email (Gmail): 50/분 제한
 * - Contact별: 10/일 제한 (스팸 방지)
 * - Redis 기반 토큰 버킷 알고리즘
 *
 * 사용:
 * 1. executeCampaignMessages()에서 배치 처리 전 호출:
 *    if (!await checkRateLimit('SMS', organizationId)) {
 *      return { sent: 0, failed: contactIds.length, skipped: 0 };
 *    }
 *
 * 2. sendToContactByTemplate()에서 개별 발송 전 호출:
 *    if (!await checkContactRateLimit(contactId)) {
 *      return { status: 'SKIPPED', failureReason: 'RATE_LIMITED' };
 *    }
 */

import { Redis } from "@upstash/redis";
import { logger } from "../logger";
import {
  getRateLimitPolicy,
  RATE_LIMIT_KEYS,
  DEFAULT_RATE_LIMIT_POLICY,
} from "../config/rate-limit-config";

// Redis 인스턴스
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  logger.warn('[RateLimit] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN — rate limiting disabled (fail-open)');
}

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!redisUrl || !redisToken) return null;
  if (!_redis) _redis = new Redis({ url: redisUrl, token: redisToken });
  return _redis;
}

interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp (ms)
}

/**
 * 함수 1: 채널 레벨 Rate Limit 검사 (분 단위)
 * - SMS: 100/분 (Aligo)
 * - Email: 50/분 (Gmail)
 *
 * @param channel - "SMS" | "EMAIL"
 * @param organizationId - 조직 ID
 * @returns RateLimitCheckResult { allowed, remaining, resetAt }
 *
 * @example
 * const result = await checkChannelRateLimit("SMS", orgId);
 * if (!result.allowed) {
 *   logger.warn(`Rate limited. Reset at ${new Date(result.resetAt)}`);
 * }
 */
export async function checkChannelRateLimit(
  channel: "SMS" | "EMAIL",
  organizationId: string
): Promise<RateLimitCheckResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true, remaining: 1000, resetAt: Date.now() + 60 * 1000 };
  try {
    const policy = getRateLimitPolicy(organizationId);
    const limit = channel === "SMS" ? policy.SMS_PER_MINUTE : policy.EMAIL_PER_MINUTE;
    const key = channel === "SMS"
      ? RATE_LIMIT_KEYS.SMS_CHANNEL(organizationId)
      : RATE_LIMIT_KEYS.EMAIL_CHANNEL(organizationId);

    // Redis INCR + TTL 설정
    const current = (await redis.incr(key)) as number;

    // 첫 요청 시에만 TTL 설정 (60초)
    if (current === 1) {
      await redis.expire(key, 60);
    }

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const resetAt = Date.now() + 60 * 1000; // 1분 후

    if (!allowed) {
      logger.warn(`[RateLimit] ${channel} 초과 (${current}/${limit})`, {
        channel,
        organizationId,
        current,
        limit,
        resetAt: new Date(resetAt).toISOString(),
      });
    }

    return { allowed, remaining, resetAt };
  } catch (err) {
    logger.error(`[RateLimit] ${channel} 검사 실패`, { organizationId, err });
    // Redis 실패 시: 허용 (fail-open 전략)
    return {
      allowed: true,
      remaining: 1000, // 임의값
      resetAt: Date.now() + 60 * 1000,
    };
  }
}

/**
 * 함수 2: Contact 레벨 Rate Limit 검사 (일 단위)
 * - Contact별 10/일 제한 (스팸 방지)
 *
 * @param contactId - 연락처 ID
 * @param limit - 일일 제한 (기본값: 10)
 * @returns RateLimitCheckResult { allowed, remaining, resetAt }
 *
 * @example
 * const result = await checkContactRateLimit(contactId);
 * if (!result.allowed) {
 *   logger.warn(`Contact rate limited until ${new Date(result.resetAt)}`);
 * }
 */
export async function checkContactRateLimit(
  contactId: string,
  limit?: number
): Promise<RateLimitCheckResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true, remaining: 1000, resetAt: Date.now() + 24 * 60 * 60 * 1000 };
  try {
    const dailyLimit = limit ?? DEFAULT_RATE_LIMIT_POLICY.CONTACT_PER_DAY;
    const key = RATE_LIMIT_KEYS.CONTACT_PER_DAY(contactId);

    // Redis INCR + TTL 설정
    const current = (await redis.incr(key)) as number;

    // 첫 요청 시에만 TTL 설정 (24시간 = 86400초)
    if (current === 1) {
      await redis.expire(key, 86400);
    }

    const allowed = current <= dailyLimit;
    const remaining = Math.max(0, dailyLimit - current);

    // 오늘 자정까지의 시간 계산
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const resetAt = tomorrow.getTime();

    if (!allowed) {
      logger.warn(`[RateLimit] Contact 초과 (${current}/${dailyLimit})`, {
        contactId,
        current,
        limit: dailyLimit,
        resetAt: new Date(resetAt).toISOString(),
      });
    }

    return { allowed, remaining, resetAt };
  } catch (err) {
    logger.error(`[RateLimit] Contact 검사 실패`, { contactId, err });
    // Redis 실패 시: 허용 (fail-open 전략)
    return {
      allowed: true,
      remaining: 1000,
      resetAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  }
}

/**
 * 함수 3: Organization 레벨 Rate Limit 검사 (월 단위)
 * - 조직별 월간 발송 제한 (프리미엄 기능)
 *
 * @param organizationId - 조직 ID
 * @returns RateLimitCheckResult { allowed, remaining, resetAt }
 *
 * @example
 * const result = await checkOrganizationRateLimit(orgId);
 * if (!result.allowed) {
 *   logger.warn("Organization monthly quota exceeded");
 * }
 */
export async function checkOrganizationRateLimit(
  organizationId: string
): Promise<RateLimitCheckResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true, remaining: 1000000, resetAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  try {
    const policy = getRateLimitPolicy(organizationId);
    const monthlyLimit = policy.ORGANIZATION_PER_MONTH;
    const key = RATE_LIMIT_KEYS.ORGANIZATION_PER_MONTH(organizationId);

    // Redis INCR + TTL 설정
    const current = (await redis.incr(key)) as number;

    // 첫 요청 시에만 TTL 설정 (30일 = 2592000초)
    if (current === 1) {
      await redis.expire(key, 30 * 24 * 60 * 60);
    }

    const allowed = current <= monthlyLimit;
    const remaining = Math.max(0, monthlyLimit - current);

    // 다음 달 1일까지의 시간 계산
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    const resetAt = nextMonth.getTime();

    if (!allowed) {
      logger.warn(`[RateLimit] Organization 월간 초과 (${current}/${monthlyLimit})`, {
        organizationId,
        current,
        limit: monthlyLimit,
        resetAt: new Date(resetAt).toISOString(),
      });
    }

    return { allowed, remaining, resetAt };
  } catch (err) {
    logger.error(`[RateLimit] Organization 검사 실패`, { organizationId, err });
    // Redis 실패 시: 허용 (fail-open 전략)
    return {
      allowed: true,
      remaining: 1000000,
      resetAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
  }
}

/**
 * 함수 4: 종합 Rate Limit 검사
 * - 채널(분) + Contact(일) + Organization(월) 모두 확인
 *
 * @returns 모든 제한 통과: true, 하나라도 초과: false
 *
 * @example
 * const allowed = await checkAllRateLimits(channel, contactId, organizationId);
 * if (!allowed) {
 *   return { status: 'SKIPPED', failureReason: 'RATE_LIMITED' };
 * }
 */
export async function checkAllRateLimits(
  channel: "SMS" | "EMAIL",
  contactId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const [channelResult, contactResult, orgResult] = await Promise.all([
      checkChannelRateLimit(channel, organizationId),
      checkContactRateLimit(contactId),
      checkOrganizationRateLimit(organizationId),
    ]);

    return channelResult.allowed && contactResult.allowed && orgResult.allowed;
  } catch (err) {
    logger.error("[RateLimit] 종합 검사 실패", { channel, contactId, organizationId, err });
    // 실패 시: 허용 (fail-open)
    return true;
  }
}

/**
 * 함수 5: Rate Limit 리셋 (테스트용)
 * - 특정 키의 rate limit 초기화
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
    logger.info(`[RateLimit] 리셋 완료: ${key}`);
  } catch (err) {
    logger.warn(`[RateLimit] 리셋 실패: ${key}`, { err });
  }
}

/**
 * 함수 6: 모든 Rate Limit 리셋 (개발 및 테스트용)
 */
export async function resetAllRateLimits(): Promise<void> {
  try {
    // 패턴 매칭으로 모든 rate limit 키 삭제
    // Redis SCAN을 사용하면 더 효율적이지만, Upstash는 SCAN 미지원
    // 따라서 수동으로 알려진 키들만 삭제
    logger.info("[RateLimit] 모든 제한 리셋 (개발/테스트용)");
    // TODO: Upstash 지원 명령어로 패턴 삭제 구현
  } catch (err) {
    logger.warn("[RateLimit] 전체 리셋 실패", { err });
  }
}
