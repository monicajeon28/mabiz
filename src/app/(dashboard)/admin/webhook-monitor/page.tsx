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
import { AlertTriangle, CheckCircle, Clock, AlertCircle, TrendingUp, Activity } from 'lucide-react';

interface WebhookMonitoringData {
  health: {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    metrics: {
      last1hSuccessRate: number;
      last24hSuccessRate: number;
      pendingCount: number;
      failedCount: number;
      avgLatency: number;
    };
  };
  monitoring: {
    period: { days: number; since: string; until: string };
    overall: {
      totalEvents: number;
      successCount: number;
      failureCount: number;
      pendingCount: number;
      avgExecutionTimeMs: number;
      p95ExecutionTimeMs: number;
      p99ExecutionTimeMs: number;
      successRate: number;
      retryRate: number;
      autoRetrySuccessRate: number;
    };
    byType: Record<
      string,
      {
        totalEvents: number;
        successCount: number;
        failureCount: number;
        pendingCount: number;
        avgExecutionTimeMs: number;
        successRate: number;
        totalCalls: number;
        estimatedMonthlyVolume: number;
      }
    >;
    alerts: Array<{
      level: 'critical' | 'warning' | 'info';
      message: string;
      metric: string;
      current: number;
      threshold: number;
      timestamp: string;
    }>;
    recommendations: string[];
    dailyTrend?: Array<{
      date: string;
      totalEvents: number;
      successCount: number;
      failureCount: number;
      avgExecutionTimeMs: number;
    }>;
  };
  timestamp: string;
}

const STATUS_KO: Record<string, string> = {
  healthy: '정상',
  warning: '주의',
  critical: '위험',
};

export default function WebhookMonitorPage() {
  const [data, setData] = useState<WebhookMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('7');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async (dayCount: string, signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/webhook-stats-advanced?days=${dayCount}`, { signal });
      if (!response.ok) throw new Error('웹훅 통계를 불러오지 못했습니다');
      const result = await response.json();
      setData(result.data);
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
    fetchData(days, ctrl.signal);
    return () => ctrl.abort();
  }, [days]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchData(days), 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, days]);

  if (loading && !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-4 text-gray-600">웹훅 지표 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const { health, monitoring } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100';
      case 'warning': return 'bg-yellow-100';
      case 'critical': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">웹훅 모니터링</h1>
          <p className="mt-1 text-gray-600">실시간 웹훅 성능 추적 및 알림</p>
        </div>
        <div className="flex gap-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">최근 24시간</SelectItem>
              <SelectItem value="7">최근 7일</SelectItem>
              <SelectItem value="30">최근 30일</SelectItem>
              <SelectItem value="90">최근 90일</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            {autoRefresh ? '자동 갱신 중' : '수동 갱신'}
          </Button>
          <Button onClick={() => fetchData(days)} variant="outline">
            새로고침
          </Button>
        </div>
      </div>

      {/* 시스템 상태 카드 */}
      <Card className={`border-2 ${getStatusBgColor(health.status)}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className={`h-5 w-5 ${getStatusColor(health.status)}`} />
            시스템 상태
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <p className={`text-2xl font-bold ${getStatusColor(health.status)}`}>
              {STATUS_KO[health.status] ?? health.status}
            </p>
            <p className="text-gray-600">{health.message}</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">1시간 성공률:</span>
              <span className="font-semibold">{health.metrics.last1hSuccessRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">24시간 성공률:</span>
              <span className="font-semibold">{health.metrics.last24hSuccessRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">평균 지연시간:</span>
              <span className="font-semibold">{health.metrics.avgLatency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">대기 중 이벤트:</span>
              <span className={`font-semibold ${health.metrics.pendingCount > 50 ? 'text-orange-600' : ''}`}>
                {health.metrics.pendingCount}건
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">전체 이벤트</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitoring.overall.totalEvents.toLocaleString()}건</div>
            <p className="text-sm text-gray-500 mt-1">최근 {monitoring.period.days}일</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">성공률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monitoring.overall.successRate >= 95 ? 'text-green-600' : 'text-orange-600'}`}>
              {monitoring.overall.successRate.toFixed(2)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              성공 {monitoring.overall.successCount.toLocaleString()}건
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">평균 처리 시간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitoring.overall.avgExecutionTimeMs.toFixed(0)}ms</div>
            <p className="text-sm text-gray-500 mt-1">
              상위 5% 기준: {monitoring.overall.p95ExecutionTimeMs.toFixed(0)}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">재시도 성공률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monitoring.overall.autoRetrySuccessRate >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
              {monitoring.overall.autoRetrySuccessRate.toFixed(2)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              재시도율 {monitoring.overall.retryRate.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 알림 */}
      {monitoring.alerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              발생 중인 알림 ({monitoring.alerts.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {monitoring.alerts.map((alert, idx) => (
              <Alert key={idx} variant={alert.level === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex justify-between">
                    <span>{alert.message}</span>
                    <span className="text-sm text-gray-500">
                      현재: {alert.current.toFixed(2)} | 기준: {alert.threshold.toFixed(2)}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 개선 권고사항 */}
      {monitoring.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              개선 권고사항
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {monitoring.recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 웹훅 유형별 성능 */}
      <Card>
        <CardHeader>
          <CardTitle>웹훅 유형별 성능</CardTitle>
          <CardDescription>웹훅 유형별 성공률 및 처리량</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">유형</th>
                  <th className="text-right py-2 px-2 font-semibold">전체</th>
                  <th className="text-right py-2 px-2 font-semibold">성공률</th>
                  <th className="text-right py-2 px-2 font-semibold">평균 지연시간</th>
                  <th className="text-right py-2 px-2 font-semibold">월 예상량</th>
                  <th className="text-right py-2 px-2 font-semibold">총 호출수</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(monitoring.byType).map(([type, metrics]) => (
                  <tr key={type} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{type}</td>
                    <td className="text-right py-2 px-2">{metrics.totalEvents.toLocaleString()}건</td>
                    <td className="text-right py-2 px-2">
                      <span className={metrics.successRate >= 95 ? 'text-green-600' : 'text-orange-600'}>
                        {metrics.successRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right py-2 px-2">{metrics.avgExecutionTimeMs.toFixed(0)}ms</td>
                    <td className="text-right py-2 px-2">{metrics.estimatedMonthlyVolume.toLocaleString()}건</td>
                    <td className="text-right py-2 px-2">{metrics.totalCalls.toLocaleString()}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 일별 추이 */}
      {monitoring.dailyTrend && monitoring.dailyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>일별 추이</CardTitle>
            <CardDescription>날짜별 웹훅 이벤트 및 성능</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-semibold">날짜</th>
                    <th className="text-right py-2 px-2 font-semibold">전체 이벤트</th>
                    <th className="text-right py-2 px-2 font-semibold">성공</th>
                    <th className="text-right py-2 px-2 font-semibold">실패</th>
                    <th className="text-right py-2 px-2 font-semibold">평균 지연시간</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoring.dailyTrend.map((trend) => (
                    <tr key={trend.date} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">{trend.date}</td>
                      <td className="text-right py-2 px-2">{trend.totalEvents.toLocaleString()}건</td>
                      <td className="text-right py-2 px-2 text-green-600">
                        {trend.successCount.toLocaleString()}건
                      </td>
                      <td className="text-right py-2 px-2 text-red-600">
                        {trend.failureCount.toLocaleString()}건
                      </td>
                      <td className="text-right py-2 px-2">{trend.avgExecutionTimeMs.toFixed(0)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 마지막 업데이트 */}
      <div className="text-sm text-gray-500 text-right">
        마지막 업데이트: {new Date(data.timestamp).toLocaleString('ko-KR')}
      </div>
    </div>
  );
}
