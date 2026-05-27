'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

interface StatusStat {
  status: string;
  count: number;
  totalCommission: number;
  totalWithholding: number;
  netPayout: number;
}

interface PartnerStat {
  profileId: number | null;
  settlementCount: number;
  totalCommission: number;
  totalWithholding: number;
  netPayout: number;
  lastSettlementDate: string | null;
}

interface MonthlyTrend {
  month: string;
  settlementCount: number;
  totalCommission: number;
  totalWithholding: number;
  netPayout: number;
  paidCount: number;
}

interface StatsResponse {
  ok: boolean;
  data: {
    statusStats: StatusStat[];
    topPartners: PartnerStat[];
    monthlyTrend: MonthlyTrend[];
  };
  performance: {
    elapsedMs: number;
    queryPerformance: string;
  };
}

const STATUS_COLORS: Record<string, { bg: string; icon: JSX.Element; label: string }> = {
  DRAFT: {
    bg: 'bg-slate-100 text-slate-700',
    icon: <ClockIcon className="w-5 h-5" />,
    label: '예정',
  },
  APPROVED: {
    bg: 'bg-blue-100 text-blue-700',
    icon: <CheckCircleIcon className="w-5 h-5" />,
    label: '승인',
  },
  LOCKED: {
    bg: 'bg-yellow-100 text-yellow-700',
    icon: <LockClosedIcon className="w-5 h-5" />,
    label: '진행중',
  },
  PAID: {
    bg: 'bg-green-100 text-green-700',
    icon: <CheckCircleIcon className="w-5 h-5" />,
    label: '완료',
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function SettlementsAdminPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const startTime = Date.now();
        const res = await fetch('/api/admin/settlements/stats', {
          headers: { 'Cache-Control': 'no-store' },
        });
        const data = (await res.json()) as StatsResponse;
        const elapsed = Date.now() - startTime;

        if (data.ok) {
          setStats(data);
          setElapsedTime(elapsed);
        } else {
          setError('데이터를 불러올 수 없습니다.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '네트워크 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">정산 분석 대시보드</h1>
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">정산 분석 대시보드</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          {error || '데이터를 불러올 수 없습니다.'}
        </div>
      </div>
    );
  }

  const { statusStats, topPartners, monthlyTrend } = stats.data;
  const totalStatus = statusStats.reduce((sum, s) => sum + s.count, 0);
  const grandTotalCommission = statusStats.reduce((sum, s) => sum + s.totalCommission, 0);
  const grandTotalNetPayout = statusStats.reduce((sum, s) => sum + s.netPayout, 0);

  // 파이 차트 데이터
  const pieData = statusStats.map((s) => ({
    name: STATUS_COLORS[s.status]?.label || s.status,
    value: s.count,
  }));

  const COLORS = ['#64748b', '#3b82f6', '#eab308', '#22c55e'];

  // 월별 추이 차트 데이터 (역순)
  const trendData = [...monthlyTrend].reverse();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">정산 분석 대시보드</h1>
          <p className="text-sm text-gray-600 mt-1">1M행 쿼리 응답시간: {elapsedTime}ms</p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            (elapsedTime ?? 0) < 2000 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {(elapsedTime ?? 0) < 2000 ? '✓ EXCELLENT (<2초)' : '⚠ NEEDS OPTIMIZATION'}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="전체 정산 건"
          value={totalStatus}
          subtext={`${totalStatus}건`}
          icon={<ClockIcon className="w-8 h-8" />}
          color="bg-gradient-to-br from-slate-50 to-slate-100"
          textColor="text-slate-600"
        />
        <StatCard
          label="누적 수수료"
          value={formatCurrency(grandTotalCommission)}
          subtext="모든 상태 합계"
          icon={<ArrowTrendingUpIcon className="w-8 h-8" />}
          color="bg-gradient-to-br from-blue-50 to-blue-100"
          textColor="text-blue-600"
        />
        <StatCard
          label="차감액"
          value={formatCurrency(grandTotalCommission - grandTotalNetPayout)}
          subtext="세금/수수료"
          icon={<ExclamationCircleIcon className="w-8 h-8" />}
          color="bg-gradient-to-br from-yellow-50 to-yellow-100"
          textColor="text-yellow-600"
        />
        <StatCard
          label="순 지급액"
          value={formatCurrency(grandTotalNetPayout)}
          subtext="실제 지급액"
          icon={<CheckCircleIcon className="w-8 h-8" />}
          color="bg-gradient-to-br from-green-50 to-green-100"
          textColor="text-green-600"
        />
      </div>

      {/* 상태별 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">상태별 분포</h2>
          <div className="space-y-3">
            {statusStats.map((stat) => (
              <div key={stat.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded ${STATUS_COLORS[stat.status]?.bg || 'bg-gray-100'}`}>
                    {STATUS_COLORS[stat.status]?.icon || <ClockIcon className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {STATUS_COLORS[stat.status]?.label || stat.status}
                    </p>
                    <p className="text-xs text-gray-600">{stat.count}건</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(stat.netPayout)}
                  </p>
                  <p className="text-xs text-gray-600">{Math.round((stat.count / totalStatus) * 100)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 파이 차트 */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">정산 현황</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name} (${entry.value})`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}건`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 월별 추이 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">월별 정산 추이</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalCommission"
              stroke="#3b82f6"
              name="수수료"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="netPayout"
              stroke="#22c55e"
              name="순지급액"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 파트너별 수익 Top 10 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">파트너별 상위 10개 수익</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">파트너 ID</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">정산건수</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">수수료</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">차감액</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">순지급액</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">최근 정산</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topPartners.map((partner, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-mono">
                    {partner.profileId || '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {partner.settlementCount}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(partner.totalCommission)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(partner.totalCommission - partner.netPayout)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(partner.netPayout)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(partner.lastSettlementDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 성능 정보 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-2">
          <CheckCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">성능 최적화 완료</h3>
            <p className="text-sm text-blue-700">
              1M행 쿼리가 {elapsedTime}ms에 응답했습니다.
              {(elapsedTime ?? 0) < 2000
                ? ' 목표치(<2초) 달성 ✓'
                : ' 인덱스 추가 최적화 권장'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  color,
  textColor,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: JSX.Element;
  color: string;
  textColor: string;
}) {
  return (
    <div className={`${color} rounded-lg border border-gray-200 p-6`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
          <p className="text-xs text-gray-600 mt-2">{subtext}</p>
        </div>
        <div className={`p-3 rounded-lg ${textColor} bg-white bg-opacity-50`}>{icon}</div>
      </div>
    </div>
  );
}
