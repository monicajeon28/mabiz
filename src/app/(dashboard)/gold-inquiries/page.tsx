"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2, MessageSquare, UserPlus, Users } from "lucide-react";
import { logger } from "@/lib/logger";
import { useToast } from "@/lib/api/use-toast";

type GoldInquiry = {
  id: number;
  name: string;
  phone: string;
  tier: number | null;
  status: string;
  message: string | null;
  submittedAt: string | null;
  createdAt: string;
  /** "본사" | "대리점장 홍길동" | "판매원 김철수" | "프리세일즈 이영희" | 이름만 */
  agentName: string | null;
};

type Group = {
  id: string;
  name: string;
  color: string;
  memberCount: number;
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

  // 그룹 배정 관련 상태
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<Record<number, string>>({}); // inquiryId → groupId
  const [assigning, setAssigning] = useState<number | null>(null); // 배정 중인 문의 id

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
      .catch((e) => { if (e.name !== "AbortError") logger.error("[gold-inquiries] 조회 실패", { error: e instanceof Error ? e.message : String(e) }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [page, status, search]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // 그룹 목록 로드 (최초 1회)
  useEffect(() => {
    fetch("/api/groups?limit=100")
      .then((r) => r.json())
      .then((d: { ok: boolean; groups?: Group[] }) => {
        if (d.ok && d.groups) setGroups(d.groups);
      })
      .catch((e) => {
        logger.error("[gold-inquiries] 그룹 목록 조회 실패", { error: e instanceof Error ? e.message : String(e) });
      });
  }, []);

  // 그룹 빠른 배정
  const quickAssign = async (inq: GoldInquiry) => {
    const groupId = selectedGroupId[inq.id];
    if (!groupId) {
      toast({ title: "그룹 선택 필요", description: "배정할 그룹을 먼저 선택해 주세요.", variant: "warning" });
      return;
    }
    setAssigning(inq.id);
    try {
      const r = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: inq.phone,
          name: inq.name,
          sourceType: "gold_inquiry",
          sourceId: String(inq.id),
        }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => `HTTP ${r.status}`);
        toast({ title: "배정 실패", description: `오류: ${text}`, variant: "destructive" });
        return;
      }
      const d = await r.json() as { ok: boolean; successCount?: number; error?: string };
      if (d.ok) {
        const groupName = groups.find((g) => g.id === groupId)?.name ?? groupId;
        toast({ title: "그룹 배정 완료", description: `${inq.name}님이 [${groupName}] 그룹에 배정되었습니다.`, variant: "success" });
        // 드롭다운 초기화
        setSelectedGroupId((prev) => { const next = { ...prev }; delete next[inq.id]; return next; });
      } else {
        toast({ title: "배정 실패", description: d.error ?? "알 수 없는 오류", variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "네트워크 오류";
      logger.error("[gold-inquiries] quickAssign 오류", { error: msg });
      toast({ title: "배정 실패", description: msg, variant: "destructive" });
    } finally {
      setAssigning(null);
    }
  };

  const changeStatus = async (id: number, newStatus: string) => {
    setActing(id);
    try {
      const r = await fetch(`/api/gold-inquiries/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      // ✅ HTTP 상태 확인
      if (!r.ok) {
        logger.warn(`[gold-inquiries] 상태 변경 실패`, { id, status: r.status });
        toast({ title: "상태 변경 실패", description: `오류 코드: ${r.status}`, variant: "destructive" });
        setActing(null);
        return;
      }

      const d = await r.json() as { ok: boolean; error?: string };

      if (d.ok) {
        toast({ title: "상태 변경 완료", description: "상태가 변경되었습니다.", variant: "success" });
        load();
      } else {
        toast({ title: "상태 변경 실패", description: d.error ?? "알 수 없는 오류", variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '네트워크 오류';
      logger.warn("[gold-inquiries] changeStatus 네트워크 오류", { err: msg });
      toast({ title: "네트워크 오류", description: msg, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const convertToMember = async (inq: GoldInquiry, courseType: string) => {
    setConverting(inq.id);
    try {
      const r = await fetch(`/api/gold-inquiries/${inq.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseType }),
      });

      // ✅ HTTP 상태 확인
      if (!r.ok) {
        const errorMsg = await r.text().catch(() => `HTTP ${r.status}`);
        logger.warn(`[gold-inquiries] 회원 전환 실패`, { id: inq.id, status: r.status });
        toast({ title: "회원 전환 실패", description: `오류 (${r.status}): ${errorMsg}`, variant: "destructive" });
        setConverting(null);
        return;
      }

      const d = await r.json() as {
        ok: boolean;
        memberId?: string;
        memberCode?: string;
        alreadyExists?: boolean;
        error?: string;
      };

      if (d.ok && d.memberId) {
        setConvertedIds((prev) => ({ ...prev, [inq.id]: d.memberId! }));
        const desc = d.memberCode
          ? `${d.memberCode}로 골드회원 전환되었습니다`
          : '골드회원으로 전환되었습니다';
        toast({ title: "회원 전환 완료", description: desc, variant: "success" });
        load();
      } else {
        const desc = d.alreadyExists
          ? '이미 골드회원으로 등록된 고객입니다'
          : (d.error ?? '회원 전환 실패');
        toast({ title: "회원 전환 실패", description: desc, variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '네트워크 오류';
      logger.warn("[gold-inquiries] convertToMember 네트워크 오류", { err: msg });
      toast({ title: "네트워크 오류", description: msg, variant: "destructive" });
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
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
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
        <div className="text-center py-16 text-gray-600">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>골드문의 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* 모바일 카드 뷰 (640px 미만) */}
          <div className="md:hidden divide-y divide-gray-100">
            {inquiries.map((inq) => {
              const st = STATUS_LABELS[inq.status] ?? { label: inq.status, color: "bg-gray-100 text-gray-500" };
              const nextStatuses = NEXT_STATUS[inq.status] ?? [];
              return (
                <div key={`m-${inq.id}`} className="p-4 space-y-3">
                  {/* 상단: 이름 + 상태 + 담당자 */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-base">{inq.name}</p>
                      <p className="text-sm text-gray-500 font-mono mt-0.5">{inq.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      {inq.agentName === '본사' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          🏢 본사
                        </span>
                      ) : inq.agentName?.startsWith('대리점장') ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {inq.agentName}
                        </span>
                      ) : inq.agentName?.startsWith('판매원') ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {inq.agentName}
                        </span>
                      ) : inq.agentName?.startsWith('프리세일즈') ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {inq.agentName}
                        </span>
                      ) : inq.agentName ? (
                        <span className="text-xs text-gray-600">{inq.agentName}</span>
                      ) : (
                        <span className="text-xs text-gray-400">담당 없음</span>
                      )}
                    </div>
                  </div>

                  {/* 희망등급 + 접수일 */}
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>희망등급: {inq.tier != null ? (TIER_LABELS[inq.tier] ?? `Tier${inq.tier}`) : "-"}</span>
                    <span>·</span>
                    <span>{(inq.submittedAt ?? inq.createdAt).slice(0, 10)}</span>
                  </div>

                  {/* 메시지 */}
                  {inq.message && (
                    <p className="text-sm text-gray-500 line-clamp-2">{inq.message}</p>
                  )}

                  {/* 상태 변경 버튼 */}
                  {nextStatuses.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {acting === inq.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                      ) : (
                        nextStatuses.map((ns) => (
                          <button
                            key={ns}
                            onClick={() => changeStatus(inq.id, ns)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                              ns === "confirmed"
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : ns === "unavailable" || ns === "refund"
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            }`}
                          >
                            {STATUS_LABELS[ns]?.label ?? ns}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* 그룹 배정 */}
                  <div className="flex items-center gap-2">
                    {assigning === inq.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                    ) : (
                      <>
                        <select
                          value={selectedGroupId[inq.id] ?? ""}
                          onChange={(e) =>
                            setSelectedGroupId((prev) => ({ ...prev, [inq.id]: e.target.value }))
                          }
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-navy-900/20 bg-white text-gray-700"
                        >
                          <option value="">그룹 선택</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => quickAssign(inq)}
                          disabled={!selectedGroupId[inq.id]}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Users className="w-4 h-4" />
                          배정
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 데스크톱 테이블 뷰 (640px 이상) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">전화번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">희망등급</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">메시지</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">담당</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">액션</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">회원전환</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">그룹배정</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">접수일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inquiries.map((inq) => {
                  const st = STATUS_LABELS[inq.status] ?? { label: inq.status, color: "bg-gray-100 text-gray-500" };
                  const nextStatuses = NEXT_STATUS[inq.status] ?? [];
                  return (
                    <tr key={inq.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{inq.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm font-mono">{inq.phone}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {inq.tier != null ? (TIER_LABELS[inq.tier] ?? `Tier${inq.tier}`) : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm max-w-[180px] truncate" title={inq.message ?? ""}>
                        {inq.message ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {inq.agentName === '본사' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            🏢 본사
                          </span>
                        ) : inq.agentName?.startsWith('대리점장') ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {inq.agentName}
                          </span>
                        ) : inq.agentName?.startsWith('판매원') ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {inq.agentName}
                          </span>
                        ) : inq.agentName?.startsWith('프리세일즈') ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            {inq.agentName}
                          </span>
                        ) : inq.agentName ? (
                          <span className="text-gray-600 text-sm">{inq.agentName}</span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {acting === inq.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                onClick={() => changeStatus(inq.id, ns)}
                                className={`px-2 py-0.5 rounded text-sm font-medium transition-colors ${
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
                            className="text-sm text-emerald-600 font-medium hover:underline flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />회원보기
                          </a>
                        ) : converting === inq.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                        ) : !['unavailable', 'refund'].includes(inq.status) ? (
                          <div className="flex gap-1 flex-wrap">
                            {(['A', 'B', 'C', 'HEALTH'] as const).map((course) => (
                              <button
                                key={course}
                                onClick={() => convertToMember(inq, course)}
                                className={`px-1.5 py-0.5 rounded text-sm font-medium transition-colors ${
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
                          <span className="text-sm text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {assigning === inq.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-[180px]">
                            <select
                              value={selectedGroupId[inq.id] ?? ""}
                              onChange={(e) =>
                                setSelectedGroupId((prev) => ({ ...prev, [inq.id]: e.target.value }))
                              }
                              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-navy-900/20 bg-white text-gray-700"
                            >
                              <option value="">그룹 선택</option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => quickAssign(inq)}
                              disabled={!selectedGroupId[inq.id]}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title="그룹 배정"
                            >
                              <Users className="w-3.5 h-3.5" />
                              배정
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
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
    </div>
  );
}
