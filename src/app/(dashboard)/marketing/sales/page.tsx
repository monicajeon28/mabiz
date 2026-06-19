"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, Lock, ShoppingCart, Building2, FileText, User } from "lucide-react";
import { logger } from "@/lib/logger";
import { formatAmount, formatDate, formatMonth } from "@/lib/marketing-utils";
import { SkeletonRow } from "@/components/marketing/SkeletonRow";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { SalesBarChart } from "@/components/marketing/SalesBarChart";
import { KpiCard } from "@/components/marketing/KpiCard";
import { cn } from "@/lib/utils";
import type { RecentRow, SalesApiData, SalesSummary, OrgBreakdown, AdminPersonalSales } from "@/types/marketing";


// ─── 최근 결제 테이블 (PC) ─────────────────────────────────────
function RecentPaymentTable({ recent, loading }: { recent: RecentRow[], loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">📋 주문번호</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">👤 구매자</th>
            <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">💵 금액</th>
            <th scope="col" className="text-center px-4 py-3 text-base font-medium text-gray-600">📊 상태</th>
            <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">📅 결제일</th>
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
              <td colSpan={5} className="text-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <ShoppingCart className="w-10 h-10 text-gray-300" />
                  <p className="text-base font-medium text-gray-500">아직 결제 내역이 없어요</p>
                  <p className="text-base text-gray-500">랜딩페이지를 통해 고객이 결제하면 여기에 표시됩니다</p>
                </div>
              </td>
            </tr>
          )}
          {!loading &&
            recent.map((row) => (
              <tr key={row.orderId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-gray-500 font-mono text-base">{row.orderId}</td>
                <td className="px-4 py-4 text-base text-gray-700">
                  {row.buyerName}{" "}
                  {row.masked ? (
                    <span
                      className="inline-flex items-center gap-0.5 text-gray-400 italic text-base"
                      title="개인정보 보호를 위해 마스킹된 번호입니다"
                    >
                      <Lock className="w-4 h-4 shrink-0" />
                      {row.buyerTel}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-base">{row.buyerTel}</span>
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

// ─── 최근 결제 카드 (모바일) ───────────────────────────────────
function RecentPaymentCard({ recent, loading }: { recent: RecentRow[], loading: boolean }) {
  return (
    <div className="p-4 space-y-2">
      {loading && (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} className="border rounded-xl p-3 bg-white">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </>
      )}
      {!loading && recent.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10">
          <ShoppingCart className="w-10 h-10 text-gray-300" />
          <p className="text-base font-medium text-gray-500 text-center">아직 결제 내역이 없어요</p>
          <p className="text-base text-gray-500 text-center">랜딩페이지를 통해 고객이 결제하면 여기에 표시됩니다</p>
        </div>
      )}
      {!loading && recent.map((row) => (
        <div key={row.orderId} className="border rounded-xl p-3 bg-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-medium">{row.buyerName}</span>
            <StatusBadge status={row.status} />
          </div>
          <p className="text-base font-bold text-gray-900">{formatAmount(row.amount)}</p>
          <p className="text-base mt-1">
            {row.masked ? (
              <span
                className="inline-flex items-center gap-0.5 text-gray-400 italic text-base"
                title="개인정보 보호를 위해 마스킹된 번호입니다"
              >
                <Lock className="w-4 h-4 shrink-0" />
                {row.buyerTel}
              </span>
            ) : (
              <span className="text-gray-600 text-base">{row.buyerTel}</span>
            )}{" "}
            · {row.paidAt ? formatDate(row.paidAt) : '-'}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── 관리자 개인 링크 매출 (GLOBAL_ADMIN 전용) ─────────────────
function AdminPersonalSalesSection({ sales }: { sales: AdminPersonalSales }) {
  return (
    <div className="bg-purple-50 rounded-xl border border-purple-200">
      <div className="px-6 py-4 border-b border-purple-100 flex items-center gap-3">
        <User className="w-5 h-5 text-purple-600 shrink-0" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">👤 내가 만든 링크 - 이번 달 매출</h2>
          <p className="text-base text-gray-500 mt-0.5">당신이 직접 만든 랜딩페이지에서 발생한 매출이에요</p>
          {/* [API-SALES-005] 이중 집계 안내: 관리자 링크 매출은 대리점 합계와 별도로 집계됩니다 */}
          <p className="text-sm text-purple-600 mt-0.5">※ 아래 대리점 매출과 별개로 집계돼요</p>
        </div>
      </div>
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 카드 1: 이번 달 매출 */}
          <div className="bg-white rounded-xl border border-purple-100 p-4">
            <p className="text-base text-gray-500 mb-1">💵 이번 달 매출</p>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(sales.totalRevenue)}</p>
            <p className="text-sm text-gray-400 mt-1">결제 완료 {sales.paidCount}건</p>
          </div>
          {/* 카드 2: 환불 금액 */}
          <div className="bg-white rounded-xl border border-purple-100 p-4">
            <p className="text-base text-gray-500 mb-1">↩️ 반품/환불</p>
            <p className="text-2xl font-bold text-red-600">
              {sales.totalRefund > 0 ? formatAmount(sales.totalRefund) : '없음'}
            </p>
            {sales.totalRefund > 0 && (
              <p className="text-sm text-red-400 mt-1">이번 달 반품된 금액이에요</p>
            )}
          </div>
          {/* 카드 3: 순매출 */}
          <div className="bg-white rounded-xl border border-purple-100 p-4">
            <p className="text-base text-gray-500 mb-1">✅ 실제 매출</p>
            <p className="text-2xl font-bold text-green-700">{formatAmount(sales.netRevenue)}</p>
            <p className="text-sm text-gray-400 mt-1">반품을 뺀 실제 매출</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 대리점별 매출 breakdown (GLOBAL_ADMIN 전용) ────────────────
function OrgBreakdownSection({ orgBreakdown }: { orgBreakdown: OrgBreakdown[] }) {
  if (orgBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">🏢 대리점별 이번 달 매출</h2>
            <p className="text-base text-gray-500 mt-0.5">각 대리점 팀원들이 이번 달 성사시킨 매출을 보여줘요</p>
            {/* [LIB-TYPES-008 / LIB-TYPES-NEW-002] orgBreakdownBasis 귀속 기준 안내 */}
            <p className="text-sm text-blue-500 mt-0.5">※ 팀원들 소속 대리점 기준으로 집계돼요</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 py-12">
          <Building2 className="w-10 h-10 text-gray-300" />
          <p className="text-base font-medium text-gray-500">이번 달 대리점 실적이 없어요</p>
          <p className="text-base text-gray-500">대리점에서 결제가 생기면 여기에 나타나요</p>
        </div>
      </div>
    );
  }

  const totalRevenue = orgBreakdown.reduce((sum, o) => sum + o.totalRevenue, 0);
  const totalCount   = orgBreakdown.reduce((sum, o) => sum + o.paidCount,    0);
  const totalNet     = orgBreakdown.reduce((sum, o) => sum + o.netRevenue,    0);
  // [UI-SALES-NEW-002] IIFE 제거 — tfoot 합계 환불 미리 계산
  const totalRefund  = orgBreakdown.reduce((sum, o) => sum + o.totalRefund,  0);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">🏢 대리점별 이번 달 매출</h2>
          <p className="text-base text-gray-500 mt-0.5">각 대리점 팀원들이 이번 달 성사시킨 매출을 보여줘요</p>
          {/* [LIB-TYPES-008 / LIB-TYPES-NEW-002] orgBreakdownBasis 귀속 기준 안내 */}
          <p className="text-sm text-blue-500 mt-0.5">※ 팀원들 소속 대리점 기준 (랜딩페이지 만든 사람이 아님)</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="text-left px-6 py-3 text-base font-medium text-gray-600">대리점 이름</th>
              <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">💵 이번 달 매출</th>
              <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">개수</th>
              <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">↩️ 반품</th>
              <th scope="col" className="text-right px-6 py-3 text-base font-medium text-gray-600">✅ 실제 매출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orgBreakdown.map((org) => (
              <tr key={org.orgId} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-base font-medium text-gray-900">{org.orgName}</td>
                <td className="px-6 py-4 text-right text-base text-gray-900">{formatAmount(org.totalRevenue)}</td>
                <td className="px-6 py-4 text-right text-base text-gray-600">{org.paidCount}건</td>
                <td className="px-6 py-4 text-right text-base text-red-600">{org.totalRefund > 0 ? formatAmount(org.totalRefund) : '-'}</td>
                <td className="px-6 py-4 text-right text-base font-semibold text-green-700">{formatAmount(org.netRevenue)}</td>
              </tr>
            ))}
          </tbody>
          {/* 전체 합계 행 */}
          <tfoot className="bg-blue-50 border-t-2 border-blue-200">
            <tr>
              <td className="px-6 py-4 text-base font-bold text-blue-900">🎯 전체 합계</td>
              <td className="px-6 py-4 text-right text-base font-bold text-blue-900">{formatAmount(totalRevenue)}</td>
              <td className="px-6 py-4 text-right text-base font-bold text-blue-900">{totalCount}건</td>
              <td className="px-6 py-4 text-right text-base font-bold text-red-700">
                {totalRefund > 0 ? formatAmount(totalRefund) : '-'}
              </td>
              <td className="px-6 py-4 text-right text-base font-bold text-green-800">{formatAmount(totalNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── 접근 거부 화면 (AGENT / FREE_SALES / 403) ────────────────
function AccessDeniedView() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Lock className="w-16 h-16 text-gray-300" />
        <h1 className="text-xl font-bold text-gray-700">🔒 접근할 수 없어요</h1>
        <p className="text-base text-gray-500 text-center max-w-sm">
          이 페이지는 대리점장이나 관리자만 볼 수 있어요.<br />
          권한이 필요하면 관리자에게 말씀해주세요.
        </p>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function MarketingSalesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [data,      setData]      = useState<SalesApiData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [page,      setPage]      = useState(1);
  const refreshCtrlRef = useRef<AbortController | null>(null);

  const load = useCallback((pageNum: number = 1, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setPage(pageNum);
    fetch(`/api/marketing/sales?page=${pageNum}&limit=20`, { signal })
      .then((res) => {
        // UI-SALES-001: 403 응답 시 명확한 접근 거부 UI 표시
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        return res.json();
      })
      .then((json: SalesApiData | null) => {
        if (!json) return;
        if (json.ok) {
          setData(json);
        } else {
          setError("데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('[MarketingSalesPage] fetch error', { err });
        setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  // [UI-SALES-009] 세션에서 역할을 즉시 읽어 AGENT/FREE_SALES 차단 (fetch 완료 전 조기 차단)
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  // [UI-SALES-NEW-001] 세션 로딩 중(status === 'loading')이면 데이터 UI 노출 방지
  // next-auth의 status를 사용하여 로딩/미인증/인증 상태를 정확히 구분
  if (sessionStatus === 'loading') {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" aria-label="불러오는 중" />
      </div>
    );
  }
  if (sessionRole === 'AGENT' || sessionRole === 'FREE_SALES') {
    return <AccessDeniedView />;
  }

  // UI-SALES-001: AGENT/FREE_SALES 접근 차단 화면
  if (forbidden) {
    return <AccessDeniedView />;
  }

  const summary: SalesSummary | undefined = data?.summary;
  const monthly      = data?.monthly      ?? [];
  const byLanding    = data?.byLanding    ?? [];
  const recent       = data?.recent       ?? [];
  const orgBreakdown = data?.orgBreakdown ?? [];
  const adminPersonalSales: AdminPersonalSales | null = data?.adminPersonalSales ?? null;
  // UI-SALES-002: 서버가 명시적으로 내려주는 isGlobalAdmin 플래그 사용 (실적 0인 경우 오판 방지)
  const isGlobalAdmin = data?.isGlobalAdmin === true;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 leading-relaxed">
      {/* 제목 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isGlobalAdmin ? '💰 모든 랜딩페이지 매출 관리' : '💰 랜딩페이지 매출 관리'}
          </h1>
          {summary && (
            <p className="text-base text-gray-600 mt-1">{formatMonth(summary.month)}의 매출 현황이에요</p>
          )}
        </div>
        <button
          onClick={() => {
            refreshCtrlRef.current?.abort();
            refreshCtrlRef.current = new AbortController();
            load(page, refreshCtrlRef.current.signal);
          }}
          disabled={loading}
          aria-busy={loading}
          className="p-3 min-w-[48px] min-h-[48px] hover:bg-gray-100 rounded-lg transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 flex items-center justify-center gap-2"
          aria-label="새로 읽기"
        >
          <RefreshCw className={cn("w-5 h-5 text-gray-500", loading && "animate-spin")} />
          <span className="hidden sm:inline text-base text-gray-600">새로 읽기</span>
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="text-center py-12">
          <p className="text-base text-red-500 mb-3">{error}</p>
          <button
            onClick={() => {
              refreshCtrlRef.current?.abort();
              refreshCtrlRef.current = new AbortController();
              load(1, refreshCtrlRef.current.signal);
            }}
            className="px-6 py-3 min-h-[48px] bg-gray-900 text-white rounded-lg text-base"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* KPI 카드 3개 (전체 합계) */}
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
            label={isGlobalAdmin ? '💵 모든 매출' : '💵 매출'}
            value={formatAmount(summary.totalRevenue)}
            sub={`✅ 결제 완료 ${summary.paidCount}건`}
            color="bg-white border-gray-200"
          />
          <KpiCard
            label="📊 결제 건수"
            value={`${summary.paidCount}건`}
            color="bg-blue-50 border-blue-100"
          />
          <KpiCard
            label="✅ 실제 매출"
            value={formatAmount(summary.netRevenue)}
            sub={summary.totalRefund > 0 ? `↩️ 반품 ${formatAmount(summary.totalRefund)}` : undefined}
            color="bg-green-50 border-green-100"
          />
        </div>
      ) : (
        // [UI-SALES-017] summary null + 로드완료 + 에러없음 → 빈 카드로 CLS 방지
        !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border p-5 bg-white h-[88px]" />
            ))}
          </div>
        )
      )}

      {/* 월별 막대 그래프 */}
      {!loading && monthly.length > 0 && <SalesBarChart monthly={monthly} />}

      {/* UI-SALES-010: GLOBAL_ADMIN 전용 — 로딩 중 스켈레톤으로 CLS 방지 (sessionRole undefined 포함: 세션 로드 전 CLS 방지) */}
      {loading && (sessionRole === 'GLOBAL_ADMIN' || sessionRole === undefined) && (
        <div className="space-y-4">
          {/* 관리자 개인 링크 매출 스켈레톤 */}
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
            <div className="h-6 w-48 bg-purple-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-purple-100 p-4">
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          {/* 대리점별 매출 breakdown 스켈레톤 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse mb-2" />
            ))}
          </div>
        </div>
      )}

      {/* UI-SALES-003: GLOBAL_ADMIN 전용 - 관리자 개인 링크 매출 */}
      {/* [UI-SALES-NEW-003] adminPersonalSales가 null이어도 섹션 표시 (API는 항상 객체 반환) */}
      {!loading && isGlobalAdmin && (
        adminPersonalSales !== null
          ? <AdminPersonalSalesSection sales={adminPersonalSales} />
          : (
            <div className="bg-purple-50 rounded-xl border border-purple-200 px-6 py-5">
              <p className="text-base text-purple-600">이번 달 내 링크 매출이 없어요</p>
            </div>
          )
      )}

      {/* UI-SALES-002: GLOBAL_ADMIN 전용 - 대리점별 매출 breakdown */}
      {!loading && isGlobalAdmin && (
        <OrgBreakdownSection orgBreakdown={orgBreakdown} />
      )}

      {/* 랜딩페이지별 매출 기여 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">📄 랜딩페이지별 매출</h2>
          <p className="text-base text-gray-500 mt-1">어떤 페이지에서 가장 많은 매출이 났는지 보세요</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="text-left px-4 py-3 text-base font-medium text-gray-600">📄 페이지</th>
                <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">💵 매출</th>
                <th scope="col" className="text-right px-4 py-3 text-base font-medium text-gray-600">개수</th>
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
                  <td colSpan={3} className="text-center py-10">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-10 h-10 text-gray-300" />
                      <p className="text-base font-medium text-gray-500">아직 매출이 없어요</p>
                      <p className="text-base text-gray-500">페이지를 고객에게 공유하면 매출이 여기에 나타나요</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                byLanding.map((row, i) => (
                  <tr key={row.landingPageId ?? row.landingPageTitle ?? String(i)} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-base text-gray-700">{row.landingPageTitle}</td>
                    <td className="px-4 py-4 text-right text-base font-semibold text-gray-900">
                      {formatAmount(row.revenue)}
                    </td>
                    <td className="px-4 py-4 text-right text-base text-gray-600">{row.count}건</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 최근 결제 내역 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">🛒 최근 결제 내역</h2>
          <p className="text-base text-gray-500 mt-1">최근 고객들의 결제 내역을 확인해보세요</p>
        </div>

        {/* 모바일 카드 */}
        <div className="md:hidden">
          <RecentPaymentCard recent={recent} loading={loading} />
        </div>

        {/* PC 테이블 */}
        <div className="hidden md:block">
          <RecentPaymentTable recent={recent} loading={loading} />
        </div>

        {/* 페이지네이션 */}
        {!loading && data?.pagination && data.pagination.totalPages > 1 && (() => {
          const paging = data.pagination;
          return (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  refreshCtrlRef.current?.abort();
                  refreshCtrlRef.current = new AbortController();
                  load(Math.max(1, page - 1), refreshCtrlRef.current.signal);
                }}
                disabled={page <= 1}
                className="px-4 py-3 min-h-[48px] border border-gray-300 rounded-lg text-base hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← 이전
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, paging.totalPages))].map((_, i) => {
                  let pageNum: number;
                  if (paging.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= paging.totalPages - 2) {
                    pageNum = paging.totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => {
                        refreshCtrlRef.current?.abort();
                        refreshCtrlRef.current = new AbortController();
                        load(pageNum, refreshCtrlRef.current.signal);
                      }}
                      aria-label={`${pageNum}페이지로 이동`}
                      aria-current={pageNum === page ? 'page' : undefined}
                      className={cn(
                        "px-4 py-3 min-h-[48px] rounded-lg text-base font-medium",
                        pageNum === page
                          ? "bg-gray-900 text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  refreshCtrlRef.current?.abort();
                  refreshCtrlRef.current = new AbortController();
                  load(Math.min(paging.totalPages, page + 1), refreshCtrlRef.current.signal);
                }}
                disabled={page >= paging.totalPages}
                className="px-4 py-3 min-h-[48px] border border-gray-300 rounded-lg text-base hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음 →
              </button>
              <span className="text-base text-gray-600 ml-2">
                {page} / {paging.totalPages}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
