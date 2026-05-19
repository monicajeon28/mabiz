import { logger } from '@/lib/logger';

/**
 * Retry 옵션 인터페이스
 */
export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  timeout?: number;
}

/**
 * 지수 백오프(exponential backoff)를 포함한 재시도 fetch 함수
 *
 * @param url - 요청 URL
 * @param options - fetch 옵션 + 재시도 옵션
 * @returns 응답 JSON 데이터
 *
 * @example
 * const data = await retryFetch('/api/campaigns/1/delta', {
 *   method: 'GET',
 *   maxRetries: 2,
 *   delayMs: 1000,
 *   timeout: 5000,
 * });
 */
export async function retryFetch<T>(
  url: string,
  options: RequestInit & RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    delayMs = 1000,
    backoffMultiplier = 2,
    timeout = 5000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let delay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json() as Promise<T>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 마지막 시도가 아니면 재시도
      if (attempt < maxRetries) {
        logger.warn(`[retryFetch] ${url} 재시도 ${attempt + 1}/${maxRetries}`, {
          delay,
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffMultiplier; // 지수 백오프
      }
    }
  }

  throw lastError || new Error('Network error');
}
