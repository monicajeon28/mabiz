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

export default function WebhookMonitorPage() {
  const [data, setData] = useState<WebhookMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('7');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async (dayCount: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/webhook-stats-advanced?days=${dayCount}`);
      if (!response.ok) throw new Error('Failed to fetch webhook stats');
      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(days);
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
          <p className="mt-4 text-gray-600">Loading webhook metrics...</p>
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
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100';
      case 'warning':
        return 'bg-yellow-100';
      case 'critical':
        return 'bg-red-100';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Monitoring</h1>
          <p className="mt-1 text-gray-600">Real-time webhook performance tracking and alerts</p>
        </div>
        <div className="flex gap-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          <Button onClick={() => fetchData(days)} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status Card */}
      <Card className={`border-2 ${getStatusBgColor(health.status)}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className={`h-5 w-5 ${getStatusColor(health.status)}`} />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <p className={`text-2xl font-bold ${getStatusColor(health.status)}`}>
              {health.status.toUpperCase()}
            </p>
            <p className="text-gray-600">{health.message}</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">1h Success Rate:</span>
              <span className="font-semibold">{health.metrics.last1hSuccessRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">24h Success Rate:</span>
              <span className="font-semibold">{health.metrics.last24hSuccessRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Latency:</span>
              <span className="font-semibold">{health.metrics.avgLatency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending Events:</span>
              <span className={`font-semibold ${health.metrics.pendingCount > 50 ? 'text-orange-600' : ''}`}>
                {health.metrics.pendingCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitoring.overall.totalEvents.toLocaleString()}</div>
            <p className="text-sm text-gray-500 mt-1">in {monitoring.period.days} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monitoring.overall.successRate >= 95 ? 'text-green-600' : 'text-orange-600'}`}>
              {monitoring.overall.successRate.toFixed(2)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {monitoring.overall.successCount} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Execution Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitoring.overall.avgExecutionTimeMs.toFixed(0)}ms</div>
            <p className="text-sm text-gray-500 mt-1">
              P95: {monitoring.overall.p95ExecutionTimeMs.toFixed(0)}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Retry Success</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monitoring.overall.autoRetrySuccessRate >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
              {monitoring.overall.autoRetrySuccessRate.toFixed(2)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {monitoring.overall.retryRate.toFixed(2)}% retry rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {monitoring.alerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Active Alerts ({monitoring.alerts.length})
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
                      Current: {alert.current.toFixed(2)} | Threshold: {alert.threshold.toFixed(2)}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {monitoring.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Recommendations
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

      {/* Webhook Type Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Type Performance</CardTitle>
          <CardDescription>Success rate and volume by webhook type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">Type</th>
                  <th className="text-right py-2 px-2 font-semibold">Total</th>
                  <th className="text-right py-2 px-2 font-semibold">Success Rate</th>
                  <th className="text-right py-2 px-2 font-semibold">Avg Latency</th>
                  <th className="text-right py-2 px-2 font-semibold">Monthly Volume</th>
                  <th className="text-right py-2 px-2 font-semibold">Total Calls</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(monitoring.byType).map(([type, metrics]) => (
                  <tr key={type} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{type}</td>
                    <td className="text-right py-2 px-2">{metrics.totalEvents.toLocaleString()}</td>
                    <td className="text-right py-2 px-2">
                      <span className={metrics.successRate >= 95 ? 'text-green-600' : 'text-orange-600'}>
                        {metrics.successRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right py-2 px-2">{metrics.avgExecutionTimeMs.toFixed(0)}ms</td>
                    <td className="text-right py-2 px-2">{metrics.estimatedMonthlyVolume.toLocaleString()}</td>
                    <td className="text-right py-2 px-2">{metrics.totalCalls.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily Trend Chart */}
      {monitoring.dailyTrend && monitoring.dailyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Trend</CardTitle>
            <CardDescription>Webhook events and performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-semibold">Date</th>
                    <th className="text-right py-2 px-2 font-semibold">Total Events</th>
                    <th className="text-right py-2 px-2 font-semibold">Success</th>
                    <th className="text-right py-2 px-2 font-semibold">Failed</th>
                    <th className="text-right py-2 px-2 font-semibold">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoring.dailyTrend.map((trend) => (
                    <tr key={trend.date} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">{trend.date}</td>
                      <td className="text-right py-2 px-2">{trend.totalEvents.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-green-600">
                        {trend.successCount.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-2 text-red-600">
                        {trend.failureCount.toLocaleString()}
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

      {/* Last Updated */}
      <div className="text-sm text-gray-500 text-right">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
