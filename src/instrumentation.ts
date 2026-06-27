/**
 * Next.js Instrumentation Hook
 * 프로덕션 환경에서만 Sentry 초기화
 * 개발 환경: DSN이 없으면 초기화 스킵 (startup 성능 개선)
 */

export async function register() {
  // 개발 환경에서 SENTRY_DSN이 없으면 Sentry 초기화 스킵 (274s → 60s 개선)
  const isDev = process.env.NODE_ENV === 'development';
  const hasSentryDsn = !!process.env.SENTRY_DSN;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry 먼저 (있을 때만)
    if (!(isDev && !hasSentryDsn)) {
      const { initializeSentry } = await import('./lib/sentry');
      initializeSentry();
    }

    // 알리고 고정 IP 프록시 라우팅 — Sentry 등 다른 라이브러리가 setGlobalDispatcher를
    // 호출해도 우리 host 라우터가 최종값이 되도록 '맨 마지막'에 적용.
    // (ALIGO_PROXY_URL 미설정이면 무동작 = 기존과 동일)
    const { initAligoProxyRouting } = await import('./lib/aligo/proxy-routing');
    initAligoProxyRouting();
  }
}
