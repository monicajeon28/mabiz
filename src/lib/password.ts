/**
 * src/lib/password.ts
 * 비밀번호 해싱 중앙 유틸 — 모든 가입/로그인 API는 이 함수만 사용
 * SHA-256, 기본값 'qwe1' 절대 사용 금지
 */
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';

const ROUNDS = 14;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw Object.assign(new Error('비밀번호는 8자 이상이어야 합니다.'), { status: 400 });
  }
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false; // stored 없으면 무조건 실패

  // bcrypt 해시
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    return bcrypt.compare(plain, stored);
  }

  // 레거시 SHA-256 (기존 데이터 호환용 — 새로 만드는 곳에서 사용 금지)
  try {
    const inputHash = createHash('sha256').update(plain).digest('hex');
    const a = Buffer.from(inputHash);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
