/**
 * Fetch 유틸리티: 타임아웃 + 재시도 로직
 */

import { logger } from '@/lib/logger';

/**
 * 타임아웃이 있는 fetch 호출
 * @param url
 * @param options
 * @param timeoutMs - 타임아웃 시간 (기본값 10초)
 * @returns
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 자동 재시도가 있는 fetch 호출
 * @param url
 * @param options
 * @param config - { maxRetries, timeoutMs, retryDelayMs }
 * @returns
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config?: {
    maxRetries?: number;
    timeoutMs?: number;
    retryDelayMs?: number;
  }
): Promise<Response> {
  const { maxRetries = 3, timeoutMs = 10000, retryDelayMs = 1000 } = config || {};

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      // 성공 (2xx, 3xx)
      if (response.status >= 200 && response.status < 400) {
        return response;
      }

      // 실패지만 재시도 불가능 (4xx 제외 5xx)
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        return response;
      }

      // 5xx 또는 408/429 → 재시도 가능
      lastError = new Error(`HTTP ${response.status}`);
      if (attempt < maxRetries) {
        await delay(retryDelayMs * attempt); // Exponential backoff
      }
    } catch (error) {
      lastError = error as Error;

      // 네트워크 오류 또는 타임아웃 → 재시도 가능
      if (attempt < maxRetries) {
        await delay(retryDelayMs * attempt);
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * localStorage에 여권 입력 데이터 저장
 *
 * ⚠️ 브라우저 전용 (localStorage): 서버/Edge 환경에서 호출 금지
 *
 * @param token - 여권 토큰
 * @param travelers - 여행자 데이터
 */
export function saveTravelersDraft(token: string, travelers: any[]): void {
  try {
    const key = `passport_draft_${token}`;
    const draft = {
      travelers,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    logger.warn('[Passport] localStorage 저장 실패:', { error: error instanceof Error ? error.message : String(error) });
    // localStorage 실패는 무시 (용량 부족 등)
  }
}

/**
 * localStorage에서 여권 입력 데이터 로드
 *
 * ⚠️ 브라우저 전용 (localStorage): 서버/Edge 환경에서 호출 금지
 *
 * @param token - 여권 토큰
 * @returns { travelers, savedAt } 또는 null
 */
export function loadTravelersDraft(token: string): { travelers: any[]; savedAt: string } | null {
  try {
    const key = `passport_draft_${token}`;
    const draft = localStorage.getItem(key);
    if (!draft) return null;

    const parsed = JSON.parse(draft);

    // 저장된 지 24시간이 지나면 버림
    const savedAt = new Date(parsed.savedAt);
    const now = new Date();
    const diff = now.getTime() - savedAt.getTime();
    const hours24 = 24 * 60 * 60 * 1000;

    if (diff > hours24) {
      clearTravelersDraft(token);
      return null;
    }

    return parsed;
  } catch (error) {
    logger.warn('[Passport] localStorage 로드 실패:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * localStorage에서 여권 입력 데이터 삭제
 *
 * ⚠️ 브라우저 전용 (localStorage): 서버/Edge 환경에서 호출 금지
 *
 * @param token - 여권 토큰
 */
export function clearTravelersDraft(token: string): void {
  try {
    const key = `passport_draft_${token}`;
    localStorage.removeItem(key);
  } catch (error) {
    logger.warn('[Passport] localStorage 삭제 실패:', { error: error instanceof Error ? error.message : String(error) });
  }
}
