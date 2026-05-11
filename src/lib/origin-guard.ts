import { logger } from '@/lib/logger';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Origin 헤더 검증 — CSRF 방어
 * @returns true = 허용, false = 차단
 */
export function checkOrigin(req: Request, context: string): boolean {
  const origin = req.headers.get('origin');

  // Origin 헤더 없음 → 개발 환경에서만 허용, 프로덕션에서는 차단
  if (!origin) {
    if (isDev) return true;
    logger.warn(`[OriginGuard:${context}] Origin 헤더 없음 — 차단`);
    return false;
  }

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean) as string[];

  // 환경변수 미설정 시 → 개발 환경에서만 허용, 프로덕션에서는 차단
  if (allowedOrigins.length === 0) {
    if (isDev) return true;
    logger.warn(`[OriginGuard:${context}] allowedOrigins 미설정 — 차단`);
    return false;
  }

  // 개발 환경에서 localhost 허용
  if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return true;
  }

  const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

  if (!isAllowed) {
    logger.warn(`[OriginGuard:${context}] 차단됨`, { origin, allowedOrigins });
  }

  return isAllowed;
}
