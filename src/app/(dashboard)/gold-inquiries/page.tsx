"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2, MessageSquare, UserPlus } from "lucide-react";

type GoldInquiry = {
  id: number;
  name: string;
  phone: string;
  tier: number | null;
  status: string;
  message: string | null;
  submittedAt: string | null;
  createdAt: string;
  agentName: string | null;
};

const TIER_LABELS: Record<number, string> = {
  1: "실버",
  2: "골드",
  3: "플래티넘",
};

// GMcruise ProductInquiry 실제 status 값 (소문자)
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:          { label: "대기",        color: "bg-yellow-100 text-yellow-700" },
  passport_waiting: { label: "여권대기",    color: "bg-blue-100 text-blue-700" },
  confirmed:        { label: "확정",        color: "bg-green-100 text-green-700" },
  unavailable:      { label: "불가",        color: "bg-gray-100 text-gray-500" },
  refund:           { label: "환불",        color: "bg-red-100 text-red-700" },
};

const NEXT_STATUS: Record<string, string[]> = {
  pending:          ["passport_waiting", "confirmed", "unavailable"],
  passport_waiting: ["confirmed", "unavailable"],
  confirmed:        ["refund"],
  unavailable:      [],
  refund:           [],
};

export default function GoldInquiriesPage() {
  const [inquiries, setInquiries] = useState<GoldInquiry[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState("");
  const [q,         setQ]         = useState("");
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [acting,      setActing]      = useState<number | null>(null);
  const [converting,  setConverting]  = useState<number | null>(null);  // 전환 중인 문의 id
  const [convertedIds, setConvertedIds] = useState<Record<number, string>>({}); // id → memberId
  const abortRef = useRef<AbortController | null>(null);

  const totalPages = Math.ceil(total / 20);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    if (search) params.set("q", search);
    fetch(`/api/gold-inquiries?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.ok) { setInquiries(d.inquiries ?? []); setTotal(d.total ?? 0); }
      })
      .catch((e) => { if (e.name !== "AbortError") console.error("[gold-inquiries]", e); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [page, status, search]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const changeStatus = async (id: number, newStatus: string) => {
    setActing(id);
    await fetch(`/api/gold-inquiries/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setActing(null);
    load();
  };

  const convertToMember = async (inq: GoldInquiry, courseType: string) => {
    setConverting(inq.id);
    try {
      const r = await fetch(`/api/gold-inquiries/${inq.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseType }),
      });
      const d = await r.json() as { ok: boolean; memberId?: string; alreadyExists?: boolean; error?: string };
      if (d.ok && d.memberId) {
        setConvertedIds((prev) => ({ ...prev, [inq.id]: d.memberId! }));
        if (d.alreadyExists) alert('이미 골드회원으로 등록된 고객입니다.');
      } else {
        alert(d.error ?? '전환 실패');
      }
    } catch {
      alert('네트워크 오류');
    } finally {
      setConverting(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-bold text-navy-900">골드문의</h1>
        </div>
        <p className="text-sm text-gray-500">골드회원 가입 문의 관리</p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {["", "pending", "passport_waiting", "confirmed", "unavailable", "refund"].map((s) => (
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
        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 / 전화번호"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 w-48"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 text-sm bg-navy-900 text-white rounded-lg hover:opacity-90">
            검색
          </button>
        </form>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>골드문의 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">전화번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">희망등급</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">메시지</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">담당</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">액션</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">회원전환</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">접수일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inquiries.map((inq) => {
                  const st = STATUS_LABELS[inq.status] ?? { label: inq.status, color: "bg-gray-100 text-gray-500" };
                  const nextStatuses = NEXT_STATUS[inq.status] ?? [];
                  return (
                    <tr key={inq.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{inq.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{inq.phone}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {inq.tier != null ? (TIER_LABELS[inq.tier] ?? `Tier${inq.tier}`) : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate" title={inq.message ?? ""}>
                        {inq.message ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{inq.agentName ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {acting === inq.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                onClick={() => changeStatus(inq.id, ns)}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                  ns === "confirmed"
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : ns === "unavailable" || ns === "refund"
                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                }`}
                              >
                                {STATUS_LABELS[ns]?.label ?? ns}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {convertedIds[inq.id] ? (
                          <a
                            href={`/gold-members/${convertedIds[inq.id]}`}
                            className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />회원보기
                          </a>
                        ) : converting === inq.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : !['unavailable', 'refund'].includes(inq.status) ? (
                          <div className="flex gap-1 flex-wrap">
                            {(['A', 'B', 'C', 'HEALTH'] as const).map((course) => (
                              <button
                                key={course}
                                onClick={() => convertToMember(inq, course)}
                                className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                                  course === 'HEALTH'
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                }`}
                                title={`${course === 'HEALTH' ? '건강' : course + '코스'} 골드회원 전환`}
                              >
                                {course === 'HEALTH' ? '건강' : course}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {(inq.submittedAt ?? inq.createdAt).slice(0, 10)}
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
