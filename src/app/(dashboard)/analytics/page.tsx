'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Users,
  DollarSign,
  Zap,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface HeroKPI {
  revenue: { current: number; previous: number; growth: number; target: number };
  newContacts: { current: number; previous: number; growth: number; target: number };
  conversionRate: { current: number; previous: number; growth: number; target: number };
  ltv: { current: number; previous: number; growth: number; target: number };
  riskScore: { current: number; status: 'GREEN' | 'YELLOW' | 'RED'; previousScore: number };
}

interface LensPerformance {
  lens: string;
  totalContacts: number;
  conversions: number;
  conversionRate: number;
}

interface ChannelPerformance {
  channel: string;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  openRate: number;
  clickRate: number;
  roas: number;
}

interface AnalyticsSummary {
  hero: HeroKPI;
  lens: LensPerformance[];
  channels: ChannelPerformance[];
  timeframe: string;
  generatedAt: string;
}

export default function AnalyticsDashboard() {
  const session = useSession();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('month');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 데이터 로드
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/analytics/summary?timeframe=${timeframe}`);
        if (res.ok) {
          const data = await res.json();
          setSummary(data);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.organizationId) {
      fetchSummary();
      // 5분마다 새로고침
      const interval = setInterval(fetchSummary, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [session?.organizationId, timeframe]);

  if (!session?.organizationId) {
    return <div className="flex items-center justify-center h-screen">로그인이 필요합니다</div>;
  }

  const getIcon = (metric: string) => {
    switch (metric) {
      case 'revenue':
        return <DollarSign className="w-6 h-6" />;
      case 'contacts':
        return <Users className="w-6 h-6" />;
      case 'conversion':
        return <Target className="w-6 h-6" />;
      case 'ltv':
        return <TrendingUp className="w-6 h-6" />;
      case 'risk':
        return <Shield className="w-6 h-6" />;
      default:
        return <BarChart3 className="w-6 h-6" />;
    }
  };

  const getRiskColor = (status: 'GREEN' | 'YELLOW' | 'RED') => {
    switch (status) {
      case 'GREEN':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'YELLOW':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'RED':
        return 'bg-red-50 border-red-200 text-red-900';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">📊 분석 대시보드</h1>
          <p className="text-slate-600 mt-1">심리학 렌즈 기반 5계층 성과 분석</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Timeframe Selector */}
          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
            {(['day', 'week', 'month'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'px-4 py-2 rounded text-sm font-medium transition',
                  timeframe === tf
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                {tf === 'day' && '일일'}
                {tf === 'week' && '주간'}
                {tf === 'month' && '월간'}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-white rounded-lg transition"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-sm text-slate-500 mb-6">
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-slate-600">분석 데이터 로드 중...</span>
          </div>
        </div>
      ) : summary ? (
        <>
          {/* Layer 1: Hero KPI (5개 핵심지표) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            {/* 수익 */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">수익</h3>
                {getIcon('revenue')}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    ₩{(summary.hero.revenue.current / 1000000).toFixed(1)}M
                  </div>
                  <div
                    className={cn(
                      'text-sm font-medium flex items-center gap-1 mt-1',
                      summary.hero.revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {summary.hero.revenue.growth >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Math.abs(summary.hero.revenue.growth).toFixed(1)}%
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">목표</div>
                  <div className="text-sm font-semibold text-slate-700">
                    ₩{(summary.hero.revenue.target / 1000000).toFixed(1)}M
                  </div>
                </div>
              </div>
            </div>

            {/* 신규 고객 */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">신규 고객</h3>
                {getIcon('contacts')}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    {summary.hero.newContacts.current}명
                  </div>
                  <div
                    className={cn(
                      'text-sm font-medium flex items-center gap-1 mt-1',
                      summary.hero.newContacts.growth >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {summary.hero.newContacts.growth >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Math.abs(summary.hero.newContacts.growth).toFixed(1)}%
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">목표</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {summary.hero.newContacts.target}명
                  </div>
                </div>
              </div>
            </div>

            {/* 전환율 */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">전환율</h3>
                {getIcon('conversion')}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    {summary.hero.conversionRate.current.toFixed(1)}%
                  </div>
                  <div
                    className={cn(
                      'text-sm font-medium flex items-center gap-1 mt-1',
                      summary.hero.conversionRate.growth >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {summary.hero.conversionRate.growth >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Math.abs(summary.hero.conversionRate.growth).toFixed(1)}%p
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">목표</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {summary.hero.conversionRate.target.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* LTV */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">LTV</h3>
                {getIcon('ltv')}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    ₩{(summary.hero.ltv.current / 10000).toFixed(0)}만
                  </div>
                  <div
                    className={cn(
                      'text-sm font-medium flex items-center gap-1 mt-1',
                      summary.hero.ltv.growth >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {summary.hero.ltv.growth >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Math.abs(summary.hero.ltv.growth).toFixed(1)}%
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">목표</div>
                  <div className="text-sm font-semibold text-slate-700">
                    ₩{(summary.hero.ltv.target / 10000).toFixed(0)}만
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Score */}
            <div
              className={cn(
                'rounded-lg p-6 shadow-sm border hover:shadow-md transition',
                getRiskColor(summary.hero.riskScore.status)
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">위험도</h3>
                {getIcon('risk')}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold">
                    {summary.hero.riskScore.current}/100
                  </div>
                  <div className="text-sm font-semibold mt-1">
                    {summary.hero.riskScore.status === 'GREEN' && '🟢 안전'}
                    {summary.hero.riskScore.status === 'YELLOW' && '🟡 주의'}
                    {summary.hero.riskScore.status === 'RED' && '🔴 경고'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Layer 2: 렌즈별 성과 (L0-L10) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                심리학 렌즈별 성과 (상위 5개)
              </h2>

              <div className="space-y-3">
                {summary.lens.slice(0, 5).map((lens, idx) => (
                  <Link
                    key={lens.lens}
                    href={`/analytics/segments?lens=${lens.lens}`}
                    className="block p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-slate-900">
                        {idx + 1}. Lens {lens.lens.toUpperCase()}
                      </div>
                      <div className="text-sm font-bold text-blue-600">
                        {lens.conversionRate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>{lens.totalContacts}명 고객 ({lens.conversions}건 전환)</span>
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(lens.conversionRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/analytics/segments"
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                → 전체 렌즈 분석 보기
              </Link>
            </div>

            {/* Layer 3: 채널별 성과 */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                채널별 성과 (ROAS 기준)
              </h2>

              <div className="space-y-3">
                {summary.channels.slice(0, 5).map((channel, idx) => (
                  <Link
                    key={channel.channel}
                    href={`/analytics/channels?channel=${channel.channel}`}
                    className="block p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-slate-900">
                        {idx + 1}. {channel.channel}
                      </div>
                      <div className="text-sm font-bold text-green-600">
                        ROAS {channel.roas.toFixed(2)}x
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>
                        발송 {channel.sent}건 / 오픈율 {channel.openRate.toFixed(1)}%
                      </span>
                      <span className="text-blue-600 font-medium">클릭율 {channel.clickRate.toFixed(1)}%</span>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/analytics/channels"
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                → 전체 채널 분석 보기
              </Link>
            </div>
          </div>

          {/* Layer 4: 위험도 대시보드 */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              위험도 경고 시스템
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 위험도별 분포 */}
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-sm font-semibold text-green-900 mb-2">🟢 안전 (0-30)</div>
                <div className="text-2xl font-bold text-green-600">안정적</div>
                <div className="text-xs text-green-700 mt-2">위험신호 없음 - 현재 전략 유지</div>
              </div>

              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="text-sm font-semibold text-yellow-900 mb-2">🟡 주의 (30-60)</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {summary.hero.riskScore.status === 'YELLOW' ? '점검 필요' : '양호'}
                </div>
                <div className="text-xs text-yellow-700 mt-2">렌즈별 전환율 모니터링 필요</div>
              </div>

              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="text-sm font-semibold text-red-900 mb-2">🔴 경고 (60-100)</div>
                <div className="text-2xl font-bold text-red-600">
                  {summary.hero.riskScore.status === 'RED' ? '즉시 조치' : '정상'}
                </div>
                <div className="text-xs text-red-700 mt-2">전략 재점검 및 개입 필요</div>
              </div>
            </div>

            <Link
              href="/analytics/optimization"
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              → 위험도 대시보드 및 최적화 전략 보기
            </Link>
          </div>

          {/* Layer 5: 실시간 모니터링 */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              실시간 모니터링 및 자동 리포트
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/analytics/realtime"
                className="p-4 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
              >
                <div className="font-semibold text-blue-900 mb-2">📡 실시간 KPI</div>
                <div className="text-sm text-blue-700">
                  5분 주기 자동 업데이트<br />
                  WebSocket 실시간 스트리밍
                </div>
              </Link>

              <Link
                href="/analytics/reports"
                className="p-4 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 transition cursor-pointer"
              >
                <div className="font-semibold text-purple-900 mb-2">📊 자동 리포트</div>
                <div className="text-sm text-purple-700">
                  매주 금요일 이메일 발송<br />
                  월간/분기 성과 분석
                </div>
              </Link>
              {/* 프로액티브 카드 제거 — /analytics/proactive 페이지가 없어 404였음.
                  해당 기능 구현 시 카드 복원. */}
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600">분석 데이터를 불러올 수 없습니다</p>
          </div>
        </div>
      )}
    </div>
  );
}
