'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, MessageCircle, CheckCircle, DollarSign } from 'lucide-react';

interface HeroKpiProps {
  data: {
    totalSent: number;
    totalClicked: number;
    responseRate: number;
    formCompletionRate: number;
    estimatedRevenue: number;
    trends: {
      responseRateChange: number;
      formCompletionChange: number;
      revenueChange: number;
    };
  };
  loading?: boolean;
}

function KpiCard({
  title,
  value,
  unit = '',
  sub,
  trend,
  trendDir = 'up',
  color,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  unit?: string;
  sub: string;
  trend?: number;
  trendDir?: 'up' | 'down' | 'neutral';
  color: string;
  icon: React.ComponentType<{ className: string }>;
}) {
  const trendColor =
    trendDir === 'up'
      ? 'text-green-600'
      : trendDir === 'down'
      ? 'text-red-600'
      : 'text-gray-500';

  return (
    <div
      className={`rounded-xl border p-6 shadow-sm transition-all hover:shadow-md ${color} group`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{sub}</p>
          {trend !== undefined && (
            <div className={`text-sm font-semibold mt-2 ${trendColor} flex items-center gap-1`}>
              <TrendingUp className="w-3 h-3" />
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
        </div>
        <div className="p-3 bg-white/50 dark:bg-gray-800 rounded-lg group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
          <Icon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border p-6 shadow-sm bg-gray-50 dark:bg-gray-900 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
          <div className="mt-3 h-10 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-40 mt-2"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-16 mt-2"></div>
        </div>
        <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded-lg w-12 h-12"></div>
      </div>
    </div>
  );
}

export function Loop5HeroKpi({ data, loading }: HeroKpiProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="📤 SMS 발송수"
        value={data.totalSent}
        sub="지난 7일 합계"
        color="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800"
        icon={MessageCircle}
      />
      <KpiCard
        title="💬 응답율"
        value={data.responseRate.toFixed(1)}
        unit="%"
        sub="클릭 또는 폼 제출"
        trend={data.trends.responseRateChange}
        trendDir={data.trends.responseRateChange > 0 ? 'up' : 'down'}
        color="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800"
        icon={CheckCircle}
      />
      <KpiCard
        title="📋 폼 완성율"
        value={data.formCompletionRate.toFixed(1)}
        unit="%"
        sub="폼 시작 → 제출 완료"
        trend={data.trends.formCompletionChange}
        trendDir={data.trends.formCompletionChange > 0 ? 'up' : 'down'}
        color="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800"
        icon={CheckCircle}
      />
      <KpiCard
        title="💰 예상 매출"
        value={`$${(data.estimatedRevenue / 1000).toFixed(1)}K`}
        sub="지난 7일 예상치"
        trend={data.trends.revenueChange}
        trendDir={data.trends.revenueChange > 0 ? 'up' : 'down'}
        color="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800"
        icon={DollarSign}
      />
    </div>
  );
}
