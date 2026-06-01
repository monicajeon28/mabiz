'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/hooks/useSession';
import {
  TrendingUp,
  Activity,
  MessageSquare,
  Users,
  BarChart3,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Signal,
  RefreshCw,
} from 'lucide-react';
import { useKpiSocket } from '@/lib/realtime/kpi-socket';
import { RealtimeMetrics } from '@/lib/realtime/kpi-socket';
import { logger } from '@/lib/logger';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

export default function RealtimeDashboard() {
  const session = useSession();
  const { isConnected, metrics } = useKpiSocket();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'charts' | 'health'>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Update timestamp when metrics change
  useEffect(() => {
    if (metrics) {
      setLastUpdated(new Date());
    }
  }, [metrics]);

  const revenueGrowth = useMemo(() => {
    if (!metrics || metrics.yesterdayRevenue === 0) return 0;
    return ((metrics.todayRevenue - metrics.yesterdayRevenue) / metrics.yesterdayRevenue) * 100;
  }, [metrics]);

  if (!session?.organizationId) {
    return <div className="flex items-center justify-center h-screen">로그인이 필요합니다</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">실시간 KPI 대시보드</h1>
            <p className="text-sm text-slate-600 mt-2">
              {new Date().toLocaleDateString('ko-KR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Connection Status */}
          <div
            className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
              isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-orange-100 text-orange-800'
            }`}
          >
            <Signal className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isConnected ? '실시간 연결됨' : '폴링 모드'}
            </span>
            <span className="text-xs text-white px-2 py-1 bg-current rounded-full">
              {isConnected ? '5초' : '60초'} 갱신
            </span>
          </div>
        </div>

        {/* Update Info */}
        <div className="mt-4 text-xs text-slate-500">
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
          {!isConnected && ' (폴링 중...)'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {(['overview', 'charts', 'health'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              selectedTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'overview' && '개요'}
            {tab === 'charts' && '상세분석'}
            {tab === 'health' && '시스템 상태'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && <OverviewTab metrics={metrics} revenueGrowth={revenueGrowth} />}
      {selectedTab === 'charts' && <ChartsTab metrics={metrics} />}
      {selectedTab === 'health' && <HealthTab metrics={metrics} />}
    </div>
  );
}

function OverviewTab({
  metrics,
  revenueGrowth,
}: {
  metrics: RealtimeMetrics | null;
  revenueGrowth: number;
}) {
  return (
    <div className="space-y-6">
      {/* Hero Metrics - Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="오늘 매출"
          value={`$${(metrics?.todayRevenue || 0).toLocaleString('en-US')}`}
          sub={`어제: $${(metrics?.yesterdayRevenue || 0).toLocaleString('en-US')}`}
          change={revenueGrowth}
          icon={<TrendingUp className="w-5 h-5" />}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />

        <MetricCard
          title="실시간 전환율"
          value={`${(metrics?.lastHourConversion || 0).toFixed(1)}%`}
          sub="최근 1시간"
          icon={<Activity className="w-5 h-5" />}
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />

        <MetricCard
          title="활성 시퀀스"
          value={`${metrics?.activeDaySequences || 0}`}
          sub="Day 0-3 진행 중"
          icon={<Zap className="w-5 h-5" />}
          color="bg-gradient-to-br from-amber-500 to-amber-600"
        />

        <MetricCard
          title="상위 렌즈"
          value={metrics?.topLenses?.[0]?.lens || 'N/A'}
          sub={`${metrics?.topLenses?.[0]?.count || 0}명`}
          icon={<BarChart3 className="w-5 h-5" />}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
      </div>

      {/* Channel Performance */}
      <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          채널별 성과
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ChannelMetric
            name="SMS"
            sent={metrics?.channelMetrics?.sms?.sent || 0}
            opened={metrics?.channelMetrics?.sms?.opened || 0}
            clicked={metrics?.channelMetrics?.sms?.clicked || 0}
            color="text-blue-600"
          />
          <ChannelMetric
            name="카카오톡"
            sent={metrics?.channelMetrics?.kakao?.sent || 0}
            opened={metrics?.channelMetrics?.kakao?.opened || 0}
            clicked={metrics?.channelMetrics?.kakao?.clicked || 0}
            color="text-yellow-600"
          />
          <ChannelMetric
            name="이메일"
            sent={metrics?.channelMetrics?.email?.sent || 0}
            opened={metrics?.channelMetrics?.email?.opened || 0}
            clicked={metrics?.channelMetrics?.email?.clicked || 0}
            color="text-slate-600"
          />
        </div>
      </div>

      {/* Top Partners */}
      <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          오늘의 파트너 랭킹
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">순위</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">파트너명</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">매출</th>
              </tr>
            </thead>
            <tbody>
              {metrics?.partnerLeaderboard?.map((partner, idx) => (
                <tr key={partner.affiliateCode} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">{partner.name}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">
                    ${partner.saleAmount.toLocaleString('en-US')}
                  </td>
                </tr>
              ))}
              {!metrics?.partnerLeaderboard?.length && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    파트너 데이터 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#14B8A6'];

function ChartsTab({ metrics }: { metrics: RealtimeMetrics | null }) {
  const revenueData = [
    { name: '어제', revenue: metrics?.yesterdayRevenue ?? 0 },
    { name: '오늘', revenue: metrics?.todayRevenue ?? 0 },
  ];

  const channelData = [
    { name: 'SMS',   발송: metrics?.channelMetrics?.sms?.sent ?? 0,   오픈: metrics?.channelMetrics?.sms?.opened ?? 0,   클릭: metrics?.channelMetrics?.sms?.clicked ?? 0 },
    { name: '카카오', 발송: metrics?.channelMetrics?.kakao?.sent ?? 0,  오픈: metrics?.channelMetrics?.kakao?.opened ?? 0,  클릭: metrics?.channelMetrics?.kakao?.clicked ?? 0 },
    { name: '이메일', 발송: metrics?.channelMetrics?.email?.sent ?? 0,  오픈: metrics?.channelMetrics?.email?.opened ?? 0,  클릭: metrics?.channelMetrics?.email?.clicked ?? 0 },
  ];

  const lensData = (metrics?.topLenses ?? []).slice(0, 8).map(l => ({
    name: l.lens,
    count: l.count,
  }));

  const conversionData = [
    { name: '지난시간', value: Math.max(0, (metrics?.lastHourConversion ?? 0) - 2) },
    { name: '현재',    value: metrics?.lastHourConversion ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매출 비교 */}
        <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 mb-4">매출 트렌드 (어제 vs 오늘)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => [`$${(v as number).toLocaleString()}`, '매출']} />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 전환율 */}
        <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 mb-4">전환율 추이</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v}%`, '전환율']} />
              <Area type="monotone" dataKey="value" stroke="#10B981" fill="#D1FAE5" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 채널별 성과 */}
        <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 mb-4">채널별 성과 비교</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="발송" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="오픈"  fill="#10B981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="클릭" fill="#F59E0B" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 렌즈별 분포 */}
        <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 mb-4">렌즈별 분포 (상위 8개)</h3>
          {lensData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={lensData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {lensData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, '건수']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-slate-400 text-sm">
              렌즈 데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* 렌즈 분포 */}
      <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4">렌즈 분포 (상위 10개)</h3>
        <div className="space-y-3">
          {metrics?.topLenses?.map((lens) => (
            <div key={lens.lens} className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm font-medium text-slate-700">{lens.lens}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (lens.count / (metrics.topLenses?.[0]?.count || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-900 w-12 text-right">
                  {lens.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthTab({ metrics }: { metrics: RealtimeMetrics | null }) {
  return (
    <div className="space-y-6">
      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            크론 작업 상태
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics?.cronHealth || {}).map(([name, health]: [string, any]) => (
              <div
                key={name}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{name}</p>
                  <p className="text-xs text-slate-500">
                    {health.lastRun && new Date(health.lastRun).toLocaleTimeString('ko-KR')}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    health.status === 'healthy'
                      ? 'bg-green-100 text-green-800'
                      : health.status === 'degraded'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {health.status === 'healthy' && <CheckCircle className="w-4 h-4" />}
                  {health.status === 'degraded' && <AlertCircle className="w-4 h-4" />}
                  {health.status === 'error' && <AlertCircle className="w-4 h-4" />}
                  {health.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            데이터베이스 상태
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">쿼리 레이턴시</p>
              <p className="text-2xl font-bold text-slate-900">
                {metrics?.databaseHealth?.queryLatency || 0}ms
              </p>
              <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, (metrics?.databaseHealth?.queryLatency || 0) / 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">활성 연결</p>
              <p className="text-2xl font-bold text-slate-900">
                {metrics?.databaseHealth?.connectionCount || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  sub,
  change,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  sub?: string;
  change?: number;
  icon?: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`${color} text-white rounded-lg shadow-md p-6 border border-white/20`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-white/80">{title}</h3>
        <div className="text-white/60">{icon}</div>
      </div>

      <p className="text-3xl font-bold mb-2">{value}</p>

      <div className="flex items-center justify-between">
        <p className="text-xs text-white/60">{sub}</p>
        {change !== undefined && (
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              change >= 0
                ? 'bg-white/20 text-white'
                : 'bg-red-500/30 text-red-200'
            }`}
          >
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function ChannelMetric({
  name,
  sent,
  opened,
  clicked,
  color,
}: {
  name: string;
  sent: number;
  opened: number;
  clicked: number;
  color: string;
}) {
  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0';
  const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-3">
      <h4 className={`text-sm font-bold ${color}`}>{name}</h4>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-600">발송</span>
          <span className="font-semibold text-slate-900">{sent.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">오픈</span>
          <span className="font-semibold text-slate-900">{opened.toLocaleString()} ({openRate}%)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">클릭</span>
          <span className="font-semibold text-slate-900">{clicked.toLocaleString()} ({clickRate}%)</span>
        </div>
      </div>
    </div>
  );
}

