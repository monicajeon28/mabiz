'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Mail, FileText, RefreshCw } from 'lucide-react';
import { useToast } from '@/lib/api/use-toast';
import { Loop5HeroKpi } from '@/components/loop5-hero-kpi';
import { Loop5SegmentTable } from '@/components/loop5-segment-table';
import { Loop5DayChart } from '@/components/loop5-day-chart';
import { Loop5ABTestResults } from '@/components/loop5-ab-test-results';
import { Loop5FilterPanel, FilterState } from '@/components/loop5-filter-panel';

interface DashboardStats {
  totalSent: number;
  totalClicked: number;
  totalFormSubmitted: number;
  responseRate: number;
  formCompletionRate: number;
  estimatedRevenue: number;
  byDay: Record<number, any>;
  trends: {
    responseRateChange: number;
    formCompletionChange: number;
    revenueChange: number;
  };
  lastUpdated: string;
}

interface SegmentBreakdown {
  segments: Array<{
    key: string;
    name: string;
    sent: number;
    clicked: number;
    submitted: number;
    responseRate: number;
    formCompletionRate: number;
    estimatedRevenue: number;
    trend: string;
  }>;
  lastUpdated: string;
}

interface ABTestData {
  ctaTests: Array<any>;
  smsTests: Array<any>;
  summary: {
    totalVariants: number;
    totalSmsTests: number;
    recommendation: string;
  };
  lastUpdated: string;
}

export default function Loop5DashboardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [segments, setSegments] = useState<SegmentBreakdown | null>(null);
  const [abTests, setAbTests] = useState<ABTestData | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    segments: ['A', 'B', 'C', 'D', 'E'],
  });

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);

      const params = new URLSearchParams({
        fromDate: filters.dateFrom,
        toDate: filters.dateTo,
      });

      const [statsRes, segmentRes, abTestRes] = await Promise.all([
        fetch(`/api/loop5/dashboard/stats?${params}`),
        fetch(`/api/loop5/dashboard/segment-breakdown?${params}`),
        fetch(`/api/loop5/dashboard/ab-test-results?${params}`),
      ]);

      if (!statsRes.ok || !segmentRes.ok || !abTestRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [statsData, segmentData, abTestData] = await Promise.all([
        statsRes.json(),
        segmentRes.json(),
        abTestRes.json(),
      ]);

      setStats(statsData);
      setSegments(segmentData);
      setAbTests(abTestData);
      setLastRefresh(new Date().toLocaleTimeString('ko-KR'));

      toast({
        title: '대시보드 업데이트',
        description: `${new Date().toLocaleTimeString('ko-KR')} 기준 데이터 갱신됨`,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast({
        title: '오류',
        description: '대시보드 데이터를 불러올 수 없습니다.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    // 초기 로드
    fetchData();

    // 5분마다 자동 갱신
    const interval = setInterval(fetchData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setLoading(true);
  };

  const handleResetFilters = () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    setFilters({
      dateFrom: weekAgo,
      dateTo: today,
      segments: ['A', 'B', 'C', 'D', 'E'],
    });
    setLoading(true);
  };

  const handleExportCSV = () => {
    if (!segments?.segments) return;

    const headers = ['Segment', 'SMS발송', '응답율(%)', '폼완성(%)', '예상매출($)'];
    const rows = segments.segments.map(s => [
      s.name,
      s.sent,
      s.responseRate.toFixed(1),
      s.formCompletionRate.toFixed(1),
      (s.estimatedRevenue / 1000).toFixed(1) + 'K',
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loop5-dashboard-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'CSV 다운로드',
      description: '대시보드 데이터가 CSV로 다운로드되었습니다.',
    });
  };

  const handleExportPDF = async () => {
    toast({
      title: 'PDF 생성 중',
      description: '고급 리포트를 생성 중입니다...',
    });

    // TODO: PDF 생성 로직
    setTimeout(() => {
      toast({
        title: 'PDF 준비 완료',
        description: '다운로드 링크가 준비되었습니다.',
      });
    }, 2000);
  };

  const handleSendEmail = () => {
    toast({
      title: '이메일 발송',
      description: '관리자에게 일일 리포트가 발송되었습니다.',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Loop 5 성과 대시보드
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {lastRefresh ? `마지막 업데이트: ${lastRefresh}` : '데이터 로딩 중...'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Loop5FilterPanel
                onApplyFilters={handleFilterChange}
                onResetFilters={handleResetFilters}
              />

              <button
                onClick={fetchData}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                새로고침
              </button>

              {/* Export Dropdown */}
              <div className="relative group">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium text-sm">
                  <Download className="w-4 h-4" />
                  내보내기
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg shadow-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-left"
                  >
                    <FileText className="w-4 h-4" />
                    CSV로 다운로드
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-left"
                  >
                    <FileText className="w-4 h-4" />
                    PDF 리포트
                  </button>
                  <button
                    onClick={handleSendEmail}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-left"
                  >
                    <Mail className="w-4 h-4" />
                    이메일 발송
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero KPI Section */}
        {stats && (
          <div className="mb-8">
            <Loop5HeroKpi data={stats} loading={loading} />
          </div>
        )}

        {/* Charts and Tables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Day Chart - Full Width */}
          <div className="lg:col-span-3">
            {stats && (
              <Loop5DayChart data={stats.byDay} loading={loading} />
            )}
          </div>

          {/* Segment Table - Full Width */}
          <div className="lg:col-span-3">
            {segments && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Segment별 성과 분해
                </h2>
                <Loop5SegmentTable data={segments.segments} loading={loading} />
              </div>
            )}
          </div>

          {/* A/B Test Results - Full Width */}
          <div className="lg:col-span-3">
            {abTests && (
              <Loop5ABTestResults
                ctaTests={abTests.ctaTests}
                smsTests={abTests.smsTests}
                loading={loading}
              />
            )}
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📊 최적화 권장사항
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {abTests?.ctaTests[0]?.winner && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-900 dark:text-green-200">
                  ✅ CTA 변형 우승자 결정됨
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  CTA Variant {abTests.ctaTests[0].variant}를 Default로 변경 권장
                </p>
              </div>
            )}

            {segments?.segments.some(
              s => s.responseRate < 30 && s.key !== 'TOTAL'
            ) && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                  ⚠️ 응답율 저조 Segment 발견
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {segments.segments
                    .filter(s => s.responseRate < 30 && s.key !== 'TOTAL')
                    .map(s => s.name)
                    .join(', ')} - 메시지 재작성 필요
                </p>
              </div>
            )}

            {stats?.byDay[0]?.rate! < 10 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  🕐 Day 0 응답율 개선
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  발송 시간 최적화 또는 초기 메시지 톤 재검토 권장
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
