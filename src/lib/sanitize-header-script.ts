import { logger } from "@/lib/logger";

/**
 * P0-1: headerScript 저장 전 sanitize 공용 유틸
 * page.tsx 렌더 시점과 API 저장 시점 모두에서 동일 로직을 적용합니다.
 *
 * P2-9 FIX: ALLOWED_DOMAINS 환경변수화
 * - HEADER_SCRIPT_ALLOWED_DOMAINS 환경변수로 도메인 화이트리스트 지정 가능
 * - 기본값: google.com, cloudflare.com (필수 애널리틱스 도메인)
 * - 형식: 쉼표 구분 목록 (예: google.com,cloudflare.com,developers.kakao.com)
 */

function getAllowedDomains(): string[] {
  const envDomains = process.env.HEADER_SCRIPT_ALLOWED_DOMAINS;
  if (envDomains) {
    return envDomains.split(',').map(d => d.trim()).filter(Boolean);
  }

  // 기본값: 필수 애널리틱스 도메인들
  return [
    'www.googletagmanager.com',
    'www.google-analytics.com',
    'connect.facebook.net',
    'cdn.jsdelivr.net',
    'developers.kakao.com',
    'wcs.naver.net',
    'cdn.channel.io',
    't1.kakaocdn.net',
  ];
}

export function sanitizeHeaderScript(script: string | null | undefined): string | null {
  if (!script) return null;

  // 인라인 스크립트 차단 (src= 없는 script 태그) — match()로 전체 검사
  const inlineMatches = script.match(/<script(?![^>]*src=)[^>]*>/gi);
  if (inlineMatches && inlineMatches.length > 0) {
    return null;
  }

  // src URL 도메인 검증
  const allowedDomains = getAllowedDomains();
  const srcPattern = /src=["']([^"']+)["']/gi;
  let match;
  while ((match = srcPattern.exec(script)) !== null) {
    try {
      const url = new URL(match[1]);
      if (!allowedDomains.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) {
        logger.warn('[Security] headerScript: 허용되지 않은 도메인 차단', { hostname: url.hostname });
        return null;
      }
    } catch {
      return null; // 잘못된 URL
    }
  }

  return script;
}
