/**
 * 지수 백오프 재시도 엔진
 * 지수 백오프 + 지터를 사용한 안정적인 재시도 로직
 *
 * 사용 예:
 * const result = await retryWithExponentialBackoff(
 *   () => fetch('/api/some-endpoint'),
 *   { maxRetries: 3, initialDelayMs: 500 }
 * );
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(`실패 (${result.attempts}회)`, result.error);
 * }
 */

import { logger } from './logger';
import { isRetryableStatus } from './error-codes';

export interface RetryConfig {
  /** 최대 재시도 횟수 (기본값: 3) */
  maxRetries?: number;
  /** 초기 대기 시간 (ms, 기본값: 500) */
  initialDelayMs?: number;
  /** 최대 대기 시간 (ms, 기본값: 30000) */
  maxDelayMs?: number;
  /** 백오프 배수 (기본값: 2, 즉 500→1000→2000) */
  backoffMultiplier?: number;
  /** 지터 범위 비율 (기본값: 0.1, 즉 ±10%) */
  jitterFactor?: number;
  /** 재시도 가능한 HTTP 상태 코드 (기본값: 408, 429, 500-504) */
  retryableStatusCodes?: Set<number>;
  /** 재시도 시도마다 콜백 */
  onRetryAttempt?: (attempt: number, error: Error) => void;
  /** 성공 콜백 */
  onRetrySuccess?: (attempts: number) => void;
}

export interface RetryResult<T> {
  /** 작업 성공 여부 */
  success: boolean;
  /** 성공한 데이터 */
  data?: T;
  /** 마지막 에러 */
  error?: Error;
  /** 총 시도 횟수 */
  attempts: number;
  /** 마지막 HTTP 상태 코드 */
  lastErrorCode?: number;
  /** 추적용 작업 ID */
  operationId: string;
  /** 총 대기 시간 (ms) */
  totalDelayMs?: number;
}

/**
 * 지수 백오프 재시도 로직
 *
 * 시간 표:
 * 시도 1: 즉시 실행
 * 시도 2: 500ms + 지터(±50ms) = 450-550ms 대기
 * 시도 3: 1000ms + 지터(±100ms) = 900-1100ms 대기
 * 시도 4: 2000ms + 지터(±200ms) = 1800-2200ms 대기
 *
 * 예시 (3회 재시도):
 * 총 대기: ~4-4.5초
 *
 * @example
 * ```typescript
 * const result = await retryWithExponentialBackoff(
 *   async () => {
 *     const response = await fetch('/api/contacts');
 *     if (!response.ok) {
 *       const err = new Error(`HTTP ${response.status}`);
 *       (err as any).status = response.status;
 *       throw err;
 *     }
 *     return response.json();
 *   },
 *   { maxRetries: 3, initialDelayMs: 500 }
 * );
 *
 * if (result.success) {
 *   console.log('성공:', result.data, `(${result.attempts}회)`);
 * } else {
 *   console.error('실패:', result.error?.message);
 * }
 * ```
 */
export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitterFactor = 0.1,
    retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504]),
    onRetryAttempt,
    onRetrySuccess,
  } = config;

  const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  let lastError: Error | undefined;
  let lastErrorCode: number | undefined;
  let totalDelayMs = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await operation();

      if (attempt > 0) {
        logger.log(`[RETRY_SUCCESS] 재시도 성공`, {
          operationId,
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
          totalDelayMs,
        });
      }

      onRetrySuccess?.(attempt + 1);

      return {
        success: true,
        data,
        attempts: attempt + 1,
        operationId,
        totalDelayMs,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // HTTP 상태 코드 추출
      if ('status' in lastError) {
        lastErrorCode = (lastError as any).status;
      }

      const isRetryable = isRetryableStatus(lastErrorCode ?? 500);
      const isLastAttempt = attempt === maxRetries;

      onRetryAttempt?.(attempt + 1, lastError);

      if (!isRetryable || isLastAttempt) {
        logger.error(`[RETRY_FAILED] 재시도 포기`, {
          operationId,
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
          error: lastError.message,
          errorCode: lastErrorCode,
          isRetryable,
          totalDelayMs,
        });

        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          lastErrorCode,
          operationId,
          totalDelayMs,
        };
      }

      // 다음 재시도까지의 대기 시간 계산
      const exponentialDelay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);
      const finalDelay = Math.max(0, Math.round(exponentialDelay + jitter));

      totalDelayMs += finalDelay;

      logger.warn(`[RETRY] 재시도 예약`, {
        operationId,
        attempt: attempt + 1,
        totalAttempts: maxRetries + 1,
        error: lastError.message,
        delayMs: finalDelay,
        totalDelayMs,
      });

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  // 모든 재시도 실패 (코드 도달 불가능하지만 타입 안전)
  return {
    success: false,
    error: lastError,
    attempts: maxRetries + 1,
    lastErrorCode,
    operationId,
    totalDelayMs,
  };
}

/**
 * 조건부 재시도 래퍼
 *
 * @example
 * ```typescript
 * const result = await retryIf(
 *   () => fetchData(),
 *   (error) => error.status === 503 // 503만 재시도
 * );
 * ```
 */
export async function retryIf<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  config?: RetryConfig
): Promise<RetryResult<T>> {
  return retryWithExponentialBackoff(operation, {
    ...config,
    retryableStatusCodes: new Set([]), // 기본값 무시
  });
}

/**
 * 최대 N번 재시도
 *
 * @example
 * ```typescript
 * const result = await retryTimes(3, () => fetchData());
 * ```
 */
export async function retryTimes<T>(
  times: number,
  operation: () => Promise<T>,
  config?: Omit<RetryConfig, 'maxRetries'>
): Promise<RetryResult<T>> {
  return retryWithExponentialBackoff(operation, {
    ...config,
    maxRetries: times - 1,
  });
}

/**
 * 재시도 결과에서 값 추출 또는 기본값 반환
 *
 * @example
 * ```typescript
 * const result = await retryWithExponentialBackoff(...);
 * const data = getOrThrow(result); // 성공하면 데이터, 실패하면 throw
 * const data = getOrDefault(result, []); // 성공하면 데이터, 실패하면 []
 * ```
 */
export function getOrDefault<T>(result: RetryResult<T>, defaultValue: T): T {
  return result.success && result.data !== undefined ? result.data : defaultValue;
}

export function getOrThrow<T>(result: RetryResult<T>): T {
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw result.error || new Error('Operation failed');
}

/**
 * 여러 작업을 재시도하며 실행 (제한 시간 기반)
 *
 * @example
 * ```typescript
 * const results = await retryMultiple(
 *   [
 *     () => fetchContacts(),
 *     () => fetchCampaigns(),
 *     () => fetchAnalytics(),
 *   ],
 *   { maxRetries: 2, timeoutMs: 30000 }
 * );
 * ```
 */
export async function retryMultiple<T>(
  operations: Array<() => Promise<T>>,
  config: RetryConfig & { timeoutMs?: number } = {}
): Promise<RetryResult<T>[]> {
  const { timeoutMs = 60000, ...retryConfig } = config;
  const results: RetryResult<T>[] = [];

  const startTime = Date.now();

  for (const operation of operations) {
    const elapsedMs = Date.now() - startTime;
    const remainingMs = timeoutMs - elapsedMs;

    if (remainingMs <= 0) {
      results.push({
        success: false,
        error: new Error('Overall timeout exceeded'),
        attempts: 0,
        operationId: `op_timeout`,
      });
      continue;
    }

    // 남은 시간 내에서 최대 재시도 횟수 제한
    const maxRetriesForThisOp = Math.max(
      0,
      Math.floor(remainingMs / (retryConfig.initialDelayMs || 500))
    );

    const result = await retryWithExponentialBackoff(operation, {
      ...retryConfig,
      maxRetries: Math.min(retryConfig.maxRetries || 3, maxRetriesForThisOp),
    });

    results.push(result);
  }

  return results;
}

/**
 * 재시도 통계 (디버깅용)
 */
export interface RetryStatistics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  averageAttemptsPerOperation: number;
  totalDelayMs: number;
}

export function collectRetryStats(results: RetryResult<any>[]): RetryStatistics {
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);
  const totalDelayMs = results.reduce((sum, r) => sum + (r.totalDelayMs || 0), 0);

  return {
    totalAttempts,
    successCount,
    failureCount,
    averageAttemptsPerOperation: results.length > 0 ? totalAttempts / results.length : 0,
    totalDelayMs,
  };
}
