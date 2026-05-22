/**
 * CSRF Token Management
 * S-002: CSRF 토큰 추가로 DB 전달 요청 보안 강화
 */

import { randomBytes } from 'crypto';

/**
 * CSRF 토큰 생성
 * 서버에서 클라이언트로 전달 (요청 시마다 새로 생성하면 안 됨)
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * CSRF 토큰 검증
 * 클라이언트에서 전송된 토큰이 유효한지 확인
 *
 * 주의: 프로덕션에서는 서버 세션/데이터베이스에 저장된 토큰과 비교해야 함
 * 현재는 간단한 형식 검증만 수행 (실제 저장은 별도 구현 필요)
 */
export function verifyCsrfToken(token: string): boolean {
  // 토큰 형식 검증 (64글자 hex)
  if (!token || typeof token !== 'string') return false;
  if (!/^[a-f0-9]{64}$/.test(token)) return false;

  // TODO: 실제 검증은 세션/DB와 비교해야 함
  // const storedToken = await getSessionToken(sessionId);
  // return token === storedToken && !isExpired(storedToken);

  return true; // 현재는 형식만 검증
}

/**
 * CSRF 토큰을 요청 헤더에서 추출
 */
export function extractCsrfToken(req: Request): string | null {
  return req.headers.get('x-csrf-token');
}

/**
 * CSRF 토큰 타임아웃 (밀리초)
 * 기본값: 1시간
 */
export const CSRF_TOKEN_TIMEOUT = 60 * 60 * 1000; // 1 hour

/**
 * CSRF 토큰 저장소 (간단한 메모리 캐시)
 * 프로덕션: Redis 또는 데이터베이스로 대체
 */
const tokenStore = new Map<string, { token: string; expires: number }>();

/**
 * 세션별 CSRF 토큰 저장
 */
export function storeToken(sessionId: string, token: string): void {
  tokenStore.set(sessionId, {
    token,
    expires: Date.now() + CSRF_TOKEN_TIMEOUT,
  });
}

/**
 * 세션별 CSRF 토큰 조회 및 검증
 */
export function validateToken(sessionId: string, token: string): boolean {
  const stored = tokenStore.get(sessionId);

  if (!stored) return false;
  if (Date.now() > stored.expires) {
    tokenStore.delete(sessionId); // 만료된 토큰 삭제
    return false;
  }

  return stored.token === token;
}

/**
 * 세션별 CSRF 토큰 삭제 (로그아웃 시)
 */
export function deleteToken(sessionId: string): void {
  tokenStore.delete(sessionId);
}
