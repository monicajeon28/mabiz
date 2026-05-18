/**
 * Next.js Instrumentation Hook
 * 서버 시작 시 Sentry 초기화
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeSentry } = await import('./lib/sentry');
    initializeSentry();
  }
}
