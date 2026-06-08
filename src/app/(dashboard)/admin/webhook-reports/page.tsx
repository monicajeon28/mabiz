'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowDown, ArrowUp, BarChart3, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface PerformanceMetrics {
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

interface WeeklyReport {
  weekOf: string;
  metrics: PerformanceMetrics;
  recommendations: string[];
  comparisonWithPreviousWeek: {
    successRateChange: number;
    volumeChange: number;
    latencyChange: number;
  };
}

interface MonthlyReport {
  month: string;
  metrics: PerformanceMetrics;
  trends: Array<{ date: string; rate?: number; volume?: number; latency?: number }>;
  topIssues: Array<{
    type: string;
    successRate: number;
    failureCount: number;
    recommendation: string;
  }>;
  actionItems: string[];
}

type Report = WeeklyReport | MonthlyReport;

export default function WebhookReportsPage() {
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>('weekly');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/webhook-reports?type=${reportType}`, { signal });
      if (!response.ok) throw new Error('리포트를 불러오지 못했습니다');
      const result = await response.json();
      setReport(result.data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchReport(ctrl.signal);
    return () => ctrl.abort();
  }, [reportType]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <BarChart3 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-4 text-gray-600">리포트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!report) return null;

  const metrics = report.metrics;
  const isWeekly = reportType === 'weekly';
  const weeklyReport = report as WeeklyReport;

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">웹훅 성능 리포트</h1>
          <p className="mt-1 text-gray-600">
            {isWeekly ? '주간' : '월간'} 성능 분석 및 개선 권고사항
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={reportType} onValueChange={(v) => setReportType(v as 'weekly' | 'monthly')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">주간 리포트</SelectItem>
              <SelectItem value="monthly">월간 리포트</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => fetchReport()} variant="outline">
            새로고침
          </Button>
        </div>
      </div>

      {/* 리포트 헤더 */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isWeekly ? `${weeklyReport.weekOf} 주간 리포트` : `${(report as MonthlyReport).month} 월간 리포트`}
          </CardTitle>
          <CardDescription>
            기간: {metrics.period}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">전체 이벤트</p>
              <p className="text-2xl font-bold">{metrics.totalEvents.toLocaleString()}건</p>
              {isWeekly && (
                <p className={`text-sm mt-1 ${weeklyReport.comparisonWithPreviousWeek.volumeChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  전주 대비 {weeklyReport.comparisonWithPreviousWeek.volumeChange > 0 ? '+' : ''}
                  {weeklyReport.comparisonWithPreviousWeek.volumeChange}건
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">성공률</p>
              <p className={`text-2xl font-bold ${metrics.successRate >= 99 ? 'text-green-600' : metrics.successRate >= 95 ? 'text-blue-600' : 'text-orange-600'}`}>
                {metrics.successRate.toFixed(2)}%
              </p>
              {isWeekly && (
                <p className={`text-sm mt-1 ${weeklyReport.comparisonWithPreviousWeek.successRateChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  전주 대비 {weeklyReport.comparisonWithPreviousWeek.successRateChange > 0 ? '+' : ''}
                  {weeklyReport.comparisonWithPreviousWeek.successRateChange.toFixed(2)}%
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">평균 지연시간</p>
              <p className="text-2xl font-bold">{metrics.avgExecutionTimeMs.toFixed(0)}ms</p>
              {isWeekly && (
                <p className={`text-sm mt-1 ${weeklyReport.comparisonWithPreviousWeek.latencyChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  전주 대비 {weeklyReport.comparisonWithPreviousWeek.latencyChange > 0 ? '+' : ''}
                  {weeklyReport.comparisonWithPreviousWeek.latencyChange.toFixed(0)}ms
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">월 예상 비용</p>
              <p className="text-2xl font-bold">{metrics.estimatedMonthlyCost.toFixed(0)}원</p>
              <p className="text-sm text-gray-500 mt-1">
                이벤트 100만건당 {(metrics.costPerEvent * 1000000).toFixed(0)}원
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 핵심 성과 지표 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">성공 / 실패</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">성공</p>
                <p className="text-2xl font-bold text-green-600">{metrics.successCount.toLocaleString()}건</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">실패</p>
                <p className="text-2xl font-bold text-red-600">{metrics.failureCount.toLocaleString()}건</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">응답 시간 분포</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>중앙값(P50):</span>
              <span className="font-semibold">{metrics.p50ExecutionTimeMs.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>상위 5%(P95):</span>
              <span className={`font-semibold ${metrics.p95ExecutionTimeMs > 5000 ? 'text-orange-600' : ''}`}>
                {metrics.p95ExecutionTimeMs.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>상위 1%(P99):</span>
              <span className={`font-semibold ${metrics.p99ExecutionTimeMs > 10000 ? 'text-red-600' : ''}`}>
                {metrics.p99ExecutionTimeMs.toFixed(0)}ms
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">자동 재시도 성능</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>총 재시도:</span>
              <span className="font-semibold">{metrics.totalRetries.toLocaleString()}회</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>재시도 성공률:</span>
              <span className={`font-semibold ${metrics.autoRetrySuccessRate >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                {metrics.autoRetrySuccessRate.toFixed(2)}%
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              재시도 기능 {metrics.autoRetrySuccessRate >= 80 ? '정상 작동 중' : '개선 필요'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 피크 시간 및 유형 분석 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">최대 트래픽 시간대</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.peakHour}</div>
            <p className="text-sm text-gray-600 mt-2">
              해당 시간대 {metrics.peakHourVolume.toLocaleString()}건 처리
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">웹훅 유형 분석</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">가장 느린 유형</p>
              <p className="font-semibold">{metrics.slowestType}</p>
              <p className="text-sm text-gray-500">평균 {metrics.slowestTypeAvgTime.toFixed(0)}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">가장 안정적인 유형</p>
              <p className="font-semibold">{metrics.mostReliableType}</p>
              <p className="text-sm text-green-600">성공률 {metrics.mostReliableTypeSuccessRate.toFixed(2)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 개선 권고사항 (주간) */}
      {isWeekly && weeklyReport.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              개선 권고사항
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {weeklyReport.recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 주요 이슈 (월간) */}
      {!isWeekly && (report as MonthlyReport).topIssues.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle>해결해야 할 주요 이슈</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(report as MonthlyReport).topIssues.map((issue, idx) => (
              <div key={idx} className="border-l-4 border-orange-400 pl-3">
                <p className="font-semibold">{issue.type}</p>
                <p className="text-sm text-gray-600">
                  성공률: {issue.successRate.toFixed(2)}% | 실패 {issue.failureCount}건
                </p>
                <p className="text-sm text-blue-600 mt-1">{issue.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 다음 달 실행 항목 (월간) */}
      {!isWeekly && (report as MonthlyReport).actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>다음 달 실행 항목</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(report as MonthlyReport).actionItems.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-sm">
                  <div className="h-4 w-4 rounded border border-blue-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 요약 */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm">요약</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          <p>
            이번 {isWeekly ? '주' : '달'}에는 총{' '}
            <span className="font-semibold">{metrics.totalEvents.toLocaleString()}건</span>의 웹훅 이벤트를 처리했으며, 성공률은{' '}
            <span className="font-semibold">{metrics.successRate.toFixed(2)}%</span>였습니다.
            평균 처리 시간은 <span className="font-semibold">{metrics.avgExecutionTimeMs.toFixed(0)}ms</span>이고,
            재시도 이벤트의 <span className="font-semibold">{metrics.autoRetrySuccessRate.toFixed(2)}%</span>가 성공적으로 처리됐습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
