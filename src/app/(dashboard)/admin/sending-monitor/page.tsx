'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, TrendingDown, BarChart3, PieChart, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type Period = '1d' | '7d' | '30d';

type Metrics = {
  period: Period;
  dateRange: { from: string; to: string };
  summary: {
    totalSent: number;
    totalFailed: number;
    totalSkipped: number;
    totalAbandoned: number;
    successRate: string;
    failureRate: string;
  };
  byChannel: Record<
    string,
    {
      sent: number;
      failed: number;
      skipped: number;
      successRate: string;
    }
  >;
  retryMetrics: {
    totalRetried: number;
    retrySuccess: number;
    retryFailed: number;
    retrySuccessRate: string;
    avgRetries: number;
  };
  failureAnalysis: {
    topReasons: Array<{
      reason: string;
      count: number;
      percent: string;
    }>;
  };
  dlqMetrics: {
    pendingDLQ: number;
    dlqFailureRate: string;
    topDLQSources: Array<{
      source: string;
      count: number;
    }>;
  };
  organizationBreakdown: Array<{
    organizationId: string;
    organizationName: string;
    sent: number;
    failed: number;
    successRate: string;
  }>;
  trends: {
    dailySent: Array<{ date: string; count: number }>;
    dailyFailureRate: Array<{ date: string; rate: string }>;
  };
};

const FAILURE_REASON_LABELS: Record<string, string> = {
  INVALID_EMAIL: '유효하지 않은 이메일',
  INVALID_PHONE: '유효하지 않은 휴대폰',
  OPT_OUT: '수신거부 고객',
  QUOTA_EXCEEDED: '발송 한도 초과',
  SYSTEM_ERROR: 'CRM 시스템 오류',
  PROVIDER_ERROR: '공급자 오류',
  NETWORK_ERROR: '네트워크 오류',
  BOUNCE: '이메일 반송',
  UNKNOWN: '기타',
};

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
];

export default function SendingMonitorPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/sending-metrics?period=${period}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.message || 'Failed to fetch metrics');
        }

        setMetrics(data.metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="mt-4 text-gray-600">데이터를 로드 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">오류가 발생했습니다</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600">데이터를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const periodLabels: Record<Period, string> = {
    '1d': '1일',
    '7d': '7일',
    '30d': '30일',
  };

  const totalProcessed =
    metrics.summary.totalSent +
    metrics.summary.totalFailed +
    metrics.summary.totalSkipped;

  // 실패 원인 차트 데이터
  const failureChartData = metrics.failureAnalysis.topReasons.map(r => ({
    name: FAILURE_REASON_LABELS[r.reason] || r.reason,
    value: r.count,
  }));

  // 조직별 성공률 차트 데이터 (상위 10개)
  const orgChartData = metrics.organizationBreakdown
    .slice(0, 10)
    .map(org => ({
      name: org.organizationName.length > 20
        ? org.organizationName.substring(0, 17) + '...'
        : org.organizationName,
      successRate: parseFloat(org.successRate),
      sent: org.sent,
    }));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">발송 모니터링</h1>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.dateRange.from} ~ {metrics.dateRange.to}
            </p>
          </div>

          {/* 기간 선택 */}
          <div className="flex gap-2">
            {(['1d', '7d', '30d'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
                aria-label={`${periodLabels[p]} 기간 선택`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="총 발송"
            value={metrics.summary.totalSent.toLocaleString()}
            sub={`총 ${totalProcessed.toLocaleString()} 건`}
            icon={<Activity className="h-5 w-5" />}
            color="bg-gradient-to-br from-blue-600 to-blue-700 text-white"
          />
          <KPICard
            title="성공률"
            value={metrics.summary.successRate}
            sub={`${metrics.summary.totalFailed.toLocaleString()} 건 실패`}
            icon={<TrendingDown className="h-5 w-5" />}
            color={
              parseFloat(metrics.summary.successRate) >= 95
                ? 'bg-gradient-to-br from-green-600 to-green-700 text-white'
                : 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
            }
          />
          <KPICard
            title="재시도 성공"
            value={metrics.retryMetrics.retrySuccessRate}
            sub={`${metrics.retryMetrics.totalRetried} 건 재시도`}
            icon={<BarChart3 className="h-5 w-5" />}
            color="bg-gradient-to-br from-purple-600 to-purple-700 text-white"
          />
          <KPICard
            title="DLQ 대기"
            value={metrics.dlqMetrics.pendingDLQ.toString()}
            sub={`${metrics.dlqMetrics.dlqFailureRate}`}
            icon={<AlertCircle className="h-5 w-5" />}
            color={
              metrics.dlqMetrics.pendingDLQ > 100
                ? 'bg-gradient-to-br from-red-600 to-red-700 text-white'
                : 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white'
            }
          />
        </div>

        {/* 채널별 성공률 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">채널별 성공률</h2>
          <div className="space-y-4">
            {Object.entries(metrics.byChannel).map(([channel, data]) => (
              <div key={channel}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">{channel}</span>
                  <span className="text-sm font-bold text-blue-600">
                    {data.successRate}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-600 h-full transition-all"
                    style={{ width: data.successRate }}
                    role="progressbar"
                    aria-valuenow={parseFloat(data.successRate)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{data.sent.toLocaleString()} 발송</span>
                  <span>{data.failed.toLocaleString()} 실패</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 차트 2열 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 실패 원인 분석 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">실패 원인 분석</h2>
            {failureChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie
                  data={failureChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {failureChartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80 text-gray-500">
                실패 데이터가 없습니다.
              </div>
            )}
          </div>

          {/* 발송 추이 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">발송 추이</h2>
            {metrics.trends.dailySent.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.trends.dailySent}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    interval={
                      metrics.trends.dailySent.length > 7 ? 1 : 0
                    }
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="발송"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80 text-gray-500">
                발송 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 조직별 현황 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">조직별 현황</h2>
          {orgChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={orgChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis label={{ value: '성공률 (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Bar dataKey="successRate" fill="#10b981" name="성공률" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-80 text-gray-500">
              조직별 데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 조직별 상세 테이블 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">조직별 상세 현황</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="조직별 발송 현황">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">
                    조직명
                  </th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">
                    발송
                  </th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">
                    실패
                  </th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">
                    성공률
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.organizationBreakdown.length > 0 ? (
                  metrics.organizationBreakdown.map((org, idx) => {
                    const successRate = parseFloat(org.successRate);
                    const isWarning = successRate < 95;
                    return (
                      <tr
                        key={org.organizationId}
                        className={`border-b border-gray-200 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } hover:bg-blue-50 transition-colors`}
                      >
                        <td className="px-6 py-4 text-gray-900 font-medium">
                          {org.organizationName}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {org.sent.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {org.failed.toLocaleString()}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-semibold ${
                            isWarning ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {org.successRate}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      조직별 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DLQ 상태 */}
        {metrics.dlqMetrics.pendingDLQ > 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 mb-2">
                  웹훅 DLQ 대기 중 ({metrics.dlqMetrics.pendingDLQ}건)
                </h3>
                <div className="text-sm text-amber-800 space-y-1">
                  {metrics.dlqMetrics.topDLQSources.map(source => (
                    <p key={source.source}>
                      • {source.source}: {source.count}건
                    </p>
                  ))}
                </div>
                {metrics.dlqMetrics.pendingDLQ > 100 && (
                  <p className="text-sm font-semibold text-red-600 mt-2">
                    경고: 100건 이상 대기 중입니다. 즉시 확인이 필요합니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  sub,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      className={`rounded-lg p-6 ${
        color || 'bg-white border border-gray-200'
      } ${!color ? 'border' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-sm font-medium ${
            color ? 'text-white/80' : 'text-gray-500'
          }`}
        >
          {title}
        </p>
        {icon && (
          <span
            className={color ? 'text-white/60' : 'text-gray-300'}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={`text-3xl font-bold mt-2 ${
          color ? 'text-white' : 'text-gray-900'
        }`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p
          className={`text-xs mt-2 ${
            color ? 'text-white/60' : 'text-gray-400'
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
