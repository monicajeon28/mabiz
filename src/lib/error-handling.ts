/**
 * Error handling utilities for safe parallel execution
 * Provides graceful degradation when some (but not all) parallel tasks fail
 */

import { logger } from './logger';

/**
 * Safely execute multiple promises in parallel with graceful degradation
 * Returns all results (both fulfilled and rejected) instead of failing on first rejection
 *
 * @example
 * const results = await safeParallel(
 *   [
 *     prisma.campaign.findMany(),
 *     prisma.campaign.aggregate({ _count: true }),
 *     calculateCosts(),
 *   ],
 *   { timeout: 5000, logging: true }
 * );
 *
 * // Handle results individually
 * const campaigns = results[0].status === 'fulfilled' ? results[0].value : [];
 * const stats = results[1].status === 'fulfilled' ? results[1].value : { _count: 0 };
 */
export async function safeParallel<T>(
  promises: Promise<T>[],
  options?: {
    timeout?: number;
    logging?: boolean;
    onError?: (index: number, error: Error) => void;
  }
): Promise<PromiseSettledResult<T>[]> {
  const timeout = options?.timeout ?? 5000;
  const shouldLog = options?.logging ?? true;
  const onError = options?.onError;

  // Add timeout to each promise
  const withTimeout = promises.map((p, index) =>
    Promise.race([
      p,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Promise ${index} timed out after ${timeout}ms`)),
          timeout
        )
      ),
    ])
  );

  // Execute all promises and capture results
  const results = await Promise.allSettled(withTimeout);

  // Log and handle rejected promises
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));

      if (shouldLog) {
        logger.error(`[SAFE_PARALLEL] Promise ${index} rejected`, {
          error: error.message,
          stack: error.stack,
        });
      }

      if (onError) {
        onError(index, error);
      }
    }
  });

  return results;
}

/**
 * Helper to extract value or default from PromiseSettledResult
 *
 * @example
 * const campaigns = getOrDefault(result, []);
 * // Returns result.value if fulfilled, [] if rejected
 */
export function getOrDefault<T>(
  result: PromiseSettledResult<T>,
  defaultValue: T
): T {
  return result.status === 'fulfilled' ? result.value : defaultValue;
}

/**
 * Helper to check if all promises were fulfilled
 */
export function allFulfilled<T>(results: PromiseSettledResult<T>[]): boolean {
  return results.every((r) => r.status === 'fulfilled');
}

/**
 * Helper to count fulfilled promises
 */
export function countFulfilled<T>(results: PromiseSettledResult<T>[]): number {
  return results.filter((r) => r.status === 'fulfilled').length;
}

/**
 * Helper to get all errors from rejected promises
 */
export function getErrors<T>(results: PromiseSettledResult<T>[]): Error[] {
  return results
    .filter((r) => r.status === 'rejected')
    .map((r) => (r.reason instanceof Error ? r.reason : new Error(String(r.reason))));
}

/**
 * Type-safe wrapper for Promise.allSettled with better type inference
 *
 * @example
 * const [result1, result2, result3] = await allSettledTuple([
 *   promise1,
 *   promise2,
 *   promise3,
 * ]);
 * const value1 = getOrDefault(result1, defaultValue);
 */
export async function allSettledTuple<T extends readonly Promise<any>[]>(
  promises: T
): Promise<{
  [K in keyof T]: T[K] extends Promise<infer U> ? PromiseSettledResult<U> : never;
}> {
  return Promise.allSettled(promises) as any;
}
