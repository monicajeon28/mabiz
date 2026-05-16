/**
 * src/lib/affiliate-rate-limit.ts
 * 대리점 비즈니스 로직 레이트 리미팅
 * - SMS 발송 제한
 * - 이메일 발송 제한
 * - 계약 신청 제한
 */

import { checkRateLimit } from '@/lib/rate-limit';

/**
 * SMS 발송 레이트 제한 확인
 * - Per phone: 5회/분 이상 차단
 * - Per affiliateCode: 100회/일 이상 차단
 */
export function checkSmsRateLimit(identifier: string, type: 'phone' | 'affiliateCode' = 'phone'): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const limits = {
    phone: { maxPerMinute: 5, windowMs: 60_000 },
    affiliateCode: { maxPerMinute: 100, windowMs: 24 * 60 * 60 * 1000 },
  };

  const limit = limits[type];
  const key = `sms:${type}:${identifier}`;

  return checkRateLimit(key, limit.maxPerMinute, limit.windowMs);
}

/**
 * 이메일 발송 레이트 제한 확인
 * - Per email: 10회/시간 이상 차단
 * - Per organizationId: 1000회/일 이상 차단
 */
export function checkEmailRateLimit(identifier: string, type: 'email' | 'org' = 'email'): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const limits = {
    email: { maxPerMinute: 10, windowMs: 60 * 60 * 1000 },
    org: { maxPerMinute: 1000, windowMs: 24 * 60 * 60 * 1000 },
  };

  const limit = limits[type];
  const key = `email:${type}:${identifier}`;

  return checkRateLimit(key, limit.maxPerMinute, limit.windowMs);
}

/**
 * 계약 신청 레이트 제한 확인
 * - Per IP: 10회/시간 이상 차단
 * - Per phone: 3회/일 이상 차단 (중복 신청 방지)
 */
export function checkContractApplicationRateLimit(
  identifier: string,
  type: 'ip' | 'phone' = 'ip',
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const limits = {
    ip: { maxPerMinute: 10, windowMs: 60 * 60 * 1000 },
    phone: { maxPerMinute: 3, windowMs: 24 * 60 * 60 * 1000 },
  };

  const limit = limits[type];
  const key = `contract:${type}:${identifier}`;

  return checkRateLimit(key, limit.maxPerMinute, limit.windowMs);
}

/**
 * 이메일 토큰 발송 레이트 제한
 * - Per email: 3회/30분 이상 차단
 */
export function checkEmailTokenRateLimit(email: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const key = `email-token:${email}`;
  return checkRateLimit(key, 3, 30 * 60 * 1000);
}
