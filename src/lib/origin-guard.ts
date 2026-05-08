import { logger } from '@/lib/logger';

/**
 * Origin 헤더 검증 — CSRF 방어
 * @returns true = 허용, false = 차단
 */
export function checkOrigin(req: Request, context: string): boolean {
  const origin = req.headers.get('origin');

  // Origin 헤더 없음 → 서버 간 호출 또는 개발 환경 허용
  if (!origin) return true;

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean) as string[];

  // 환경변수 미설정 시 → 개발 환경이므로 통과
  if (allowedOrigins.length === 0) return true;

  const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

  if (!isAllowed) {
    logger.warn(`[OriginGuard:${context}] 차단됨`, { origin, allowedOrigins });
  }

  return isAllowed;
}
