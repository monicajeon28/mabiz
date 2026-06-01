"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

type LedgerEntry = {
  id: number;
  agentId: number;
  saleId: number | null;
  type: string;
  amount: number;
  balance: number;
  yearMonth: string;
  note: string | null;
  createdAt: string;
};

type Summary = {
  totalEarned: number;          // SALES_COMMISSION + OVERRIDE_COMMISSION
  totalSalesCommission: number;
  totalOverride: number;
  totalWithholding: number;
  net: number;
};

// GMcruise CommissionLedger 실제 entryType 값
const TYPE_META: Record<string, { label: string; badge: string }> = {
  SALES_COMMISSION:   { label: "판매커미션",  badge: "bg-green-100 text-green-700" },
  OVERRIDE_COMMISSION:{ label: "오버라이드",  badge: "bg-emerald-100 text-emerald-700" },
  BRANCH_COMMISSION:  { label: "지점커미션",  badge: "bg-teal-100 text-teal-700" },
  HQ_NET:             { label: "본사순수익",  badge: "bg-blue-100 text-blue-700" },
  WITHHOLDING:        { label: "원천징수",    badge: "bg-red-100 text-red-700" },
};

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

function formatAmount(type: string, amount: number) {
  const absAmount = Math.abs(amount);
  const isNegative = type === "WITHHOLDING" || amount < 0;
  return (
    <span className={isNegative ? "text-red-500 font-medium" : "text-green-600 font-medium"}>
      {isNegative ? "-" : "+"}
      {absAmount.toLocaleString("ko-KR")}원
    </span>
  );
}

const LIMIT = 20;

function buildYmOptions() {
  const opts: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return opts;
}

const YM_OPTIONS = buildYmOptions();

const TYPE_TABS: { value: string; label: string }[] = [
  { value: "",                   label: "전체" },
  { value: "SALES_COMMISSION",   label: "판매커미션" },
  { value: "OVERRIDE_COMMISSION",label: "오버라이드" },
  { value: "BRANCH_COMMISSION",  label: "지점커미션" },
  { value: "WITHHOLDING",        label: "원천징수" },
];

export default function CommissionLedgerPage() {
  const [ledger,     setLedger]     = useState<LedgerEntry[]>([]);
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [type,       setType]       = useState("");
  const [yearMonth,  setYearMonth]  = useState("");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (type)      params.set("type",      type);
    if (yearMonth) params.set("yearMonth", yearMonth);
    fetch(`/api/commission-ledger?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`서버 오류 (HTTP ${r.status})`);
        return r.json();
      })
      .then((d) => {
        if (d.ok) {
          setLedger(d.ledger ?? []);
          setSummary(d.summary ?? null);
          setTotal(d.total ?? 0);
          setTotalPages(d.totalPages ?? 1);
          setError(null);
        } else {
          setError(d.error || "데이터를 불러올 수 없습니다.");
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          console.error("[commission-ledger]", e);
          setError(e.message || "데이터를 불러올 수 없습니다.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [page, type, yearMonth]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  function handleTypeTab(v: string) {
    setType(v);
    setPage(1);
  }

  function handleYm(v: string) {
    setYearMonth(v);
    setPage(1);
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold text-navy-900">커미션 원장</h1>
        </div>
        <p className="text-sm text-gray-500">에이전트별 커미션 수익·지급·조정 내역</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">판매커미션</p>
          <p className="text-lg font-bold text-green-600">
            {summary ? `+${summary.totalSalesCommission.toLocaleString("ko-KR")}원` : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">오버라이드</p>
          <p className="text-lg font-bold text-emerald-600">
            {summary ? `+${summary.totalOverride.toLocaleString("ko-KR")}원` : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">원천징수</p>
          <p className="text-lg font-bold text-red-500">
            {summary ? `-${summary.totalWithholding.toLocaleString("ko-KR")}원` : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">실수령액</p>
          <p className="text-lg font-bold text-navy-900">
            {summary ? `${summary.net.toLocaleString("ko-KR")}원` : "—"}
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Type tabs */}
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTypeTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                type === tab.value
                  ? "bg-navy-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* yearMonth select */}
        <select
          value={yearMonth}
          onChange={(e) => handleYm(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 bg-white"
        >
          <option value="">전체 기간</option>
          {YM_OPTIONS.map((ym) => (
            <option key={ym} value={ym}>{ym}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">커미션 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">날짜</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">기간</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">구분</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-sm">금액</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-sm">잔액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledger.map((entry) => {
                  const meta = TYPE_META[entry.type] ?? { label: entry.type, badge: "bg-gray-100 text-gray-500" };
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-sm font-mono whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm font-mono">
                        {entry.yearMonth}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatAmount(entry.type, entry.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">
                        {entry.balance.toLocaleString("ko-KR")}원
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">
                        {entry.note ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-600">총 {total.toLocaleString("ko-KR")}건</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
