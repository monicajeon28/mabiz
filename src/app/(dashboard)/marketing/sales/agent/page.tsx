"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/hooks/useSession";
import { RefreshCw, Lock, ShoppingCart, Trophy, FileText } from "lucide-react";
import { logger } from "@/lib/logger";
import { formatAmount, formatDate } from "@/lib/marketing-utils";
import { SkeletonRow } from "@/components/marketing/SkeletonRow";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { SalesBarChart } from "@/components/marketing/SalesBarChart";
import { KpiCard } from "@/components/marketing/KpiCard";
import type { RecentRow } from "@/types/marketing";

interface AgentApiData {
  ok: boolean;
  summary: {
    totalRevenue: number;
    totalRefund: number;
    netRevenue: number;
    paidCount: number;
    month: string;
  };
  monthly: Array<{ month: string; revenue: number; count: number }>;
  byLanding: Array<{ landingPageId: string | null; landingPageTitle: string; revenue: number; count: number }>;
  topPage: {
    landingPageId: string;
    landingPageTitle: string;
    revenue: number;
    count: number;
  } | null;
  totalPages: number;
  recent: RecentRow[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number };
}

// ─── 성과 하이라이트 카드 ──────────────────────────────────────
function HighlightCards({ topPage, totalPages, loading }: { topPage: AgentApiData['topPage']; totalPages: number; loading: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 최고 매출 페이지 */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
        {loading ? (
          <>
            <div className="h-6 w-32 bg-blue-200 rounded mb-3 animate-pulse" />
            <div className="h-8 w-40 bg-blue-200 rounded" />
          </>
        ) : topPage ? (
          <>
            <div className="flex items-center gap-2 text-base font-medium text-blue-700 mb-3">
              <Trophy className="w-5 h-5" />
              최고 매출 페이지
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
              {topPage.landingPageTitle}
            </div>
            <div className="text-3xl font-bold text-blue-700 mb-2">
              {formatAmount(topPage.revenue)}
            </div>
            <div className="text-base text-blue-600">이번 달 ({topPage.count}건)</div>
          </>
        ) : (
          <div className="py-8 text-center text-blue-600">
            <p className="text-base">아직 매출 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* 운영 중인 페이지 */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-6">
        {loading ? (
          <>
            <div className="h-6 w-32 bg-green-200 rounded mb-3 animate-pulse" />
            <div className="h-8 w-40 bg-green-200 rounded" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-base font-medium text-green-700 mb-3">
              <FileText className="w-5 h-5" />
              운영 중인 페이지
            </div>
            <div className="text-5xl font-bold text-green-700 mb-2">
              {totalPages}
            </div>
            <div className="text-base text-green-600">총 만든 랜딩페이지</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 내 페이지별 매출 테이블 ───────────────────────────────────
function MyPageSalesTable({ byLanding, loading }: { byLanding: Array<{ landingPageTitle: string; revenue: number; count: number }>; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">페이지명</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">매출</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">건수</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">전환율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <>
              <SkeletonRow cols={4} />
              <SkeletonRow cols={4} />
              <SkeletonRow cols={4} />
            </>
          )}
          {!loading && byLanding.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <FileText className="w-10 h-10 text-gray-300" />
                  <p className="text-base font-medium text-gray-500">아직 매출 데이터가 없어요</p>
                  <p className="text-base text-gray-500">랜딩페이지를 생성하고 고객이 구매하면 여기에 표시됩니다</p>
                </div>
              </td>
            </tr>
          )}
          {!loading &&
            byLanding.map((row, i) => {
              const conversionRate = row.count > 0 ? ((row.count / 10) * 100).toFixed(1) : '0.0';
              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-base text-gray-700">{row.landingPageTitle}</td>
                  <td className="px-4 py-4 text-right text-base font-semibold text-gray-900">
                    {formatAmount(row.revenue)}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-gray-700">{row.count}건</td>
                  <td className="px-4 py-4 text-right text-base font-medium text-green-600">{conversionRate}%</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

// ─── 최근 결제 테이블 ──────────────────────────────────────────
function RecentPaymentTable({ recent, loading }: { recent: RecentRow[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">주문번호</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">구매자</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">금액</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">결제일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <>
              <SkeletonRow cols={4} />
              <SkeletonRow cols={4} />
              <SkeletonRow cols={4} />
            </>
          )}
          {!loading && recent.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <ShoppingCart className="w-10 h-10 text-gray-300" />
                  <p className="text-base font-medium text-gray-500">아직 결제 내역이 없어요</p>
                </div>
              </td>
            </tr>
          )}
          {!loading &&
            recent.slice(0, 10).map((row) => (
              <tr key={row.orderId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-gray-500 font-mono text-base text-sm">{row.orderId.slice(0, 12)}...</td>
                <td className="px-4 py-4 text-base text-gray-700">{row.buyerName}</td>
                <td className="px-4 py-4 text-right text-base font-semibold text-gray-900">
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-4 text-base text-gray-600">{formatDate(row.paidAt)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function AgentSalesDashboard() {
  const { userId } = useSession();
  const [data, setData] = useState<AgentApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/marketing/sales/agent?page=1&limit=20');
      if (!res.ok) {
        logger.error("판매원 매출 조회 실패", { status: res.status });
        return;
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      logger.error("판매원 매출 조회 오류", { err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-base text-gray-500">로그인이 필요합니다</p>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-base text-gray-500">데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">내 판매 성과</h1>
              <p className="text-base text-gray-600 mt-2">{data.summary.month} 기준</p>
            </div>
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-2 px-4 py-2 text-base font-medium border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* KPI 카드 2개 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <KpiCard
            label="이번 달 매출"
            value={data.summary.totalRevenue}
            color="bg-blue-50"
          />
          <KpiCard
            label="순매출 (환불 차감)"
            value={data.summary.netRevenue}
            color="bg-green-50"
          />
        </div>

        {/* 성과 하이라이트 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">성과 하이라이트</h2>
          <HighlightCards
            topPage={data.topPage}
            totalPages={data.totalPages}
            loading={loading}
          />
        </div>

        {/* 월별 추이 그래프 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">월별 매출 추이</h2>
          <SalesBarChart monthly={data.monthly} />
        </div>

        {/* 내 페이지별 매출 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">내 페이지별 매출</h2>
          <MyPageSalesTable byLanding={data.byLanding} loading={loading} />
        </div>

        {/* 최근 결제 내역 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">최근 결제 내역</h2>
          <RecentPaymentTable recent={data.recent} loading={loading} />
        </div>
      </div>
    </div>
  );
}
