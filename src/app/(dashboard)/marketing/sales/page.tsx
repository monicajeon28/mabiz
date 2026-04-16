"use client";

import { useEffect, useState } from "react";

// ─── 타입 ─────────────────────────────────────────────────────
interface Summary {
  totalRevenue: number;
  totalRefund:  number;
  netRevenue:   number;
  paidCount:    number;
  month:        string;
}

interface MonthlyRow {
  month:   string;
  revenue: number;
  count:   number;
}

interface LandingRow {
  landingPageId:    string | null;
  landingPageTitle: string;
  revenue:          number;
  count:            number;
}

interface RecentRow {
  orderId:       string;
  amount:        number;
  status:        string;
  buyerName:     string;
  buyerTel:      string;
  paidAt:        string | null;
  landingPageId: string | null;
}

interface ApiData {
  ok:        boolean;
  summary:   Summary;
  monthly:   MonthlyRow[];
  byLanding: LandingRow[];
  recent:    RecentRow[];
}

// ─── 유틸 ─────────────────────────────────────────────────────
function formatAmount(n: number) {
  return n.toLocaleString() + "원";
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}.${m}`;
}

// ─── 상태 배지 ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        결제완료
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
        환불
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      대기중
    </span>
  );
}

// ─── 막대 그래프 (CSS only) ────────────────────────────────────
function BarChart({ monthly }: { monthly: MonthlyRow[] }) {
  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">최근 6개월 매출</h2>
      <div className="flex items-end gap-3 h-40">
        {monthly.map((row) => {
          const heightPct = Math.max((row.revenue / maxRevenue) * 100, 2);
          return (
            <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 truncate w-full text-center">
                {row.revenue > 0 ? formatAmount(row.revenue) : ""}
              </span>
              <div
                className="w-full rounded-t-md bg-blue-500 transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${row.month}: ${formatAmount(row.revenue)} (${row.count}건)`}
              />
              <span className="text-xs text-gray-500 mt-1">{formatMonth(row.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KPI 카드 ─────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── 스켈레톤 ─────────────────────────────────────────────────
function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function MarketingSalesPage() {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/sales")
      .then((res) => res.json())
      .then((json: ApiData) => {
        if (json.ok) {
          setData(json);
        } else {
          setError("데이터를 불러오지 못했습니다.");
        }
      })
      .catch(() => setError("네트워크 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const summary   = data?.summary;
  const monthly   = data?.monthly   ?? [];
  const byLanding = data?.byLanding ?? [];
  const recent    = data?.recent    ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* 제목 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">랜딩페이지 매출관리</h1>
        {summary && (
          <p className="text-sm text-gray-400 mt-0.5">{summary.month} 기준</p>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* KPI 카드 3개 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border p-5 bg-white">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="이번 달 매출"
            value={formatAmount(summary.totalRevenue)}
            sub={`결제완료 ${summary.paidCount}건`}
            color="bg-white border-gray-200"
          />
          <KpiCard
            label="결제 건수"
            value={`${summary.paidCount}건`}
            color="bg-blue-50 border-blue-100"
          />
          <KpiCard
            label="순매출"
            value={formatAmount(summary.netRevenue)}
            sub={summary.totalRefund > 0 ? `환불 ${formatAmount(summary.totalRefund)}` : undefined}
            color="bg-green-50 border-green-100"
          />
        </div>
      ) : null}

      {/* 월별 막대 그래프 */}
      {!loading && monthly.length > 0 && <BarChart monthly={monthly} />}

      {/* 랜딩페이지별 매출 기여 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">랜딩페이지별 매출 기여</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">랜딩페이지</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">매출</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">건수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <>
                  <SkeletonRow cols={3} />
                  <SkeletonRow cols={3} />
                  <SkeletonRow cols={3} />
                </>
              )}
              {!loading && byLanding.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-gray-400">
                    데이터가 없습니다
                  </td>
                </tr>
              )}
              {!loading &&
                byLanding.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">{row.landingPageTitle}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatAmount(row.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.count}건</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 최근 결제 내역 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">최근 결제 내역</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">주문번호</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">구매자</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">금액</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">결제일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <>
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                </>
              )}
              {!loading && recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400">
                    결제 내역이 없습니다
                  </td>
                </tr>
              )}
              {!loading &&
                recent.map((row) => (
                  <tr key={row.orderId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.orderId}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.buyerName}{" "}
                      <span className="text-gray-400 text-xs">{row.buyerTel}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(row.paidAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
