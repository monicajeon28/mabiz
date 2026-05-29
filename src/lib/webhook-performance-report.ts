import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface PerformanceMetrics {
  period: string;
  totalEvents: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgExecutionTimeMs: number;
  p50ExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  p99ExecutionTimeMs: number;
  totalRetries: number;
  autoRetrySuccessRate: number;
  estimatedWeeklyVolume: number;
  estimatedMonthlyCost: number;
  costPerEvent: number;
  estimatedMonthlyErrors: number;
  errorRate: number;
  peakHour: string;
  peakHourVolume: number;
  slowestType: string;
  slowestTypeAvgTime: number;
  mostReliableType: string;
  mostReliableTypeSuccessRate: number;
}

export interface WeeklyReport {
  weekOf: string;
  metrics: PerformanceMetrics;
  recommendations: string[];
  comparisonWithPreviousWeek: {
    successRateChange: number;
    volumeChange: number;
    latencyChange: number;
  };
}

export interface MonthlyReport {
  month: string;
  metrics: PerformanceMetrics;
  trends: {
    dailySuccessRate: Array<{ date: string; rate: number }>;
    dailyVolume: Array<{ date: string; volume: number }>;
    dailyLatency: Array<{ date: string; latency: number }>;
  };
  topIssues: Array<{
    type: string;
    successRate: number;
    failureCount: number;
    recommendation: string;
  }>;
  actionItems: string[];
}

/**
 * 주간 성과 리포트 생성
 */
export async function generateWeeklyReport(
  organizationId: string,
  weekEndDate?: Date
): Promise<WeeklyReport> {
  const endDate = weekEndDate || new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [currentWeek, previousWeek] = await Promise.all([
      collectMetrics(organizationId, startDate, endDate),
      collectMetrics(organizationId, new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), startDate),
    ]);

    const recommendations = generateWeeklyRecommendations(currentWeek);

    const comparisonWithPreviousWeek = {
      successRateChange: currentWeek.successRate - previousWeek.successRate,
      volumeChange: currentWeek.totalEvents - previousWeek.totalEvents,
      latencyChange: currentWeek.avgExecutionTimeMs - previousWeek.avgExecutionTimeMs,
    };

    return {
      weekOf: startDate.toISOString().split('T')[0],
      metrics: currentWeek,
      recommendations,
      comparisonWithPreviousWeek,
    };
  } catch (error) {
    logger.error('[PerformanceReport] Error generating weekly report', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 월간 성과 리포트 생성
 */
export async function generateMonthlyReport(
  organizationId: string,
  month?: { year: number; month: number }
): Promise<MonthlyReport> {
  const now = new Date();
  const targetMonth = month || { year: now.getFullYear(), month: now.getMonth() };

  const startDate = new Date(targetMonth.year, targetMonth.month, 1);
  const endDate = new Date(targetMonth.year, targetMonth.month + 1, 1);

  try {
    const metrics = await collectMetrics(organizationId, startDate, endDate);

    // 일별 데이터 수집
    const dailyEvents = await prisma.webhookEvent.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lt: endDate },
      },
      select: {
        createdAt: true,
        status: true,
        executionTimeMs: true,
      },
    });

    // 일별 트렌드 계산
    const dailyData: Record<string, any> = {};
    for (const event of dailyEvents) {
      const date = event.createdAt.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          total: 0,
          success: 0,
          times: [],
        };
      }
      dailyData[date].total++;
      if (event.status === 'COMPLETED') dailyData[date].success++;
      if (event.executionTimeMs) dailyData[date].times.push(event.executionTimeMs);
    }

    const dailySuccessRate = Object.values(dailyData).map((d: any) => ({
      date: d.date,
      rate: (d.success / d.total) * 100,
    }));

    const dailyVolume = Object.values(dailyData).map((d: any) => ({
      date: d.date,
      volume: d.total,
    }));

    const dailyLatency = Object.values(dailyData).map((d: any) => ({
      date: d.date,
      latency:
        d.times.length > 0 ? Math.round(d.times.reduce((a: number, b: number) => a + b, 0) / d.times.length) : 0,
    }));

    // 문제 있는 웹훅 타입 분석
    const topIssues = await analyzeProblematicTypes(organizationId, startDate, endDate);

    // 액션 아이템 생성
    const actionItems = generateMonthlyActionItems(metrics, topIssues);

    return {
      month: `${targetMonth.year}-${String(targetMonth.month + 1).padStart(2, '0')}`,
      metrics,
      trends: {
        dailySuccessRate,
        dailyVolume,
        dailyLatency,
      },
      topIssues,
      actionItems,
    };
  } catch (error) {
    logger.error('[PerformanceReport] Error generating monthly report', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 메트릭 수집 (내부 헬퍼)
 */
async function collectMetrics(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<PerformanceMetrics> {
  const events = await prisma.webhookEvent.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lt: endDate },
    },
    select: {
      webhookType: true,
      status: true,
      executionTimeMs: true,
      retryCount: true,
      createdAt: true,
    },
  });

  if (events.length === 0) {
    return {
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      totalEvents: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgExecutionTimeMs: 0,
      p50ExecutionTimeMs: 0,
      p95ExecutionTimeMs: 0,
      p99ExecutionTimeMs: 0,
      totalRetries: 0,
      autoRetrySuccessRate: 0,
      estimatedWeeklyVolume: 0,
      estimatedMonthlyCost: 0,
      costPerEvent: 0,
      estimatedMonthlyErrors: 0,
      errorRate: 0,
      peakHour: 'N/A',
      peakHourVolume: 0,
      slowestType: 'N/A',
      slowestTypeAvgTime: 0,
      mostReliableType: 'N/A',
      mostReliableTypeSuccessRate: 0,
    };
  }

  // 기본 메트릭
  const successCount = events.filter(e => e.status === 'COMPLETED').length;
  const failureCount = events.filter(e => e.status === 'FAILED').length;
  const successRate = (successCount / events.length) * 100;

  const executionTimes = events
    .filter(e => e.executionTimeMs !== null)
    .map(e => e.executionTimeMs!)
    .sort((a, b) => a - b);

  const avgExecutionTimeMs =
    executionTimes.length > 0 ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0;

  const p50ExecutionTimeMs = executionTimes[Math.floor(executionTimes.length * 0.5)];
  const p95ExecutionTimeMs = executionTimes[Math.floor(executionTimes.length * 0.95)];
  const p99ExecutionTimeMs = executionTimes[Math.floor(executionTimes.length * 0.99)];

  // Retry 메트릭
  const totalRetries = events.reduce((sum, e) => sum + e.retryCount, 0);
  const retriedEvents = events.filter(e => e.retryCount > 0);
  const autoRetrySuccessRate =
    retriedEvents.length > 0
      ? (retriedEvents.filter(e => e.status === 'COMPLETED').length / retriedEvents.length) * 100
      : 0;

  // 피크 시간 분석
  const hourlyStats: Record<number, number> = {};
  for (const event of events) {
    const hour = new Date(event.createdAt).getHours();
    hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
  }
  const peakHour = Object.entries(hourlyStats).sort((a, b) => b[1] - a[1])[0];
  const peakHourVolume = peakHour ? peakHour[1] : 0;
  const peakHourStr = peakHour ? `${String(peakHour[0]).padStart(2, '0')}:00` : 'N/A';

  // 타입별 분석
  const typeMetrics: Record<string, any> = {};
  for (const event of events) {
    if (!typeMetrics[event.webhookType]) {
      typeMetrics[event.webhookType] = {
        total: 0,
        success: 0,
        times: [],
      };
    }
    typeMetrics[event.webhookType].total++;
    if (event.status === 'COMPLETED') typeMetrics[event.webhookType].success++;
    if (event.executionTimeMs) typeMetrics[event.webhookType].times.push(event.executionTimeMs);
  }

  const slowestType = Object.entries(typeMetrics).reduce((prev, curr) => {
    const prevAvg = prev[1].times.length > 0 ? prev[1].times.reduce((a: number, b: number) => a + b) / prev[1].times.length : 0;
    const currAvg = curr[1].times.length > 0 ? curr[1].times.reduce((a: number, b: number) => a + b) / curr[1].times.length : 0;
    return currAvg > prevAvg ? curr : prev;
  });

  const mostReliableType = Object.entries(typeMetrics).reduce((prev, curr) => {
    const prevRate = (prev[1].success / prev[1].total) * 100;
    const currRate = (curr[1].success / curr[1].total) * 100;
    return currRate > prevRate ? curr : prev;
  });

  // 비용 추정 (1000개 이벤트당 $0.01 기준)
  const costPerEvent = 0.00001;
  const estimatedMonthlyCost = (events.length / 7) * 30 * costPerEvent;
  const estimatedMonthlyErrors = (failureCount / events.length) * (events.length / Math.max(1, (endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000))) * 30;

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalEvents: events.length,
    successCount,
    failureCount,
    successRate: Math.round(successRate * 100) / 100,
    avgExecutionTimeMs: Math.round(avgExecutionTimeMs * 100) / 100,
    p50ExecutionTimeMs: Math.round(p50ExecutionTimeMs * 100) / 100,
    p95ExecutionTimeMs: Math.round(p95ExecutionTimeMs * 100) / 100,
    p99ExecutionTimeMs: Math.round(p99ExecutionTimeMs * 100) / 100,
    totalRetries,
    autoRetrySuccessRate: Math.round(autoRetrySuccessRate * 100) / 100,
    estimatedWeeklyVolume: Math.round((events.length / Math.max(1, (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))) * 7),
    estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100,
    costPerEvent,
    estimatedMonthlyErrors: Math.round(estimatedMonthlyErrors),
    errorRate: Math.round((failureCount / events.length) * 100 * 100) / 100,
    peakHour: peakHourStr,
    peakHourVolume,
    slowestType: slowestType[0],
    slowestTypeAvgTime: Math.round((slowestType[1].times.reduce((a: number, b: number) => a + b, 0) / slowestType[1].times.length) * 100) / 100,
    mostReliableType: mostReliableType[0],
    mostReliableTypeSuccessRate: Math.round(((mostReliableType[1].success / mostReliableType[1].total) * 100) * 100) / 100,
  };
}

/**
 * 문제 있는 웹훅 타입 분석
 */
async function analyzeProblematicTypes(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    type: string;
    successRate: number;
    failureCount: number;
    recommendation: string;
  }>
> {
  const events = await prisma.webhookEvent.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { webhookType: true, status: true },
  });

  const typeMetrics: Record<string, any> = {};
  for (const event of events) {
    if (!typeMetrics[event.webhookType]) {
      typeMetrics[event.webhookType] = { total: 0, failed: 0 };
    }
    typeMetrics[event.webhookType].total++;
    if (event.status === 'FAILED') typeMetrics[event.webhookType].failed++;
  }

  return Object.entries(typeMetrics)
    .map(([type, metrics]) => {
      const successRate = ((metrics.total - metrics.failed) / metrics.total) * 100;
      let recommendation = 'No action needed';

      if (successRate < 90) {
        recommendation = `Investigate ${type} webhook handlers - high failure rate detected`;
      } else if (successRate < 95) {
        recommendation = `Monitor ${type} webhook performance and optimize error handling`;
      }

      return {
        type,
        successRate: Math.round(successRate * 100) / 100,
        failureCount: metrics.failed,
        recommendation,
      };
    })
    .filter(t => t.successRate < 95)
    .sort((a, b) => a.successRate - b.successRate);
}

/**
 * 주간 권장사항 생성
 */
function generateWeeklyRecommendations(metrics: PerformanceMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.successRate < 95) {
    recommendations.push(`Success rate is ${metrics.successRate.toFixed(2)}%. Target 99%+ by investigating failures.`);
  }

  if (metrics.p95ExecutionTimeMs > 5000) {
    recommendations.push(`P95 latency is ${metrics.p95ExecutionTimeMs}ms. Optimize database queries or add caching.`);
  }

  if (metrics.autoRetrySuccessRate < 80) {
    recommendations.push(`Auto-retry success is only ${metrics.autoRetrySuccessRate.toFixed(2)}%. Consider exponential backoff.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Webhook system is performing well. Continue monitoring for any changes.');
  }

  return recommendations;
}

/**
 * 월간 액션 아이템 생성
 */
function generateMonthlyActionItems(
  metrics: PerformanceMetrics,
  topIssues: Array<{ type: string; successRate: number; recommendation: string }>
): string[] {
  const items: string[] = [];

  items.push(`Review ${topIssues.length} problematic webhook types identified this month`);

  if (metrics.successRate < 99) {
    items.push(`Implement automated recovery for webhook failures - target 99.9% success rate`);
  }

  items.push(`Analyze peak hours (${metrics.peakHour} - ${metrics.peakHourVolume} events) for scaling needs`);

  items.push(`Estimated monthly cost: $${metrics.estimatedMonthlyCost} - review pricing and optimization options`);

  return items;
}
