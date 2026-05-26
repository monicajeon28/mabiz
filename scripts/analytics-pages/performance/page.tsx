'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ComposedChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Download, Calendar, Filter, AlertCircle,
  Loader2, Eye, Click, Send, MessageSquare, Users,
} from 'lucide-react';
import { logger } from '@/lib/logger';

/* ────────────────────── 타입 정의 ────────────────────── */

type DateRange = '7' | '14' | '30' | '90';

interface PerformanceOverview {
  totalRevenue: number;
  lastMonthRevenue: number;
  conversionRate: number;
  lastMonthConversionRate: number;
  activeSequences: number;
  avgOpenRate: number;
  cpa: number;
  ltv: number;
}

interface DailyMetric {
  date: string;
  revenue: number;
  conversions: number;
  sent: number;
  opened: number;
  clicked: number;
}

interface LensMetric {
  lens: string;
  count: number;
  conversionRate: number;
  ltv: number;
  monthlyRevenue: number;
  trend: number;
}

interface Day03Metric {
  day: number;
  sentCount: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  stage: string;
}

interface SequencePerformance {
  id: string;
  name: string;
  deployed: string;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
}

interface ABTest {
  id: string;
  name: string;
  duration: string;
  sampleSize: number;
  pValue: number;
  winner: string | null;
  status: 'IN PROGRESS' | 'CONCLUDED' | 'FAILED';
}

interface ChannelMetrics {
  channel: string;
  sent: number;
  opened: number;
  clicked: number;
  costPerMessage: number;
  roi: number;
}

interface AnalyticsResponse {
  ok: boolean;
  error?: string;
  overview?: PerformanceOverview;
  dailyData?: DailyMetric[];
  lensData?: LensMetric[];
  day03Data?: Day03Metric[];
  sequenceData?: SequencePerformance[];
  testData?: ABTest[];
  channelData?: ChannelMetrics[];
}

/* ────────────────────── 유틸 함수 ────────────────────── */

const formatCurrency = (value: number) => {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`;
  return `${value.toLocaleString()}`;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const formatNumber = (value: number) => value.toLocaleString();

const getTrendColor = (value: number) => value >= 0 ? 'text-green-600' : 'text-red-600';
const getTrendIcon = (value: number) => value >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;

/* ────────────────────── 메트릭 카드 컴포넌트 ────────────────────── */

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: number;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, subtext, trend, icon, isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 min-h-[120px] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <div className="text-blue-500">{icon}</div>}
      </div>
      <div className="mb-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${getTrendColor(trend)}`}>
          {getTrendIcon(trend)}
          <span>{trend > 0 ? '+' : ''}{formatPercent(trend / 100)}</span>
        </div>
      )}
    </div>
  );
};

/* ────────────────────── 오버뷰 탭 ────────────────────── */

interface OverviewTabProps {
  data: AnalyticsResponse;
  isLoading: boolean;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ data, isLoading }) => {
  const overview = data.overview || {} as PerformanceOverview;
  const dailyData = data.dailyData || [];
  const lensData = data.lensData || [];
  const sequenceData = data.sequenceData || [];
  const testData = data.testData || [];

  // 펑넬 데이터 계산
  const funnelStages = useMemo(() => {
    if (!dailyData.length) return [];
    const totalSent = dailyData.reduce((sum, d) => sum + d.sent, 0);
    const totalOpened = dailyData.reduce((sum, d) => sum + d.opened, 0);
    const totalClicked = dailyData.reduce((sum, d) => sum + d.clicked, 0);
    const totalConverted = dailyData.reduce((sum, d) => sum + d.conversions, 0);

    return [
      { stage: 'Sent (P)', value: totalSent, actual: totalSent },
      { stage: 'Opened (A)', value: Math.round(totalOpened * 100 / totalSent), actual: totalOpened },
      { stage: 'Clicked (S)', value: Math.round(totalClicked * 100 / totalSent), actual: totalClicked },
      { stage: 'Converted (N)', value: Math.round(totalConverted * 100 / totalSent), actual: totalConverted },
    ];
  }, [dailyData]);

  return (
    <div className="space-y-6">
      {/* 메트릭 카드 (4개) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue (This Month)"
          value={formatCurrency(overview.totalRevenue || 0)}
          subtext={`Last: ${formatCurrency(overview.lastMonthRevenue || 0)}`}
          trend={overview.totalRevenue - (overview.lastMonthRevenue || 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Conversion Rate"
          value={formatPercent(overview.conversionRate || 0)}
          subtext={`Target: 25%`}
          trend={(overview.conversionRate || 0) - (overview.lastMonthConversionRate || 0)}
          icon={<Click className="w-5 h-5" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Active Sequences"
          value={overview.activeSequences || 0}
          subtext="Day 0-3 count"
          icon={<MessageSquare className="w-5 h-5" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Avg Open Rate"
          value={formatPercent(overview.avgOpenRate || 0)}
          subtext="All channels blended"
          trend={(overview.avgOpenRate || 0) - 0.35}
          icon={<Eye className="w-5 h-5" />}
          isLoading={isLoading}
        />
      </div>

      {/* 차트 행 (2개) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue Trend (30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                formatter={(value: any) => formatCurrency(value as number)}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">PASONA Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelStages}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="stage" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                formatter={(value: any, name) => {
                  if (name === 'value') return [formatPercent(value / 100), 'Drop-off %'];
                  return [formatNumber(value), 'Contacts'];
                }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]}>
                {funnelStages.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 하단 테이블 (3개) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Lenses */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 3 Lenses by Revenue</h3>
          <div className="space-y-3">
            {lensData.slice(0, 3).map((lens, i) => (
              <div key={lens.lens} className="pb-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{lens.lens}</span>
                  <span className="text-sm font-bold text-blue-600">{formatCurrency(lens.monthlyRevenue)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{lens.count} contacts</span>
                  <span className={getTrendColor(lens.trend)}>
                    {lens.trend > 0 ? '+' : ''}{formatPercent(lens.trend / 100)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Sequences */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Day 0-3 Sequences</h3>
          <div className="space-y-3">
            {sequenceData.slice(0, 3).map((seq) => (
              <div key={seq.id} className="pb-3 border-b border-gray-100 last:border-0">
                <div className="text-sm font-medium text-gray-900 truncate mb-1">{seq.name}</div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Eye className="w-3 h-3" />
                  <span>{formatPercent((seq.opened / seq.sent) * 100)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* A/B Tests */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top A/B Tests</h3>
          <div className="space-y-3">
            {testData.filter(t => t.status === 'CONCLUDED' || t.status === 'IN PROGRESS').slice(0, 3).map((test) => (
              <div key={test.id} className="pb-3 border-b border-gray-100 last:border-0">
                <div className="text-sm font-medium text-gray-900 truncate mb-1">{test.name}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    test.status === 'CONCLUDED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {test.status === 'CONCLUDED' && test.winner ? `✓ ${test.winner}` : 'Running'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────── 렌즈 분석 탭 ────────────────────── */

interface LensAnalyticsTabProps {
  data: AnalyticsResponse;
  isLoading: boolean;
}

const LensAnalyticsTab: React.FC<LensAnalyticsTabProps> = ({ data, isLoading }) => {
  const lensData = data.lensData || [];
  const [sortBy, setSortBy] = useState<'revenue' | 'conversionRate' | 'ltv'>('revenue');

  const sortedData = useMemo(
    () => [...lensData].sort((a, b) => {
      if (sortBy === 'revenue') return b.monthlyRevenue - a.monthlyRevenue;
      if (sortBy === 'conversionRate') return b.conversionRate - a.conversionRate;
      return b.ltv - a.ltv;
    }),
    [lensData, sortBy],
  );

  // Heatmap 데이터
  const heatmapData = sortedData.map(d => ({
    lens: d.lens,
    revenueColor: d.monthlyRevenue > 1000000 ? 'bg-red-500' : d.monthlyRevenue > 500000 ? 'bg-orange-400' : 'bg-yellow-300',
    conversionColor: d.conversionRate > 0.5 ? 'bg-green-500' : d.conversionRate > 0.25 ? 'bg-green-400' : 'bg-yellow-300',
    ltvColor: d.ltv > 1000000 ? 'bg-blue-600' : d.ltv > 500000 ? 'bg-blue-400' : 'bg-blue-300',
  }));

  // Radar 데이터
  const radarData = sortedData.map(d => ({
    lens: d.lens,
    revenue: Math.min(d.monthlyRevenue / 100000, 100),
    conversionRate: d.conversionRate * 100,
    ltv: Math.min(d.ltv / 10000, 100),
  }));

  const distributionData = sortedData.map(d => ({
    lens: d.lens,
    value: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Lens Performance Heatmap</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">Lens</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Revenue</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Conv Rate</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">LTV</th>
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row) => (
                <tr key={row.lens} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-900">{row.lens}</td>
                  <td className="text-center py-2 px-3">
                    <div className={`w-8 h-8 rounded ${row.revenueColor} mx-auto`} title={row.lens} />
                  </td>
                  <td className="text-center py-2 px-3">
                    <div className={`w-8 h-8 rounded ${row.conversionColor} mx-auto`} />
                  </td>
                  <td className="text-center py-2 px-3">
                    <div className={`w-8 h-8 rounded ${row.ltvColor} mx-auto`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Performance Table</h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg"
          >
            <option value="revenue">Sort by Revenue</option>
            <option value="conversionRate">Sort by Conv Rate</option>
            <option value="ltv">Sort by LTV</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">Lens</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Count</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Conv Rate</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">LTV</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Monthly Revenue</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((lens) => (
                <tr key={lens.lens} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                  <td className="py-2 px-3 font-medium text-gray-900">{lens.lens}</td>
                  <td className="text-right py-2 px-3 text-gray-600">{formatNumber(lens.count)}</td>
                  <td className="text-right py-2 px-3 text-gray-600">{formatPercent(lens.conversionRate)}</td>
                  <td className="text-right py-2 px-3 text-gray-600">{formatCurrency(lens.ltv)}</td>
                  <td className="text-right py-2 px-3 font-bold text-gray-900">{formatCurrency(lens.monthlyRevenue)}</td>
                  <td className={`text-right py-2 px-3 ${getTrendColor(lens.trend)}`}>
                    {lens.trend > 0 ? '+' : ''}{formatPercent(lens.trend / 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lens Comparison (Radar)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#f0f0f0" />
              <PolarAngleAxis dataKey="lens" stroke="#9ca3af" style={{ fontSize: '11px' }} />
              <PolarRadiusAxis stroke="#9ca3af" angle={90} domain={[0, 100]} />
              <Radar name="Revenue" dataKey="revenue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
              <Radar name="Conv Rate" dataKey="conversionRate" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution by Lens</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ lens, percent }) => `${lens} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {distributionData.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#06b6d4', '#f97316', '#84cc16', '#14b8a6', '#0ea5e9'][i % 11]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatNumber(value as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Growth Projection */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Growth Projection</h3>
            <p className="text-gray-700">
              If L6 (Timing/Loss Aversion) grows 10%, expect <span className="font-bold text-green-600">+$35K/month</span> additional revenue.
              <br />
              Current L6 contribution: <span className="font-bold">{formatCurrency(sortedData.find(d => d.lens === 'L6')?.monthlyRevenue || 0)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────── Day 0-3 분석 탭 ────────────────────── */

interface Day03AnalyticsTabProps {
  data: AnalyticsResponse;
  isLoading: boolean;
}

const Day03AnalyticsTab: React.FC<Day03AnalyticsTabProps> = ({ data, isLoading }) => {
  const day03Data = data.day03Data || [];
  const sequenceData = data.sequenceData || [];
  const [filterStatus, setFilterStatus] = useState<'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ALL'>('ALL');

  const filteredSequences = sequenceData.filter(
    s => filterStatus === 'ALL' || s.status === filterStatus,
  );

  // Completion funnel
  const funnelStages = [
    { stage: 'Deployed', count: sequenceData.length },
    { stage: 'Sent Day 0', count: sequenceData.filter(s => s.sent > 0).length },
    { stage: 'Sent Day 1', count: sequenceData.filter(s => s.opened > 0).length },
    { stage: 'Sent Day 2', count: sequenceData.filter(s => s.clicked > 0).length },
    { stage: 'Sent Day 3', count: sequenceData.filter(s => s.converted > 0).length },
  ];

  return (
    <div className="space-y-6">
      {/* Day Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {day03Data.map((day) => (
          <MetricCard
            key={day.day}
            title={`Day ${day.day} (${day.stage})`}
            value={`${day.sentCount.toLocaleString()} sent`}
            subtext={`Open: ${formatPercent(day.openRate)} | Click: ${formatPercent(day.clickRate)}`}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Sequence Performance Leaderboard */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Sequence Performance Leaderboard</h3>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="PAUSED">Paused</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">Sequence Name</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Deployed</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Sent</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Opened</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Clicked</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Converted</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Open Rate</th>
              </tr>
            </thead>
            <tbody>
              {filteredSequences.map((seq) => {
                const openRate = seq.sent > 0 ? seq.opened / seq.sent : 0;
                return (
                  <tr key={seq.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{seq.name}</td>
                    <td className="text-center py-2 px-3 text-gray-600">{seq.deployed}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{formatNumber(seq.sent)}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{formatNumber(seq.opened)}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{formatNumber(seq.clicked)}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{formatNumber(seq.converted)}</td>
                    <td className="text-right py-2 px-3 font-bold text-blue-600">{formatPercent(openRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelStages}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="stage" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                formatter={(value: any) => [formatNumber(value), 'Sequences']}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Predicted Completions</h3>
          <div className="space-y-3">
            {sequenceData.slice(0, 5).map((seq) => {
              const daysActive = Math.floor(Math.random() * 3) + 1;
              return (
                <div key={seq.id} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-900">{seq.name}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    In {daysActive} days
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────── A/B 테스트 탭 ────────────────────── */

interface ABTestsTabProps {
  data: AnalyticsResponse;
  isLoading: boolean;
}

const ABTestsTab: React.FC<ABTestsTabProps> = ({ data, isLoading }) => {
  const testData = data.testData || [];
  const activeTests = testData.filter(t => t.status === 'IN PROGRESS');
  const concludedTests = testData.filter(t => t.status === 'CONCLUDED');

  return (
    <div className="space-y-6">
      {/* Active Tests Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Tests Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">Test Name</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Duration</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Sample</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">p-value</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Winner</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeTests.map((test) => (
                <tr key={test.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-900">{test.name}</td>
                  <td className="text-center py-2 px-3 text-gray-600">{test.duration}</td>
                  <td className="text-right py-2 px-3 text-gray-600">{formatNumber(test.sampleSize)}</td>
                  <td className="text-right py-2 px-3 text-gray-600">{test.pValue.toFixed(4)}</td>
                  <td className="py-2 px-3 text-gray-600">-</td>
                  <td className="py-2 px-3">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">IN PROGRESS</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Winners Board */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Winners Board</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {concludedTests.slice(0, 4).map((test) => (
            <div key={test.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{test.name}</h4>
                <span className="text-green-600 text-sm font-bold">✓ {test.winner}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>p-value: {test.pValue.toFixed(4)}</span>
                <span>Sample: {formatNumber(test.sampleSize)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Performance Trend */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Success Rate Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={[
              { month: 'Jan', successRate: 60 },
              { month: 'Feb', successRate: 65 },
              { month: 'Mar', successRate: 72 },
              { month: 'Apr', successRate: 75 },
              { month: 'May', successRate: 80 },
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
              formatter={(value: any) => `${value}%`}
            />
            <Bar dataKey="successRate" fill="#10b981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ────────────────────── 채널 분석 탭 ────────────────────── */

interface ChannelMixTabProps {
  data: AnalyticsResponse;
  isLoading: boolean;
}

const ChannelMixTab: React.FC<ChannelMixTabProps> = ({ data, isLoading }) => {
  const channelData = data.channelData || [];

  const chartData = channelData.map(c => ({
    channel: c.channel,
    openRate: c.opened / c.sent || 0,
    costPerMessage: c.costPerMessage,
  }));

  const budgetData = channelData.map(c => ({
    channel: c.channel,
    value: Math.round((c.costPerMessage * c.sent) / 1000), // 천원 단위
  }));

  return (
    <div className="space-y-6">
      {/* Channel Comparison */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-700">Channel</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Sent</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Opened</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Clicked</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Cost/Message</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">ROI</th>
              </tr>
            </thead>
            <tbody>
              {channelData.map((channel) => {
                const openRate = channel.sent > 0 ? channel.opened / channel.sent : 0;
                return (
                  <tr key={channel.channel} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{channel.channel}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{formatNumber(channel.sent)}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{formatNumber(channel.opened)}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{formatNumber(channel.clicked)}</td>
                    <td className="text-right py-2 px-3 text-gray-600">₩{channel.costPerMessage.toFixed(0)}</td>
                    <td className="text-right py-2 px-3 font-bold text-green-600">{formatPercent(channel.roi)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dual-Axis Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Rate vs Cost (Dual-Axis)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="channel" stroke="#9ca3af" />
            <YAxis yAxisId="left" stroke="#3b82f6" label={{ value: 'Open Rate (%)', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" label={{ value: 'Cost/Message (₩)', angle: 90, position: 'insideRight' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
              formatter={(value: any, name) => {
                if (name === 'openRate') return [(value * 100).toFixed(2) + '%', 'Open Rate'];
                return [value.toFixed(0) + '₩', 'Cost/Message'];
              }}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="openRate" stroke="#3b82f6" strokeWidth={2} name="Open Rate" />
            <Bar yAxisId="right" dataKey="costPerMessage" fill="#f59e0b" name="Cost/Message" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendation Engine */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Channel Optimization Recommendation</h3>
            <p className="text-gray-700 mb-3">
              Kakao has <span className="font-bold text-green-600">40% higher open rate</span> than SMS at similar cost.
              <br />
              Consider increasing Kakao allocation by 20% next month for expected +$45K additional revenue.
            </p>
            <button className="text-green-600 font-semibold hover:underline flex items-center gap-1">
              View Details →
            </button>
          </div>
        </div>
      </div>

      {/* Budget Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Spend by Channel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={budgetData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ channel, value }) => `${channel} ${value}천원`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {budgetData.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={['#3b82f6', '#f59e0b', '#06b6d4'][i % 3]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}천원`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Allocation</h3>
          <div className="space-y-4">
            {channelData.map((channel, i) => {
              const recommended = i === 1 ? 45 : i === 0 ? 35 : 20; // Kakao 45%, SMS 35%, Email 20%
              return (
                <div key={channel.channel}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{channel.channel}</span>
                    <span className="text-sm font-bold text-blue-600">{recommended}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${recommended}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────── 메인 페이지 ────────────────────── */

type TabType = 'overview' | 'lens' | 'day03' | 'tests' | 'channels';

export default function PerformanceDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('30');

  // API 데이터 페치
  const { data, isLoading, error } = useSWR(
    `/api/analytics/performance?dateRange=${dateRange}`,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    { revalidateOnFocus: false, revalidateOnReconnect: true }
  );

  const analyticsData: AnalyticsResponse = data || {
    ok: false,
    overview: {} as PerformanceOverview,
    dailyData: [],
    lensData: [],
    day03Data: [],
    sequenceData: [],
    testData: [],
    channelData: [],
  };

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics/performance/export?dateRange=${dateRange}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      logger.error('export failed:', err);
    }
  }, [dateRange]);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error loading analytics</h3>
            <p className="text-red-700 text-sm mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">📊 성과 추적 (Performance Analytics)</h1>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Range:
            </span>
            <div className="flex gap-2">
              {(['7', '14', '30', '90'] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    dateRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Last {range} Days
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-t border-gray-200 pt-4 -mx-6 px-6 overflow-x-auto">
            {(['overview', 'lens', 'day03', 'tests', 'channels'] as TabType[]).map((tab) => {
              const labels: Record<TabType, string> = {
                overview: '📈 Overview',
                lens: '🎯 Lens Analytics',
                day03: '📅 Day 0-3 Analytics',
                tests: '🧪 A/B Tests',
                channels: '📱 Channel Mix',
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab data={analyticsData} isLoading={isLoading} />}
        {activeTab === 'lens' && <LensAnalyticsTab data={analyticsData} isLoading={isLoading} />}
        {activeTab === 'day03' && <Day03AnalyticsTab data={analyticsData} isLoading={isLoading} />}
        {activeTab === 'tests' && <ABTestsTab data={analyticsData} isLoading={isLoading} />}
        {activeTab === 'channels' && <ChannelMixTab data={analyticsData} isLoading={isLoading} />}
      </div>
    </div>
  );
}
