"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, CheckCircle, Loader2, ChevronLeft, ChevronRight, X, Clock } from "lucide-react";

type Member = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  mallUserId: string | null;
  mallNickname: string | null;
  kakaoChannelAdded: boolean;
  naverChannelAdded: boolean;
  googleChannelAdded: boolean;
  createdAt: string | Date;
  isLocked: boolean;
  affiliateType: string | null;
  provider: "KAKAO" | "NAVER" | "GOOGLE" | "DIRECT";
  memberStatus: string | null;
  memberTags: string[];
  groups?: { id: number; groupId: number; group: { id: number; name: string; color: string | null } }[];
};

type ContactChangeLog = {
  id: number;
  gmUserId: number | null;
  contactId: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedBy: string;
  changedAt: string;
};

type Staff = {
  id: string;
  displayName: string | null;
  loginId: string;
  orgName: string;
};

const PROVIDER_BADGE: Record<string, { label: string; color: string }> = {
  KAKAO:  { label: "카카오",   color: "bg-yellow-100 text-yellow-700" },
  NAVER:  { label: "네이버",   color: "bg-green-100 text-green-700" },
  GOOGLE: { label: "구글",     color: "bg-blue-100 text-blue-700" },
  DIRECT: { label: "일반가입", color: "bg-gray-100 text-gray-600" },
};

const AFFILIATE_BADGE: Record<string, { label: string; color: string }> = {
  BRANCH_MANAGER: { label: "대리점장",   color: "bg-purple-100 text-purple-700" },
  HQ:             { label: "본사",       color: "bg-indigo-100 text-indigo-700" },
  PRESALES:       { label: "프리세일즈", color: "bg-sky-100 text-sky-700" },
  SALES_AGENT:    { label: "판매원",     color: "bg-orange-100 text-orange-700" },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  "잠재고객": { label: "잠재고객", color: "bg-blue-100 text-blue-700" },
  "소통":     { label: "소통",     color: "bg-purple-100 text-purple-700" },
  "구매완료": { label: "구매완료", color: "bg-green-100 text-green-700" },
  "VIP":      { label: "VIP",      color: "bg-yellow-100 text-yellow-800 font-bold" },
  "수신거부": { label: "수신거부", color: "bg-gray-100 text-gray-500" },
};

const STATUS_OPTIONS = ["잠재고객", "소통", "구매완료", "VIP", "수신거부"];
const SUGGEST_TAGS = ["VIP관심", "상담중", "장기검토", "재문의", "크루즈입문"];

const LIMIT = 30;

function formatDate(val: string | Date | null | undefined): string {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default function MembersPage() {
  const [members, setMembers]   = useState<Member[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [inputQ, setInputQ]     = useState(""); // 입력창 표시용
  const [q, setQ]               = useState(""); // 실제 검색어 (디바운스 적용)
  const [provider, setProvider] = useState("");
  const [status, setStatus]     = useState("");
  const [dateRange, setDateRange] = useState("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // 모달 관련 상태
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<{
    user: { groupMemberships?: { groupId: number }[]; [key: string]: unknown };
    changeHistory: ContactChangeLog[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState("");

  // 상태/태그/그룹 관련 상태
  const [memberStatus, setMemberStatus] = useState<string>("");
  const [memberTags, setMemberTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [groups, setGroups] = useState<{ id: number; name: string; color: string | null; memberCount: number }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [statusUpdateMsg, setStatusUpdateMsg] = useState("");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const totalPages  = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q)         params.set("q",    q);
    if (provider)  params.set("provider", provider);
    if (status)    params.set("status", status);
    if (dateRange) params.set("date",  dateRange);

    fetch(`/api/members?${params}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        if (d.ok) {
          setMembers(d.members ?? []);
          setTotal(d.total ?? 0);
          if ((d.members ?? []).length === 0 && page > 1) setPage(1);
        } else {
          setError(d.error ?? "데이터를 불러올 수 없습니다.");
          setMembers([]);
        }
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        if (e.message === "403") {
          setError("접근 권한이 없습니다. (GLOBAL_ADMIN 전용)");
        } else if (e.message === "401") {
          setError("로그인이 필요합니다.");
        } else {
          setError("서버 연결에 실패했습니다.");
        }
        setMembers([]);
      })
      .finally(() => { clearTimeout(t); setLoading(false); });
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [page, q, provider, status, dateRange]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  // 입력 변경 시 350ms 디바운스 후 실제 검색 실행
  const handleQChange = (val: string) => {
    setInputQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(val);
      setPage(1);
    }, 350);
  };

  // Enter / 검색 버튼: 디바운스 취소 후 즉시 실행
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputQ === q && page === 1) {
      // 상태 변경 없이 직접 reload
      load();
    } else {
      setQ(inputQ);
      setPage(1);
    }
  };

  const handleProviderChange = (val: string) => {
    setProvider(val);
    setPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleDateRangeChange = (val: string) => {
    setDateRange(val);
    setPage(1);
  };

  // 회원 상세 모달 열기
  const openDetailModal = async (member: Member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
    setDetailLoading(true);
    setAssignResult("");
    setStatusUpdateMsg("");
    setSelectedStaff("");
    setAssignReason("");
    setMemberStatus(member.memberStatus || "");
    setMemberTags(member.memberTags || []);
    setTagInput("");
    setNewGroupName("");
    setShowNewGroupInput(false);

    try {
      // 상세 정보 + 변경 이력 조회
      const detailRes = await fetch(`/api/members/${member.id}`);
      if (!detailRes.ok) throw new Error(String(detailRes.status));
      const detailJson = await detailRes.json();
      if (detailJson.ok) {
        setDetailData(detailJson);
        // groupMemberships에서 배정된 그룹 ID 추출
        const groupIds = new Set<number>(detailJson.user.groupMemberships?.map((m: { groupId: number }) => m.groupId) ?? []);
        setSelectedGroups(groupIds);
      }

      // 스태프 목록 조회 (담당자 드롭다운)
      if (staffList.length === 0) {
        setStaffLoading(true);
        const staffRes = await fetch("/api/org/agents");
        if (staffRes.ok) {
          const staffJson = await staffRes.json();
          if (staffJson.ok && staffJson.sections) {
            const allStaff: Staff[] = [];
            for (const section of staffJson.sections) {
              allStaff.push(...section.members);
            }
            setStaffList(allStaff);
          }
        }
        setStaffLoading(false);
      }

      // 그룹 목록 조회 (조건 제거 - 매번 최신 목록 fetch)
      try {
        setGroupsLoading(true);
        const groupRes = await fetch("/api/members/groups");
        if (groupRes.ok) {
          const groupJson = await groupRes.json();
          if (groupJson.ok && groupJson.groups) {
            setGroups(groupJson.groups);
          }
        }
      } catch (err) {
        // 그룹 로드 실패해도 계속 진행
      } finally {
        setGroupsLoading(false);
      }
    } catch (err) {
      setAssignResult("상세 정보를 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  // 담당자 지정
  const handleAssignStaff = async () => {
    if (!selectedMember || !selectedStaff) {
      setAssignResult("담당자를 선택해주세요.");
      return;
    }

    setAssigning(true);
    setAssignResult("");

    // Optimistic update: 즉시 UI에 반영
    const selectedStaffData = staffList.find((s) => s.id === selectedStaff);
    if (selectedStaffData && detailData) {
      setAssignResult(`✅ 담당자: ${selectedStaffData.displayName || selectedStaffData.loginId}로 지정 중...`);
    }

    try {
      const res = await fetch(`/api/members/${selectedMember.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedUserId: selectedStaff,
          reason: assignReason || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setAssignResult(json.error || "담당자 지정에 실패했습니다.");
        return;
      }

      const json = await res.json();
      if (json.ok) {
        setAssignResult("✅ 담당자가 지정되었습니다.");
        // 상세 정보 다시 로드 (변경 이력 갱신)
        setTimeout(() => {
          openDetailModal(selectedMember);
        }, 500);
      } else {
        setAssignResult(json.error || "담당자 지정에 실패했습니다.");
      }
    } catch (err) {
      setAssignResult("서버 연결에 실패했습니다.");
    } finally {
      setAssigning(false);
    }
  };

  // 상태 변경
  const handleStatusChange = async (status: string) => {
    if (!selectedMember) return;

    setMemberStatus(status);
    setStatusUpdateMsg("");

    try {
      const res = await fetch(`/api/members/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberStatus: status || null,
        }),
      });

      if (res.ok) {
        setStatusUpdateMsg("✅ 상태가 저장되었습니다.");
        setTimeout(() => setStatusUpdateMsg(""), 2000);
        // 상세 데이터 재로드 (변경된 상태 반영)
        setTimeout(() => { if (selectedMember) openDetailModal(selectedMember); }, 300);
      }
    } catch (err) {
      setStatusUpdateMsg("❌ 저장 실패");
    }
  };

  // 태그 추가 (Enter 키 또는 직접 호출)
  const addTagDirectly = (tag: string) => {
    if (memberTags.length >= 5 || memberTags.includes(tag)) return;
    const newTags = [...memberTags, tag];
    setMemberTags(newTags);
    setTagInput("");

    if (!selectedMember) return;

    fetch(`/api/members/${selectedMember.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberTags: newTags }),
    }).catch(() => setMemberTags(memberTags));
  };

  const handleAddTag = async () => {
    if (!tagInput.trim() || memberTags.length >= 5) return;
    const newTag = tagInput.trim();
    if (memberTags.includes(newTag)) {
      setTagInput("");
      return;
    }
    addTagDirectly(newTag);
  };

  // 태그 제거
  const handleRemoveTag = async (tag: string) => {
    const newTags = memberTags.filter((t) => t !== tag);
    setMemberTags(newTags);

    if (!selectedMember) return;

    try {
      await fetch(`/api/members/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberTags: newTags }),
      });
    } catch (err) {
      setMemberTags(memberTags);
    }
  };

  // 그룹 배정
  const handleAssignGroup = async (groupId: number) => {
    if (!selectedMember) return;

    try {
      const res = await fetch(`/api/members/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmUserId: selectedMember.id }),
      });

      if (res.ok) {
        setSelectedGroups((prev) => new Set([...prev, groupId]));
      } else {
        setAssignResult("그룹 배정에 실패했습니다.");
      }
    } catch (err) {
      setAssignResult("그룹 배정 중 오류가 발생했습니다.");
    }
  };

  // 그룹 제거
  const handleRemoveGroup = async (groupId: number) => {
    if (!selectedMember) return;

    try {
      const res = await fetch(`/api/members/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmUserId: selectedMember.id }),
      });

      if (res.ok) {
        setSelectedGroups((prev) => {
          const newSet = new Set(prev);
          newSet.delete(groupId);
          return newSet;
        });
      } else {
        setAssignResult("그룹 제거에 실패했습니다.");
      }
    } catch (err) {
      setAssignResult("그룹 제거 중 오류가 발생했습니다.");
    }
  };

  // 새 그룹 생성 + 배정
  const handleCreateAndAssignGroup = async () => {
    if (!newGroupName.trim() || !selectedMember) return;

    setCreatingGroup(true);
    try {
      const createRes = await fetch("/api/members/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (createRes.ok) {
        const createJson = await createRes.json();
        const newGroupId = createJson.group?.id;

        if (newGroupId) {
          // 배정
          const assignRes = await fetch(`/api/members/groups/${newGroupId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gmUserId: selectedMember.id }),
          });

          if (assignRes.ok) {
            setGroups((prev) => [...prev, createJson.group]);
            setSelectedGroups((prev) => new Set([...prev, newGroupId]));
            setNewGroupName("");
            setShowNewGroupInput(false);
            setAssignResult("✅ 그룹이 생성되고 배정되었습니다.");
          } else {
            setAssignResult("그룹 생성은 성공했으나 배정 실패");
          }
        }
      } else {
        setAssignResult("그룹 생성에 실패했습니다.");
      }
    } catch (err) {
      setAssignResult("그룹 생성 중 오류가 발생했습니다.");
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">크루즈닷 회원관리</h1>
        {!loading && total > 0 && (
          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-sm font-medium rounded-full">
            총 {total.toLocaleString()}명
          </span>
        )}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <form onSubmit={handleSearch} className="relative flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            value={inputQ}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="이름 / 전화번호"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-52"
          />
        </form>

        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700"
        >
          <option value="">전체 가입경로</option>
          <option value="KAKAO">카카오</option>
          <option value="NAVER">네이버</option>
          <option value="GOOGLE">구글</option>
          <option value="DIRECT">일반가입</option>
        </select>

        <select
          value={status}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700"
        >
          <option value="">전체 상태</option>
          <option value="잠재고객">잠재고객</option>
          <option value="소통">소통</option>
          <option value="구매완료">구매완료</option>
          <option value="VIP">VIP</option>
          <option value="수신거부">수신거부</option>
        </select>

        <input
          type="text"
          value={dateRange}
          onChange={(e) => handleDateRangeChange(e.target.value)}
          placeholder="YYYY-MM-DD~YYYY-MM-DD"
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
        />
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 컨텐츠 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      ) : !error && members.length === 0 ? (
        <div className="text-center py-20 text-gray-600 text-sm">
          검색 결과가 없습니다.
        </div>
      ) : !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">전화번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">이메일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">가입경로</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">태그</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">파트너유형</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">카카오채널</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-sm">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m, idx) => {
                  const providerBadge  = PROVIDER_BADGE[m.provider] ?? PROVIDER_BADGE.DIRECT;
                  const affiliateBadge = m.affiliateType ? AFFILIATE_BADGE[m.affiliateType] : null;
                  const rowNum         = (page - 1) * LIMIT + idx + 1;

                  return (
                    <tr
                      key={String(m.id)}
                      onClick={() => openDetailModal(m)}
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-gray-600 text-sm">{rowNum}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {m.name ?? <span className="text-gray-600 font-normal">이름없음</span>}
                        {m.isLocked && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-600 text-sm rounded">잠금</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm font-mono">
                        {m.phone ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {m.email ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${providerBadge.color}`}>
                          {providerBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {m.memberStatus && STATUS_BADGE[m.memberStatus] ? (
                          <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${STATUS_BADGE[m.memberStatus].color}`}>
                            {STATUS_BADGE[m.memberStatus].label}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {m.memberTags && m.memberTags.length > 0 ? (
                            <>
                              {m.memberTags.slice(0, 2).map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-sm rounded">
                                  #{tag}
                                </span>
                              ))}
                              {m.memberTags.length > 2 && (
                                <span className="px-1.5 py-0.5 text-gray-500 text-sm">
                                  +{m.memberTags.length - 2}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-300 text-sm">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {affiliateBadge ? (
                          <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${affiliateBadge.color}`}>
                            {affiliateBadge.label}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {m.kakaoChannelAdded && <span className="text-yellow-600 text-xs font-medium">카카오✓</span>}
                          {m.naverChannelAdded && <span className="text-green-600 text-xs font-medium">네이버✓</span>}
                          {m.googleChannelAdded && <span className="text-blue-600 text-xs font-medium">구글✓</span>}
                          {!m.kakaoChannelAdded && !m.naverChannelAdded && !m.googleChannelAdded && (
                            <span className="text-gray-300 text-sm">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {formatDate(m.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-600">총 {total.toLocaleString()}명</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="이전 페이지"
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="다음 페이지"
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 상세 모달 */}
      {showDetailModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedMember.name || "이름없음"}
                </h2>
                <p className="text-sm text-gray-500">{selectedMember.email || "-"}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                aria-label="닫기"
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">불러오는 중...</span>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* 기본 정보 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 기본 정보</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">가입경로</p>
                      <p className="font-medium text-gray-900">
                        {PROVIDER_BADGE[selectedMember.provider]?.label || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">가입일</p>
                      <p className="font-medium text-gray-900">{formatDate(selectedMember.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">전화번호</p>
                      <p className="font-medium text-gray-900 font-mono">{selectedMember.phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">SNS 채널 연결</p>
                      <div className="flex gap-3">
                        <p className="text-sm">
                          {selectedMember.kakaoChannelAdded ? "✅ 카카오" : "❌ 카카오"}
                        </p>
                        <p className="text-sm">
                          {selectedMember.naverChannelAdded ? "✅ 네이버" : "❌ 네이버"}
                        </p>
                        <p className="text-sm">
                          {selectedMember.googleChannelAdded ? "✅ 구글" : "❌ 구글"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상태 */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 상태</h3>
                  <select
                    value={memberStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— 상태 미설정 —</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {statusUpdateMsg && (
                    <p className="text-sm text-gray-600 mt-2">{statusUpdateMsg}</p>
                  )}
                </div>

                {/* 태그 */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">🏷️ 태그 (최대 5개)</h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {memberTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                        >
                          #{tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            aria-label={`태그 ${tag} 삭제`}
                            className="hover:text-blue-900 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    {memberTags.length < 5 && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                          placeholder="태그 입력 후 Enter"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          onClick={handleAddTag}
                          disabled={!tagInput.trim()}
                          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          추가
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {SUGGEST_TAGS.filter((tag) =>
                        tag.toLowerCase().includes(tagInput.toLowerCase())
                      ).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          disabled={memberTags.includes(tag) || memberTags.length >= 5}
                          onClick={() => addTagDirectly(tag)}
                          className={`px-2 py-0.5 text-sm rounded-full border transition-colors ${
                            memberTags.includes(tag)
                              ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50"
                              : "border-blue-200 text-blue-600 hover:bg-blue-50 cursor-pointer"
                          }`}
                          title={memberTags.includes(tag) ? "이미 추가됨" : "클릭하여 추가"}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 그룹 */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">👥 그룹</h3>
                  <div className="space-y-3">
                    {selectedGroups.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Array.from(selectedGroups).map((groupId) => {
                          const group = groups.find((g) => g.id === groupId);
                          return group ? (
                            <span
                              key={groupId}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium text-white"
                              style={{ backgroundColor: group.color || "#6B7280" }}
                            >
                              {group.name}
                              <button
                                onClick={() => handleRemoveGroup(groupId)}
                                aria-label={`그룹 삭제`}
                                className="opacity-70 hover:opacity-100"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">그룹 추가</label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAssignGroup(parseInt(e.target.value, 10));
                            e.target.value = "";
                          }
                        }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="">— 그룹 선택 —</option>
                        {groups
                          .filter((g) => !selectedGroups.has(g.id))
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    {!showNewGroupInput ? (
                      <button
                        onClick={() => setShowNewGroupInput(true)}
                        className="w-full px-3 py-2 text-sm border border-dashed border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        + 새 그룹 만들기
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="그룹 이름"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          onClick={handleCreateAndAssignGroup}
                          disabled={!newGroupName.trim() || creatingGroup}
                          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          생성
                        </button>
                        <button
                          onClick={() => {
                            setShowNewGroupInput(false);
                            setNewGroupName("");
                          }}
                          className="px-3 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 담당자 지정 */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">👤 담당자 지정</h3>
                  <div className="space-y-3">
                    {staffLoading ? (
                      <p className="text-sm text-gray-500">담당자 목록을 불러오는 중...</p>
                    ) : (
                      <div>
                        <label className="text-sm text-gray-600 mb-2 block">담당자 선택</label>
                        <select
                          value={selectedStaff}
                          onChange={(e) => setSelectedStaff(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          <option value="">— 담당자 선택 —</option>
                          {staffList.length > 0 ? (
                            staffList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.displayName || s.loginId} [{s.id}]
                              </option>
                            ))
                          ) : (
                            <option disabled>담당자가 없습니다.</option>
                          )}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-gray-600 mb-2 block">변경 이유 (선택)</label>
                      <textarea
                        value={assignReason}
                        onChange={(e) => setAssignReason(e.target.value)}
                        placeholder="예: 팀 이동, 지역 담당 변경 등"
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* 타임라인 */}
                {detailData && detailData.changeHistory.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      변경 이력
                    </h3>
                    <div className="space-y-2">
                      {detailData.changeHistory.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/50 transition-colors"
                        >
                          <span className="mt-0.5 text-gold-500 shrink-0 text-lg">✨</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">{log.newValue}</span>
                              {log.reason && (
                                <>
                                  <br />
                                  <span className="text-gray-600">이유: {log.reason}</span>
                                </>
                              )}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {new Date(log.changedAt).toLocaleString("ko-KR")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 결과 메시지 */}
                {assignResult && (
                  <div
                    className={`px-4 py-3 rounded-lg text-sm ${
                      assignResult.startsWith("✅")
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {assignResult}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAssignStaff}
                    disabled={!selectedStaff || assigning}
                    className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigning ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
