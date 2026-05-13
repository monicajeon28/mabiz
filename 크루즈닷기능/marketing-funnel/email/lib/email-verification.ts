import crypto from 'crypto';
import { logger } from '@/lib/logger';

/**
 * S-3: 이메일 검증 토큰 생성
 * - 32바이트 랜덤 토큰 (256비트)
 * - 24시간 만료
 */
export function generateVerificationToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

  logger.info('Email verification token generated', {
    tokenPrefix: token.slice(0, 8),
    expiresAt: expiresAt.toISOString(),
  });

  return { token, expiresAt };
}

/**
 * S-3: 토큰 해시 (SHA-256)
 * - DB에 저장된 해시와 비교하여 검증
 * - 토큰 노출 시에도 원본 복원 불가
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * S-3: 토큰 검증 (Timing-safe 비교)
 * - 상수 시간 비교로 타이밍 공격 방지
 */
export function verifyTokenHash(token: string, storedHash: string): boolean {
  const computedHash = hashToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(storedHash)
  );
}

/**
 * S-3: 토큰 만료 여부 확인
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * S-3: 토큰 검증 전체 플로우
 */
export function validateVerificationToken(
  token: string,
  storedHash: string,
  expiresAt: Date
): { valid: boolean; reason?: string } {
  try {
    // 1. 만료 여부 확인
    if (isTokenExpired(expiresAt)) {
      return { valid: false, reason: 'Token expired' };
    }

    // 2. 토큰 해시 검증 (타이밍 공격 방지)
    if (!verifyTokenHash(token, storedHash)) {
      return { valid: false, reason: 'Invalid token' };
    }

    return { valid: true };
  } catch (error) {
    logger.error('Token validation error', { error });
    return { valid: false, reason: 'Validation error' };
  }
}
