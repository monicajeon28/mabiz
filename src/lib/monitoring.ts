/**
 * Performance Monitoring Module
 *
 * Tracks middleware and database query performance
 * Alerts on slow operations (threshold: middleware 100ms, query 500ms)
 * Integrates with Sentry/Datadog for production monitoring
 */

import { performance } from 'perf_hooks';

/**
 * Performance metric types
 */
export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  tags?: Record<string, string>;
  isSlow: boolean;
  threshold: number;
}

/**
 * Middleware performance record
 */
export interface MiddlewareMetric extends PerformanceMetric {
  type: 'middleware';
  pathname: string;
  method: string;
  statusCode?: number;
}

/**
 * Database query performance record
 */
export interface QueryMetric extends PerformanceMetric {
  type: 'query';
  query: string;
  operation: string;
  rowsAffected?: number;
}

/**
 * In-memory metrics storage (for local monitoring)
 * In production, these should be sent to Datadog/Sentry/New Relic
 */
class MetricsCollector {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000;

  add(metric: PerformanceMetric) {
    this.metrics.push(metric);
    // Keep only recent metrics to avoid memory leak
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(type?: string): PerformanceMetric[] {
    if (type) {
      return this.metrics.filter(m => m.name === type);
    }
    return this.metrics;
  }

  getSlow(): PerformanceMetric[] {
    return this.metrics.filter(m => m.isSlow);
  }

  clear() {
    this.metrics = [];
  }

  stats() {
    const slow = this.getSlow();
    const avg = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
      : 0;

    return {
      total: this.metrics.length,
      slow: slow.length,
      slowPercentage: this.metrics.length > 0 ? ((slow.length / this.metrics.length) * 100).toFixed(2) + '%' : '0%',
      avgDuration: avg.toFixed(2) + 'ms',
    };
  }
}

const collector = new MetricsCollector();

/**
 * Record middleware performance
 *
 * @param name - Middleware name
 * @param duration - Execution duration in milliseconds
 * @param tags - Optional metadata (pathname, method, etc.)
 *
 * Example:
 * recordMiddlewarePerformance('auth-header-injection', 25, { pathname: '/dashboard' })
 */
export function recordMiddlewarePerformance(
  name: string,
  duration: number,
  tags?: Record<string, string>
): void {
  const threshold = 100; // 100ms threshold
  const isSlow = duration > threshold;

  const metric: MiddlewareMetric = {
    type: 'middleware',
    name,
    duration,
    timestamp: new Date(),
    tags,
    isSlow,
    threshold,
    pathname: tags?.pathname || '',
    method: tags?.method || 'UNKNOWN',
    statusCode: tags?.statusCode ? parseInt(tags.statusCode) : undefined,
  };

  collector.add(metric);

  // Log slow middleware to console
  if (isSlow) {
    console.warn(
      `[SLOW_MIDDLEWARE] ${name}: ${duration}ms (threshold: ${threshold}ms)`,
      tags
    );
    // In production, send to Sentry:
    // Sentry.captureMessage(
    //   `Slow middleware: ${name} - ${duration}ms`,
    //   'warning'
    // );
  }

  // Send to Datadog/New Relic (implementation details):
  // if (process.env.DATADOG_ENABLED === 'true') {
  //   dd.metrics.gauge('middleware.duration', duration, {
  //     tags: Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`),
  //   });
  // }
}

/**
 * Record database query performance
 *
 * @param query - SQL query string (first 100 chars logged)
 * @param duration - Execution duration in milliseconds
 * @param operation - SQL operation type (SELECT, INSERT, UPDATE, DELETE)
 * @param rowsAffected - Number of rows affected
 *
 * Example:
 * recordQueryPerformance(
 *   'SELECT * FROM users WHERE id = ?',
 *   245,
 *   'SELECT',
 *   1
 * )
 */
export function recordQueryPerformance(
  query: string,
  duration: number,
  operation: string = 'QUERY',
  rowsAffected?: number
): void {
  const threshold = 500; // 500ms threshold
  const isSlow = duration > threshold;

  const metric: QueryMetric = {
    type: 'query',
    name: operation,
    duration,
    timestamp: new Date(),
    isSlow,
    threshold,
    query,
    operation,
    rowsAffected,
  };

  collector.add(metric);

  // Log slow queries to console
  if (isSlow) {
    const queryPreview = query.substring(0, 100).replace(/\n/g, ' ');
    console.warn(
      `[SLOW_QUERY] ${duration}ms (threshold: ${threshold}ms): ${queryPreview}${query.length > 100 ? '...' : ''}`
    );

    if (rowsAffected) {
      console.warn(`  Rows affected: ${rowsAffected}`);
    }

    // In production, send to Sentry:
    // Sentry.captureMessage(
    //   `Slow query: ${operation} - ${duration}ms`,
    //   'warning'
    // );
  }

  // Send to Datadog (implementation details):
  // if (process.env.DATADOG_ENABLED === 'true') {
  //   dd.metrics.gauge('query.duration', duration, {
  //     tags: [`operation:${operation}`],
  //   });
  // }
}

/**
 * Record custom timing for any operation
 *
 * @param name - Operation name
 * @param fn - Async function to measure
 * @param tags - Optional metadata
 * @returns The function's return value
 *
 * Example:
 * const result = await measureAsync('fetch-user', async () => {
 *   return await getUserFromDb(id);
 * });
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - startTime);

    // Record as general metric (not categorized as middleware or query)
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date(),
      tags,
      isSlow: false,
      threshold: 1000,
    };

    collector.add(metric);

    if (duration > 500) {
      console.warn(`[SLOW_OPERATION] ${name}: ${duration}ms`, tags);
    }

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(`[OPERATION_ERROR] ${name}: ${duration}ms`, error);
    throw error;
  }
}

/**
 * Record synchronous timing
 *
 * @param name - Operation name
 * @param fn - Synchronous function to measure
 * @param tags - Optional metadata
 * @returns The function's return value
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  tags?: Record<string, string>
): T {
  const startTime = performance.now();

  try {
    const result = fn();
    const duration = Math.round(performance.now() - startTime);

    if (duration > 10) {
      const metric: PerformanceMetric = {
        name,
        duration,
        timestamp: new Date(),
        tags,
        isSlow: duration > 100,
        threshold: 100,
      };

      collector.add(metric);

      if (duration > 100) {
        console.warn(`[SLOW_SYNC_OP] ${name}: ${duration}ms`, tags);
      }
    }

    return result;
  } catch (error) {
    console.error(`[SYNC_OP_ERROR] ${name}`, error);
    throw error;
  }
}

/**
 * Get monitoring statistics
 * Useful for health checks and dashboards
 */
export function getMonitoringStats() {
  const slowMetrics = collector.getSlow();
  const stats = collector.stats();

  return {
    stats,
    slowMetrics: slowMetrics
      .slice(-10) // Last 10 slow operations
      .map(m => ({
        name: m.name,
        duration: `${m.duration}ms`,
        timestamp: m.timestamp.toISOString(),
        tags: m.tags,
      })),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics() {
  collector.clear();
}

/**
 * Middleware wrapper to automatically measure endpoint performance
 *
 * Usage in Route Handlers:
 * export const GET = withMetrics('GET /api/users', async (req) => {
 *   return NextResponse.json({ users: [...] });
 * });
 */
export function withMetrics<T extends (req: any, ...args: any[]) => Promise<any>>(
  operationName: string,
  handler: T
): T {
  return (async (req: any, ...args: any[]) => {
    const startTime = performance.now();
    const method = req.method || 'UNKNOWN';
    const pathname = req.nextUrl?.pathname || 'unknown';

    try {
      const response = await handler(req, ...args);
      const duration = Math.round(performance.now() - startTime);

      recordMiddlewarePerformance(operationName, duration, {
        pathname,
        method,
        statusCode: response?.status?.toString() || '200',
      });

      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      recordMiddlewarePerformance(operationName, duration, {
        pathname,
        method,
        statusCode: '500',
      });
      throw error;
    }
  }) as T;
}

export default {
  recordMiddlewarePerformance,
  recordQueryPerformance,
  measureAsync,
  measureSync,
  getMonitoringStats,
  clearMetrics,
  withMetrics,
};
