/**
 * "완전한 HTML 문서"(<!doctype html> 또는 최상위 <html>로 시작)인지 판별 — #15.
 * 의존성 0 (서버 page.tsx + 클라이언트 빌더 양쪽에서 안전하게 import).
 * true면 sanitize 대신 iframe 격리 렌더 대상. 앵커(^\s*)로 본문 중간에 <html 문자열이
 * 끼어 있어도(빌더 조각/이미지형 오탐) 걸리지 않게 시작 부분만 검사.
 */
export function isFullHtmlDocument(html: string | null | undefined): boolean {
  return /^\s*(<!doctype\s+html|<html[\s>])/i.test(html ?? '');
}
