/**
 * P0-1: headerScript 저장 전 sanitize 공용 유틸
 * page.tsx 렌더 시점과 API 저장 시점 모두에서 동일 로직을 적용합니다.
 */

const ALLOWED_DOMAINS = [
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'connect.facebook.net',
  'cdn.jsdelivr.net',
  'developers.kakao.com',
  'wcs.naver.net',
  'cdn.channel.io',
  't1.kakaocdn.net',
];

export function sanitizeHeaderScript(script: string | null | undefined): string | null {
  if (!script) return null;

  // 인라인 스크립트 차단 (src= 없는 script 태그) — match()로 전체 검사
  const inlineMatches = script.match(/<script(?![^>]*src=)[^>]*>/gi);
  if (inlineMatches && inlineMatches.length > 0) {
    console.warn('[Security] headerScript: 인라인 스크립트 차단됨');
    return null;
  }

  // src URL 도메인 검증
  const srcPattern = /src=["']([^"']+)["']/gi;
  let match;
  while ((match = srcPattern.exec(script)) !== null) {
    try {
      const url = new URL(match[1]);
      if (!ALLOWED_DOMAINS.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) {
        console.warn('[Security] headerScript: 허용되지 않은 도메인 차단', url.hostname);
        return null;
      }
    } catch {
      return null; // 잘못된 URL
    }
  }

  return script;
}
