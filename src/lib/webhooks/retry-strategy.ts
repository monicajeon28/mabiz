export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  backoffFactor: number;
  maxDelayMs?: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  backoffFactor: 2.0,
  maxDelayMs: 60000,
};

/**
 * HTTP Status Code Classification for Retry Logic
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
 */
export enum HttpStatusRetryPolicy {
  // 4xx Client Errors - NO RETRY (except specific cases)
  BAD_REQUEST = 400,              // Client error - don't retry
  UNAUTHORIZED = 401,              // Auth failed - don't retry
  FORBIDDEN = 403,                 // Forbidden - don't retry
  NOT_FOUND = 404,                 // Not found - don't retry
  CONFLICT = 409,                  // Conflict - don't retry
  UNPROCESSABLE_ENTITY = 422,      // Unprocessable - don't retry

  // 5xx Server Errors - RETRY with exponential backoff
  INTERNAL_SERVER_ERROR = 500,      // Server error - retry
  NOT_IMPLEMENTED = 501,            // Not implemented - don't retry
  BAD_GATEWAY = 502,                // Bad gateway - retry
  SERVICE_UNAVAILABLE = 503,        // Service unavailable - retry
  GATEWAY_TIMEOUT = 504,            // Gateway timeout - retry

  // Special cases
  REQUEST_TIMEOUT = 408,            // Request timeout - retry
  TOO_MANY_REQUESTS = 429,          // Rate limit - retry with exponential backoff
}

/**
 * Smart Retry Strategy with HTTP Status Code Awareness
 *
 * - 400/401/403/404/409/422: Immediate DLQ (don't retry)
 * - 500/502/503/504: Retry with exponential backoff (max 5 attempts)
 * - 408/429: Retry with exponential backoff (max 5 attempts)
 * - Network errors: Retry with exponential backoff
 */
export const retryStrategy = {
  /**
   * Determine retry policy based on HTTP status code
   *
   * @param statusCode HTTP status code
   * @returns { retryable: boolean, dlq: boolean, delay: 'exponential' | 'fixed' }
   */
  getRetryPolicy: (statusCode: number): {
    retryable: boolean;
    dlq: boolean;
    delayStrategy: 'exponential' | 'linear' | 'fixed';
  } => {
    switch (statusCode) {
      // 4xx Client Errors - NO RETRY (DLQ)
      case 400: // Bad Request
      case 401: // Unauthorized
      case 403: // Forbidden
      case 404: // Not Found
      case 409: // Conflict
      case 422: // Unprocessable Entity
        return { retryable: false, dlq: true, delayStrategy: 'fixed' };

      // 5xx Server Errors - RETRY
      case 500: // Internal Server Error
      case 502: // Bad Gateway
      case 503: // Service Unavailable
      case 504: // Gateway Timeout
        return { retryable: true, dlq: false, delayStrategy: 'exponential' };

      // Special Cases
      case 408: // Request Timeout
        return { retryable: true, dlq: false, delayStrategy: 'exponential' };

      case 429: // Too Many Requests (Rate Limited)
        return { retryable: true, dlq: false, delayStrategy: 'exponential' };

      // Default: Treat as client error (DLQ)
      default:
        if (statusCode >= 500) {
          return { retryable: true, dlq: false, delayStrategy: 'exponential' };
        }
        return { retryable: false, dlq: true, delayStrategy: 'fixed' };
    }
  },

  calculateNextRetryAt: (
    attemptNumber: number,
    config: RetryConfig = DEFAULT_CONFIG,
    statusCode?: number
  ): Date => {
    let delayMs: number;

    if (statusCode === 429) {
      // Rate limit: use longer backoff
      delayMs = Math.min(
        (config.baseDelayMs * 2) * Math.pow(config.backoffFactor, attemptNumber - 1),
        config.maxDelayMs || 60000
      );
    } else {
      delayMs = Math.min(
        config.baseDelayMs * Math.pow(config.backoffFactor, attemptNumber - 1),
        config.maxDelayMs || 60000
      );
    }

    // Add jitter (±10%) to prevent thundering herd
    const jitter = Math.random() * 0.2 * delayMs - 0.1 * delayMs;
    return new Date(Date.now() + delayMs + jitter);
  },

  shouldRetry: (
    attemptNumber: number,
    config: RetryConfig = DEFAULT_CONFIG,
    statusCode?: number
  ): boolean => {
    if (statusCode) {
      const policy = retryStrategy.getRetryPolicy(statusCode);
      if (!policy.retryable) {
        return false;
      }
    }
    return attemptNumber < config.maxRetries;
  },

  calculateBackoffMs: (
    attemptNumber: number,
    config: RetryConfig = DEFAULT_CONFIG,
    statusCode?: number
  ): number => {
    if (statusCode === 429) {
      // Rate limit: longer backoff
      return Math.min(
        (config.baseDelayMs * 2) * Math.pow(config.backoffFactor, attemptNumber - 1),
        config.maxDelayMs || 60000
      );
    }

    return Math.min(
      config.baseDelayMs * Math.pow(config.backoffFactor, attemptNumber - 1),
      config.maxDelayMs || 60000
    );
  },

  /**
   * Smart error classification
   *
   * Returns { retryable, dlq, statusCode, reason }
   */
  classifyError: (error: any): {
    retryable: boolean;
    dlq: boolean;
    statusCode?: number;
    reason: string;
  } => {
    if (!error) {
      return { retryable: false, dlq: true, reason: 'Unknown error' };
    }

    const statusCode = error.statusCode || error.status;

    // Check HTTP status code first
    if (statusCode) {
      const policy = retryStrategy.getRetryPolicy(statusCode);
      return {
        retryable: policy.retryable,
        dlq: policy.dlq,
        statusCode,
        reason: `HTTP ${statusCode}`,
      };
    }

    // Check error message for network issues
    const message = error.message?.toLowerCase() || '';

    if (
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('ehostunreach') ||
      message.includes('etimedout') ||
      message.includes('temporary failure')
    ) {
      return {
        retryable: true,
        dlq: false,
        reason: `Network error: ${error.message}`,
      };
    }

    // Check error code for network issues
    const code = (error as any).code?.toLowerCase() || '';
    if (
      code === 'econnrefused' ||
      code === 'econnreset' ||
      code === 'ehostunreach' ||
      code === 'etimedout'
    ) {
      return {
        retryable: true,
        dlq: false,
        reason: `Network error: ${code}`,
      };
    }

    // Default: treat as non-retryable (DLQ)
    return {
      retryable: false,
      dlq: true,
      reason: error.message || 'Unknown error',
    };
  },

  /**
   * Legacy compatibility: isRetryableError
   */
  isRetryableError: (error: any): boolean => {
    const classification = retryStrategy.classifyError(error);
    return classification.retryable;
  },
};
