"use client";

import { useState, useEffect } from "react";
import { BarChart2, TrendingUp, DollarSign, RotateCcw, CheckCircle } from "lucide-react";

interface Agent {
  agentId: number;
  agentName: string;
  mallUserId: string | null;
  totalSaleAmount: number;
  totalCommission: number;
  totalRefund: number;
  confirmedCount: number;
  refundRate: number;
}

interface GrandTotal {
  totalSaleAmount: number;
  totalCommission: number;
  totalRefund: number;
  confirmedCount: number;
}

interface ReportData {
  ok: true;
  year: string;
  agents: Agent[];
  grandTotal: GrandTotal;
}

function formatKRW(value: number): string {
  if (value >= 100_000_000) {
    return (value / 100_000_000).toFixed(1).replace(/\.0$/, "") + "억";
  }
  if (value >= 10_000) {
    return (value / 10_000).toFixed(0) + "만";
  }
  return value.toLocaleString("ko-KR") + "원";
}

function formatFull(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
}

const RANK_STYLES: Record<number, string> = {
  1: "border-l-4 border-l-yellow-400",
  2: "border-l-4 border-l-gray-400",
  3: "border-l-4 border-l-amber-600",
};

const RANK_LABEL_STYLES: Record<number, string> = {
  1: "text-yellow-500 font-bold",
  2: "text-gray-500 font-bold",
  3: "text-amber-600 font-bold",
};

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-8 w-32 bg-gray-200 rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-gray-100">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2023 + 1 }, (_, i) => String(2023 + i));

export default function YearEndReportPage() {
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/year-end-report?year=${year}`, { signal })
      .then((res) => {
        if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (!signal.aborted) setData(json);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!signal.aborted) setError(err.message ?? "데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [year]);

  const gt = data?.grandTotal;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-navy-900" />
          <h1 className="text-2xl font-bold text-navy-900">연말정산 보고서</h1>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm font-medium text-gray-600">
            연도
          </label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : gt ? (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-navy-900" />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">총매출액</span>
              </div>
              <p className="text-2xl font-bold text-navy-900" title={formatFull(gt.totalSaleAmount)}>
                {formatKRW(gt.totalSaleAmount)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gold-500" />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">총커미션</span>
              </div>
              <p className="text-2xl font-bold text-gold-500" title={formatFull(gt.totalCommission)}>
                {formatKRW(gt.totalCommission)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">총환불</span>
              </div>
              <p className="text-2xl font-bold text-red-500" title={formatFull(gt.totalRefund)}>
                {formatKRW(gt.totalRefund)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">확정건수</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {gt.confirmedCount.toLocaleString("ko-KR")}건
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">{year}년 대리점장별 실적</span>
          {data && (
            <span className="text-sm text-gray-600">총 {data.agents.length}명</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-900 text-white">
                <th className="px-4 py-3 text-left font-semibold w-14">순위</th>
                <th className="px-4 py-3 text-left font-semibold">대리점장</th>
                <th className="px-4 py-3 text-right font-semibold">확정건수</th>
                <th className="px-4 py-3 text-right font-semibold">총매출액</th>
                <th className="px-4 py-3 text-right font-semibold">총커미션</th>
                <th className="px-4 py-3 text-right font-semibold">총환불</th>
                <th className="px-4 py-3 text-right font-semibold">환불율</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : data && data.agents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-600">
                    <div className="flex flex-col items-center gap-2">
                      <BarChart2 className="w-10 h-10 text-gray-300" />
                      <span>{year}년 데이터가 없습니다.</span>
                    </div>
                  </td>
                </tr>
              ) : data ? (
                data.agents.map((agent, idx) => {
                  const rank = idx + 1;
                  const rowStyle = RANK_STYLES[rank] ?? "";
                  const rankLabelStyle = RANK_LABEL_STYLES[rank] ?? "text-gray-500";
                  const isHighRefund = agent.refundRate >= 30;

                  return (
                    <tr
                      key={agent.agentId}
                      className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${rowStyle}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`text-sm ${rankLabelStyle}`}>#{rank}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{agent.agentName}</p>
                        {agent.mallUserId && (
                          <p className="text-sm text-gray-600 mt-0.5">{agent.mallUserId}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {agent.confirmedCount.toLocaleString("ko-KR")}건
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">
                        <span title={formatFull(agent.totalSaleAmount)}>
                          {formatKRW(agent.totalSaleAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gold-500 font-medium">
                        <span title={formatFull(agent.totalCommission)}>
                          {formatKRW(agent.totalCommission)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                        <span title={formatFull(agent.totalRefund)}>
                          {formatKRW(agent.totalRefund)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isHighRefund ? "text-red-600" : "text-gray-600"}`}>
                        {agent.refundRate}%
                        {isHighRefund && (
                          <span className="ml-1 text-sm text-red-500" title="환불율 30% 초과">!</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
