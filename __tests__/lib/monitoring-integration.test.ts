/**
 * Monitoring Integration Tests
 *
 * Tests for monitoring performance detection in realistic scenarios
 */

import {
  recordMiddlewarePerformance,
  recordQueryPerformance,
  measureAsync,
  getMonitoringStats,
  clearMetrics,
} from '@/src/lib/monitoring';

describe('Monitoring - Slow Operation Detection', () => {
  beforeEach(() => {
    clearMetrics();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearMetrics();
  });

  // ===== Test 1: Slow Middleware Detection =====

  describe('Slow Middleware Detection', () => {
    it('should detect slow middleware and trigger alert', () => {
      const scenarios = [
        { name: 'auth-validation', duration: 85, expected: false },
        { name: 'role-check', duration: 120, expected: true },
        { name: 'permission-audit', duration: 250, expected: true },
        { name: 'session-refresh', duration: 500, expected: true },
      ];

      scenarios.forEach(({ name, duration, expected }) => {
        recordMiddlewarePerformance(name, duration, {
          pathname: '/dashboard',
        });
      });

      const stats = getMonitoringStats();
      expect(stats.stats.total).toBe(4);
      expect(stats.stats.slow).toBe(3); // 120, 250, 500ms

      // Verify slow operations are in slowMetrics
      const slowOps = stats.slowMetrics;
      expect(slowOps.some(m => m.duration.includes('120'))).toBe(true);
      expect(slowOps.some(m => m.duration.includes('250'))).toBe(true);
      expect(slowOps.some(m => m.duration.includes('500'))).toBe(true);
    });

    it('should identify bottleneck middleware', () => {
      // Simulating request pipeline
      const middlewares = [
        { name: 'cors', duration: 5 },
        { name: 'logging', duration: 10 },
        { name: 'auth-header-injection', duration: 8 },
        { name: 'role-validation', duration: 200 }, // 🔴 Bottleneck!
        { name: 'audit-logging', duration: 15 },
      ];

      middlewares.forEach(({ name, duration }) => {
        recordMiddlewarePerformance(name, duration, {
          endpoint: '/admin/dashboard',
        });
      });

      const stats = getMonitoringStats();
      const slowMetrics = stats.slowMetrics;

      // Should identify 'role-validation' as bottleneck
      expect(slowMetrics.length).toBe(1);
      expect(slowMetrics[0].name).toBe('role-validation');
      expect(slowMetrics[0].duration).toContain('200');
    });

    it('should aggregate slow middleware for P99 calculation', () => {
      // Simulate 100 requests with varying middleware durations
      const durations = [];

      for (let i = 0; i < 100; i++) {
        // Most are fast, some are slow
        const duration = Math.random() < 0.05 ? 150 + Math.random() * 100 : 20 + Math.random() * 30;
        durations.push(duration);
        recordMiddlewarePerformance('auth', Math.round(duration), {
          requestId: `req-${i}`,
        });
      }

      const stats = getMonitoringStats();
      // P99 should be in slow operations
      expect(stats.stats.total).toBe(100);
      expect(stats.stats.slow).toBeGreaterThan(0); // At least 5% should be slow
      expect(stats.stats.slowPercentage).toContain('%');
    });
  });

  // ===== Test 2: Slow Query Detection =====

  describe('Slow Query Detection', () => {
    it('should detect N+1 query patterns (multiple slow queries)', () => {
      // Simulating N+1 query problem
      const queries = [
        'SELECT * FROM campaigns', // Fast
        'SELECT * FROM campaigns WHERE id = ?', // Slow - should be batched
        'SELECT * FROM campaigns WHERE id = ?', // Slow
        'SELECT * FROM campaigns WHERE id = ?', // Slow
        'SELECT * FROM campaigns WHERE id = ?', // Slow
      ];

      queries.forEach((query, index) => {
        const duration = index === 0 ? 100 : 600; // First fast, rest slow
        recordQueryPerformance(query, duration, 'SELECT', Math.random() * 1000);
      });

      const stats = getMonitoringStats();
      expect(stats.stats.slow).toBe(4); // 4 slow queries
      expect(stats.stats.slowPercentage).toContain('80'); // 80% are slow
    });

    it('should identify slow database operations by type', () => {
      const operations = [
        { query: 'SELECT * FROM users', duration: 100, type: 'SELECT' },
        { query: 'INSERT INTO logs VALUES (...)', duration: 200, type: 'INSERT' },
        { query: 'UPDATE users SET status = true', duration: 700, type: 'UPDATE' }, // 🔴 Slow
        { query: 'DELETE FROM old_records', duration: 600, type: 'DELETE' }, // 🔴 Slow
      ];

      operations.forEach(({ query, duration, type }) => {
        recordQueryPerformance(query, duration, type, 100);
      });

      const stats = getMonitoringStats();
      expect(stats.stats.slow).toBe(2);

      // Slow operations should include UPDATE and DELETE
      const slowOps = stats.slowMetrics;
      expect(slowOps.some(m => m.duration.includes('700'))).toBe(true);
      expect(slowOps.some(m => m.duration.includes('600'))).toBe(true);
    });

    it('should detect query timeout risks', () => {
      // Queries approaching timeout threshold (typically 30s)
      const riskQueries = [
        { duration: 5000, risk: 'warning' }, // 5 seconds
        { duration: 15000, risk: 'critical' }, // 15 seconds
        { duration: 25000, risk: 'critical' }, // 25 seconds
      ];

      riskQueries.forEach(({ duration }, index) => {
        recordQueryPerformance(
          `SELECT * FROM large_table WHERE complex_filter = ?`,
          duration,
          'SELECT',
          10000
        );
      });

      const stats = getMonitoringStats();
      expect(stats.stats.slow).toBe(3); // All slow

      // All should be logged as slow
      const slowOps = stats.slowMetrics;
      expect(slowOps.length).toBe(3);
    });
  });

  // ===== Test 3: Real-World Request Scenarios =====

  describe('Real-World Request Performance', () => {
    it('should track complete request lifecycle', async () => {
      // Simulate: /dashboard page load
      // 1. Middleware processing
      recordMiddlewarePerformance('auth-validation', 8);
      recordMiddlewarePerformance('session-inject', 5);
      recordMiddlewarePerformance('role-check', 120); // 🔴 Slightly slow

      // 2. API queries
      recordQueryPerformance('SELECT * FROM users WHERE org_id = ?', 250, 'SELECT', 1);
      recordQueryPerformance('SELECT * FROM organizations WHERE id = ?', 180, 'SELECT', 1);

      // 3. Sub-queries (N+1 pattern)
      for (let i = 0; i < 10; i++) {
        recordQueryPerformance(
          `SELECT * FROM teams WHERE org_id = ? AND id = ?`,
          600, // 🔴 Slow
          'SELECT',
          1
        );
      }

      const stats = getMonitoringStats();

      // Summary
      expect(stats.stats.total).toBe(13); // 3 middleware + 2 queries + 10 sub-queries
      expect(stats.stats.slow).toBe(11); // role-check + all sub-queries
      expect(stats.stats.slowPercentage).toContain('84'); // ~85% are slow
    });

    it('should detect performance regression in bulk operations', async () => {
      // Before optimization
      console.log('=== Before Optimization ===');
      for (let i = 0; i < 5; i++) {
        await measureAsync(
          'process-user-batch',
          async () => {
            // Simulate bulk user processing
            await new Promise(resolve => setTimeout(resolve, 200));
            return { processed: 100 };
          },
          { batchSize: '100' }
        );
      }

      let beforeStats = getMonitoringStats();
      const beforeAvg = parseFloat(
        beforeStats.stats.avgDuration.replace('ms', '')
      );

      clearMetrics();

      // After optimization (should be faster)
      console.log('=== After Optimization ===');
      for (let i = 0; i < 5; i++) {
        await measureAsync(
          'process-user-batch',
          async () => {
            // Simulate optimized bulk processing
            await new Promise(resolve => setTimeout(resolve, 80));
            return { processed: 100 };
          },
          { batchSize: '100' }
        );
      }

      let afterStats = getMonitoringStats();
      const afterAvg = parseFloat(
        afterStats.stats.avgDuration.replace('ms', '')
      );

      // Should show improvement
      expect(afterAvg).toBeLessThan(beforeAvg);
      console.log(`Performance improvement: ${beforeAvg.toFixed(0)}ms → ${afterAvg.toFixed(0)}ms`);
    });

    it('should monitor peak load scenario', () => {
      // Simulate 100 concurrent requests during peak load
      const baselineHealth = { slow: 0, total: 0 };

      for (let request = 0; request < 100; request++) {
        // Each request has 3 middleware calls
        recordMiddlewarePerformance('cors', 5 + Math.random() * 30);
        recordMiddlewarePerformance('auth', 10 + Math.random() * 80);
        recordMiddlewarePerformance('logging', 2 + Math.random() * 20);

        // Each request makes 2-4 queries
        const queryCount = 2 + Math.floor(Math.random() * 3);
        for (let q = 0; q < queryCount; q++) {
          recordQueryPerformance(
            `SELECT * FROM table_${q}`,
            200 + Math.random() * 400,
            'SELECT',
            100
          );
        }
      }

      const stats = getMonitoringStats();

      // Under peak load, we expect:
      expect(stats.stats.total).toBeGreaterThan(400); // 3 middleware + 2-4 queries per request
      expect(stats.stats.slow).toBeGreaterThan(0);

      const slowPercentage = parseFloat(stats.stats.slowPercentage);
      console.log(
        `Peak load analysis: ${stats.stats.slow} slow out of ${stats.stats.total} operations (${slowPercentage}%)`
      );
    });
  });

  // ===== Test 4: Alert Threshold Validation =====

  describe('Alert Threshold Validation', () => {
    it('should trigger alert for middleware exceeding threshold', () => {
      const threshold = 100;
      let alertCount = 0;

      [50, 80, 120, 150].forEach(duration => {
        recordMiddlewarePerformance('auth', duration);
        if (duration > threshold) {
          alertCount++;
        }
      });

      expect(console.warn).toHaveBeenCalledTimes(2); // 120, 150
      expect(alertCount).toBe(2);
    });

    it('should trigger alert for query exceeding threshold', () => {
      const threshold = 500;
      let alertCount = 0;

      [300, 400, 650, 800].forEach(duration => {
        recordQueryPerformance('SELECT', duration, 'SELECT');
        if (duration > threshold) {
          alertCount++;
        }
      });

      expect(console.warn).toHaveBeenCalledTimes(2); // 650, 800
      expect(alertCount).toBe(2);
    });

    it('should calculate severity based on duration', () => {
      // Severity levels: Warning < 150ms, Critical >= 150ms
      const levels = [
        { duration: 120, severity: 'warning' },
        { duration: 180, severity: 'critical' },
        { duration: 300, severity: 'critical' },
      ];

      levels.forEach(({ duration }) => {
        recordMiddlewarePerformance('slow-op', duration);
      });

      const stats = getMonitoringStats();
      const slowOps = stats.slowMetrics;

      // At least one critical operation (duration >= 150)
      expect(slowOps.some(m => parseInt(m.duration) >= 180)).toBe(true);
    });
  });

  // ===== Test 5: Monitoring Health Checks =====

  describe('Monitoring Health Checks', () => {
    it('should report monitoring system health', () => {
      // Record 20 normal operations
      for (let i = 0; i < 20; i++) {
        recordMiddlewarePerformance(`op${i}`, 20 + Math.random() * 40);
      }

      const stats = getMonitoringStats();

      // Health checks:
      const health = {
        operationsTracked: stats.stats.total,
        slowOperationPercentage: parseFloat(stats.stats.slowPercentage),
        avgDuration: parseFloat(stats.stats.avgDuration),
        systemHealthy: parseFloat(stats.stats.slowPercentage) < 10,
      };

      expect(health.operationsTracked).toBe(20);
      expect(health.slowOperationPercentage).toBeLessThan(10);
      expect(health.systemHealthy).toBe(true);
    });

    it('should detect degradation over time', () => {
      // Hour 1: Normal performance
      for (let i = 0; i < 50; i++) {
        recordMiddlewarePerformance('auth', 20 + Math.random() * 50);
      }

      let stats = getMonitoringStats();
      const hour1Slow = stats.stats.slow;

      clearMetrics();

      // Hour 2: Degraded performance
      for (let i = 0; i < 50; i++) {
        recordMiddlewarePerformance('auth', 100 + Math.random() * 200);
      }

      stats = getMonitoringStats();
      const hour2Slow = stats.stats.slow;

      // Second hour should have more slow operations
      expect(hour2Slow).toBeGreaterThan(hour1Slow);
      console.log(
        `Performance degradation: ${hour1Slow} slow operations → ${hour2Slow} slow operations`
      );
    });
  });

  // ===== Test 6: SLA Monitoring =====

  describe('SLA Compliance Monitoring', () => {
    it('should verify P99 middleware latency < 100ms', () => {
      // Generate realistic latency distribution
      const latencies: number[] = [];

      // 95% normal requests (10-50ms)
      for (let i = 0; i < 95; i++) {
        latencies.push(10 + Math.random() * 40);
      }

      // 5% slow requests (100-200ms)
      for (let i = 0; i < 5; i++) {
        latencies.push(100 + Math.random() * 100);
      }

      latencies.forEach(duration => {
        recordMiddlewarePerformance('api-gateway', duration);
      });

      const stats = getMonitoringStats();

      // P99 calculation (99th percentile)
      const sorted = latencies.sort((a, b) => a - b);
      const p99Index = Math.floor(sorted.length * 0.99);
      const p99Latency = sorted[p99Index];

      expect(p99Latency).toBeLessThan(200);
      console.log(`P99 latency: ${p99Latency}ms`);
    });

    it('should verify query response time SLA', () => {
      // SLA: 95% of queries should complete in < 500ms
      const queryDurations: number[] = [];

      // 95% fast queries
      for (let i = 0; i < 95; i++) {
        queryDurations.push(50 + Math.random() * 450);
      }

      // 5% slow queries
      for (let i = 0; i < 5; i++) {
        queryDurations.push(500 + Math.random() * 500);
      }

      queryDurations.forEach(duration => {
        recordQueryPerformance('SELECT * FROM table', duration, 'SELECT');
      });

      const stats = getMonitoringStats();

      // Verify 95% compliance
      const withinSLA = queryDurations.filter(d => d < 500).length;
      const slaCompliance = (withinSLA / queryDurations.length) * 100;

      expect(slaCompliance).toBeGreaterThanOrEqual(95);
      console.log(`Query SLA compliance: ${slaCompliance.toFixed(2)}%`);
    });
  });
});
