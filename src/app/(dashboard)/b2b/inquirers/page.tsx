"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Users, CheckCircle, Clock, XCircle } from "lucide-react";
import { useToast } from "@/lib/api/use-toast";

type B2BProspect = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  eduType: string;
  productName: string | null;
  paymentAmount: number | null;
  paymentDate: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

type Group = {
  id: string;
  name: string;
  funnelId: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "LEAD",         label: "잠재고객" },
  { value: "CONSULTING",   label: "상담중" },
  { value: "CONTRACTED",   label: "계약완료" },
  { value: "CANCELLED",    label: "취소" },
];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  LEAD:       { label: "잠재고객", color: "bg-blue-100 text-blue-700",   icon: <Clock className="w-3 h-3" /> },
  CONSULTING: { label: "상담중",   color: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" /> },
  CONTRACTED: { label: "계약완료", color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
  CANCELLED:  { label: "취소",     color: "bg-red-100 text-red-700",     icon: <XCircle className="w-3 h-3" /> },
};

const NEXT_STATUS: Record<string, string> = {
  LEAD:       "CONSULTING",
  CONSULTING: "CONTRACTED",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function B2BInquirersPage() {
  const { toast } = useToast();

  const [prospects, setProspects]           = useState<B2BProspect[]>([]);
  const [total, setTotal]                   = useState(0);
  const [totalPages, setTotalPages]         = useState(1);
  const [page, setPage]                     = useState(1);
  const [q, setQ]                           = useState("");
  const [statusFilter, setStatusFilter]     = useState("");
  const [loading, setLoading]               = useState(true);
  const [fetchError, setFetchError]         = useState("");

  const [groups, setGroups]                 = useState<Group[]>([]);
  const [assigning, setAssigning]           = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  // ── 데이터 로드 ──────────────────────────────────────────────
  const fetchProspects = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFetchError("");
    const params = new URLSearchParams({
      eduType: "INQUIRER",
      page: String(page),
      limit: "50",
    });
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/b2b-prospects?${params}`, { signal });
      if (!res.ok) throw new Error("서버 오류");
      const data = await res.json() as {
        ok: boolean;
        prospects?: B2BProspect[];
        total?: number;
        totalPages?: number;
      };
      if (!data.ok) throw new Error("데이터 로드 실패");
      setProspects(data.prospects ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setFetchError("목록을 불러오지 못했습니다");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [q, page, statusFilter]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchProspects(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchProspects]);

  // q / statusFilter 변경 시 페이지 초기화
  useEffect(() => { setPage(1); }, [q, statusFilter]);

  // 그룹 목록 로드
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/groups", { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (d.ok) setGroups(d.groups ?? []); })
      .catch(err => { if (err instanceof Error && err.name === "AbortError") return; });
    return () => ctrl.abort();
  }, []);

  // ── 그룹 배정 ──────────────────────────────────────────────
  const quickAssign = async (prospect: B2BProspect, groupId: string) => {
    if (!groupId) return;
    setAssigning(prospect.id);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: prospect.phone,
          name: prospect.name,
          sourceType: "education_inquiry",
          sourceId: String(prospect.id),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "그룹 배정 실패", description: data.message ?? "다시 시도해주세요.", variant: "destructive" });
        return;
      }
      toast({ title: "그룹 배정 완료", variant: "success" });
    } catch {
      toast({ title: "네트워크 오류", description: "다시 시도해주세요.", variant: "destructive" });
    } finally {
      setAssigning(null);
    }
  };

  // ── 상태 변경 ──────────────────────────────────────────────
  const changeStatus = async (prospect: B2BProspect, newStatus: string) => {
    setChangingStatus(prospect.id);
    try {
      const res = await fetch(`/api/b2b-prospects?id=${prospect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "상태 변경 실패", variant: "destructive" });
        return;
      }
      toast({ title: "상태 변경 완료", variant: "success" });
      setProspects(prev =>
        prev.map(p => p.id === prospect.id ? { ...p, status: newStatus } : p)
      );
    } catch {
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally {
      setChangingStatus(null);
    }
  };

  const statusMeta = (status: string) =>
    STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-600", icon: null };

  // ── 렌더 ───────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-navy-900">교육문의자 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total.toLocaleString()}명</p>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        B2B 랜딩페이지를 통해 교육 관련 문의를 남긴 잠재고객 목록입니다
      </div>

      {/* 검색 + 상태 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 연락처 검색"
            value={q}
            onChange={(e) => { setQ(e.target.value); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold-500"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 에러 */}
      {fetchError && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm mb-3">{fetchError}</p>
          <button
            onClick={() => fetchProspects()}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {!fetchError && loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* 목록 없음 */}
      {!fetchError && !loading && prospects.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">
            <Users className="w-12 h-12 mx-auto text-gray-300" />
          </p>
          <p className="font-medium text-gray-500">교육 문의자가 없습니다</p>
          <p className="text-sm mt-1">B2B 랜딩페이지 제출 시 자동으로 등록됩니다</p>
        </div>
      )}

      {/* 목록 테이블 */}
      {!fetchError && !loading && prospects.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">연락처</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">이메일</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">상품명</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold hidden sm:table-cell">등록일</th>
                <th className="px-4 py-3 font-semibold">그룹배정</th>
                <th className="px-4 py-3 font-semibold">상태변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prospects.map((p) => {
                const meta = statusMeta(p.status);
                const nextStatus = NEXT_STATUS[p.status];
                const nextMeta = nextStatus ? statusMeta(nextStatus) : null;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    {/* 이름 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {p.name[0]}
                        </div>
                        <span className="font-medium text-gray-900">{p.name}</span>
                      </div>
                    </td>

                    {/* 연락처 */}
                    <td className="px-4 py-3 text-gray-600">
                      <a href={`tel:${p.phone}`} className="hover:text-blue-600 hover:underline">
                        {p.phone}
                      </a>
                    </td>

                    {/* 이메일 */}
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {p.email ?? <span className="text-gray-300">-</span>}
                    </td>

                    {/* 상품명 */}
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {p.productName ?? <span className="text-gray-300">-</span>}
                    </td>

                    {/* 상태 배지 */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>

                    {/* 등록일 */}
                    <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">
                      {formatDate(p.createdAt)}
                    </td>

                    {/* 그룹 배정 드롭다운 */}
                    <td className="px-4 py-3">
                      {groups.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-gold-500 max-w-[140px]"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                quickAssign(p, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            disabled={assigning === p.id}
                          >
                            <option value="">그룹 선택...</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}{g.funnelId ? " 🔄" : ""}
                              </option>
                            ))}
                          </select>
                          {assigning === p.id && (
                            <span className="text-xs text-gray-400">배정 중...</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">그룹 없음</span>
                      )}
                    </td>

                    {/* 상태 변경 버튼 */}
                    <td className="px-4 py-3">
                      {nextMeta && nextStatus ? (
                        <button
                          type="button"
                          disabled={changingStatus === p.id}
                          onClick={() => changeStatus(p, nextStatus)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${nextMeta.color} hover:opacity-80`}
                        >
                          {changingStatus === p.id ? "처리 중..." : `→ ${nextMeta.label}`}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
