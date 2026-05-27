/**
 * Next.js Instrumentation Hook
 * 프로덕션 환경에서만 Sentry 초기화
 * 개발 환경: DSN이 없으면 초기화 스킵 (startup 성능 개선)
 */

export async function register() {
  // 개발 환경에서 SENTRY_DSN이 없으면 초기화 스킵 (274s → 60s 개선)
  const isDev = process.env.NODE_ENV === 'development';
  const hasSentryDsn = !!process.env.SENTRY_DSN;

  if (isDev && !hasSentryDsn) {
    // 개발: Sentry 스킵 (startup 성능 극대화)
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeSentry } = await import('./lib/sentry');
    initializeSentry();
  }
}
