"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { logger } from "@/lib/logger";
import { CommissionButtons } from "./commission-buttons";
import type { UserRole } from "@/lib/rbac";

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
  commissionRate?: number | null;
};

type Summary = {
  totalEarned: number;          // SALES_COMMISSION + OVERRIDE_COMMISSION
  totalSalesCommission: number;
  totalOverride: number;
  totalWithholding: number;
  net: number;
};

// 수당 항목별 설명 (50대 친화적)
const TYPE_META: Record<string, { label: string; badge: string }> = {
  SALES_COMMISSION:   { label: "판매 수당",   badge: "bg-green-100 text-green-700" },
  OVERRIDE_COMMISSION:{ label: "추가 수당",   badge: "bg-emerald-100 text-emerald-700" },
  BRANCH_COMMISSION:  { label: "지점 수당",   badge: "bg-teal-100 text-teal-700" },
  HQ_NET:             { label: "본사 정산액", badge: "bg-blue-100 text-blue-700" },
  WITHHOLDING:        { label: "세금 차감",   badge: "bg-red-100 text-red-700" },
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
  { value: "SALES_COMMISSION",   label: "판매 수당" },
  { value: "OVERRIDE_COMMISSION",label: "추가 수당" },
  { value: "BRANCH_COMMISSION",  label: "지점 수당" },
  { value: "WITHHOLDING",        label: "세금 차감" },
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
  const [userRole,   setUserRole]   = useState<UserRole>("AGENT"); // 기본값: AGENT
  const abortRef = useRef<AbortController | null>(null);

  // Phase 3: 사용자 역할 로드 (버튼 권한 결정용)
  // API 응답에서 역할 정보를 추출하여 설정
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const res = await fetch('/api/commission-ledger?limit=1', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          // API 응답에 role이 포함되어 있으면 설정
          if (data.userRole) {
            setUserRole(data.userRole as UserRole);
          }
        }
      } catch (err) {
        logger.error('[commission-ledger] role load error', { error: err instanceof Error ? err.message : String(err) });
        // role load 실패시 기본값 유지
      }
    };
    loadUserRole();
  }, []);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (type)      params.set("type",      type);
    if (yearMonth) params.set("yearMonth", yearMonth);
    fetch(`/api/commission-ledger?${params}`, { signal: controller.signal, credentials: 'include' })
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
          logger.error("[commission-ledger]", { error: e instanceof Error ? e.message : String(e) });
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

  // Phase 3: 버튼 액션 핸들러
  const handleSettle = async () => {
    alert('💰 월말정산\n\n모든 판매원의 수당을 정산하는 프로세스를 시작합니다.');
    // TODO: Phase 4에서 openSettleModal() 구현
  };

  const handleDispute = async () => {
    alert('🚨 이의제기\n\n수당 계산에 이의가 있으신가요?\n상세 이유를 입력해주세요.');
    // TODO: Phase 4에서 openDisputeModal() 구현
  };

  const handleVerify = async () => {
    alert('✅ 확인\n\n선택한 항목의 상세 정보를 확인합니다.');
    // TODO: Phase 4에서 openDetailModal() 구현
  };

  const handleExcelDownload = async () => {
    alert('📥 엑셀다운\n\n수당 기록을 엑셀로 다운로드합니다.');
    // TODO: Phase 5에서 downloadExcel() 구현
  };

  const handleRecalculate = async () => {
    alert('🔄 재계산\n\n모든 팀의 수당을 다시 계산하는 프로세스를 시작합니다.');
    // TODO: Phase 6에서 openRecalculateModal() 구현
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold text-navy-900">수당 현황</h1>
        </div>
        <p className="text-sm text-gray-500">판매원별 수당 입금·차감·조정 내역을 확인합니다</p>
      </div>

      {/* Phase 3: 버튼 권한 시스템 */}
      <CommissionButtons
        userRole={userRole}
        onSettle={handleSettle}
        onDispute={handleDispute}
        onVerify={handleVerify}
        onExcelDownload={handleExcelDownload}
        onRecalculate={handleRecalculate}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">판매 수당</p>
          <p className="text-lg font-bold text-green-600">
            {summary ? `+${summary.totalSalesCommission.toLocaleString("ko-KR")}원` : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">추가 수당</p>
          <p className="text-lg font-bold text-emerald-600">
            {summary ? `+${summary.totalOverride.toLocaleString("ko-KR")}원` : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">세금 차감</p>
          <p className="text-lg font-bold text-red-500">
            {summary ? `-${summary.totalWithholding.toLocaleString("ko-KR")}원` : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 mb-1">받을 금액</p>
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
          <p className="text-xs text-gray-500 mt-2">
            크루즈닷몰 연동 계정이 필요합니다. 관리자에 문의해주세요.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">처리 날짜</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">해당 기간</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">항목</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-sm">비율</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-sm">금액</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-sm">현재 잔액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">비고</th>
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
                      <td className="px-4 py-3 text-right text-gray-600 text-sm">
                        {entry.commissionRate != null ? `${entry.commissionRate}%` : '-'}
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
