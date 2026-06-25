"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";
import {
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Building2,
  Download,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SaleItem = {
  id: string;
  productName: string;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  withholdingAmount: number;
  netAmount: number;
  refundedAmount: number;
  status: string;
  travelCompletedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type PayslipItem = {
  id: number;
  yearMonth: string;
  baseCommission: number;
  bonus: number | null;
  deduction: number | null;
  withholdingAmount: number;
  netAmount: number;
  status: string;
  expectedPaymentDate: string;
  paidAt: string | null;
  note: string | null;
  tierLabel?: string | null;
};

type Summary = {
  totalCommission: number;
  totalWithholding: number;
  totalDeduction: number;
  totalNet: number;
  pendingCount: number;
  paidCount: number;
};

type DocumentInfo = {
  hasIdCard: boolean;
  hasBankBook: boolean;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ApiResponse = {
  ok: boolean;
  role: string;
  data: {
    sales?: SaleItem[];
    payslips?: PayslipItem[];
    summary: Summary;
    document: DocumentInfo;
    pagination: Pagination;
  };
  error?: string;
  message?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALE_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "정산예정",  color: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "지급완료",  color: "bg-green-100 text-green-700" },
  REFUNDED:  { label: "환불",      color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소",      color: "bg-red-100 text-red-700" },
};

const PAYSLIP_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "정산예정",  color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "승인완료",  color: "bg-blue-100 text-blue-700" },
  SENT:     { label: "지급완료",  color: "bg-green-100 text-green-700" },
};

const LIMIT = 20;

function buildYmOptions(): string[] {
  const opts: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return opts;
}

const YM_OPTIONS = buildYmOptions();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR");
}

function getSaleStatusMeta(status: string) {
  return SALE_STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
}

function getPayslipStatusMeta(status: string) {
  return PAYSLIP_STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DocumentBanner({ doc }: { doc: DocumentInfo }) {
  const allOk = doc.hasIdCard && doc.hasBankBook;
  const missing: string[] = [];
  if (!doc.hasIdCard) missing.push("신분증");
  if (!doc.hasBankBook) missing.push("통장사본");

  return (
    <div
      className={`mb-5 rounded-xl border p-4 ${
        allOk
          ? "bg-green-50 border-green-200"
          : "bg-amber-50 border-amber-300"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        {/* 서류 상태 */}
        <div className="flex items-center gap-3 flex-wrap">
          <Building2
            className={`w-5 h-5 flex-shrink-0 ${allOk ? "text-green-600" : "text-amber-600"}`}
          />
          <span className="font-semibold text-sm text-gray-800">서류 상태</span>

          <span className="flex items-center gap-1 text-sm">
            {doc.hasIdCard ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={doc.hasIdCard ? "text-green-700" : "text-red-600 font-medium"}>
              신분증
            </span>
          </span>

          <span className="flex items-center gap-1 text-sm">
            {doc.hasBankBook ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={doc.hasBankBook ? "text-green-700" : "text-red-600 font-medium"}>
              통장사본
            </span>
          </span>
        </div>

        {/* 계좌 정보 */}
        {(doc.bankName || doc.bankAccount) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-gray-400">|</span>
            <span>
              {doc.bankName ?? "-"} &nbsp;{doc.bankAccount ?? "-"}
            </span>
            {doc.bankAccountHolder && (
              <span className="text-gray-500">({doc.bankAccountHolder})</span>
            )}
          </div>
        )}
      </div>

      {/* 미제출 경고 + CTA */}
      {!allOk && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>{missing.join(", ")}</strong>을 제출하면 정산 승인이 더 빠릅니다.
            </span>
          </div>
          <a
            href="/settings/documents"
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors"
          >
            서류 업로드하기 →
          </a>
        </div>
      )}
    </div>
  );
}

// 이번달 지급 예정액 히어로 카드 (AGENT/OWNER 전용)
function HeroPayoutCard({ summary, payslips }: { summary: Summary; payslips: PayslipItem[] }) {
  // 가장 최근 APPROVED/PENDING payslip에서 예정 지급일 추출
  const upcoming = payslips.find((p) => p.status === "APPROVED" || p.status === "PENDING");
  const expectedDate = upcoming?.expectedPaymentDate
    ? new Date(upcoming.expectedPaymentDate).toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "다음달 15일";

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 p-6 text-white shadow-lg">
      <p className="text-sm font-medium text-teal-100 mb-1">이번달 받을 금액</p>
      <p className="text-4xl font-bold tracking-tight mb-3">
        {formatKRW(summary.totalNet)}
      </p>
      <div className="flex flex-wrap gap-4 text-sm text-teal-100">
        <span>지급 예정일 <span className="font-semibold text-white">{expectedDate}</span></span>
        {summary.pendingCount > 0 && (
          <span>승인 대기 <span className="font-semibold text-yellow-300">{summary.pendingCount}건</span></span>
        )}
      </div>
    </div>
  );
}

function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-500 mb-1">총 커미션</p>
        <p className="text-lg font-bold text-blue-600">
          {formatKRW(summary.totalCommission)}
        </p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-500 mb-1">원천징수 (3.3%)</p>
        <p className="text-lg font-bold text-red-500">
          -{formatKRW(summary.totalWithholding)}
        </p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-500 mb-1">환수금액</p>
        <p className="text-lg font-bold text-orange-500">
          {summary.totalDeduction > 0 ? `-${formatKRW(summary.totalDeduction)}` : formatKRW(0)}
        </p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-500 mb-1">실지급액</p>
        <p className="text-lg font-bold text-teal-700">
          {formatKRW(summary.totalNet)}
        </p>
      </div>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FREE_SALES Table
// ---------------------------------------------------------------------------

function FreeSalesTable({ sales }: { sales: SaleItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">상품명</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">판매금액</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">수수료율</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">커미션</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">원천징수</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">환불공제</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">실지급액</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">정산기준일</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sales.map((s) => {
            const meta = getSaleStatusMeta(s.status);
            return (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">
                  {s.productName}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatKRW(s.saleAmount)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {s.commissionRate.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right text-blue-600 font-medium">
                  {formatKRW(s.commissionAmount)}
                </td>
                <td className="px-4 py-3 text-right text-red-500">
                  -{formatKRW(s.withholdingAmount)}
                </td>
                <td className="px-4 py-3 text-right text-orange-500">
                  {s.refundedAmount > 0 ? `-${formatKRW(s.refundedAmount)}` : "-"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-teal-700">
                  {formatKRW(s.netAmount)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                  {formatDate(s.travelCompletedAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                    {meta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AGENT / OWNER Table
// ---------------------------------------------------------------------------

function PayslipTable({ payslips }: { payslips: PayslipItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">정산기간</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Tier</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">기본커미션</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">보너스</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">환수금액</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">원천징수(3.3%)</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">실지급액</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">예정지급일</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payslips.map((p) => {
            const meta = getPayslipStatusMeta(p.status);
            return (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                  {p.yearMonth}
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                  {p.tierLabel ?? '-'}
                </td>
                <td className="px-4 py-3 text-right text-blue-600 font-medium">
                  {formatKRW(p.baseCommission)}
                </td>
                <td className="px-4 py-3 text-right text-green-600">
                  {p.bonus != null && p.bonus > 0 ? `+${formatKRW(p.bonus)}` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-orange-500">
                  {p.deduction != null && p.deduction > 0 ? `-${formatKRW(p.deduction)}` : "-"}
                </td>
                <td className="px-4 py-3 text-right text-red-500">
                  -{formatKRW(p.withholdingAmount)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-teal-700">
                  {formatKRW(p.netAmount)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                  {formatDate(p.expectedPaymentDate)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                    {meta.label}
                  </span>
                  {p.note && (
                    <p className="text-xs text-gray-400 mt-0.5 max-w-[120px] truncate">{p.note}</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function StatementsPage() {
  const [apiData, setApiData]   = useState<ApiResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [period, setPeriod]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]         = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (period)       params.set("period", period);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/statements/my?${params}`, {
      signal: controller.signal,
      credentials: "include",
    })
      .then((r) => {
        if (r.status === 403) throw new Error("접근 권한이 없습니다. 파트너 계정으로 로그인해주세요.");
        if (!r.ok) throw new Error(`서버 오류 (HTTP ${r.status})`);
        return r.json() as Promise<ApiResponse>;
      })
      .then((d) => {
        if (d.ok) {
          setApiData(d);
          setError(null);
        } else {
          setError(d.error ?? "데이터를 불러올 수 없습니다.");
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") {
          logger.error("[statements]", { message: e.message });
          setError(e.message || "데이터를 불러올 수 없습니다.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [page, period, statusFilter]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Derived state
  const role       = apiData?.role;
  const summary    = apiData?.data.summary;
  const document   = apiData?.data.document;
  const pagination = apiData?.data.pagination;
  const sales      = apiData?.data.sales ?? [];
  const payslips   = apiData?.data.payslips ?? [];

  const isFreeSales    = role === "FREE_SALES";
  const isAgentOrOwner = role === "AGENT" || role === "OWNER";
  const isPartner      = isFreeSales || isAgentOrOwner;
  const totalPages     = pagination?.totalPages ?? 1;
  const totalCount     = pagination?.total ?? 0;

  // Status tab options differ by role
  const statusTabs = isFreeSales
    ? [
        { value: "",           label: "전체" },
        { value: "PENDING",    label: "정산예정" },
        { value: "COMPLETED",  label: "지급완료" },
        { value: "REFUNDED",   label: "환불" },
        { value: "CANCELLED",  label: "취소" },
      ]
    : [
        { value: "",        label: "전체" },
        { value: "PENDING", label: "정산예정" },
        { value: "APPROVED",label: "승인완료" },
        { value: "SENT",    label: "지급완료" },
      ];

  const hasItems = isFreeSales ? sales.length > 0 : payslips.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <ReceiptText className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold text-gray-900">내 정산 내역</h1>
        </div>
        <p className="text-sm text-gray-500">
          {isFreeSales
            ? "여행별 커미션 정산 내역 (출발일 기준)"
            : "월별 커미션 정산 내역 (다음달 15일 지급)"}
        </p>
      </div>

      {/* 비파트너 역할 안내 */}
      {!loading && !error && apiData && !isPartner && (
        <div className="mb-5 p-5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <div className="flex items-start gap-3">
            <ReceiptText className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">파트너 계정이 필요합니다</p>
              <p className="text-blue-700">
                {apiData.message ?? "정산 내역은 자유대리점장 / 소속대리점장 / 지사장 계정으로 로그인하면 확인할 수 있습니다."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 히어로 카드 — AGENT/OWNER: 이번달 받을 금액 크게 표시 */}
      {!loading && !error && isAgentOrOwner && summary && (
        <HeroPayoutCard summary={summary} payslips={payslips} />
      )}

      {/* Document Banner — show only when data loaded */}
      {!loading && document && <DocumentBanner doc={document} />}

      {/* Summary Cards */}
      {!loading && !error && summary && <SummaryCards summary={summary} />}

      {/* Sticky Filters + Download */}
      {!loading && apiData && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 md:sticky md:bottom-auto md:border-t md:shadow-lg px-4 py-3 md:px-0 md:py-0 md:mb-5 md:border-none md:shadow-none">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? "bg-teal-700 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Period select */}
            <select
              value={period}
              onChange={(e) => { setPeriod(e.target.value); setPage(1); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 bg-white"
            >
              <option value="">전체 기간</option>
              {YM_OPTIONS.map((ym) => (
                <option key={ym} value={ym}>{ym}</option>
              ))}
            </select>

            {/* CSV Export */}
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({ format: "csv" });
                if (period) params.set("period", period);
                if (statusFilter) params.set("status", statusFilter);
                window.location.href = `/api/statements/my/export?${params.toString()}`;
              }}
              className="ml-auto w-full md:w-auto flex items-center justify-center md:justify-start gap-1.5 px-3 py-2 md:py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              CSV 내보내기
            </button>
          </div>
        </div>
      )}

      {/* Padding for sticky filter on mobile */}
      {!loading && apiData && (
        <div className="h-16 md:h-0" />
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1 ml-2 px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors whitespace-nowrap flex-shrink-0"
            >
              ↺ 다시 시도
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonRows count={6} />
      ) : !hasItems ? (
        <div className="text-center py-20 text-gray-500">
          <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {period ? `${period} 기간에 해당하는 정산 내역이 없습니다.` : "정산 내역이 없습니다."}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {isFreeSales
              ? "아직 완료된 여행 정산이 없습니다. 여행 출발일 이후 정산이 등록됩니다."
              : period
              ? "다른 기간을 선택해 보세요."
              : "이번 달 정산 내역이 아직 등록되지 않았습니다. 다른 기간을 선택해 보세요."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {isFreeSales && <FreeSalesTable sales={sales} />}
          {isAgentOrOwner && <PayslipTable payslips={payslips} />}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              총 {totalCount.toLocaleString("ko-KR")}건
              {summary && (
                <span className="ml-3 text-gray-400">
                  정산예정 {summary.pendingCount}건 · 지급완료 {summary.paidCount}건
                </span>
              )}
            </div>
            {totalPages > 1 && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
