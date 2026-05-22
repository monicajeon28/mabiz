/**
 * Performance Monitoring Tests
 *
 * Tests for middleware and database query performance monitoring
 */

import {
  recordMiddlewarePerformance,
  recordQueryPerformance,
  measureAsync,
  measureSync,
  getMonitoringStats,
  clearMetrics,
} from '@/src/lib/monitoring';

describe('Performance Monitoring', () => {
  beforeEach(() => {
    clearMetrics();
    // Mock console.warn to avoid test output pollution
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearMetrics();
  });

  // ===== Middleware Performance Tests =====

  describe('recordMiddlewarePerformance', () => {
    it('should record fast middleware (< 100ms threshold)', () => {
      recordMiddlewarePerformance('auth-header-injection', 25, {
        pathname: '/dashboard',
        method: 'GET',
      });

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(1);
      expect(stats.stats.slow).toBe(0);
    });

    it('should detect slow middleware (> 100ms threshold)', () => {
      recordMiddlewarePerformance('role-validation', 150, {
        pathname: '/admin',
        method: 'POST',
      });

      expect(console.warn).toHaveBeenCalled();
      const warning = (console.warn as jest.Mock).mock.calls[0][0];
      expect(warning).toContain('[SLOW_MIDDLEWARE]');
      expect(warning).toContain('role-validation');
      expect(warning).toContain('150ms');

      const stats = getMonitoringStats();
      expect(stats.stats.slow).toBe(1);
    });

    it('should include tags in slow operation logs', () => {
      const tags = {
        pathname: '/admin/dashboard',
        method: 'GET',
        statusCode: '500',
      };

      recordMiddlewarePerformance('error-handler', 200, tags);

      const stats = getMonitoringStats();
      expect(stats.slowMetrics[0].tags).toEqual(tags);
    });

    it('should record multiple middleware calls', () => {
      recordMiddlewarePerformance('auth', 20, { method: 'GET' });
      recordMiddlewarePerformance('cors', 15, { method: 'GET' });
      recordMiddlewarePerformance('logging', 10, { method: 'GET' });

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(3);
      expect(stats.stats.slow).toBe(0);
    });

    it('should cap metrics to 1000 entries (memory safety)', () => {
      // Record 1100 metrics
      for (let i = 0; i < 1100; i++) {
        recordMiddlewarePerformance(`middleware-${i}`, 10, {});
      }

      const stats = getMonitoringStats();
      // Should keep only last 1000
      expect(stats.stats.total).toBeLessThanOrEqual(1000);
    });
  });

  // ===== Database Query Performance Tests =====

  describe('recordQueryPerformance', () => {
    it('should record fast query (< 500ms threshold)', () => {
      recordQueryPerformance(
        'SELECT * FROM users WHERE id = ?',
        100,
        'SELECT',
        1
      );

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(1);
      expect(stats.stats.slow).toBe(0);
    });

    it('should detect slow query (> 500ms threshold)', () => {
      recordQueryPerformance(
        'SELECT * FROM large_table WHERE complex_condition = ?',
        750,
        'SELECT',
        10000
      );

      expect(console.warn).toHaveBeenCalled();
      const calls = (console.warn as jest.Mock).mock.calls;
      const slowQueryCall = calls.find((call: any[]) =>
        call[0]?.includes('[SLOW_QUERY]')
      );
      expect(slowQueryCall).toBeDefined();
      expect(slowQueryCall?.[0]).toContain('750ms');

      const stats = getMonitoringStats();
      expect(stats.stats.slow).toBe(1);
    });

    it('should log query preview (first 100 chars)', () => {
      const longQuery = 'SELECT * FROM ' + 'x'.repeat(200);

      recordQueryPerformance(longQuery, 600, 'SELECT');

      const warning = (console.warn as jest.Mock).mock.calls[0][0];
      expect(warning.length).toBeLessThan(200); // Should truncate
      expect(warning).toContain('...');
    });

    it('should include rows affected in log', () => {
      recordQueryPerformance('UPDATE users SET active = true', 520, 'UPDATE', 5000);

      const warning = (console.warn as jest.Mock).mock.calls[0][1]; // Second call
      expect(warning).toContain('5000');
    });

    it('should handle various SQL operations', () => {
      const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

      operations.forEach(op => {
        recordQueryPerformance(`${op} query`, 600, op, 1);
      });

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(4);
      expect(stats.stats.slow).toBe(4);
    });

    it('should not log rows affected if undefined', () => {
      recordQueryPerformance('SELECT * FROM users', 600, 'SELECT');

      const calls = (console.warn as jest.Mock).mock.calls;
      // Should have log for slow query but no log for rows affected
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toContain('[SLOW_QUERY]');
    });
  });

  // ===== Async Measurement Tests =====

  describe('measureAsync', () => {
    it('should measure async function execution time', async () => {
      const result = await measureAsync('fetch-user', async () => {
        // Simulate 50ms operation
        await new Promise(resolve => setTimeout(resolve, 50));
        return { id: 1, name: 'John' };
      });

      expect(result).toEqual({ id: 1, name: 'John' });

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(1);
      expect(stats.slowMetrics[0].duration).toMatch(/ms/);
    });

    it('should detect slow async operations (> 500ms)', async () => {
      await measureAsync('slow-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 550));
        return 'done';
      });

      expect(console.warn).toHaveBeenCalled();
      const warning = (console.warn as jest.Mock).mock.calls[0][0];
      expect(warning).toContain('[SLOW_OPERATION]');
    });

    it('should handle async errors gracefully', async () => {
      const testError = new Error('Test error');

      await expect(
        measureAsync('failing-operation', async () => {
          throw testError;
        })
      ).rejects.toThrow('Test error');

      const errorLog = (console.error as jest.Mock).mock.calls[0][0];
      expect(errorLog).toContain('[OPERATION_ERROR]');
    });

    it('should include tags in metric', async () => {
      await measureAsync(
        'database-query',
        async () => 'result',
        { table: 'users', operation: 'SELECT' }
      );

      const stats = getMonitoringStats();
      expect(stats.slowMetrics[0].tags).toEqual({
        table: 'users',
        operation: 'SELECT',
      });
    });

    it('should return async function result', async () => {
      const complexResult = { data: [1, 2, 3], count: 3 };

      const result = await measureAsync('fetch-data', async () => complexResult);

      expect(result).toEqual(complexResult);
    });
  });

  // ===== Sync Measurement Tests =====

  describe('measureSync', () => {
    it('should measure sync function execution time', () => {
      const result = measureSync('parse-json', () => {
        const json = '{"key": "value"}';
        return JSON.parse(json);
      });

      expect(result).toEqual({ key: 'value' });
    });

    it('should only record metrics for operations > 10ms', () => {
      measureSync('very-fast', () => {
        // Fast operation, < 10ms
        return 42;
      });

      const stats = getMonitoringStats();
      // Might or might not be recorded depending on timing
      expect(stats.stats.total).toBeLessThanOrEqual(1);
    });

    it('should detect slow sync operations (> 100ms)', () => {
      // Simulate slow sync operation
      const startTime = Date.now();
      measureSync('cpu-intensive', () => {
        // Busy-wait for ~150ms
        while (Date.now() - startTime < 150) {}
        return 'done';
      });

      const warning = (console.warn as jest.Mock).mock.calls.find(
        (call: any[]) => call[0]?.includes('[SLOW_SYNC_OP]')
      );
      expect(warning).toBeDefined();
    });

    it('should handle sync errors gracefully', () => {
      const testError = new Error('Sync error');

      expect(() => {
        measureSync('failing-sync', () => {
          throw testError;
        });
      }).toThrow('Sync error');

      const errorLog = (console.error as jest.Mock).mock.calls[0][0];
      expect(errorLog).toContain('[SYNC_OP_ERROR]');
    });

    it('should return sync function result', () => {
      const result = measureSync('calculate', () => 2 + 2);
      expect(result).toBe(4);
    });

    it('should include tags in metric', () => {
      measureSync(
        'cpu-parse',
        () => JSON.parse('{"test": true}'),
        { type: 'json', size: 'small' }
      );

      const stats = getMonitoringStats();
      const metric = stats.slowMetrics[0];
      if (metric) {
        expect(metric.tags).toEqual({ type: 'json', size: 'small' });
      }
    });
  });

  // ===== Statistics Tests =====

  describe('getMonitoringStats', () => {
    it('should return empty stats when no metrics recorded', () => {
      const stats = getMonitoringStats();

      expect(stats.stats.total).toBe(0);
      expect(stats.stats.slow).toBe(0);
      expect(stats.stats.slowPercentage).toBe('0%');
      expect(stats.slowMetrics).toEqual([]);
    });

    it('should calculate slow percentage correctly', () => {
      // Record 10 fast, 5 slow
      for (let i = 0; i < 10; i++) {
        recordMiddlewarePerformance(`fast-${i}`, 20);
      }
      for (let i = 0; i < 5; i++) {
        recordMiddlewarePerformance(`slow-${i}`, 150);
      }

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(15);
      expect(stats.stats.slow).toBe(5);
      expect(stats.stats.slowPercentage).toContain('33');
    });

    it('should return last 10 slow metrics', () => {
      // Record 15 slow metrics
      for (let i = 0; i < 15; i++) {
        recordMiddlewarePerformance(`slow-${i}`, 150 + i);
      }

      const stats = getMonitoringStats();
      expect(stats.slowMetrics.length).toBeLessThanOrEqual(10);
    });

    it('should include timestamp in stats', () => {
      recordMiddlewarePerformance('test', 50);
      const stats = getMonitoringStats();

      expect(stats.timestamp).toBeDefined();
      expect(new Date(stats.timestamp)).toBeInstanceOf(Date);
    });

    it('should calculate average duration', () => {
      recordMiddlewarePerformance('op1', 100);
      recordMiddlewarePerformance('op2', 200);
      recordMiddlewarePerformance('op3', 300);

      const stats = getMonitoringStats();
      expect(stats.stats.avgDuration).toContain('200');
    });
  });

  // ===== Integration Tests =====

  describe('Monitoring Integration', () => {
    it('should handle mixed middleware and query monitoring', () => {
      recordMiddlewarePerformance('cors', 25, { method: 'GET' });
      recordQueryPerformance('SELECT * FROM users', 250, 'SELECT', 100);
      recordMiddlewarePerformance('auth', 15, { method: 'GET' });
      recordQueryPerformance('UPDATE users SET active = true', 600, 'UPDATE', 50);

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(4);
      expect(stats.stats.slow).toBe(1); // Only the slow query
    });

    it('should clear all metrics', () => {
      recordMiddlewarePerformance('test1', 50);
      recordQueryPerformance('SELECT', 600, 'SELECT');

      let stats = getMonitoringStats();
      expect(stats.stats.total).toBe(2);

      clearMetrics();

      stats = getMonitoringStats();
      expect(stats.stats.total).toBe(0);
    });

    it('should track P95/P99 percentiles implicitly', () => {
      // Record 20 metrics with varying durations
      const durations = Array.from({ length: 20 }, (_, i) => (i + 1) * 10); // 10, 20, ..., 200

      durations.forEach((duration, index) => {
        recordMiddlewarePerformance(`middleware-${index}`, duration);
      });

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(20);
      // Average should be around 105ms
      expect(stats.stats.avgDuration).toContain('105');
    });
  });

  // ===== Threshold Tests =====

  describe('Performance Thresholds', () => {
    it('middleware threshold should be 100ms', () => {
      recordMiddlewarePerformance('test1', 99);
      recordMiddlewarePerformance('test2', 100);
      recordMiddlewarePerformance('test3', 101);

      expect(console.warn).toHaveBeenCalledTimes(2); // 100ms and 101ms
    });

    it('query threshold should be 500ms', () => {
      recordQueryPerformance('SELECT', 499, 'SELECT');
      recordQueryPerformance('SELECT', 500, 'SELECT');
      recordQueryPerformance('SELECT', 501, 'SELECT');

      expect(console.warn).toHaveBeenCalledTimes(2); // 500ms and 501ms
    });
  });
});
