"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart2, Users, MousePointerClick, TrendingUp } from "lucide-react";

type Summary = {
  totalViews: number;
  totalRegistrations: number;
  totalFunnelEntered: number;
  totalPurchased: number;
  conversionRate: number;
  purchaseRate: number;
};

type TopPage = {
  id: string;
  title: string;
  slug: string;
  viewCount: number;
  registrations: number;
  conversionRate: number;
};

type TrendDay = {
  date: string;
  count: number;
};

type DashboardData = {
  summary: Summary;
  topPages: TopPage[];
  trend: TrendDay[];
};

function KpiCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start gap-4">
      <div className="bg-navy-50 rounded-lg p-2 shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-navy-900 mt-0.5">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
}

export default function MarketingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
        } else {
          setError(d.message ?? "데이터를 불러올 수 없습니다.");
        }
      })
      .catch(() => setError("네트워크 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const maxCount =
    data?.trend.reduce((m, d) => Math.max(m, d.count), 0) ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">마케팅 대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">랜딩페이지 성과 및 전환율 분석</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
          {error}
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
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-8">
        <h2 className="text-base font-semibold text-navy-900 mb-4">최근 7일 등록 추이</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : data?.trend.length ? (
          <div className="space-y-2">
            {data.trend.map((day) => (
              <div key={day.date} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 shrink-0">
                  {day.date.slice(5)}
                </span>
                <div className="flex-1 bg-gray-100 rounded h-6 relative">
                  <div
                    className="bg-navy-600 rounded h-6 transition-all"
                    style={{
                      width: `${maxCount > 0 ? (day.count / maxCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium w-6 text-right shrink-0">
                  {day.count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">최근 7일 등록 데이터가 없습니다.</p>
        )}
      </div>

      {/* ━━━ 상위 랜딩페이지 5개 ━━━ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-navy-900 mb-4">상위 랜딩페이지 TOP 5</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : data?.topPages.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-100">
                  <th className="text-left font-medium pb-2 pr-4">페이지명</th>
                  <th className="text-right font-medium pb-2 px-3">방문</th>
                  <th className="text-right font-medium pb-2 px-3">등록</th>
                  <th className="text-right font-medium pb-2 px-3">전환율</th>
                  <th className="text-right font-medium pb-2 pl-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((page) => (
                  <tr
                    key={page.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-navy-900 max-w-[200px] truncate">
                      {page.title}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600">
                      {page.viewCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600">
                      {page.registrations.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          page.conversionRate >= 5
                            ? "text-green-600"
                            : page.conversionRate >= 2
                            ? "text-yellow-600"
                            : "text-gray-400"
                        }`}
                      >
                        {page.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <Link
                        href={`/landing-pages/${page.id}`}
                        className="text-xs text-navy-600 hover:underline whitespace-nowrap"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">랜딩페이지 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
