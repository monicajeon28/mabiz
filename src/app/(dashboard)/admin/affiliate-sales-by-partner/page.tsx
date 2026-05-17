'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Loader2, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import type { AdminAffiliateSalesResponse } from '@/lib/affiliate/types';

type AffiliateData = {
  affiliateUserId: string;
  affiliateName: string;
  totalRevenue: number;
  conversionRate: number;
  avgOrderAmount: number;
  pageCount: number;
  status: 'active' | 'inactive';
};

type PeriodType = 'month' | 'quarter' | 'year';

function formatWon(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}

function getMonthOptions(): { label: string; value: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return {
      label: `${y}년 ${m}월`,
      value: `${y}-${String(m).padStart(2, '0')}`,
    };
  });
}

function StatCard({
  title,
  value,
  icon,
  suffix,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span className="text-gray-300">{icon}</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p className="text-3xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="ml-1 text-lg font-medium text-gray-400">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

export default function AdminAffiliateSalesPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodType>('month');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<AffiliateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'revenue' | 'conversion' | 'avgOrder'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [authChecked, setAuthChecked] = useState(false);

  // 권한 확인 (GLOBAL_ADMIN만)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/');
          return;
        }
        const ctx = await res.json();
        if (ctx.role !== 'GLOBAL_ADMIN') {
          router.push('/');
          return;
        }
        setAuthChecked(true);
      } catch {
        router.push('/');
      }
    };
    checkAuth();
  }, [router]);

  // 데이터 로드
  const handleLoad = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        period,
        year: year.toString(),
      });
      if (period === 'month') params.append('month', month.toString());

      const res = await fetch(`/api/admin/affiliate-sales?${params}`, {
        credentials: 'include',
      });

      if (res.status === 401 || res.status === 403) {
        setError('관리자만 접근 가능합니다');
        router.push('/');
        return;
      }

      if (!res.ok) throw new Error('데이터 로드 실패');

      const json: AdminAffiliateSalesResponse | { ok: false; error?: string } = await res.json();
      if (!json.ok) throw new Error(json.error || '알 수 없는 오류');

      // API 응답 형식에 맞춰 변환
      const affiliates = (json.data || []).map((item) => {
        // Type safety check — status 필드 유효성 검증
        const validStatus = ['active', 'inactive'].includes(item.status) ? item.status : 'inactive';

        return {
          affiliateUserId: String(item.affiliateUserId),
          affiliateName: item.affiliateName,
          totalRevenue: Number(item.totalRevenue) || 0,
          conversionRate: Number(item.conversionRate) || 0,
          avgOrderAmount: Number(item.avgOrderAmount) || 0,
          pageCount: Number(item.pageCount) || 0,
          status: validStatus as 'active' | 'inactive',
        } as AffiliateData;
      });

      setData(affiliates);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드 (인증 확인 후)
  useEffect(() => {
    if (!authChecked) return;
    handleLoad();
  }, [authChecked]);

  // 정렬된 데이터
  const sortedData = [...data].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    if (sortBy === 'revenue') {
      aVal = a.totalRevenue;
      bVal = b.totalRevenue;
    } else if (sortBy === 'conversion') {
      aVal = a.conversionRate;
      bVal = b.conversionRate;
    } else {
      aVal = a.avgOrderAmount;
      bVal = b.avgOrderAmount;
    }

    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // 통계 계산
  const stats = {
    totalRevenue: data.reduce((sum, d) => sum + d.totalRevenue, 0),
    avgConversion: data.length > 0
      ? Math.round(data.reduce((sum, d) => sum + d.conversionRate, 0) / data.length * 10) / 10
      : 0,
    avgOrderAmount: data.length > 0
      ? Math.floor(data.reduce((sum, d) => sum + d.avgOrderAmount, 0) / data.length)
      : 0,
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">대리점 매출 현황</h1>
        <p className="text-sm text-gray-500 mt-1">모든 대리점의 매출을 한눈에 비교하고 분석합니다.</p>
      </div>

      {/* 필터 섹션 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기간</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="month">월별</option>
              <option value="quarter">분기별</option>
              <option value="year">연도별</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">연도</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 w-28 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {period === 'month' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">월</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 w-28 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}월
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleLoad}
            disabled={loading}
            className="sm:mt-6 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                로딩 중...
              </>
            ) : (
              '조회'
            )}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 통계 카드 */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="전체 매출"
            value={`₩${formatWon(stats.totalRevenue)}`}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatCard
            title="평균 전환율"
            value={stats.avgConversion}
            suffix="%"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="평균 주문액"
            value={`₩${formatWon(stats.avgOrderAmount)}`}
            icon={<ShoppingCart className="h-5 w-5" />}
          />
        </div>
      )}

      {/* 테이블 */}
      {data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">대리점명</th>
                <th
                  className="px-6 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    setSortBy('revenue');
                    setSortOrder(sortOrder === 'desc' && sortBy === 'revenue' ? 'asc' : 'desc');
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    총 매출
                    {sortBy === 'revenue' && <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    setSortBy('conversion');
                    setSortOrder(sortOrder === 'desc' && sortBy === 'conversion' ? 'asc' : 'desc');
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    전환율
                    {sortBy === 'conversion' && <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    setSortBy('avgOrder');
                    setSortOrder(sortOrder === 'desc' && sortBy === 'avgOrder' ? 'asc' : 'desc');
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    평균 주문액
                    {sortBy === 'avgOrder' && <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>}
                  </div>
                </th>
                <th className="px-6 py-3 text-right font-semibold text-gray-700">페이지 뷰</th>
                <th className="px-6 py-3 text-center font-semibold text-gray-700">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedData.map((affiliate) => (
                <tr key={affiliate.affiliateUserId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{affiliate.affiliateName}</td>
                  <td className="px-6 py-4 text-right text-gray-700">
                    ₩{formatWon(affiliate.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      affiliate.conversionRate >= 5
                        ? 'bg-green-100 text-green-700'
                        : affiliate.conversionRate >= 3
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {affiliate.conversionRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-700">
                    ₩{formatWon(affiliate.avgOrderAmount)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-700">
                    {affiliate.pageCount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={affiliate.status === 'active'
                      ? 'inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700'
                      : 'inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700'}>
                      {affiliate.status === 'active' ? '활성' : '휴면'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && data.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">조회 결과가 없습니다</p>
          <p className="text-sm text-gray-500">다른 기간을 선택하여 다시 조회해주세요.</p>
        </div>
      ) : null}
    </div>
  );
}
