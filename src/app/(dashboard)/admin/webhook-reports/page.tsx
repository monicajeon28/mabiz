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

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/webhook-reports?type=${reportType}`);
      if (!response.ok) throw new Error('Failed to fetch report');
      const result = await response.json();
      setReport(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <BarChart3 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-4 text-gray-600">Loading report...</p>
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
          <h1 className="text-3xl font-bold">Webhook Performance Reports</h1>
          <p className="mt-1 text-gray-600">
            {isWeekly ? 'Weekly' : 'Monthly'} performance analysis and recommendations
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={reportType} onValueChange={(v) => setReportType(v as 'weekly' | 'monthly')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly Report</SelectItem>
              <SelectItem value="monthly">Monthly Report</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => fetchReport()} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Report Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isWeekly ? `Week of ${weeklyReport.weekOf}` : `Report for ${(report as MonthlyReport).month}`}
          </CardTitle>
          <CardDescription>
            Period: {metrics.period}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-2xl font-bold">{metrics.totalEvents.toLocaleString()}</p>
              {isWeekly && (
                <p className={`text-sm mt-1 ${weeklyReport.comparisonWithPreviousWeek.volumeChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {weeklyReport.comparisonWithPreviousWeek.volumeChange > 0 ? '+' : ''}
                  {weeklyReport.comparisonWithPreviousWeek.volumeChange} from previous week
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className={`text-2xl font-bold ${metrics.successRate >= 99 ? 'text-green-600' : metrics.successRate >= 95 ? 'text-blue-600' : 'text-orange-600'}`}>
                {metrics.successRate.toFixed(2)}%
              </p>
              {isWeekly && (
                <p className={`text-sm mt-1 ${weeklyReport.comparisonWithPreviousWeek.successRateChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {weeklyReport.comparisonWithPreviousWeek.successRateChange > 0 ? '+' : ''}
                  {weeklyReport.comparisonWithPreviousWeek.successRateChange.toFixed(2)}% change
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Latency</p>
              <p className="text-2xl font-bold">{metrics.avgExecutionTimeMs.toFixed(0)}ms</p>
              {isWeekly && (
                <p className={`text-sm mt-1 ${weeklyReport.comparisonWithPreviousWeek.latencyChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {weeklyReport.comparisonWithPreviousWeek.latencyChange > 0 ? '+' : ''}
                  {weeklyReport.comparisonWithPreviousWeek.latencyChange.toFixed(0)}ms change
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Est. Monthly Cost</p>
              <p className="text-2xl font-bold">${metrics.estimatedMonthlyCost.toFixed(2)}</p>
              <p className="text-sm text-gray-500 mt-1">
                ${(metrics.costPerEvent * 1000000).toFixed(2)}/million events
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success vs Failure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-green-600">{metrics.successCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{metrics.failureCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latency Percentiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>P50:</span>
              <span className="font-semibold">{metrics.p50ExecutionTimeMs.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>P95:</span>
              <span className={`font-semibold ${metrics.p95ExecutionTimeMs > 5000 ? 'text-orange-600' : ''}`}>
                {metrics.p95ExecutionTimeMs.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>P99:</span>
              <span className={`font-semibold ${metrics.p99ExecutionTimeMs > 10000 ? 'text-red-600' : ''}`}>
                {metrics.p99ExecutionTimeMs.toFixed(0)}ms
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Auto-Retry Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Retries:</span>
              <span className="font-semibold">{metrics.totalRetries.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Success Rate:</span>
              <span className={`font-semibold ${metrics.autoRetrySuccessRate >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                {metrics.autoRetrySuccessRate.toFixed(2)}%
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Retry mechanisms are {metrics.autoRetrySuccessRate >= 80 ? 'working well' : 'needs improvement'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours and Types */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Peak Activity Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.peakHour}</div>
            <p className="text-sm text-gray-600 mt-2">
              {metrics.peakHourVolume.toLocaleString()} events during peak hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Webhook Type Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Slowest Type</p>
              <p className="font-semibold">{metrics.slowestType}</p>
              <p className="text-sm text-gray-500">{metrics.slowestTypeAvgTime.toFixed(0)}ms avg</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Most Reliable Type</p>
              <p className="font-semibold">{metrics.mostReliableType}</p>
              <p className="text-sm text-green-600">{metrics.mostReliableTypeSuccessRate.toFixed(2)}% success</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {isWeekly && weeklyReport.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recommendations
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

      {/* Top Issues (Monthly) */}
      {!isWeekly && (report as MonthlyReport).topIssues.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle>Top Issues to Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(report as MonthlyReport).topIssues.map((issue, idx) => (
              <div key={idx} className="border-l-4 border-orange-400 pl-3">
                <p className="font-semibold">{issue.type}</p>
                <p className="text-sm text-gray-600">
                  Success Rate: {issue.successRate.toFixed(2)}% | {issue.failureCount} failures
                </p>
                <p className="text-sm text-blue-600 mt-1">{issue.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Items (Monthly) */}
      {!isWeekly && (report as MonthlyReport).actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Action Items for Next Month</CardTitle>
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

      {/* Summary Card */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm">Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          <p>
            This {isWeekly ? 'week' : 'month'} processed {metrics.totalEvents.toLocaleString()} webhook events with a{' '}
            <span className="font-semibold">{metrics.successRate.toFixed(2)}%</span> success rate. Average processing time
            was <span className="font-semibold">{metrics.avgExecutionTimeMs.toFixed(0)}ms</span>, with{' '}
            <span className="font-semibold">{metrics.autoRetrySuccessRate.toFixed(2)}%</span> of retried events succeeding.
            Estimated {isWeekly ? 'monthly' : ''} cost is approximately{' '}
            <span className="font-semibold">${metrics.estimatedMonthlyCost.toFixed(2)}</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
