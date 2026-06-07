"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, RotateCcw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { AffiliateSalesResponse } from "@/lib/affiliate/types";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";

type Sale = {
  id: number;
  agentId: number | null;
  status: string;
  saleAmount: number;
  salesCommission: number | null;
  yearMonth: string | null;
  saleDate: string | null;
  confirmedAt: string | null;
  externalOrderCode: string | null;
  agentDisplayName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  // 수당 귀속(대리점장 구매확인)
  managerDisplayName?: string | null;
  presalesDisplayName?: string | null;
  presalesPhone?: string | null;
  commissionOwnerType?: string | null;
  commissionOwnerConfirmed?: boolean;
  confirmedOwnerAt?: string | null;
};

const OWNER_LABEL: Record<string, string> = { PRESALES: "프리세일즈", BRANCH_MANAGER: "대리점장" };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:          { label: "대기",     color: "bg-yellow-100 text-yellow-700" },
  PENDING_APPROVAL: { label: "승인대기", color: "bg-orange-100 text-orange-700" },
  APPROVED:         { label: "승인",     color: "bg-green-100 text-green-700" },
  CONFIRMED:        { label: "확정",     color: "bg-blue-100 text-blue-700" },
  REJECTED:         { label: "거절",     color: "bg-red-100 text-red-700" },
  REFUNDED:         { label: "환불",     color: "bg-gray-100 text-gray-500" },
  CANCELLED:        { label: "취소",     color: "bg-gray-100 text-gray-600" },
};

export default function AffiliateSalesPage() {
  const { toast } = useToast();
  const [sales,   setSales]   = useState<Sale[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<number | null>(null);
  // 수당 귀속 확정 모달
  const [confirmTarget, setConfirmTarget] = useState<{ sale: Sale; ownerType: "PRESALES" | "BRANCH_MANAGER"; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const totalPages = Math.ceil(total / 20);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    fetch(`/api/affiliate-sales?${params}`, { signal })
      .then((r) => r.json() as Promise<AffiliateSalesResponse | { ok: false }>)
      .then((d) => {
        if (d.ok) { setSales(d.sales ?? []); setTotal(d.total ?? 0); }
        else { setSales([]); setTotal(0); }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSales([]); setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const doAction = async (id: number, action: "approve" | "reject" | "refund") => {
    setActing(id);
    try {
      const r = await fetch(`/api/affiliate-sales/${id}/${action}`, { method: "POST" });

      // ✅ HTTP 상태 코드 확인
      if (!r.ok) {
        const errorMsg = await r.text().catch(() => `HTTP ${r.status}`);
        logger.warn(`[affiliate-sales] ${action} 실패`, { id, status: r.status, error: errorMsg });
        toast({ title: '요청 실패', description: `(${r.status}): ${errorMsg}`, variant: 'destructive' });
        setActing(null);
        return;
      }

      const d = await r.json().catch(() => ({ ok: false }));

      if (!d.ok) {
        logger.warn("[affiliate-sales] action 실패", { id, action, message: d.message });
        toast({ title: `${action} 실패`, description: d.message || '서버 오류', variant: 'destructive' });
        setActing(null);
        return;
      }

      toast({ title: `${action} 완료` });
      setActing(null);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '네트워크 오류';
      logger.warn("[affiliate-sales] action 네트워크 오류", { id, action, err: msg });
      toast({ title: '네트워크 오류', description: msg, variant: 'destructive' });
      setActing(null);
    }
  };

  // 수당 귀속 확정 (몰로 발신)
  const doConfirmOwner = async () => {
    if (!confirmTarget) return;
    const { sale, ownerType } = confirmTarget;
    setConfirming(true);
    try {
      const r = await fetch(`/api/affiliate-sales/${sale.id}/confirm-owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerType }),
      });
      const d = await r.json().catch(() => ({ ok: false }));
      if (r.ok && d.ok) {
        toast({ title: "구매확인 완료", description: `#${sale.id} → ${OWNER_LABEL[ownerType]} 귀속 확정` });
        setConfirmTarget(null);
        load();
      } else {
        toast({ title: "구매확인 실패", description: d.error || `HTTP ${r.status}`, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "네트워크 오류", description: err instanceof Error ? err.message : "전송 실패", variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-900">판매 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">GMcruise AffiliateSale 승인/거절/환불</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["", "PENDING", "PENDING_APPROVAL", "APPROVED", "CONFIRMED", "REJECTED", "REFUNDED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                status === s ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "" ? "전체" : (STATUS_LABELS[s]?.label ?? s)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p>판매 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">판매원</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">고객</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-sm">판매액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">기간</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">수당 귀속</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s) => {
                  const st = STATUS_LABELS[s.status] ?? { label: s.status, color: "bg-gray-100 text-gray-500" };
                  const isPending = s.status === "PENDING" || s.status === "PENDING_APPROVAL";
                  const canRefund = s.status === "APPROVED" || s.status === "CONFIRMED";
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 text-sm">#{s.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.agentDisplayName ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{s.customerPhone ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{s.saleAmount.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{s.yearMonth ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      {/* 수당 귀속: 프리세일즈/대리점장 표기 + 2택 구매확인 or 확정배지 */}
                      <td className="px-4 py-3">
                        {(s.presalesDisplayName || s.managerDisplayName) && (
                          <div className="mb-1 space-y-0.5 text-xs text-gray-500">
                            {s.presalesDisplayName && <div>프리세일즈: <span className="text-gray-700">{s.presalesDisplayName}</span>{s.presalesPhone ? ` (${s.presalesPhone})` : ""}</div>}
                            {s.managerDisplayName && <div>대리점장: <span className="text-gray-700">{s.managerDisplayName}</span></div>}
                          </div>
                        )}
                        {s.commissionOwnerConfirmed ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            (s.status === "REFUNDED" || s.status === "CANCELLED")
                              ? "bg-gray-100 text-gray-400 line-through" // 환불·취소 시 무력화 표시(몰이 정산 처리)
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            확정 · {OWNER_LABEL[s.commissionOwnerType ?? ""] ?? s.commissionOwnerType ?? "-"}
                            {s.confirmedOwnerAt ? ` · ${new Date(s.confirmedOwnerAt).toLocaleDateString("ko-KR")}` : ""}
                          </span>
                        ) : (s.status !== "REFUNDED" && s.status !== "CANCELLED" && s.status !== "REJECTED") ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setConfirmTarget({ sale: s, ownerType: "PRESALES", name: s.presalesDisplayName ?? s.agentDisplayName ?? "프리세일즈" })}
                              className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >프리세일즈 확인</button>
                            <button
                              onClick={() => setConfirmTarget({ sale: s, ownerType: "BRANCH_MANAGER", name: s.managerDisplayName ?? "대리점장" })}
                              className="px-2 py-1 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                            >대리점장 확인</button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {isPending && (
                            <>
                              <button
                                onClick={() => doAction(s.id, "approve")}
                                disabled={acting === s.id}
                                className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                                title="승인"
                              >
                                {acting === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => doAction(s.id, "reject")}
                                disabled={acting === s.id}
                                className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                                title="거절"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {canRefund && (
                            <button
                              onClick={() => doAction(s.id, "refund")}
                              disabled={acting === s.id}
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                              title="환불"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-600">총 {total.toLocaleString()}건</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 수당 귀속 확정 모달 */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !confirming && setConfirmTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">구매확인 — 수당 귀속</h3>
            <p className="mt-3 text-sm text-gray-600">
              판매 <strong>#{confirmTarget.sale.id}</strong>의 수당을{" "}
              <strong className="text-indigo-700">{confirmTarget.name}</strong>
              <span className="text-gray-500"> ({OWNER_LABEL[confirmTarget.ownerType]})</span>에게 귀속 확정합니다.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              확정하면 크루즈닷몰로 전달되어 수당이 확정됩니다.{confirmTarget.ownerType === "BRANCH_MANAGER" ? " (대리점장 수당에서 1,000원이 프리세일즈 DB값으로 전달됩니다.)" : ""} 환불 시 자동 해제됩니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmTarget(null)} disabled={confirming}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">취소</button>
              <button onClick={doConfirmOwner} disabled={confirming}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1">
                {confirming && <Loader2 className="w-4 h-4 animate-spin" />} 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
