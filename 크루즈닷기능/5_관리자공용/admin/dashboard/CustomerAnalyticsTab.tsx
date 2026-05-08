'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import StatCard, { StatCardGrid } from '../StatCard';

interface CustomerStats {
  totalCustomers: number;
  newCustomersToday: number;
  newCustomersThisWeek: number;
  newCustomersThisMonth: number;
  avgSessionDuration: number; // 초 단위
  avgPageViews: number;
  conversionRate: number; // %
  repurchaseRate: number; // %
}

interface TopProduct {
  productCode: string;
  productName: string;
  viewCount: number;
  inquiryCount: number;
}

interface TopKeyword {
  keyword: string;
  count: number;
}

interface CustomerGroup {
  name: string;
  count: number;
  percentage: number;
}

interface CustomerBehavior {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  avgDuration: number;
}

export default function CustomerAnalyticsTab() {
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topKeywords, setTopKeywords] = useState<TopKeyword[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [behaviorTrends, setBehaviorTrends] = useState<CustomerBehavior[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsRes, insightsRes] = await Promise.all([
        fetch(`/api/admin/analytics?range=${timeRange}`, { credentials: 'include' }),
        fetch(`/api/admin/dashboard`, { credentials: 'include' }),
      ]);

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        if (analyticsData.ok) {
          setStats({
            totalCustomers: analyticsData.totalUsers || 0,
            newCustomersToday: analyticsData.newUsersToday || 0,
            newCustomersThisWeek: analyticsData.newUsersThisWeek || 0,
            newCustomersThisMonth: analyticsData.newUsersThisMonth || 0,
            avgSessionDuration: analyticsData.avgSessionDuration || 0,
            avgPageViews: analyticsData.avgPageViews || 0,
            conversionRate: analyticsData.conversionRate || 0,
            repurchaseRate: analyticsData.repurchaseRate || 0,
          });

          if (analyticsData.topProducts) {
            setTopProducts(analyticsData.topProducts);
          }

          if (analyticsData.topKeywords) {
            setTopKeywords(analyticsData.topKeywords);
          }

          if (analyticsData.customerGroups) {
            setCustomerGroups(analyticsData.customerGroups);
          }

          if (analyticsData.behaviorTrends) {
            setBehaviorTrends(analyticsData.behaviorTrends);
          }
        }
      }

      // 기본 통계 보완
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        if (insightsData.ok && insightsData.dashboard) {
          const dashboard = insightsData.dashboard;
          setStats(prev => ({
            ...prev!,
            totalCustomers: prev?.totalCustomers || dashboard.users?.total || 0,
          }));

          // 상품 조회 데이터
          if (dashboard.productViews?.topCruises) {
            setTopProducts(prev => prev.length > 0 ? prev : dashboard.productViews.topCruises.map((p: any) => ({
              productCode: p.code || p.name,
              productName: p.name,
              viewCount: p.count,
              inquiryCount: 0,
            })));
          }
        }
      }
    } catch (err: any) {
      console.error('Analytics load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}초`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}분 ${secs}초`;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        데이터를 불러올 수 없습니다: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">고객 분석</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7일' : range === '30d' ? '30일' : '90일'}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 카드 */}
      <StatCardGrid columns={4}>
        <StatCard
          title="전체 고객"
          value={stats?.totalCustomers || 0}
          subtitle={`오늘 +${stats?.newCustomersToday || 0}`}
          color="blue"
          gradient
        />
        <StatCard
          title="평균 체류 시간"
          value={formatDuration(stats?.avgSessionDuration || 0)}
          subtitle="세션당"
          color="green"
        />
        <StatCard
          title="전환율"
          value={`${(stats?.conversionRate || 0).toFixed(1)}%`}
          subtitle="방문 → 구매"
          color="purple"
        />
        <StatCard
          title="재구매율"
          value={`${(stats?.repurchaseRate || 0).toFixed(1)}%`}
          subtitle="2회 이상 구매"
          color="orange"
        />
      </StatCardGrid>

      {/* 고객 그룹 분포 */}
      {customerGroups.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">고객 그룹 분포</h3>
          <div className="space-y-3">
            {customerGroups.map((group, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-24 text-sm text-gray-600">{group.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${group.percentage}%` }}
                  />
                </div>
                <span className="w-20 text-right text-sm font-medium">
                  {group.count.toLocaleString()}명 ({group.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 인기 상품 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">인기 조회 상품 TOP 10</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.slice(0, 10).map((product, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-900 truncate max-w-[200px]">
                      {product.productName}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">조회 {product.viewCount}</span>
                    {product.inquiryCount > 0 && (
                      <span className="text-blue-600">문의 {product.inquiryCount}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">데이터가 없습니다</p>
          )}
        </div>

        {/* 인기 검색 키워드 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">인기 검색 키워드 TOP 10</h3>
          {topKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topKeywords.slice(0, 20).map((keyword, i) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    i < 3
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {keyword.keyword}
                  <span className="ml-1 text-xs opacity-70">({keyword.count})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">데이터가 없습니다</p>
          )}
        </div>
      </div>

      {/* 신규 고객 통계 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">신규 고객 현황</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{stats?.newCustomersToday || 0}</p>
            <p className="text-sm text-gray-500 mt-1">오늘</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{stats?.newCustomersThisWeek || 0}</p>
            <p className="text-sm text-gray-500 mt-1">이번 주</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-3xl font-bold text-purple-600">{stats?.newCustomersThisMonth || 0}</p>
            <p className="text-sm text-gray-500 mt-1">이번 달</p>
          </div>
        </div>
      </div>
    </div>
  );
}
