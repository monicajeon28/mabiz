/** parseInt 래퍼 — NaN 방지 */
export function parseIntSafe(str: string | null | undefined, defaultValue: number): number {
  if (!str) return defaultValue;
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/** 페이지 번호 안전 파싱 (최소 1) */
export function parsePageNum(str: string | null | undefined): number {
  return Math.max(1, parseIntSafe(str, 1));
}

/** limit 안전 파싱 (상한 적용) */
export function parseLimitNum(str: string | null | undefined, defaultLimit = 30, maxLimit = 200): number {
  const v = parseIntSafe(str, defaultLimit);
  return Math.min(Math.max(1, v), maxLimit);
}
