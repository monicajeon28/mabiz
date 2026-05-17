"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, RotateCcw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { AffiliateSalesResponse } from "@/lib/affiliate/types";

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
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:          { label: "대기",     color: "bg-yellow-100 text-yellow-700" },
  PENDING_APPROVAL: { label: "승인대기", color: "bg-orange-100 text-orange-700" },
  APPROVED:         { label: "승인",     color: "bg-green-100 text-green-700" },
  CONFIRMED:        { label: "확정",     color: "bg-blue-100 text-blue-700" },
  REJECTED:         { label: "거절",     color: "bg-red-100 text-red-700" },
  REFUNDED:         { label: "환불",     color: "bg-gray-100 text-gray-500" },
  CANCELLED:        { label: "취소",     color: "bg-gray-100 text-gray-400" },
};

export default function AffiliateSalesPage() {
  const [sales,   setSales]   = useState<Sale[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<number | null>(null);

  const totalPages = Math.ceil(total / 20);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    fetch(`/api/affiliate-sales?${params}`)
      .then((r) => r.json() as Promise<AffiliateSalesResponse | { ok: false }>)
      .then((d) => {
        if (d.ok) { setSales(d.sales ?? []); setTotal(d.total ?? 0); }
        else { setSales([]); setTotal(0); }
      })
      .catch(() => { setSales([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id: number, action: "approve" | "reject" | "refund") => {
    setActing(id);
    try {
      const r = await fetch(`/api/affiliate-sales/${id}/${action}`, { method: "POST" });

      // ✅ HTTP 상태 코드 확인
      if (!r.ok) {
        const errorMsg = await r.text().catch(() => `HTTP ${r.status}`);
        console.warn(`[affiliate-sales] ${action} 실패`, { id, status: r.status, error: errorMsg });
        alert(`요청 실패 (${r.status}): ${errorMsg}`);
        setActing(null);
        return;
      }

      const d = await r.json().catch(() => ({ ok: false }));

      if (!d.ok) {
        console.warn("[affiliate-sales] action 실패", { id, action, message: d.message });
        alert(`${action} 실패: ${d.message || '서버 오류'}`);
        setActing(null);
        return;
      }

      // ✅ 성공 메시지
      alert(`${action} 완료되었습니다`);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '네트워크 오류';
      console.warn("[affiliate-sales] action 네트워크 오류", { id, action, err: msg });
      alert(`네트워크 오류: ${msg}`);
      setActing(null);
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
        <div className="text-center py-16 text-gray-400">
          <p>판매 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">판매원</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">고객</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">판매액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">기간</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s) => {
                  const st = STATUS_LABELS[s.status] ?? { label: s.status, color: "bg-gray-100 text-gray-500" };
                  const isPending = s.status === "PENDING" || s.status === "PENDING_APPROVAL";
                  const canRefund = s.status === "APPROVED" || s.status === "CONFIRMED";
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">#{s.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.agentDisplayName ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.customerPhone ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{s.saleAmount.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.yearMonth ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
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
              <p className="text-xs text-gray-400">총 {total.toLocaleString()}건</p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-xs text-gray-600">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
