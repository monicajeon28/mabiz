"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart2, Users, MousePointerClick, TrendingUp, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";
import { KpiCard } from "@/components/marketing/KpiCard";
import { TrendChart } from "@/components/marketing/TrendChart";
import { FunnelChart } from "@/components/marketing/FunnelChart";
import { TopPagesTable } from "@/components/marketing/TopPagesTable";
import type { DashboardData } from "@/types/marketing";

function SkeletonCard() {
  return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
}

export default function MarketingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/marketing/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
        } else {
          setError(d.message ?? "데이터를 불러올 수 없습니다.");
        }
      })
      .catch((err) => {
        logger.error('[fetchData]', { err });
        const isNetworkError = err instanceof TypeError || !navigator.onLine;
        setError(
          isNetworkError
            ? "인터넷 연결을 확인하고 다시 시도해주세요."
            : "서버에 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">마케팅 대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">랜딩페이지 성과 및 전환율 분석</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-offset-1 focus:ring-navy-600"
          aria-label="새로고침"
          aria-busy={loading}
        >
          <RefreshCw
            className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {error && (
        <div className="text-center py-16" role="alert">
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* ━━━ 요약 카드 4개 ━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : data ? (
          <>
            <KpiCard
              title="전체 방문수"
              value={data.summary.totalViews}
              icon={<BarChart2 className="w-5 h-5 text-navy-600" />}
            />
            <KpiCard
              title="전체 등록수"
              value={data.summary.totalRegistrations}
              sub={`전환율 ${data.summary.conversionRate}%`}
              icon={<Users className="w-5 h-5 text-navy-600" />}
              delta={data.summary.registrationDelta}
            />
            <KpiCard
              title="퍼널 진입"
              value={data.summary.totalFunnelEntered}
              icon={<MousePointerClick className="w-5 h-5 text-navy-600" />}
            />
            <KpiCard
              title="구매 전환율"
              value={`${data.summary.purchaseRate}%`}
              sub={`구매 ${data.summary.totalPurchased}건`}
              icon={<TrendingUp className="w-5 h-5 text-navy-600" />}
            />
          </>
        ) : null}
      </div>

      {/* ━━━ 7일 트렌드 ━━━ */}
      {!loading && data && <TrendChart trend={data.trend} loading={loading} />}

      {/* ━━━ 전환 퍼널 차트 ━━━ */}
      {data && <FunnelChart summary={data.summary} />}

      {/* ━━━ 상위 랜딩페이지 ━━━ */}
      {data && <TopPagesTable topPages={data.topPages} loading={loading} />}
    </div>
  );
}
