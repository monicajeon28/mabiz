'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { DollarSign, TrendingUp, Percent, Download, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

/* ─────────────────── 타입 정의 ─────────────────── */

type ChartDataPoint = {
  month: string;
  smsCost: number;
  emailCost: number;
  totalCost: number;
  smsCount: number;
  emailCount: number;
};

type CampaignDetail = {
  id: string;
  name: string;
  channel: 'SMS' | 'Email';
  cost: number;
  sentCount: number;
  successCount: number;
  cpa: number;
  roi: number;
  createdAt: string;
};

type CostReportResponse = {
  ok: boolean;
  summary: {
    totalCost: number;
    totalSent: number;
    totalSuccess: number;
    averageCpa: number;
    averageRoi: number;
  };
  byMonth: ChartDataPoint[];
  byChannel: {
    SMS: { cost: number; count: number; roi: number };
    Email: { cost: number; count: number; roi: number };
  };
  campaigns: CampaignDetail[];
};

/* ─────────────────── 유틸 함수 ─────────────────── */

function formatCurrency(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만원`;
  return `${value.toLocaleString()}원`;
}

function formatNumber(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}만`;
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function getDefaultStartMonth(): string {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const year = threeMonthsAgo.getFullYear();
  const month = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function convertToCSV(campaigns: CampaignDetail[]): string {
  const headers = ['캠페인명', '채널', '비용(원)', '발송건수', '성공건수', 'CPA(원)', 'ROI(%)'];
  const rows = campaigns.map(c => [
    c.name,
    c.channel,
    c.cost.toString(),
    c.sentCount.toString(),
    c.successCount.toString(),
    c.cpa.toFixed(0),
    (c.roi * 100).toFixed(2),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return '﻿' + csv; // BOM 추가 (Excel 한글 인코딩)
}

/* ─────────────────── KPI 카드 컴포넌트 ─────────────────── */

function CostKpiCards({
  summary,
}: {
  summary: CostReportResponse['summary'];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 총 비용 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">총 비용</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(summary.totalCost)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              발송: {formatNumber(summary.totalSent)} / 성공: {formatNumber(summary.totalSuccess)}
            </p>
          </div>
          <DollarSign className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      {/* 평균 CPA */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">평균 CPA</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(summary.averageCpa)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              1명 획득당 비용
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-amber-400" />
        </div>
      </div>

      {/* 평균 ROI */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">평균 ROI</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatPercent(summary.averageRoi)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              투자 수익률
            </p>
          </div>
          <Percent className="w-8 h-8 text-green-400" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── 월별 추이 차트 ─────────────────── */

function MonthlyCostChart({
  data,
}: {
  data: ChartDataPoint[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">📈 월별 비용 추이</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6b7280"
            tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value) => [formatCurrency(value as number), '']}
            labelFormatter={(label) => `${label}월`}
          />
          <Legend
            wrapperStyle={{ fontSize: '13px', color: '#6b7280' }}
          />
          <Line
            type="monotone"
            dataKey="smsCost"
            stroke="#3b82f6"
            name="SMS 비용"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="emailCost"
            stroke="#f97316"
            name="Email 비용"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────── 채널별 비교 차트 ─────────────────── */

function ChannelComparisonChart({
  data,
}: {
  data: CostReportResponse['byChannel'];
}) {
  const chartData = Object.entries(data).map(([channel, info]) => ({
    channel,
    비용: info.cost,
    발송건수: info.count,
    ROI: (info.roi * 100).toFixed(0),
  }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 채널별 비용 비교</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="channel" stroke="#6b7280" style={{ fontSize: '12px' }} />
          <YAxis stroke="#6b7280" tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={((value: number, name: string) => {
              if (name === '비용') return [formatCurrency(value), name];
              if (name === '발송건수') return [value.toLocaleString(), name];
              return [`${value}%`, name];
            })}
          />
          <Legend wrapperStyle={{ fontSize: '13px', color: '#6b7280' }} />
          <Bar dataKey="비용" fill="#3b82f6" />
          <Bar dataKey="발송건수" fill="#10b981" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-blue-50 p-4">
          <p className="text-sm font-medium text-gray-700">SMS</p>
          <p className="mt-2 text-lg font-bold text-gray-900">
            {formatCurrency(data.SMS.cost)}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {formatNumber(data.SMS.count)} 건 발송
          </p>
        </div>
        <div className="rounded-lg bg-orange-50 p-4">
          <p className="text-sm font-medium text-gray-700">Email</p>
          <p className="mt-2 text-lg font-bold text-gray-900">
            {formatCurrency(data.Email.cost)}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {formatNumber(data.Email.count)} 건 발송
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── 캠페인 상세 테이블 ─────────────────── */

function CampaignDetailTable({
  campaigns,
  onDownload,
}: {
  campaigns: CampaignDetail[];
  onDownload: () => void;
}) {
  const sorted = [...campaigns].sort((a, b) => b.roi - a.roi);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">📋 캠페인별 상세</h2>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV 다운로드
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">캠페인명</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">채널</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">비용</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">발송</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">성공</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">CPA</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">ROI</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? (
              sorted.map((campaign) => (
                <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{campaign.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      campaign.channel === 'SMS'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {campaign.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">
                    {formatCurrency(campaign.cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatNumber(campaign.sentCount)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatNumber(campaign.successCount)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {formatCurrency(campaign.cpa)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block font-bold ${
                      campaign.roi > 1
                        ? 'text-green-600'
                        : campaign.roi > 0.5
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {formatPercent(campaign.roi)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  캠페인 데이터가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────── 메인 컴포넌트 ─────────────────── */

export default function CostDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<CostReportResponse | null>(null);
  const [dateRange, setDateRange] = useState({
    startMonth: getDefaultStartMonth(),
    endMonth: getCurrentMonth(),
  });
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5); // 분 단위
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // P1: 타임아웃 + AbortController 추가
  const fetchCostReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // AbortController로 10초 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(
          `/api/organizations/campaigns/cost/report?startMonth=${dateRange.startMonth}&endMonth=${dateRange.endMonth}`,
          {
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`API 오류: ${response.status}`);
        }

        const data: CostReportResponse = await response.json();
        if (!data.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : '알 수 없는 오류');
        }

        setReportData(data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      let message = '데이터를 불러올 수 없습니다';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          message = '요청 타임아웃 (10초)';
        } else {
          message = err.message;
        }
      }
      setError(message);
      logger.error('[CostDashboard] fetchCostReport failed', { error: err, dateRange });
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // 초기 로드
  useEffect(() => {
    fetchCostReport();
  }, [fetchCostReport]);

  // P1: 자동 새로고침 + 정리 함수 통일
  useEffect(() => {
    // 자동 새로고침이 비활성화된 경우 (0)
    if (autoRefreshInterval === 0) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      return;
    }

    refreshIntervalRef.current = setInterval(() => {
      fetchCostReport();
    }, autoRefreshInterval * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefreshInterval, fetchCostReport]);

  // CSV 다운로드
  const handleDownloadCSV = useCallback(() => {
    if (!reportData) return;

    const csv = convertToCSV(reportData.campaigns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `cost-report-${dateRange.startMonth}-${dateRange.endMonth}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 메모리 정리
    URL.revokeObjectURL(url);
  }, [reportData, dateRange]);

  // 월 범위 변경
  const handleDateChange = (field: 'startMonth' | 'endMonth', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading && !reportData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-700 font-medium">데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">💰 비용 분석 대시보드</h1>
          <div className="flex gap-2">
            <button
              onClick={() => fetchCostReport()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 필터 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작 월
              </label>
              <input
                type="month"
                value={dateRange.startMonth}
                onChange={(e) => handleDateChange('startMonth', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료 월
              </label>
              <input
                type="month"
                value={dateRange.endMonth}
                onChange={(e) => handleDateChange('endMonth', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                자동 새로고침
              </label>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5분마다</option>
                <option value={10}>10분마다</option>
                <option value={30}>30분마다</option>
                <option value={0}>사용 안함</option>
              </select>
            </div>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 콘텐츠 */}
        {reportData && (
          <>
            {/* KPI 카드 */}
            <CostKpiCards summary={reportData.summary} />

            {/* 월별 추이 */}
            {reportData.byMonth.length > 0 && (
              <MonthlyCostChart data={reportData.byMonth} />
            )}

            {/* 채널별 비교 */}
            <ChannelComparisonChart data={reportData.byChannel} />

            {/* 캠페인 상세 */}
            <CampaignDetailTable
              campaigns={reportData.campaigns}
              onDownload={handleDownloadCSV}
            />
          </>
        )}
      </div>
    </div>
  );
}
