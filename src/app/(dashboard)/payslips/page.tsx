"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

type Payslip = {
  id: number;
  agentId: number;
  yearMonth: string;
  baseCommission: number;
  bonus: number | null;
  deduction: number | null;
  netAmount: number;
  status: string;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
  agentDisplayName: string | null;
  agentMallUserId: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "초안",   color: "bg-gray-100 text-gray-500" },
  CONFIRMED: { label: "확정",   color: "bg-blue-100 text-blue-700" },
  PAID:      { label: "지급완료", color: "bg-green-100 text-green-700" },
};

export default function PayslipsPage() {
  const [payslips,  setPayslips]  = useState<Payslip[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState("");
  const [yearMonth, setYearMonth] = useState("");
  const [loading,   setLoading]   = useState(true);

  const totalPages = Math.ceil(total / 20);

  // 최근 6개월 yearMonth 선택지
  const ymOptions = (() => {
    const opts: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return opts;
  })();

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status)    params.set("status",    status);
    if (yearMonth) params.set("yearMonth", yearMonth);
    fetch(`/api/payslips?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setPayslips(d.payslips ?? []); setTotal(d.total ?? 0); }
      })
      .finally(() => setLoading(false));
  }, [page, status, yearMonth]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold text-navy-900">급여명세</h1>
        </div>
        <p className="text-sm text-gray-500">판매원 월별 커미션 명세</p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* 상태 필터 */}
        <div className="flex gap-2">
          {["", "DRAFT", "CONFIRMED", "PAID"].map((s) => (
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

        {/* 연월 필터 */}
        <select
          value={yearMonth}
          onChange={(e) => { setYearMonth(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 bg-white"
        >
          <option value="">전체 기간</option>
          {ymOptions.map((ym) => (
            <option key={ym} value={ym}>{ym}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : payslips.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>급여명세가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">판매원</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">기간</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">기본커미션</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">보너스</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">공제</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">실지급액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">지급일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payslips.map((p) => {
                  const st = STATUS_LABELS[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-500" };
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.agentDisplayName ?? "-"}</p>
                        {p.agentMallUserId && (
                          <p className="text-xs text-gray-400">{p.agentMallUserId}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono">{p.yearMonth}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{p.baseCommission.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-right text-green-600 text-sm">
                        {p.bonus != null ? `+${p.bonus.toLocaleString()}원` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 text-sm">
                        {p.deduction != null ? `-${p.deduction.toLocaleString()}원` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-navy-900">{p.netAmount.toLocaleString()}원</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {p.paidAt ? p.paidAt.slice(0, 10) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
