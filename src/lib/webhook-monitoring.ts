import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface WebhookMonitoringConfig {
  organizationId: string;
  period?: 'hour' | 'day' | 'week' | 'month';
  dayCount?: number;
  webhookTypes?: string[];
}

export interface WebhookMetric {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
  avgExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  p99ExecutionTimeMs: number;
  successRate: number;
  estimatedMonthlyCost?: number;
  retryRate: number;
  autoRetrySuccessRate: number;
}

export interface WebhookTypeMetrics {
  [webhookType: string]: WebhookMetric & {
    totalCalls: number;
    estimatedMonthlyVolume: number;
  };
}

export interface WebhookMonitoringData {
  period: { days: number; since: string; until: string };
  overall: WebhookMetric;
  byType: WebhookTypeMetrics;
  alerts: WebhookAlert[];
  recommendations: string[];
  dailyTrend?: DailyTrendData[];
}

export interface WebhookAlert {
  level: 'critical' | 'warning' | 'info';
  message: string;
  metric: string;
  current: number;
  threshold: number;
  timestamp: string;
}

export interface DailyTrendData {
  date: string;
  totalEvents: number;
  successCount: number;
  failureCount: number;
  avgExecutionTimeMs: number;
}

export async function collectWebhookMetrics(
  config: WebhookMonitoringConfig
): Promise<WebhookMonitoringData> {
  const dayCount = config.dayCount || 7;
  const sinceDate = new Date(Date.now() - dayCount * 86400000);
  const untilDate = new Date();

  try {
    // 1. 메인 이벤트 데이터 수집
    const events = await prisma.webhookEvent.findMany({
      where: {
        organizationId: config.organizationId,
        createdAt: { gte: sinceDate },
        ...(config.webhookTypes && config.webhookTypes.length > 0
          ? { webhookType: { in: config.webhookTypes } }
          : {}),
      },
      select: {
        id: true,
        webhookType: true,
        status: true,
        executionTimeMs: true,
        retryCount: true,
        createdAt: true,
        processingStartAt: true,
        processingEndAt: true,
        logs: {
          select: {
            durationMs: true,
            status: true,
            attemptNumber: true,
          },
        },
      },
    });

    // 2. 집계 데이터 계산
    const overall = calculateMetrics(events);
    const byType = calculateMetricsByType(events);
    const alerts = generateAlerts(overall, byType);
    const recommendations = generateRecommendations(overall, byType, alerts);
    const dailyTrend = calculateDailyTrend(events);

    return {
      period: {
        days: dayCount,
        since: sinceDate.toISOString(),
        until: untilDate.toISOString(),
      },
      overall,
      byType,
      alerts,
      recommendations,
      dailyTrend,
    };
  } catch (error) {
    logger.error('[WebhookMonitoring] Error collecting metrics', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function calculateMetrics(
  events: any[]
): WebhookMetric {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      successCount: 0,
      failureCount: 0,
      pendingCount: 0,
      avgExecutionTimeMs: 0,
      p95ExecutionTimeMs: 0,
      p99ExecutionTimeMs: 0,
      successRate: 0,
      retryRate: 0,
      autoRetrySuccessRate: 0,
    };
  }

  const successCount = events.filter(e => e.status === 'COMPLETED').length;
  const failureCount = events.filter(e => e.status === 'FAILED').length;
  const pendingCount = events.filter(e => e.status === 'PENDING').length;

  const executionTimes = events
    .filter(e => e.executionTimeMs !== null)
    .map(e => e.executionTimeMs)
    .sort((a, b) => a - b);

  const avgExecutionTimeMs =
    executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;

  const p95ExecutionTimeMs =
    executionTimes.length > 0
      ? executionTimes[Math.floor(executionTimes.length * 0.95)]
      : 0;

  const p99ExecutionTimeMs =
    executionTimes.length > 0
      ? executionTimes[Math.floor(executionTimes.length * 0.99)]
      : 0;

  const successRate = (successCount / events.length) * 100;
  const retryRate = (events.filter(e => e.retryCount > 0).length / events.length) * 100;

  // Auto-retry 성공률: Retry 후 성공한 이벤트
  const retriedEvents = events.filter(e => e.retryCount > 0);
  const autoRetrySuccessRate =
    retriedEvents.length > 0
      ? (retriedEvents.filter(e => e.status === 'COMPLETED').length / retriedEvents.length) *
        100
      : 0;

  return {
    totalEvents: events.length,
    successCount,
    failureCount,
    pendingCount,
    avgExecutionTimeMs: Math.round(avgExecutionTimeMs * 100) / 100,
    p95ExecutionTimeMs: Math.round(p95ExecutionTimeMs * 100) / 100,
    p99ExecutionTimeMs: Math.round(p99ExecutionTimeMs * 100) / 100,
    successRate: Math.round(successRate * 100) / 100,
    retryRate: Math.round(retryRate * 100) / 100,
    autoRetrySuccessRate: Math.round(autoRetrySuccessRate * 100) / 100,
  };
}

function calculateMetricsByType(events: any[]): WebhookTypeMetrics {
  const byType: WebhookTypeMetrics = {};

  for (const event of events) {
    if (!byType[event.webhookType]) {
      byType[event.webhookType] = {
        totalEvents: 0,
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        pendingCount: 0,
        avgExecutionTimeMs: 0,
        p95ExecutionTimeMs: 0,
        p99ExecutionTimeMs: 0,
        successRate: 0,
        retryRate: 0,
        autoRetrySuccessRate: 0,
        estimatedMonthlyVolume: 0,
      };
    }
    byType[event.webhookType].totalEvents++;
    byType[event.webhookType].totalCalls += 1 + (event.retryCount || 0);
  }

  // 각 타입별 메트릭 계산
  for (const webhookType in byType) {
    const typeEvents = events.filter(e => e.webhookType === webhookType);
    const metrics = calculateMetrics(typeEvents);

    byType[webhookType] = {
      ...byType[webhookType],
      ...metrics,
      estimatedMonthlyVolume: Math.round((typeEvents.length / 7) * 30),
    };
  }

  return byType;
}

function generateAlerts(overall: WebhookMetric, byType: WebhookTypeMetrics): WebhookAlert[] {
  const alerts: WebhookAlert[] = [];
  const now = new Date().toISOString();

  // Alert 1: Low success rate
  if (overall.successRate < 95) {
    alerts.push({
      level: overall.successRate < 90 ? 'critical' : 'warning',
      message: `Success rate below threshold (${overall.successRate.toFixed(2)}% < 95%)`,
      metric: 'successRate',
      current: overall.successRate,
      threshold: 95,
      timestamp: now,
    });
  }

  // Alert 2: High execution time (p95)
  if (overall.p95ExecutionTimeMs > 5000) {
    alerts.push({
      level: overall.p95ExecutionTimeMs > 10000 ? 'critical' : 'warning',
      message: `High execution time (P95: ${overall.p95ExecutionTimeMs.toFixed(0)}ms > 5000ms)`,
      metric: 'p95ExecutionTime',
      current: overall.p95ExecutionTimeMs,
      threshold: 5000,
      timestamp: now,
    });
  }

  // Alert 3: High failure count
  if (overall.failureCount > 10) {
    alerts.push({
      level: overall.failureCount > 50 ? 'critical' : 'warning',
      message: `High failure count (${overall.failureCount} failures)`,
      metric: 'failureCount',
      current: overall.failureCount,
      threshold: 10,
      timestamp: now,
    });
  }

  // Alert 4: Per-type critical failures
  for (const [type, metric] of Object.entries(byType)) {
    if (metric.successRate < 85) {
      alerts.push({
        level: 'warning',
        message: `Webhook type '${type}' has low success rate (${metric.successRate.toFixed(2)}%)`,
        metric: `${type}_successRate`,
        current: metric.successRate,
        threshold: 85,
        timestamp: now,
      });
    }
  }

  return alerts;
}

function generateRecommendations(
  overall: WebhookMetric,
  byType: WebhookTypeMetrics,
  alerts: WebhookAlert[]
): string[] {
  const recommendations: string[] = [];

  if (overall.successRate < 95) {
    recommendations.push(
      `Webhook success rate is ${overall.successRate.toFixed(2)}%. Investigate failed events and improve error handling.`
    );
  }

  if (overall.p95ExecutionTimeMs > 5000) {
    recommendations.push(
      `P95 execution time is ${overall.p95ExecutionTimeMs.toFixed(0)}ms. Consider optimizing database queries or adding caching.`
    );
  }

  if (overall.retryRate > 20) {
    recommendations.push(
      `High retry rate (${overall.retryRate.toFixed(2)}%). This may indicate transient issues or timeout problems.`
    );
  }

  if (overall.autoRetrySuccessRate < 80) {
    recommendations.push(
      `Auto-retry success rate is low (${overall.autoRetrySuccessRate.toFixed(2)}%). Consider implementing exponential backoff or circuit breaker.`
    );
  }

  // Type-specific recommendations
  for (const [type, metric] of Object.entries(byType)) {
    if (metric.estimatedMonthlyVolume > 10000 && metric.successRate < 90) {
      recommendations.push(
        `High-volume webhook type '${type}' has low reliability. Prioritize fixing this type.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Webhook infrastructure is operating normally. No immediate action required.');
  }

  return recommendations;
}

function calculateDailyTrend(events: any[]): DailyTrendData[] {
  const dailyData: Record<string, any> = {};

  for (const event of events) {
    const date = new Date(event.createdAt).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        totalEvents: 0,
        successCount: 0,
        failureCount: 0,
        executionTimes: [],
      };
    }
    dailyData[date].totalEvents++;
    if (event.status === 'COMPLETED') dailyData[date].successCount++;
    if (event.status === 'FAILED') dailyData[date].failureCount++;
    if (event.executionTimeMs) dailyData[date].executionTimes.push(event.executionTimeMs);
  }

  return Object.values(dailyData)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      date: d.date,
      totalEvents: d.totalEvents,
      successCount: d.successCount,
      failureCount: d.failureCount,
      avgExecutionTimeMs:
        d.executionTimes.length > 0
          ? Math.round(
              (d.executionTimes.reduce((a: number, b: number) => a + b, 0) /
                d.executionTimes.length) *
                100
            ) / 100
          : 0,
    }));
}

/**
 * 실시간 모니터링을 위한 웹훅 상태 체크
 */
export async function checkWebhookHealth(
  organizationId: string
): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  metrics: {
    last1hSuccessRate: number;
    last24hSuccessRate: number;
    pendingCount: number;
    failedCount: number;
    avgLatency: number;
  };
}> {
  const oneHourAgo = new Date(Date.now() - 3600000);
  const oneDayAgo = new Date(Date.now() - 86400000);

  const [last1h, last24h, pending, failed] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: {
        organizationId,
        createdAt: { gte: oneHourAgo },
      },
      select: { status: true, executionTimeMs: true },
    }),
    prisma.webhookEvent.findMany({
      where: {
        organizationId,
        createdAt: { gte: oneDayAgo },
      },
      select: { status: true, executionTimeMs: true },
    }),
    prisma.webhookEvent.count({
      where: {
        organizationId,
        status: 'PENDING',
      },
    }),
    prisma.webhookEvent.count({
      where: {
        organizationId,
        status: 'FAILED',
      },
    }),
  ]);

  const last1hSuccessRate =
    last1h.length > 0
      ? (last1h.filter(e => e.status === 'COMPLETED').length / last1h.length) * 100
      : 100;

  const last24hSuccessRate =
    last24h.length > 0
      ? (last24h.filter(e => e.status === 'COMPLETED').length / last24h.length) * 100
      : 100;

  const avgLatency =
    last1h.length > 0
      ? last1h.reduce((sum, e) => sum + (e.executionTimeMs || 0), 0) / last1h.length
      : 0;

  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let message = 'All systems operational';

  if (last1hSuccessRate < 85 || pending > 100 || failed > 50) {
    status = 'critical';
    message = 'Immediate attention required';
  } else if (last1hSuccessRate < 95 || pending > 50) {
    status = 'warning';
    message = 'Monitor closely';
  }

  return {
    status,
    message,
    metrics: {
      last1hSuccessRate: Math.round(last1hSuccessRate * 100) / 100,
      last24hSuccessRate: Math.round(last24hSuccessRate * 100) / 100,
      pendingCount: pending,
      failedCount: failed,
      avgLatency: Math.round(avgLatency * 100) / 100,
    },
  };
}
