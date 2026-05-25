/**
 * CSRF Token Management
 * S-002: CSRF 토큰 추가로 DB 전달 요청 보안 강화
 *
 * ✅ Web Crypto API 사용 (Edge Runtime 호환)
 * ❌ Node.js 전용 'crypto' 모듈 사용 금지 (Edge Runtime 비호환)
 */

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
 * CSRF 토큰 타임아웃 (밀리초)
 * 기본값: 1시간
 */
export const CSRF_TOKEN_TIMEOUT = 60 * 60 * 1000; // 1 hour

/**
 * CSRF 토큰 저장소 (메모리 캐시)
 *
 * ⚠️ Vercel 서버리스 한계:
 * - 각 인스턴스가 독립 Map을 가지므로 인스턴스 간 상태 공유 불가
 * - 분산 환경에서 정확한 CSRF 검증은 Redis(Upstash) 또는 DB 기반으로 교체 필요
 * - 현재는 단일 인스턴스 내 burst 방어용으로만 유효
 *
 * TODO: Redis 기반으로 교체 (src/lib/redis.ts의 setCache/getCache 활용)
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
