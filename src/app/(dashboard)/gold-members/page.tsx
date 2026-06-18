"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Search, Star, X, Plus, Loader2, AlertTriangle, Trash2, UserCheck
} from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { useSession } from "@/hooks/useSession";

type GoldMember = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  memberCode: string;
  courseType: string;
  joinDate: string;
  paymentDay: number | null;
  totalPayments: number;
  paidCount: number;
  status: string;
  memo: string | null;
  consultationCount: number;
  createdAt: string;
  agentId?: number | null;
  agentName?: string | null;
};

const COURSE_LABEL: Record<string, string> = { A: "A코스", B: "B코스", C: "C코스", HEALTH: "건강" };

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  SUSPENDED: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    "유지",
  SUSPENDED: "정지",
  CANCELLED: "해지",
};

const COURSE_BADGE: Record<string, string> = {
  A: "bg-blue-100 text-blue-700",
  B: "bg-purple-100 text-purple-700",
  C: "bg-indigo-100 text-indigo-700",
  HEALTH: "bg-emerald-100 text-emerald-700",
};

type Group = { id: string; name: string; color: string | null };

type AgentOption = { id: string; displayName: string | null };

const INITIAL_FORM = {
  name: "", phone: "", email: "",
  courseType: "A" as "A" | "B" | "C" | "HEALTH",
  joinDate: new Date().toISOString().slice(0, 10),
  paymentDay: "",
  totalPayments: "",
  memo: "",
  agentMemberId: "",
};

export default function GoldMembersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { role, isAdmin: sessionIsAdmin } = useSession();
  const isAdmin = sessionIsAdmin || role === "GLOBAL_ADMIN";
  const isOwner = role === "OWNER";
  const isAgent = role === "AGENT";

  const abortControllerRef = useRef<AbortController | null>(null);
  const [members, setMembers]     = useState<GoldMember[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [q, setQ]                 = useState("");
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 삭제 요청 관련 상태
  const [pendingCount, setPendingCount] = useState(0);
  const [deleteReqModalOpen, setDeleteReqModalOpen] = useState(false);
  const [deleteReqTarget, setDeleteReqTarget] = useState<GoldMember | null>(null);
  const [deleteReqReason, setDeleteReqReason] = useState("");
  const [deleteReqSubmitting, setDeleteReqSubmitting] = useState(false);

  // 관리자 직접 삭제 확인 모달 상태
  const [adminDeleteTarget, setAdminDeleteTarget] = useState<GoldMember | null>(null);
  const [adminDeleteSubmitting, setAdminDeleteSubmitting] = useState(false);

  // 그룹 관련 상태
  const [groups, setGroups]       = useState<Group[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null); // memberId

  // 담당 판매원 목록 (OWNER/GLOBAL_ADMIN 등록 시 사용)
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // 등록 폼 상태
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  const totalPages = Math.ceil(total / 20);

  const load = useCallback(() => {
    // P1: 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (courseFilter) params.set("courseType", courseFilter);
    if (search) params.set("q", search);

    fetch(`/api/gold-members?${params}`, {
      signal: abortControllerRef.current.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.ok) {
          setMembers(d.goldMembers ?? []);
          setTotal(d.total ?? 0);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.');
        }
      })
      .finally(() => setLoading(false));
  }, [page, statusFilter, courseFilter, search]);

  // P1: 컴포넌트 언마운트 시 AbortController 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => { load(); }, [load]);

  // 그룹 목록 로드 (최초 1회)
  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGroups(d.groups ?? []); })
      .catch(() => {});
  }, []);

  // 관리자: 삭제 요청 대기 건수 로드
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/gold-members/delete-requests?status=PENDING')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPendingCount(d.total ?? 0); })
      .catch(() => {});
  }, [isAdmin]);

  // 삭제 요청 제출 (대리점장)
  const handleDeleteRequest = useCallback(async () => {
    if (!deleteReqTarget || !deleteReqReason.trim()) return;
    setDeleteReqSubmitting(true);
    try {
      const res = await fetch('/api/gold-members/delete-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goldMemberId: deleteReqTarget.id, reason: deleteReqReason.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? '요청 실패');
      toast({ title: '삭제 요청이 접수되었습니다.', variant: 'success' });
      setDeleteReqModalOpen(false);
      setDeleteReqTarget(null);
      setDeleteReqReason('');
    } catch (err) {
      toast({
        title: '삭제 요청 실패',
        description: err instanceof Error ? err.message : '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setDeleteReqSubmitting(false);
    }
  }, [deleteReqTarget, deleteReqReason, toast]);

  // 관리자 직접 삭제 — 모달 오픈 (window.confirm 제거)
  const handleAdminDelete = useCallback((member: GoldMember) => {
    setAdminDeleteTarget(member);
  }, []);

  // 관리자 직접 삭제 — 모달 확인 후 실행
  const confirmAdminDelete = useCallback(async () => {
    if (!adminDeleteTarget) return;
    setAdminDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/gold-members/${adminDeleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? '삭제 실패');
      toast({ title: `"${adminDeleteTarget.name}" 삭제 완료`, variant: 'success' });
      setAdminDeleteTarget(null);
      load();
    } catch (err) {
      toast({
        title: '삭제 실패',
        description: err instanceof Error ? err.message : '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setAdminDeleteSubmitting(false);
    }
  }, [adminDeleteTarget, toast, load]);

  // 골드회원 → phone 기반 그룹 배정
  const quickAssign = useCallback(async (memberId: string, phone: string, name: string, groupId: string) => {
    if (!groupId) return;
    setAssigning(memberId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, sourceType: 'gold_member', sourceId: memberId }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!data.ok) throw new Error(data.message ?? '배정 실패');
      const grp = groups.find((g) => g.id === groupId);
      toast({ title: `"${grp?.name ?? '그룹'}" 배정 완료`, variant: 'success' });
    } catch (err) {
      toast({
        title: '그룹 배정 실패',
        description: err instanceof Error ? err.message : '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setAssigning(null);
    }
  }, [groups, toast]);

  // 드로어가 열릴 때 판매원 목록 로드 (OWNER/GLOBAL_ADMIN)
  useEffect(() => {
    if (!drawerOpen || isAgent) return;
    if (agents.length > 0) return; // 이미 로드된 경우 재요청 안 함
    setAgentsLoading(true);
    fetch('/api/org/agents')
      .then((r) => r.json())
      .then((d: { ok?: boolean; sections?: Array<{ label: string; members: AgentOption[] }> }) => {
        if (d.ok && Array.isArray(d.sections)) {
          const agentSection = d.sections.find((s) => s.label === '판매원');
          setAgents(agentSection?.members ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, [drawerOpen, isAgent, agents.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.phone.trim() || !form.joinDate) {
      setFormError("이름, 전화번호, 가입날짜는 필수입니다.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/gold-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          courseType: form.courseType,
          joinDate: form.joinDate,
          paymentDay: form.paymentDay ? parseInt(form.paymentDay) : undefined,
          totalPayments: form.totalPayments ? parseInt(form.totalPayments) : undefined,
          memo: form.memo.trim() || undefined,
          agentId: form.agentMemberId || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormError(data.error ?? "등록 실패");
        return;
      }
      setDrawerOpen(false);
      setForm(INITIAL_FORM);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-5 h-5 text-yellow-500" />
            <h1 className="text-xl font-bold text-navy-900">
              {isAgent ? "내 담당 고객 목록" : "골드회원 관리"}
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            {isAgent ? "나에게 배정된 골드회원만 표시됩니다." : "CRM 골드회원 수동 등록 및 관리"}
          </p>
        </div>
        {(isAdmin || isOwner) && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-4 min-h-[48px] bg-navy-900 text-white text-base font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            골드회원 등록
          </button>
        )}
      </div>

      {/* 관리자 전용: 삭제 요청 대기 배너 */}
      {isAdmin && pendingCount > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200" style={{ backgroundColor: '#FADBD8' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#E74C3C' }} />
          <span className="text-base font-medium flex-1" style={{ color: '#E74C3C' }}>
            삭제 요청 대기 {pendingCount}건이 있습니다.
          </span>
          <button
            onClick={() => router.push('/gold-members/delete-requests')}
            className="px-4 min-h-[48px] text-base font-semibold rounded-lg border-2 transition-colors"
            style={{ borderColor: '#E74C3C', color: '#E74C3C', backgroundColor: 'white' }}
          >
            확인하기
          </button>
        </div>
      )}

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* 상태 필터 */}
        <div className="flex gap-1.5">
          {[
            { val: "",           label: "전체" },
            { val: "ACTIVE",     label: "활성" },
            { val: "SUSPENDED",  label: "정지" },
            { val: "CANCELLED",  label: "해지" },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => { setStatusFilter(val); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === val ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 코스 필터 */}
        <div className="flex gap-1.5">
          {[
            { val: "",  label: "전체코스" },
            { val: "A", label: "A코스" },
            { val: "B", label: "B코스" },
            { val: "C", label: "C코스" },
            { val: "HEALTH", label: "건강" },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => { setCourseFilter(val); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                courseFilter === val ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 / 전화번호 / 코드"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 w-52"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 text-sm bg-navy-900 text-white rounded-lg hover:opacity-90">
            검색
          </button>
        </form>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2">
          <span className="font-semibold">오류:</span> {error}
        </div>
      )}

      {/* 테이블 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{isAgent ? "배정된 골드회원이 없습니다." : "골드회원이 없습니다."}</p>
          {(isAdmin || isOwner) && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="mt-4 px-4 py-2 text-sm bg-navy-900 text-white rounded-lg hover:opacity-90"
            >
              첫 골드회원 등록
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">전화번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">코스</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">회원코드</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">납부현황</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">가입일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">상담</th>
                  {(isAdmin || isOwner) && (
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">
                      <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />담당자</span>
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">그룹 배정</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/gold-members/${m.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm font-mono">{m.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${COURSE_BADGE[m.courseType] ?? "bg-gray-100 text-gray-500"}`}>
                        {COURSE_LABEL[m.courseType] ?? m.courseType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm font-mono tracking-widest">{m.memberCode}</td>
                    <td className="px-4 py-3 text-sm">
                      {m.courseType === "HEALTH" ? (
                        <span className="text-emerald-600 font-medium">{m.paidCount}회 납부</span>
                      ) : m.totalPayments > 0 ? (
                        <span className={m.paidCount >= m.totalPayments ? "text-green-600 font-medium" : "text-gray-600"}>
                          {m.paidCount} / {m.totalPayments}회
                          {m.paidCount >= m.totalPayments ? " ✓완료" : ""}
                        </span>
                      ) : (
                        <span className="text-gray-600">{m.paidCount}회</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${STATUS_COLOR[m.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {m.joinDate.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {m.consultationCount > 0 ? (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-sm">{m.consultationCount}건</span>
                      ) : "-"}
                    </td>
                    {(isAdmin || isOwner) && (
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {m.agentName ? (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                            {m.agentName}
                          </span>
                        ) : "-"}
                      </td>
                    )}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {assigning === m.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : (
                        <select
                          className="text-sm border border-gray-200 rounded px-1.5 py-1 max-w-[160px] bg-white focus:outline-none"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) quickAssign(m.id, m.phone, m.name, e.target.value);
                            e.target.value = "";
                          }}
                        >
                          <option value="">그룹 배정...</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/gold-members/${m.id}`); }}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          상세보기
                        </button>
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteReqTarget(m);
                              setDeleteReqReason('');
                              setDeleteReqModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2 min-h-[36px] text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            삭제 요청
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdminDelete(m);
                            }}
                            className="flex items-center gap-1 px-2 min-h-[36px] text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-600">총 {total.toLocaleString()}명</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 대리점장 전용: 삭제 요청 모달 */}
      {deleteReqModalOpen && deleteReqTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDeleteReqModalOpen(false); setDeleteReqReason(''); }} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-bold text-gray-900">삭제 요청</h2>
              </div>
              <button onClick={() => { setDeleteReqModalOpen(false); setDeleteReqReason(''); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-base text-gray-700">
                <span className="font-semibold">{deleteReqTarget.name}</span> 회원에 대한 삭제를 관리자에게 요청합니다.
              </p>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">
                  삭제 사유 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <textarea
                  value={deleteReqReason}
                  onChange={(e) => setDeleteReqReason(e.target.value)}
                  rows={4}
                  placeholder="삭제 사유를 입력해주세요."
                  className="w-full px-3 py-2 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setDeleteReqModalOpen(false); setDeleteReqReason(''); }}
                  className="flex-1 min-h-[48px] text-base font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteRequest}
                  disabled={deleteReqSubmitting}
                  className="flex-1 min-h-[48px] text-base font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {deleteReqSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleteReqSubmitting ? "요청 중..." : "삭제 요청 보내기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 전용: 직접 삭제 확인 모달 */}
      {adminDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!adminDeleteSubmitting) setAdminDeleteTarget(null); }} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-bold text-gray-900">회원 삭제 확인</h2>
              </div>
              <button
                onClick={() => setAdminDeleteTarget(null)}
                disabled={adminDeleteSubmitting}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-base text-gray-700">
                <span className="font-semibold text-gray-900">{adminDeleteTarget.name}</span> 회원을 삭제합니다.
              </p>
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                삭제 후 복구할 수 없습니다. 정말 삭제하시겠습니까?
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setAdminDeleteTarget(null)}
                  disabled={adminDeleteSubmitting}
                  className="flex-1 min-h-[48px] text-base font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmAdminDelete}
                  disabled={adminDeleteSubmitting}
                  className="flex-1 min-h-[48px] text-base font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {adminDeleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {adminDeleteSubmitting ? "삭제 중..." : "삭제 확인"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 등록 드로어 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 오버레이 */}
          <div className="flex-1 bg-black/40" onClick={() => { setDrawerOpen(false); setForm(INITIAL_FORM); setFormError(""); }} />
          {/* 패널 */}
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-navy-900">골드회원 등록</h2>
              <button onClick={() => { setDrawerOpen(false); setForm(INITIAL_FORM); setFormError(""); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 p-5 space-y-4">
              {formError && (
                <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {formError}
                </div>
              )}

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
              </div>

              {/* 전화번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="01012345678"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
              </div>

              {/* 코스 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  코스 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-4">
                  {(["A", "B", "C", "HEALTH"] as const).map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="courseType"
                        value={c}
                        checked={form.courseType === c}
                        onChange={() => setForm(f => ({
                          ...f,
                          courseType: c as typeof f.courseType,
                          // 건강코스 선택 시 의무납입 없으므로 총 횟수 초기화
                          totalPayments: c === "HEALTH" ? "" : f.totalPayments,
                        }))}
                        className="accent-navy-900"
                      />
                      <span className="text-sm font-medium">
                        {c === "HEALTH" ? "건강" : `${c}코스`}
                      </span>
                    </label>
                  ))}
                </div>
                {form.courseType === "HEALTH" ? (
                  <p className="mt-2 text-sm text-emerald-600">월 27,000원 · 의무납입 없음</p>
                ) : (
                  <p className="mt-2 text-sm text-blue-600">의무납입 60회</p>
                )}
              </div>

              {/* 가입날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  가입날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setForm(f => ({ ...f, joinDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
              </div>

              {/* 매월 납부 예정일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">매월 납부 예정일</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.paymentDay}
                  onChange={(e) => setForm(f => ({ ...f, paymentDay: e.target.value }))}
                  placeholder="예: 15 (15일)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
              </div>

              {/* 총 납부 예정 횟수 (ABC코스만) */}
              {form.courseType !== "HEALTH" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">의무납입 횟수</label>
                  <input
                    type="number"
                    min={0}
                    value={form.totalPayments}
                    onChange={(e) => setForm(f => ({ ...f, totalPayments: e.target.value }))}
                    placeholder="기본: 60회"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                  />
                  <p className="mt-1 text-sm text-gray-600">비워두면 기본 60회로 설정됩니다.</p>
                </div>
              )}

              {/* 담당 판매원 (OWNER/GLOBAL_ADMIN만 표시) */}
              {(isAdmin || isOwner) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 inline" />
                      담당 판매원
                    </span>
                  </label>
                  {agentsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      판매원 목록 불러오는 중...
                    </div>
                  ) : (
                    <select
                      value={form.agentMemberId}
                      onChange={(e) => setForm(f => ({ ...f, agentMemberId: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 bg-white min-h-[44px]"
                    >
                      <option value="">— 담당자 없음 (나중에 지정) —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName ?? a.id}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1 text-xs text-gray-500">이 골드회원을 관리할 판매원을 선택합니다.</p>
                </div>
              )}

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm(f => ({ ...f, memo: e.target.value }))}
                  rows={3}
                  placeholder="특이사항, 메모 등"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-navy-900 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "등록 중..." : "골드회원 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
