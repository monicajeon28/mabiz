"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Search, Star } from "lucide-react";

type GoldMember = {
  id: number;
  name: string | null;
  phone: string | null;
  tier: number | null;
  status: string;
  paymentCount: number | null;
  maxPaymentCount: number | null;
  productType: string | null;
  startDate: string | null;
  createdAt: string;
  memo: string | null;
  agentName: string | null;
  agentMallUserId: string | null;
  managerName: string | null;
};

const TIER_LABELS: Record<number, string> = { 1: "실버", 2: "골드", 3: "플래티넘" };

const STATUS_COLOR: Record<string, string> = {
  active:   "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
};

export default function GoldMembersPage() {
  const [members, setMembers] = useState<GoldMember[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState("");
  const [q,       setQ]       = useState("");
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);

  const totalPages = Math.ceil(total / 20);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    if (search) params.set("q", search);
    fetch(`/api/gold-members?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setMembers(d.goldMembers ?? []); setTotal(d.total ?? 0); }
      })
      .finally(() => setLoading(false));
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-5 h-5 text-gold-500" />
          <h1 className="text-xl font-bold text-navy-900">골드회원</h1>
        </div>
        <p className="text-sm text-gray-500">GMcruise GoldMember 목록</p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-2">
          {[
            { val: "",         label: "전체" },
            { val: "active",   label: "활성" },
            { val: "inactive", label: "비활성" },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => { setStatus(val); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                status === val ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
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
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>골드회원 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">전화번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">등급</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">상품</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">납입</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">담당 판매원</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.name ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{m.phone ?? "-"}</td>
                    <td className="px-4 py-3">
                      {m.tier != null ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gold-100 text-gold-700">
                          {TIER_LABELS[m.tier] ?? `Tier${m.tier}`}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.productType ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {m.paymentCount != null && m.maxPaymentCount != null
                        ? `${m.paymentCount} / ${m.maxPaymentCount}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{m.agentName ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[m.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {m.status === "active" ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {m.startDate ? m.startDate.slice(0, 10) : m.createdAt.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">총 {total.toLocaleString()}명</p>
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
