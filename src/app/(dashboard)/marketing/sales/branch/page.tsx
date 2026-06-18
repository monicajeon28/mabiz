"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, Lock, ShoppingCart, Building2, TrendingUp } from "lucide-react";
import { logger } from "@/lib/logger";
import { formatAmount, formatDate, formatMonth } from "@/lib/marketing-utils";
import { SkeletonRow } from "@/components/marketing/SkeletonRow";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { SalesBarChart } from "@/components/marketing/SalesBarChart";
import { KpiCard } from "@/components/marketing/KpiCard";
import { cn } from "@/lib/utils";
import type { RecentRow, SalesApiData } from "@/types/marketing";

interface AgentSalesRow {
  agentId: string;
  agentName: string;
  revenue: number;
  count: number;
  conversionRate: string;
}

interface BranchApiData {
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
  salesByAgent: AgentSalesRow[];
  topAgents: Array<{ rank: 1 | 2 | 3; agentName: string; revenue: number }>;
  recent: RecentRow[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number };
}

// ─── 판매원별 테이블 (PC) ─────────────────────────────────────
function AgentSalesTable({ agents, loading }: { agents: AgentSalesRow[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">판매원명</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">이번 달 매출</th>
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
          {!loading && agents.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <TrendingUp className="w-10 h-10 text-gray-300" />
                  <p className="text-base font-medium text-gray-500">판매 데이터가 없어요</p>
                </div>
              </td>
            </tr>
          )}
          {!loading &&
            agents.map((agent) => (
              <tr key={agent.agentId} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-4 text-base text-gray-700">{agent.agentName}</td>
                <td className="px-4 py-4 text-right text-base font-semibold text-gray-900">
                  {formatAmount(agent.revenue)}
                </td>
                <td className="px-4 py-4 text-right text-base text-gray-700">{agent.count}건</td>
                <td className="px-4 py-4 text-right text-base font-medium text-green-600">{agent.conversionRate}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── TOP 3 리더보드 카드 ───────────────────────────────────────
function TopAgentsSection({ topAgents, loading }: { topAgents: Array<{ rank: 1 | 2 | 3; agentName: string; revenue: number }>; loading: boolean }) {
  const medalEmojis = ['🥇', '🥈', '🥉'];
  const bgColors = ['bg-yellow-50', 'bg-gray-50', 'bg-orange-50'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {loading ? (
        [...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-xl p-6 bg-white animate-pulse">
            <div className="h-6 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-32 bg-gray-200 rounded" />
          </div>
        ))
      ) : topAgents.length === 0 ? (
        <div className="col-span-1 md:col-span-3 text-center py-8 text-gray-500">
          <p className="text-base">판매원 데이터가 없습니다</p>
        </div>
      ) : (
        topAgents.map((agent) => (
          <div
            key={`${agent.rank}`}
            className={cn("border rounded-xl p-6 text-center", bgColors[agent.rank - 1])}
          >
            <div className="text-4xl mb-2">{medalEmojis[agent.rank - 1]}</div>
            <div className="text-base font-medium text-gray-600 mb-2">
              {agent.rank === 1 ? '1위' : agent.rank === 2 ? '2위' : '3위'}
            </div>
            <div className="text-lg font-semibold text-gray-800 mb-3">{agent.agentName}</div>
            <div className="text-2xl font-bold text-gray-900">{formatAmount(agent.revenue)}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── 랜딩페이지별 테이블 ───────────────────────────────────────
function LandingPageTable({ byLanding, loading }: { byLanding: Array<{ landingPageTitle: string; revenue: number; count: number }>; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">랜딩페이지</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">매출</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">건수</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <>
              <SkeletonRow cols={3} />
              <SkeletonRow cols={3} />
            </>
          )}
          {!loading && byLanding.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center py-8 text-gray-500">
                <p className="text-base">데이터가 없습니다</p>
              </td>
            </tr>
          )}
          {!loading &&
            byLanding.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-base text-gray-700">{row.landingPageTitle}</td>
                <td className="px-4 py-4 text-right text-base font-semibold text-gray-900">
                  {formatAmount(row.revenue)}
                </td>
                <td className="px-4 py-4 text-right text-base text-gray-700">{row.count}건</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 최근 결제 테이블 (PC) ─────────────────────────────────────
function RecentPaymentTable({ recent, loading }: { recent: RecentRow[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">주문번호</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">구매자</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">금액</th>
            <th scope="col" className="text-center px-4 py-3 text-base font-medium text-gray-600">상태</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">결제일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <>
              <SkeletonRow cols={5} />
              <SkeletonRow cols={5} />
              <SkeletonRow cols={5} />
            </>
          )}
          {!loading && recent.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <ShoppingCart className="w-10 h-10 text-gray-300" />
                  <p className="text-base font-medium text-gray-500">아직 결제 내역이 없어요</p>
                </div>
              </td>
            </tr>
          )}
          {!loading &&
            recent.map((row) => (
              <tr key={row.orderId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-gray-500 font-mono text-base">{row.orderId}</td>
                <td className="px-4 py-4 text-base text-gray-700">
                  {row.buyerName}
                  {row.masked && row.buyerTel && (
                    <span className="inline-flex items-center gap-0.5 text-gray-400 italic text-base ml-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      {row.buyerTel}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right text-base font-semibold text-gray-900">
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-4 text-center">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-4 text-base text-gray-600">{formatDate(row.paidAt)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination 컴포넌트 ──────────────────────────────────────
function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-4 py-2 text-base font-medium border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        이전
      </button>
      <span className="text-base text-gray-600">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages || totalPages === 0}
        className="px-4 py-2 text-base font-medium border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        다음
      </button>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function BranchSalesDashboard() {
  const { data: session } = useSession();
  const [data, setData] = useState<BranchApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/marketing/sales/branch?page=${page}&limit=20`);
      if (!res.ok) {
        logger.error("대리점 매출 조회 실패", { status: res.status });
        return;
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      logger.error("대리점 매출 조회 오류", { err });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!session) {
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
              <h1 className="text-2xl font-bold text-gray-900">우리 조직 매출 현황</h1>
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
        {/* KPI 카드 3개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard
            label="이번 달 매출"
            value={data.summary.totalRevenue}
            color="bg-blue-50"
          />
          <KpiCard
            label="결제 건수"
            value={data.summary.paidCount}
            color="bg-purple-50"
          />
          <KpiCard
            label="순매출 (환불 차감)"
            value={data.summary.netRevenue}
            color="bg-green-50"
          />
        </div>

        {/* 판매원별 매출 섹션 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">판매원별 매출 현황</h2>
          <AgentSalesTable agents={data.salesByAgent} loading={loading} />
        </div>

        {/* TOP 3 리더보드 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">🏆 판매원 TOP 3</h2>
          <TopAgentsSection topAgents={data.topAgents} loading={loading} />
        </div>

        {/* 월별 추이 그래프 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">월별 매출 추이</h2>
          <SalesBarChart monthly={data.monthly} />
        </div>

        {/* 랜딩페이지별 매출 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">랜딩페이지별 매출 기여</h2>
          <LandingPageTable byLanding={data.byLanding} loading={loading} />
        </div>

        {/* 최근 결제 내역 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">최근 결제 내역</h2>
          <RecentPaymentTable recent={data.recent} loading={loading} />
          <PaginationControls
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
