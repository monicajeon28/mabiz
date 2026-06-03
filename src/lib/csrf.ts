/**
 * CSRF Token Management
 * S-002: CSRF 토큰 추가로 DB 전달 요청 보안 강화
 *
 * ✅ Web Crypto API 사용 (Edge Runtime 호환)
 * ❌ Node.js 전용 'crypto' 모듈 사용 금지 (Edge Runtime 비호환)
 *
 * 저장소:
 *   1순위: Upstash Redis (분산 환경 CSRF 검증 가능)
 *   2순위: 메모리 Map 폴백 (Redis 연결 실패 시)
 *   - 폴백은 단일 인스턴스 내에서만 유효 (서버리스 재시작 시 토큰 유실)
 */

import { csrfSet, csrfGet, csrfDel } from '@/lib/redis';

/**
 * CSRF 토큰 생성 (Web Crypto API — Edge Runtime 호환)
 * 서버에서 클라이언트로 전달 (요청 시마다 새로 생성하면 안 됨)
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * CSRF 토큰 검증 (형식 검사만 수행, 보안 검증 아님)
 *
 * ⚠️ DEPRECATED: 이 함수는 형식만 검사하고 실제 토큰 유효성을 검증하지 않습니다.
 * 보안을 위해 반드시 validateToken(sessionId, token)을 사용하세요.
 *
 * @deprecated Use validateToken(sessionId, token) instead for proper security
 */
export function verifyCsrfToken(token: string): boolean {
  // 토큰 형식 검증만 수행 (64글자 hex)
  if (!token || typeof token !== 'string') return false;
  if (!/^[a-f0-9]{64}$/.test(token)) return false;

  // 경고: 이것은 형식 검증일 뿐 실제 토큰 유효성을 확인하지 않습니다
  // 항상 validateToken(sessionId, token)을 대신 사용하세요
  return false; // 보안상 항상 false 반환 (형식만 검증하므로 신뢰 불가)
}

/**
 * CSRF 토큰을 요청 헤더에서 추출
 */
export function extractCsrfToken(req: Request): string | null {
  return req.headers.get('x-csrf-token');
}

/**
 * CSRF 토큰 타임아웃 (초)
 * 기본값: 1시간
 */
export const CSRF_TOKEN_TIMEOUT_SEC = 60 * 60; // 3600초

/**
 * CSRF 토큰 타임아웃 (밀리초) — 기존 코드 호환
 */
export const CSRF_TOKEN_TIMEOUT = CSRF_TOKEN_TIMEOUT_SEC * 1000;

// ─── 메모리 폴백 저장소 ─────────────────────────────────────────────────────
/**
 * ⚠️ 폴백: Redis 연결 실패 시에만 사용
 * - 서버리스 재시작 시 토큰 유실 → CSRF 검증 실패 가능
 * - 분산 환경(Vercel)에서 인스턴스 간 상태 공유 불가
 */
const tokenStoreFallback = new Map<string, { token: string; expires: number }>();

// ─── 공개 API ────────────────────────────────────────────────────────────────

/**
 * 세션별 CSRF 토큰 저장 (Redis 우선, 실패 시 메모리 폴백)
 */
export async function storeToken(sessionId: string, token: string): Promise<void> {
  const ok = await csrfSet(sessionId, token, CSRF_TOKEN_TIMEOUT_SEC);

  if (!ok) {
    // 메모리 폴백
    tokenStoreFallback.set(sessionId, {
      token,
      expires: Date.now() + CSRF_TOKEN_TIMEOUT,
    });
  }
}

/**
 * 세션별 CSRF 토큰 조회 및 검증 (Redis 우선, 실패 시 메모리 폴백)
 */
export async function validateToken(sessionId: string, token: string): Promise<boolean> {
  // 1순위: Redis
  const result = await csrfGet(sessionId);

  if (result !== null) {
    // Redis 정상 응답: value가 null이면 키 없음(토큰 미발급/만료) → false
    // value가 있으면 상수 시간 비교
    return result.value !== null && result.value === token;
  }

  // result === null: Redis 비활성 또는 오류 → 메모리 폴백
  const fallback = tokenStoreFallback.get(sessionId);
  if (!fallback) return false;
  if (Date.now() > fallback.expires) {
    tokenStoreFallback.delete(sessionId);
    return false;
  }
  return fallback.token === token;
}

/**
 * 세션별 CSRF 토큰 삭제 (로그아웃 시)
 */
export async function deleteToken(sessionId: string): Promise<void> {
  await csrfDel(sessionId);
  tokenStoreFallback.delete(sessionId);
}
