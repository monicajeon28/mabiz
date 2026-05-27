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

export const retryStrategy = {
  calculateNextRetryAt: (
    attemptNumber: number,
    config: RetryConfig = DEFAULT_CONFIG
  ): Date => {
    const delayMs = Math.min(
      config.baseDelayMs * Math.pow(config.backoffFactor, attemptNumber - 1),
      config.maxDelayMs || 60000
    );

    const jitter = Math.random() * 0.1 * delayMs;
    return new Date(Date.now() + delayMs + jitter);
  },

  shouldRetry: (
    attemptNumber: number,
    config: RetryConfig = DEFAULT_CONFIG
  ): boolean => {
    return attemptNumber < config.maxRetries;
  },

  calculateBackoffMs: (
    attemptNumber: number,
    config: RetryConfig = DEFAULT_CONFIG
  ): number => {
    return Math.min(
      config.baseDelayMs * Math.pow(config.backoffFactor, attemptNumber - 1),
      config.maxDelayMs || 60000
    );
  },

  isRetryableError: (error: any): boolean => {
    if (!error) return false;

    const statusCode = error.statusCode || error.status;
    if (statusCode) {
      return (
        statusCode >= 500 || // 5xx errors
        statusCode === 408 || // Request timeout
        statusCode === 429 // Too many requests
      );
    }

    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('temporary failure')
    );
  },
};
