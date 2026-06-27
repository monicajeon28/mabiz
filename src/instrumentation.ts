/**
 * Next.js Instrumentation Hook
 * 프로덕션 환경에서만 Sentry 초기화
 * 개발 환경: DSN이 없으면 초기화 스킵 (startup 성능 개선)
 */

export async function register() {
  // 알리고 고정 IP 프록시 라우팅 (ALIGO_PROXY_URL 설정 시에만 활성, 미설정이면 무동작)
  // — Sentry보다 먼저, dev/prod 무관하게 nodejs 런타임에서 1회 적용.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initAligoProxyRouting } = await import('./lib/aligo/proxy-routing');
    initAligoProxyRouting();
  }

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
