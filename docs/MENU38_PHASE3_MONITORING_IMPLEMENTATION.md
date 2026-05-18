# Menu #38 Phase 3 - 모니터링 & 검증 구현 가이드

**작성일**: 2026-05-18  
**대상**: 개발팀  
**범위**: Sentry + 자동 검증 + 대시보드

---

## 1. Sentry 알림 설정

### 1.1 기본 설정 (src/lib/telemetry/phase3-monitoring.ts)

```typescript
/**
 * Menu #38 Phase 3 모니터링
 * 
 * 목적:
 * - Phase 3a: ExecutionLog 병행 운영 중 오류 추적
 * - Phase 3b: 완전 전환 후 데이터 정합성 모니터링
 * - 자동 롤백: 심각 오류 시 즉시 복구
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 3a: 병행 운영 모니터링
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function capturePhase3aExecutionLogError(
  error: Error,
  context: {
    campaignId: string;
    operation: 'write' | 'read' | 'union';
    recordCount?: number;
  }
) {
  const severity =
    context.operation === 'write' ? 'error' : 'warning';

  Sentry.captureException(error, {
    level: severity,
    tags: {
      phase: '3a',
      operation: context.operation,
      service: 'menu38_campaigns',
    },
    extra: {
      campaignId: context.campaignId,
      recordCount: context.recordCount,
      timestamp: new Date().toISOString(),
    },
  });

  logger.error('[Phase3a] ExecutionLog 오류', {
    operation: context.operation,
    campaignId: context.campaignId,
    error: error.message,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 성능 모니터링
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function monitorQueryPerformance(
  phase: '3a' | '3b',
  queryType: 'union' | 'execution_log' | 'sending_history',
  duration: number
) {
  // 느린 쿼리 경고
  const thresholds = {
    union: 500, // ms
    execution_log: 200,
    sending_history: 150,
  };

  const threshold = thresholds[queryType];

  if (duration > threshold) {
    Sentry.captureMessage(`[${phase}] 느린 쿼리 감지: ${queryType}`, {
      level: 'warning',
      tags: {
        phase,
        queryType,
        duration: Math.round(duration),
      },
    });

    logger.warn('[Phase3 Performance]', {
      phase,
      queryType,
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 데이터 일관성 모니터링
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DataConsistencyAlert {
  type: 'row_count' | 'status_distribution' | 'failure_rate';
  severity: 'error' | 'warning';
  message: string;
  legacy: number;
  current: number;
  difference: number;
  percentDifference: number;
}

export function captureDataInconsistency(alert: DataConsistencyAlert) {
  const levelMap: Record<AlertSeverity, Sentry.SeverityLevel> = {
    error: 'error',
    warning: 'warning',
  };

  Sentry.captureMessage(alert.message, {
    level: levelMap[alert.severity],
    tags: {
      phase: '3a_3b',
      alertType: alert.type,
    },
    extra: {
      legacy: alert.legacy,
      current: alert.current,
      difference: alert.difference,
      percentDifference: alert.percentDifference.toFixed(2) + '%',
      timestamp: new Date().toISOString(),
    },
  });

  logger.warn('[DataConsistency]', {
    type: alert.type,
    severity: alert.severity,
    legacy: alert.legacy,
    current: alert.current,
    diff: alert.difference,
    percentDiff: alert.percentDifference.toFixed(2) + '%',
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enum 변환 오류
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function captureEnumConversionError(
  source: 'status' | 'failureReason',
  sourceValue: string,
  recordId: string
) {
  Sentry.captureMessage(`[CRITICAL] Enum 변환 오류: ${source}`, {
    level: 'error',
    tags: {
      phase: '3a_3b',
      errorType: 'enum_conversion',
      source,
    },
    extra: {
      sourceValue,
      recordId,
      timestamp: new Date().toISOString(),
    },
  });

  logger.error('[EnumConversion] 오류', {
    source,
    sourceValue,
    recordId,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API 오류율
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let errorCountWindow: { timestamp: number; error: boolean }[] = [];
const WINDOW_SIZE = 1000; // 최근 1000개 요청
const ERROR_RATE_THRESHOLD = 0.01; // 1%

export function trackApiError(error: boolean) {
  errorCountWindow.push({
    timestamp: Date.now(),
    error,
  });

  // 윈도우 크기 유지
  if (errorCountWindow.length > WINDOW_SIZE) {
    errorCountWindow = errorCountWindow.slice(-WINDOW_SIZE);
  }

  // 오류율 계산
  const errorCount = errorCountWindow.filter(r => r.error).length;
  const errorRate = errorCount / errorCountWindow.length;

  if (errorRate > ERROR_RATE_THRESHOLD) {
    Sentry.captureMessage('[ALERT] API 오류율 증가', {
      level: 'error',
      tags: {
        phase: '3a_3b',
        alertType: 'api_error_rate',
      },
      extra: {
        errorRate: (errorRate * 100).toFixed(2) + '%',
        errorCount,
        windowSize: errorCountWindow.length,
      },
    });

    logger.error('[ApiErrorRate]', {
      errorRate: (errorRate * 100).toFixed(2) + '%',
      errorCount,
      threshold: (ERROR_RATE_THRESHOLD * 100) + '%',
    });
  }
}
```

### 1.2 Sentry 알림 규칙 설정

**Sentry Dashboard → Alerts → New Alert Rule**

```
Rule 1: Phase 3a ExecutionLog 쓰기 실패
├─ Condition: Exception + tags.phase="3a" + tags.operation="write"
├─ Frequency: 1회 이상
├─ Action: Slack #phase3-monitoring + Email

Rule 2: UNION 쿼리 느림
├─ Condition: Message + "느린 쿼리" + duration > 500ms
├─ Frequency: 5건 이상 (1시간)
├─ Action: Slack #phase3-monitoring

Rule 3: Enum 변환 오류 (긴급)
├─ Condition: Exception + tags.errorType="enum_conversion"
├─ Frequency: 1회 이상
├─ Action: Slack #phase3-critical + Email (긴급)

Rule 4: API 오류율 증가
├─ Condition: Message + "API 오류율" + errorRate > 1%
├─ Frequency: 1회
├─ Action: Slack #phase3-monitoring + PagerDuty
```

---

## 2. 자동 검증 스크립트

### 2.1 일일 검증 스크립트 (src/scripts/validate-phase3-daily.ts)

```typescript
/**
 * 매일 06:00 (UTC+9)에 자동 실행되는 검증 스크립트
 * 
 * Cron: 0 21 * * * (UTC) = 0 6 * * * (KST)
 * 
 * 검증 항목:
 * 1. 행 수 비교
 * 2. 상태 분포 비교
 * 3. 실패율 비교
 * 4. NULL 값 분포
 * 5. API 응답 시간
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { captureDataInconsistency } from '@/lib/telemetry/phase3-monitoring';
import * as Sentry from '@sentry/nextjs';

interface ValidationReport {
  timestamp: Date;
  phase: '3a' | '3b';
  checks: {
    rowCount: RowCountCheck;
    statusDistribution: StatusDistributionCheck;
    failureRate: FailureRateCheck;
    nullDistribution: NullDistributionCheck;
    apiPerformance: ApiPerformanceCheck;
  };
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  alerts: DataConsistencyAlert[];
  recommendation: string;
}

interface RowCountCheck {
  name: 'row_count';
  status: 'PASS' | 'WARN' | 'FAIL';
  legacyCount: number;
  executionLogCount: number;
  difference: number;
  percentDifference: number;
}

// ... 더 많은 인터페이스

export async function validatePhase3Daily(): Promise<ValidationReport> {
  const report: ValidationReport = {
    timestamp: new Date(),
    phase: (await getPhase()) as '3a' | '3b',
    checks: {} as any,
    overallStatus: 'PASS',
    alerts: [],
    recommendation: 'Continue with current phase',
  };

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 행 수 비교
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const yesterday = subDays(startOfDay(new Date()), 1);
    
    const legacyCount = await prisma.sendingHistory.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: startOfDay(new Date()),
        },
      },
    });

    const executionLogCount = await prisma.executionLog.count({
      where: {
        scheduledAt: {
          gte: yesterday,
          lt: startOfDay(new Date()),
        },
        sourceType: 'CAMPAIGN',
      },
    });

    const rowDifference = Math.abs(legacyCount - executionLogCount);
    const rowPercentDiff = legacyCount > 0 
      ? (rowDifference / legacyCount) * 100 
      : 0;

    report.checks.rowCount = {
      name: 'row_count',
      status: rowPercentDiff < 1 ? 'PASS' : rowPercentDiff < 5 ? 'WARN' : 'FAIL',
      legacyCount,
      executionLogCount,
      difference: rowDifference,
      percentDifference: rowPercentDiff,
    };

    if (report.checks.rowCount.status !== 'PASS') {
      report.alerts.push({
        type: 'row_count',
        severity: report.checks.rowCount.status === 'WARN' ? 'warning' : 'error',
        message: `행 수 불일치: Legacy ${legacyCount} vs ExecutionLog ${executionLogCount}`,
        legacy: legacyCount,
        current: executionLogCount,
        difference: rowDifference,
        percentDifference: rowPercentDiff,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 상태 분포 비교
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const legacyStatuses = await prisma.sendingHistory.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: yesterday,
          lt: startOfDay(new Date()),
        },
      },
      _count: { id: true },
    });

    const execStatuses = await prisma.executionLog.groupBy({
      by: ['status'],
      where: {
        scheduledAt: {
          gte: yesterday,
          lt: startOfDay(new Date()),
        },
        sourceType: 'CAMPAIGN',
      },
      _count: { id: true },
    });

    const statusComparison = compareStatusDistribution(legacyStatuses, execStatuses);
    
    report.checks.statusDistribution = {
      name: 'status_distribution',
      status: statusComparison.maxDiff < 2 ? 'PASS' : 'WARN',
      legacy: legacyStatuses,
      current: execStatuses,
      maxDifference: statusComparison.maxDiff,
    };

    if (statusComparison.maxDiff >= 2) {
      report.alerts.push({
        type: 'status_distribution',
        severity: 'warning',
        message: `상태 분포 편차: 최대 ${statusComparison.maxDiff.toFixed(2)}%`,
        legacy: legacyCount,
        current: executionLogCount,
        difference: 0,
        percentDifference: statusComparison.maxDiff,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 실패율 비교
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const legacyFailedCount = await prisma.sendingHistory.count({
      where: {
        createdAt: { gte: yesterday, lt: startOfDay(new Date()) },
        status: 'FAILED',
      },
    });

    const execFailedCount = await prisma.executionLog.count({
      where: {
        scheduledAt: { gte: yesterday, lt: startOfDay(new Date()) },
        sourceType: 'CAMPAIGN',
        status: 'FAILED',
      },
    });

    const legacyFailureRate = legacyCount > 0 ? (legacyFailedCount / legacyCount) * 100 : 0;
    const execFailureRate = executionLogCount > 0 ? (execFailedCount / executionLogCount) * 100 : 0;
    const failureRateDiff = Math.abs(legacyFailureRate - execFailureRate);

    report.checks.failureRate = {
      name: 'failure_rate',
      status: failureRateDiff < 5 ? 'PASS' : 'WARN',
      legacy: legacyFailureRate,
      current: execFailureRate,
      difference: failureRateDiff,
    };

    if (failureRateDiff >= 5) {
      report.alerts.push({
        type: 'failure_rate',
        severity: 'warning',
        message: `실패율 편차: Legacy ${legacyFailureRate.toFixed(2)}% vs ExecutionLog ${execFailureRate.toFixed(2)}%`,
        legacy: Math.round(legacyFailureRate),
        current: Math.round(execFailureRate),
        difference: Math.round(failureRateDiff),
        percentDifference: failureRateDiff,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. NULL 값 분포
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const nullStats = await prisma.$queryRaw<Array<{ field: string; null_count: number }>>`
      SELECT 
        'messageId' as field, 
        COUNT(CASE WHEN messageId IS NULL THEN 1 END) as null_count
      FROM "ExecutionLog"
      WHERE sourceType = 'CAMPAIGN' 
      AND scheduledAt >= ${yesterday}
      UNION ALL
      SELECT 
        'sentAt' as field,
        COUNT(CASE WHEN sentAt IS NULL THEN 1 END) as null_count
      FROM "ExecutionLog"
      WHERE sourceType = 'CAMPAIGN'
      AND scheduledAt >= ${yesterday}
    `;

    report.checks.nullDistribution = {
      name: 'null_distribution',
      status: 'PASS', // 정보용
      nullStats,
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. API 응답 시간 (메트릭에서 수집)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const apiMetrics = await getApiMetricsFromDatadog(); // DataDog 조회
    
    report.checks.apiPerformance = {
      name: 'api_performance',
      status: apiMetrics.p95 < 300 ? 'PASS' : 'WARN',
      p50: apiMetrics.p50,
      p95: apiMetrics.p95,
      p99: apiMetrics.p99,
      errorRate: apiMetrics.errorRate,
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 종합 판정 & 추천
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const failCount = Object.values(report.checks).filter(c => c.status === 'FAIL').length;
    const warnCount = Object.values(report.checks).filter(c => c.status === 'WARN').length;

    if (failCount > 0) {
      report.overallStatus = 'FAIL';
      report.recommendation = '[긴급] Phase 3 롤백 검토 필요';
    } else if (warnCount > 0) {
      report.overallStatus = 'WARN';
      report.recommendation = '주의: 추적 계속 필요. 내일 재검증 예정.';
    } else {
      report.overallStatus = 'PASS';
      report.recommendation = 'Phase 3 정상 진행. 계획대로 계속 진행.';
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 저장 & 알림
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await saveValidationReport(report);

    // 문제 시 Sentry 알림
    for (const alert of report.alerts) {
      captureDataInconsistency(alert);
    }

    // 실패 시 긴급 알림
    if (report.overallStatus === 'FAIL') {
      Sentry.captureMessage('[CRITICAL] Phase 3 검증 실패 - 즉시 조치 필요', {
        level: 'fatal',
        tags: { phase: report.phase, alertType: 'validation_failed' },
        extra: { report },
      });

      // Slack 긴급 알림
      await notifySlack('#phase3-critical', {
        text: '[CRITICAL] Phase 3 검증 실패',
        attachments: [{
          color: 'danger',
          fields: report.alerts.map(alert => ({
            title: alert.type,
            value: alert.message,
            short: false,
          })),
        }],
      });
    }

    logger.info('[Validation] Phase 3 일일 검증 완료', {
      phase: report.phase,
      status: report.overallStatus,
      alertCount: report.alerts.length,
    });

    return report;

  } catch (err) {
    logger.error('[Validation] Phase 3 검증 실패', { err });
    Sentry.captureException(err, {
      level: 'error',
      tags: { type: 'phase3_validation' },
    });
    throw err;
  }
}

// Helper functions
function compareStatusDistribution(
  legacy: any[],
  current: any[]
): { maxDiff: number } {
  const legacyMap = new Map(legacy.map(s => [s.status, s._count.id]));
  const currentMap = new Map(current.map(s => [s.status, s._count.id]));

  let maxDiff = 0;
  const allStatuses = new Set([...legacyMap.keys(), ...currentMap.keys()]);

  for (const status of allStatuses) {
    const legacyCount = legacyMap.get(status) || 0;
    const currentCount = currentMap.get(status) || 0;
    const totalCount = Math.max(legacyCount, currentCount);
    
    if (totalCount > 0) {
      const diff = Math.abs(legacyCount - currentCount) / totalCount * 100;
      maxDiff = Math.max(maxDiff, diff);
    }
  }

  return { maxDiff };
}

async function saveValidationReport(report: ValidationReport) {
  await prisma.phase3ValidationReport.create({
    data: {
      timestamp: report.timestamp,
      phase: report.phase,
      overallStatus: report.overallStatus,
      checks: JSON.stringify(report.checks),
      alerts: JSON.stringify(report.alerts),
      recommendation: report.recommendation,
    },
  });
}

async function getApiMetricsFromDatadog() {
  // DataDog API 호출
  // 또는 로컬 메트릭에서 수집
  return {
    p50: 100,
    p95: 250,
    p99: 500,
    errorRate: 0.5, // %
  };
}

async function notifySlack(channel: string, message: any) {
  // Slack Webhook 호출
  // 구현 생략
}

function getPhase(): Promise<string> {
  // Feature flag에서 현재 Phase 조회
  return Promise.resolve('3a');
}

// Utility
function subDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
```

### 2.2 Cron Job 등록

**src/app/api/cron/validate-phase3/route.ts**:
```typescript
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // CRON_SECRET 검증 (Vercel 보안)
  const secret = req.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const report = await validatePhase3Daily();
    
    return Response.json({
      ok: true,
      status: report.overallStatus,
      timestamp: report.timestamp,
      alerts: report.alerts.length,
      recommendation: report.recommendation,
    });
  } catch (err) {
    logger.error('[Cron] Phase 3 검증 실패', { err });
    return Response.json(
      { ok: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
```

**vercel.json**:
```json
{
  "crons": [{
    "path": "/api/cron/validate-phase3",
    "schedule": "0 21 * * *"
  }]
}
```

---

## 3. 모니터링 대시보드

### 3.1 대시보드 페이지 (src/app/(dashboard)/campaigns/phase3-monitoring/page.tsx)

```typescript
import React, { Suspense } from 'react';
import { requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getLatestValidationReport() {
  return await prisma.phase3ValidationReport.findFirst({
    orderBy: { timestamp: 'desc' },
  });
}

async function getRecentAlerts() {
  return await prisma.phase3ValidationReport.findMany({
    where: {
      alerts: { not: '' },
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });
}

function StatusBadge({ status }: { status: 'PASS' | 'WARN' | 'FAIL' }) {
  const colors: Record<string, string> = {
    PASS: 'bg-green-100 text-green-800',
    WARN: 'bg-yellow-100 text-yellow-800',
    FAIL: 'bg-red-100 text-red-800',
  };

  const icons = {
    PASS: '✓',
    WARN: '⚠',
    FAIL: '✗',
  };

  return (
    <span className={`px-3 py-1 rounded-full font-semibold ${colors[status]}`}>
      {icons[status]} {status}
    </span>
  );
}

export default async function Phase3MonitoringPage() {
  const latestReport = await getLatestValidationReport();
  const recentAlerts = await getRecentAlerts();

  const checks = latestReport?.checks 
    ? JSON.parse(latestReport.checks as string)
    : null;

  return (
    <div className="space-y-6">
      {/* 제목 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu #38 Phase 3 모니터링</h1>
        <div className="text-sm text-gray-600">
          마지막 검증: {latestReport?.timestamp?.toLocaleString('ko-KR')}
        </div>
      </div>

      {/* 전체 상태 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">전체 상태</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 mb-2">현재 상태</p>
            <StatusBadge status={latestReport?.overallStatus as any} />
          </div>
          <div className="text-right">
            <p className="text-gray-600 mb-2">추천 조치</p>
            <p className="font-semibold">{latestReport?.recommendation}</p>
          </div>
        </div>
      </div>

      {/* 검증 항목 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 행 수 비교 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">행 수 비교</h3>
          {checks?.rowCount && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">SendingHistory</span>
                  <span className="font-semibold">{checks.rowCount.legacyCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ExecutionLog</span>
                  <span className="font-semibold">{checks.rowCount.executionLogCount}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">차이</span>
                    <span className="font-semibold">{checks.rowCount.percentDifference.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <StatusBadge status={checks.rowCount.status} />
              </div>
            </>
          )}
        </div>

        {/* 상태 분포 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">상태 분포</h3>
          {checks?.statusDistribution && (
            <>
              <div className="space-y-2">
                <p className="text-xs text-gray-600 mb-2">최대 편차: {checks.statusDistribution.maxDifference.toFixed(2)}%</p>
              </div>
              <div className="mt-4">
                <StatusBadge status={checks.statusDistribution.status} />
              </div>
            </>
          )}
        </div>

        {/* 실패율 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">실패율</h3>
          {checks?.failureRate && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">SendingHistory</span>
                  <span className="font-semibold">{checks.failureRate.legacy.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ExecutionLog</span>
                  <span className="font-semibold">{checks.failureRate.current.toFixed(2)}%</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">편차</span>
                    <span className="font-semibold">{checks.failureRate.difference.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <StatusBadge status={checks.failureRate.status} />
              </div>
            </>
          )}
        </div>

        {/* API 성능 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">API 응답 시간</h3>
          {checks?.apiPerformance && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">p50</span>
                  <span className="font-semibold">{checks.apiPerformance.p50}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">p95</span>
                  <span className="font-semibold">{checks.apiPerformance.p95}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">p99</span>
                  <span className="font-semibold">{checks.apiPerformance.p99}ms</span>
                </div>
              </div>
              <div className="mt-4">
                <StatusBadge status={checks.apiPerformance.status} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 최근 알림 */}
      {recentAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">최근 알림</h2>
          <div className="space-y-3">
            {recentAlerts.map((report) => {
              const alerts = JSON.parse(report.alerts as string);
              return alerts.map((alert: any, idx: number) => (
                <div
                  key={`${report.id}-${idx}`}
                  className="p-3 bg-yellow-50 border-l-4 border-yellow-400"
                >
                  <p className="font-semibold text-sm">{alert.type}</p>
                  <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    {report.timestamp?.toLocaleString('ko-KR')}
                  </p>
                </div>
              ));
            })}
          </div>
        </div>
      )}

      {/* 긴급 롤백 버튼 */}
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">긴급 롤백</h2>
        <p className="text-sm text-red-700 mb-4">
          심각한 문제 발생 시 즉시 Phase 2로 복구합니다.
        </p>
        <button
          onClick={() => {
            if (confirm('Phase 3을(를) 즉시 롤백하시겠습니까? (1분 내 복구 가능)')) {
              // API 호출
              fetch('/api/admin/phase3-rollback', { method: 'POST' });
            }
          }}
          className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
        >
          🚨 즉시 롤백 (Phase 3a/3b → Phase 2)
        </button>
      </div>
    </div>
  );
}
```

---

## 4. 롤백 자동화

### 4.1 자동 롤백 API (src/app/api/admin/phase3-rollback/route.ts)

```typescript
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // 관리자 권한 확인
    const ctx = await getAuthContext();
    if (ctx.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Feature flag 비활성화
    await disablePhase3();

    // Sentry P0 알림
    Sentry.captureMessage('[ROLLBACK] Phase 3 롤백 실행', {
      level: 'error',
      tags: { type: 'admin_rollback' },
    });

    // Slack 알림
    await notifySlack('#phase3-critical', {
      text: '[ROLLBACK] Phase 3 즉시 롤백 실행됨',
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🚨 Phase 3 롤백 실행*\n시간: ' + new Date().toLocaleString('ko-KR'),
        },
      }],
    });

    logger.info('[ROLLBACK] Phase 3 롤백 완료', {
      timestamp: new Date(),
    });

    return NextResponse.json({
      ok: true,
      message: 'Phase 3 롤백 완료. 1분 내 API 복구됨.',
      timestamp: new Date(),
    });

  } catch (err) {
    logger.error('[ROLLBACK] 롤백 실패', { err });
    return NextResponse.json(
      { ok: false, error: 'Rollback failed' },
      { status: 500 }
    );
  }
}

async function disablePhase3() {
  // Feature flag 업데이트 (LaunchDarkly, 환경변수, 또는 DB)
  await prisma.featureFlag.update({
    where: { name: 'PHASE3_EXECUTION_LOG' },
    data: { enabled: false },
  });

  // API 자동 롤백 (이미 코드에 있음)
  // getUnifiedSendingHistory()의 try-catch가 작동
}
```

---

## 5. 다음 단계

### 구현 순서:

1. **Day -3 (월)**:
   - [ ] Sentry 알림 규칙 설정
   - [ ] src/lib/telemetry/phase3-monitoring.ts 구현
   - [ ] 검증 리포트 테이블 생성 (Prisma migration)

2. **Day -2 (화)**:
   - [ ] src/scripts/validate-phase3-daily.ts 구현
   - [ ] Cron job 등록 (vercel.json)
   - [ ] 로컬 테스트 (npm run script:validate-phase3-daily)

3. **Day -1 (수)**:
   - [ ] 대시보드 페이지 구현
   - [ ] 롤백 API 구현
   - [ ] E2E 테스트

4. **Day 0 (목)**:
   - [ ] 배포 (기존 배포 후)
   - [ ] 모니터링 시작

---

## 참고

- Phase 3a: Day 1-7 (UNION 병행)
- Phase 3b: Day 8-14 (ExecutionLog 완전 전환)
- Phase 3c: Day 15+ (정리)

상세: [MENU38_PHASE3_DATA_CONSISTENCY_STRATEGY.md](./MENU38_PHASE3_DATA_CONSISTENCY_STRATEGY.md)
