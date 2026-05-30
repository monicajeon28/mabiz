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
    // 메트릭 + 일별 트렌드 + 타입별 문제 분석을 한 번에 병렬 실행
    // (collectMetrics는 groupBy 기반이므로 일별 트렌드와 중복 스캔 없음)
    const [metrics, dailyRows, typeIssueRows] = await Promise.all([
      collectMetrics(organizationId, startDate, endDate),
      // 일별 트렌드: DB 레벨 집계 (date × status)
      prisma.$queryRaw<Array<{ day: string; status: string; cnt: bigint; avg_ms: number | null }>>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') AS day,
          status,
          COUNT(*)::bigint AS cnt,
          AVG("executionTimeMs") AS avg_ms
        FROM "WebhookEvent"
        WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= ${startDate}
          AND "createdAt" < ${endDate}
        GROUP BY day, status
        ORDER BY day
      `,
      // 타입별 집계: DB 레벨
      prisma.webhookEvent.groupBy({
        by: ['webhookType', 'status'],
        where: {
          organizationId,
          createdAt: { gte: startDate, lt: endDate },
        },
        _count: { _all: true },
      }),
    ]);

    // 일별 트렌드 계산 (groupBy 결과 활용)
    const dailyData: Record<string, { total: number; success: number; totalMs: number; countMs: number }> = {};
    for (const row of dailyRows) {
      if (!dailyData[row.day]) {
        dailyData[row.day] = { total: 0, success: 0, totalMs: 0, countMs: 0 };
      }
      const count = Number(row.cnt);
      dailyData[row.day].total += count;
      if (row.status === 'COMPLETED') {
        dailyData[row.day].success += count;
        if (row.avg_ms !== null) {
          dailyData[row.day].totalMs += row.avg_ms * count;
          dailyData[row.day].countMs += count;
        }
      }
    }

    const dailySuccessRate = Object.entries(dailyData).map(([date, d]) => ({
      date,
      rate: d.total > 0 ? (d.success / d.total) * 100 : 0,
    }));

    const dailyVolume = Object.entries(dailyData).map(([date, d]) => ({
      date,
      volume: d.total,
    }));

    const dailyLatency = Object.entries(dailyData).map(([date, d]) => ({
      date,
      latency: d.countMs > 0 ? Math.round(d.totalMs / d.countMs) : 0,
    }));

    // 타입별 문제 분석 (groupBy 결과 활용, 추가 DB 조회 없음)
    const typeAgg: Record<string, { total: number; failed: number }> = {};
    for (const row of typeIssueRows) {
      if (!typeAgg[row.webhookType]) {
        typeAgg[row.webhookType] = { total: 0, failed: 0 };
      }
      typeAgg[row.webhookType].total += row._count._all;
      if (row.status === 'FAILED') typeAgg[row.webhookType].failed += row._count._all;
    }

    const topIssues = Object.entries(typeAgg)
      .map(([type, m]) => {
        const successRate = m.total > 0 ? ((m.total - m.failed) / m.total) * 100 : 100;
        let recommendation = 'No action needed';
        if (successRate < 90) {
          recommendation = `Investigate ${type} webhook handlers - high failure rate detected`;
        } else if (successRate < 95) {
          recommendation = `Monitor ${type} webhook performance and optimize error handling`;
        }
        return { type, successRate: Math.round(successRate * 100) / 100, failureCount: m.failed, recommendation };
      })
      .filter(t => t.successRate < 95)
      .sort((a, b) => a.successRate - b.successRate);

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
 * 메트릭 수집 (내부 헬퍼) — DB 레벨 집계로 메모리 사용 최소화
 */
async function collectMetrics(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<PerformanceMetrics> {
  // DB 레벨 집계: webhookType × status 조합별 카운트 + 평균 실행시간
  const typeStatusRows = await prisma.webhookEvent.groupBy({
    by: ['webhookType', 'status'],
    where: {
      organizationId,
      createdAt: { gte: startDate, lt: endDate },
    },
    _count: { _all: true },
    _avg: { executionTimeMs: true },
    _sum: { retryCount: true },
  });

  if (typeStatusRows.length === 0) {
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

  // 기본 메트릭 (groupBy 결과로 계산)
  let totalEvents = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalRetries = 0;

  // 타입별 집계
  const typeMetrics: Record<string, { total: number; success: number; avgTime: number | null }> = {};

  for (const row of typeStatusRows) {
    const count = row._count._all;
    const isCompleted = row.status === 'COMPLETED';
    const isFailed = row.status === 'FAILED';

    totalEvents += count;
    if (isCompleted) successCount += count;
    if (isFailed) failureCount += count;
    totalRetries += row._sum.retryCount ?? 0;

    if (!typeMetrics[row.webhookType]) {
      typeMetrics[row.webhookType] = { total: 0, success: 0, avgTime: null };
    }
    typeMetrics[row.webhookType].total += count;
    if (isCompleted) {
      typeMetrics[row.webhookType].success += count;
      typeMetrics[row.webhookType].avgTime = row._avg.executionTimeMs ?? null;
    }
  }

  // Retry 메트릭: retryCount > 0인 행은 groupBy로 정확히 구분하기 어려우므로
  // 근사치로 totalRetries > 0이면 autoRetrySuccessRate 추정
  const autoRetrySuccessRate =
    totalRetries > 0 ? Math.min((successCount / totalEvents) * 100, 100) : 0;

  // 피크 시간 분석: hour별 카운트를 DB에서 집계
  const hourRows: Array<{ hour: number; cnt: bigint }> = await prisma.$queryRaw`
    SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS cnt
    FROM "WebhookEvent"
    WHERE "organizationId" = ${organizationId}
      AND "createdAt" >= ${startDate}
      AND "createdAt" < ${endDate}
    GROUP BY hour
    ORDER BY cnt DESC
    LIMIT 1
  `;
  const peakHourRow = hourRows[0];
  const peakHourVolume = peakHourRow ? Number(peakHourRow.cnt) : 0;
  const peakHourStr = peakHourRow ? `${String(peakHourRow.hour).padStart(2, '0')}:00` : 'N/A';

  // 백분위수(p50/p95/p99): 소량 샘플로 추정 (최대 5,000건)
  const sampleRows = await prisma.webhookEvent.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lt: endDate },
      executionTimeMs: { not: null },
    },
    select: { executionTimeMs: true },
    orderBy: { executionTimeMs: 'asc' },
    take: 5000,
  });
  const executionTimes = sampleRows.map(r => r.executionTimeMs!);

  const avgExecutionTimeMs =
    executionTimes.length > 0 ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0;
  const p50ExecutionTimeMs = executionTimes[Math.floor(executionTimes.length * 0.5)] ?? 0;
  const p95ExecutionTimeMs = executionTimes[Math.floor(executionTimes.length * 0.95)] ?? 0;
  const p99ExecutionTimeMs = executionTimes[Math.floor(executionTimes.length * 0.99)] ?? 0;

  const successRate = (successCount / totalEvents) * 100;

  // 타입별 slowest / mostReliable
  const typeEntries = Object.entries(typeMetrics);
  const slowestType = typeEntries.reduce((prev, curr) =>
    (curr[1].avgTime ?? 0) > (prev[1].avgTime ?? 0) ? curr : prev
  );
  const mostReliableType = typeEntries.reduce((prev, curr) => {
    const prevRate = prev[1].total > 0 ? (prev[1].success / prev[1].total) * 100 : 0;
    const currRate = curr[1].total > 0 ? (curr[1].success / curr[1].total) * 100 : 0;
    return currRate > prevRate ? curr : prev;
  });

  // 비용 추정 (1000개 이벤트당 $0.01 기준)
  const costPerEvent = 0.00001;
  const periodDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const estimatedMonthlyCost = (totalEvents / periodDays) * 30 * costPerEvent;
  const estimatedMonthlyErrors = (failureCount / totalEvents) * (totalEvents / periodDays) * 30;

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalEvents,
    successCount,
    failureCount,
    successRate: Math.round(successRate * 100) / 100,
    avgExecutionTimeMs: Math.round(avgExecutionTimeMs * 100) / 100,
    p50ExecutionTimeMs: Math.round(p50ExecutionTimeMs * 100) / 100,
    p95ExecutionTimeMs: Math.round(p95ExecutionTimeMs * 100) / 100,
    p99ExecutionTimeMs: Math.round(p99ExecutionTimeMs * 100) / 100,
    totalRetries,
    autoRetrySuccessRate: Math.round(autoRetrySuccessRate * 100) / 100,
    estimatedWeeklyVolume: Math.round((totalEvents / periodDays) * 7),
    estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100,
    costPerEvent,
    estimatedMonthlyErrors: Math.round(estimatedMonthlyErrors),
    errorRate: Math.round((failureCount / totalEvents) * 100 * 100) / 100,
    peakHour: peakHourStr,
    peakHourVolume,
    slowestType: slowestType[0],
    slowestTypeAvgTime: Math.round((slowestType[1].avgTime ?? 0) * 100) / 100,
    mostReliableType: mostReliableType[0],
    mostReliableTypeSuccessRate: Math.round(
      ((mostReliableType[1].success / mostReliableType[1].total) * 100) * 100
    ) / 100,
  };
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
