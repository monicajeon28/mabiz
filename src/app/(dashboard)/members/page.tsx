"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, X, Clock, Filter } from "lucide-react";

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
  BRANCH_MANAGER: { label: "지사장",   color: "bg-purple-100 text-purple-700" },
  HQ:             { label: "본사",       color: "bg-indigo-100 text-indigo-700" },
  PRESALES:       { label: "마케터", color: "bg-sky-100 text-sky-700" },
  SALES_AGENT:    { label: "대리점장",     color: "bg-orange-100 text-orange-700" },
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

// 메모이제이션된 날짜 포맷 함수
const formatDate = (val: string | Date | null | undefined): string => {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
};

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
  const [showFilters, setShowFilters] = useState(false);

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
  const totalPages  = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total]);

  // 배지 데이터 메모이제이션
  const providerBadges = useMemo(() => PROVIDER_BADGE, []);
  const statusBadges = useMemo(() => STATUS_BADGE, []);
  const affiliateBadges = useMemo(() => AFFILIATE_BADGE, []);

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

  // 입력 변경 시 300ms 디바운스 후 실제 검색 실행 (성능 최적화)
  const handleQChange = useCallback((val: string) => {
    setInputQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(val);
      setPage(1);
    }, 300);
  }, []);

  // Enter / 검색 버튼: 디바운스 취소 후 즉시 실행
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputQ === q && page === 1) {
      // 상태 변경 없이 직접 reload
      load();
    } else {
      setQ(inputQ);
      setPage(1);
    }
  }, [inputQ, q, page, load]);

  const handleProviderChange = useCallback((val: string) => {
    setProvider(val);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((val: string) => {
    setStatus(val);
    setPage(1);
  }, []);

  const handleDateRangeChange = useCallback((val: string) => {
    setDateRange(val);
    setPage(1);
  }, []);

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

  // 담당자 지정 (최적화: 불필요한 재렌더링 방지)
  const handleAssignStaff = useCallback(async () => {
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
          if (selectedMember) openDetailModal(selectedMember);
        }, 400);
      } else {
        setAssignResult(json.error || "담당자 지정에 실패했습니다.");
      }
    } catch (err) {
      setAssignResult("서버 연결에 실패했습니다.");
    } finally {
      setAssigning(false);
    }
  }, [selectedMember, selectedStaff, assignReason, staffList, detailData, openDetailModal]);

  // 상태 변경
  const handleStatusChange = useCallback(async (status: string) => {
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
        setTimeout(() => { if (selectedMember) openDetailModal(selectedMember); }, 250);
      }
    } catch (err) {
      setStatusUpdateMsg("❌ 저장 실패");
    }
  }, [selectedMember, openDetailModal]);

  // 태그 추가 (Enter 키 또는 직접 호출)
  const addTagDirectly = useCallback((tag: string) => {
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
  }, [memberTags, selectedMember]);

  const handleAddTag = useCallback(() => {
    if (!tagInput.trim() || memberTags.length >= 5) return;
    const newTag = tagInput.trim();
    if (memberTags.includes(newTag)) {
      setTagInput("");
      return;
    }
    addTagDirectly(newTag);
  }, [tagInput, memberTags, addTagDirectly]);

  // 태그 제거
  const handleRemoveTag = useCallback((tag: string) => {
    const newTags = memberTags.filter((t) => t !== tag);
    setMemberTags(newTags);

    if (!selectedMember) return;

    try {
      fetch(`/api/members/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberTags: newTags }),
      });
    } catch (err) {
      setMemberTags(memberTags);
    }
  }, [memberTags, selectedMember]);

  // 그룹 배정
  const handleAssignGroup = useCallback(async (groupId: number) => {
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
  }, [selectedMember]);

  // 그룹 제거
  const handleRemoveGroup = useCallback(async (groupId: number) => {
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
  }, [selectedMember]);

  // 새 그룹 생성 + 배정
  const handleCreateAndAssignGroup = useCallback(async () => {
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
  }, [newGroupName, selectedMember]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto bg-gradient-to-b from-blue-50 to-white min-h-screen">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">👥</span>
          </div>
          <div>
            <h1 className="text-28 font-bold text-gray-900">회원 관리</h1>
            <p className="text-16 text-gray-600 mt-1">크루즈닷 전체 회원을 한눈에 관리합니다</p>
          </div>
          <a
            href="/groups"
            className="ml-auto inline-flex items-center gap-2 px-6 py-3 text-16 font-bold text-blue-700 bg-white border-2 border-blue-300 rounded-xl hover:bg-blue-50 hover:border-blue-500 transition-colors"
          >
            📁 연락처 그룹 관리 →
          </a>
        </div>
        {/* 회원 그룹 vs 연락처 그룹 안내 */}
        <div className="mt-3 px-5 py-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
          <p className="text-16 text-amber-900 leading-relaxed">
            <span className="font-bold">안내:</span> 이 페이지의 그룹은 <span className="font-bold">회원 그룹</span>(크루즈닷 가입 회원 분류)입니다.
            랜딩·자동문자에 연결되는 <span className="font-bold">연락처 그룹</span>은 위의 <span className="font-bold">[연락처 그룹 관리]</span> 버튼에서 따로 관리합니다. 두 그룹은 서로 분리되어 있습니다.
          </p>
        </div>
        {!loading && total > 0 && (
          <div className="mt-4 inline-block px-6 py-3 bg-white border-2 border-blue-200 rounded-xl">
            <p className="text-18 font-bold text-blue-700">총 <span className="text-blue-600">{total.toLocaleString()}</span>명</p>
          </div>
        )}
      </div>

      {/* 필터 바 */}
      <div className="mb-6 space-y-4">
        {/* 검색 및 필터 토글 */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              value={inputQ}
              onChange={(e) => handleQChange(e.target.value)}
              placeholder="이름 또는 전화번호를 검색하세요"
              className="w-full pl-12 pr-4 py-3 text-16 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </form>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-6 py-3 text-16 font-medium rounded-lg border-2 transition-all ${
              showFilters
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-600"
            }`}
          >
            <Filter className="w-5 h-5" />
            필터
          </button>
        </div>

        {/* 필터 확장 패널 */}
        {showFilters && (
          <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 가입경로 */}
              <div>
                <label className="block text-16 font-semibold text-gray-900 mb-3">
                  가입 경로
                </label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-4 py-3 text-16 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— 전체 경로 —</option>
                  <option value="KAKAO">😊 카카오</option>
                  <option value="NAVER">🔍 네이버</option>
                  <option value="GOOGLE">🔵 구글</option>
                  <option value="DIRECT">✏️ 일반가입</option>
                </select>
              </div>

              {/* 회원 상태 */}
              <div>
                <label className="block text-16 font-semibold text-gray-900 mb-3">
                  회원 상태
                </label>
                <select
                  value={status}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  className="w-full px-4 py-3 text-16 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— 전체 상태 —</option>
                  <option value="잠재고객">💤 잠재고객</option>
                  <option value="소통">💬 소통 중</option>
                  <option value="구매완료">✅ 구매 완료</option>
                  <option value="VIP">👑 VIP</option>
                  <option value="수신거부">🚫 수신 거부</option>
                </select>
              </div>

              {/* 가입 날짜 */}
              <div>
                <label className="block text-16 font-semibold text-gray-900 mb-3">
                  가입 기간
                </label>
                <input
                  type="text"
                  value={dateRange}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  placeholder="예: 2026-01-01~2026-06-30"
                  className="w-full px-4 py-3 text-16 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 필터 초기화 */}
            {(q || provider || status || dateRange) && (
              <div className="flex gap-3 justify-end pt-3 border-t-2 border-gray-200">
                <button
                  onClick={() => {
                    setInputQ("");
                    setQ("");
                    setProvider("");
                    setStatus("");
                    setDateRange("");
                    setPage(1);
                    setShowFilters(false);
                  }}
                  className="px-6 py-3 text-16 font-medium text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-6 px-6 py-4 bg-red-50 border-2 border-red-300 rounded-xl text-16 text-red-700 font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* 컨텐츠 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-18 text-gray-600 font-medium">회원 목록을 불러오는 중...</p>
        </div>
      ) : !error && members.length === 0 ? (
        <div className="text-center py-32 bg-white border-2 border-gray-200 rounded-xl">
          <p className="text-20 text-gray-600 font-medium">검색 결과가 없습니다</p>
          <p className="text-16 text-gray-500 mt-2">다른 조건으로 검색해보세요</p>
        </div>
      ) : !error && (
        <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <tr>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">#</th>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">👤 이름</th>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">📱 연락처</th>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">📧 이메일</th>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">경로</th>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">상태</th>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">태그</th>
                  <th className="text-left px-6 py-4 font-bold text-16 text-blue-900">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.map((m, idx) => {
                  const providerBadge = providerBadges[m.provider] ?? providerBadges.DIRECT;
                  const rowNum = (page - 1) * LIMIT + idx + 1;

                  return (
                    <tr
                      key={String(m.id)}
                      onClick={() => openDetailModal(m)}
                      className="hover:bg-blue-50 transition-colors cursor-pointer border-b border-gray-100"
                    >
                      <td className="px-6 py-4 text-16 text-gray-600 font-medium">{rowNum}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-14">
                            {(m.name ?? "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-16 font-bold text-gray-900">
                              {m.name ?? <span className="text-gray-500">이름없음</span>}
                            </p>
                            {m.isLocked && (
                              <span className="inline-block mt-1 px-2 py-1 bg-red-100 text-red-700 text-12 font-bold rounded">🔒 잠금</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-16 text-gray-700 font-mono">
                        {m.phone ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-16 text-gray-700">
                        {m.email ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-2 rounded-full text-14 font-bold ${providerBadge.color}`}>
                          {providerBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {m.memberStatus && statusBadges[m.memberStatus] ? (
                          <span className={`inline-block px-3 py-2 rounded-full text-14 font-bold ${statusBadges[m.memberStatus].color}`}>
                            {statusBadges[m.memberStatus].label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-16">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {m.memberTags && m.memberTags.length > 0 ? (
                            <>
                              {m.memberTags.slice(0, 2).map((tag) => (
                                <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-14 font-medium rounded-full">
                                  #{tag}
                                </span>
                              ))}
                              {m.memberTags.length > 2 && (
                                <span className="px-2 py-1 text-gray-600 text-14 font-medium">
                                  +{m.memberTags.length - 2}개
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-16">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-16 text-gray-700 font-medium">
                        {formatDate(m.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-5 border-t-2 border-gray-200 bg-gray-50">
            <p className="text-18 font-medium text-gray-700 mb-4 sm:mb-0">
              총 <span className="text-blue-600 font-bold">{total.toLocaleString()}</span>명
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="이전 페이지"
                className="p-3 rounded-lg text-gray-700 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed border-2 border-gray-300 hover:border-blue-500 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 py-2 text-16 font-bold text-gray-700 bg-white border-2 border-gray-300 rounded-lg min-w-20 text-center">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="다음 페이지"
                className="p-3 rounded-lg text-gray-700 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed border-2 border-gray-300 hover:border-blue-500 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 상세 모달 */}
      {showDetailModal && selectedMember && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] overflow-auto shadow-2xl">
            {/* 헤더 */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 border-b-4 border-blue-800 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold text-20 shadow-lg">
                  {(selectedMember.name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-24 font-bold text-white">
                    {selectedMember.name || "이름없음"}
                  </h2>
                  <p className="text-16 text-blue-100 mt-1">{selectedMember.email || "-"}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                aria-label="닫기"
                className="p-3 rounded-lg hover:bg-blue-500 text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-18 text-gray-600 font-medium">정보를 불러오는 중...</p>
              </div>
            ) : (
              <div className="p-8 space-y-7">
                {/* 기본 정보 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                  <h3 className="text-20 font-bold text-blue-900 mb-6">📋 기본 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg p-5">
                      <p className="text-14 text-gray-600 font-medium mb-2">가입 경로</p>
                      <p className="text-18 font-bold text-gray-900">
                        {PROVIDER_BADGE[selectedMember.provider]?.label || "-"}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-5">
                      <p className="text-14 text-gray-600 font-medium mb-2">가입 날짜</p>
                      <p className="text-18 font-bold text-gray-900">{formatDate(selectedMember.createdAt)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-5">
                      <p className="text-14 text-gray-600 font-medium mb-2">연락처</p>
                      <p className="text-18 font-bold text-gray-900 font-mono">{selectedMember.phone || "-"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-5">
                      <p className="text-14 text-gray-600 font-medium mb-3">연결된 채널</p>
                      <div className="flex gap-4">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-14 ${selectedMember.kakaoChannelAdded ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                          {selectedMember.kakaoChannelAdded ? "✅" : "❌"} 카카오
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-14 ${selectedMember.naverChannelAdded ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {selectedMember.naverChannelAdded ? "✅" : "❌"} 네이버
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-14 ${selectedMember.googleChannelAdded ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                          {selectedMember.googleChannelAdded ? "✅" : "❌"} 구글
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상태 */}
                <div className="bg-white border-2 border-purple-200 rounded-xl p-6">
                  <h3 className="text-20 font-bold text-purple-900 mb-5">📊 회원 상태</h3>
                  <div>
                    <label className="block text-16 font-semibold text-gray-800 mb-4">현재 상태를 선택하세요</label>
                    <select
                      value={memberStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-16 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white font-medium"
                    >
                      <option value="">— 상태 미설정 —</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {statusUpdateMsg && (
                    <p className="text-16 text-green-700 font-medium mt-4 bg-green-50 px-4 py-3 rounded-lg border-2 border-green-200">
                      {statusUpdateMsg}
                    </p>
                  )}
                </div>

                {/* 태그 */}
                <div className="bg-white border-2 border-orange-200 rounded-xl p-6">
                  <h3 className="text-20 font-bold text-orange-900 mb-5">🏷️ 태그 (최대 5개)</h3>
                  <div className="space-y-5">
                    {memberTags.length > 0 && (
                      <div className="bg-orange-50 border-2 border-orange-100 rounded-lg p-4">
                        <p className="text-14 font-semibold text-gray-700 mb-3">추가된 태그 ({memberTags.length}/5)</p>
                        <div className="flex flex-wrap gap-3">
                          {memberTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-200 text-orange-800 text-16 rounded-full font-bold"
                            >
                              #{tag}
                              <button
                                onClick={() => handleRemoveTag(tag)}
                                aria-label={`태그 ${tag} 삭제`}
                                className="hover:text-orange-900 font-bold text-18"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {memberTags.length < 5 && (
                      <div>
                        <label className="block text-16 font-semibold text-gray-800 mb-3">새 태그 추가</label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                            placeholder="태그명 입력 후 Enter"
                            className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-3 text-16 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                          <button
                            onClick={handleAddTag}
                            disabled={!tagInput.trim()}
                            className="px-6 py-3 bg-orange-500 text-white text-16 font-bold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            추가
                          </button>
                        </div>
                      </div>
                    )}
                    {SUGGEST_TAGS.length > 0 && (
                      <div>
                        <p className="text-14 font-semibold text-gray-700 mb-3">추천 태그 (클릭하여 추가)</p>
                        <div className="flex flex-wrap gap-2">
                          {SUGGEST_TAGS.filter((tag) =>
                            tag.toLowerCase().includes(tagInput.toLowerCase())
                          ).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              disabled={memberTags.includes(tag) || memberTags.length >= 5}
                              onClick={() => addTagDirectly(tag)}
                              className={`px-4 py-2 text-16 rounded-full border-2 font-medium transition-all ${
                                memberTags.includes(tag)
                                  ? "border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50"
                                  : "border-orange-400 text-orange-600 hover:bg-orange-50 cursor-pointer hover:border-orange-600"
                              }`}
                              title={memberTags.includes(tag) ? "이미 추가됨" : "클릭하여 추가"}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 그룹 */}
                <div className="bg-white border-2 border-green-200 rounded-xl p-6">
                  <h3 className="text-20 font-bold text-green-900 mb-2">👥 회원 그룹</h3>
                  <p className="text-14 text-gray-600 mb-5 leading-relaxed">
                    크루즈닷 회원 분류용 그룹입니다. 랜딩·자동문자에 쓰는 연락처 그룹과는 다릅니다.
                  </p>
                  <div className="space-y-5">
                    {selectedGroups.size > 0 && (
                      <div className="bg-green-50 border-2 border-green-100 rounded-lg p-4">
                        <p className="text-14 font-semibold text-gray-700 mb-3">속한 그룹 ({selectedGroups.size})</p>
                        <div className="flex flex-wrap gap-3">
                          {Array.from(selectedGroups).map((groupId) => {
                            const group = groups.find((g) => g.id === groupId);
                            return group ? (
                              <span
                                key={groupId}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-16 font-bold text-white"
                                style={{ backgroundColor: group.color || "#16A34A" }}
                              >
                                {group.name}
                                <button
                                  onClick={() => handleRemoveGroup(groupId)}
                                  aria-label={`그룹 삭제`}
                                  className="opacity-80 hover:opacity-100 font-bold text-18"
                                >
                                  ×
                                </button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-16 font-semibold text-gray-800 mb-3">그룹 추가하기</label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAssignGroup(parseInt(e.target.value, 10));
                            e.target.value = "";
                          }
                        }}
                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-16 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 font-medium"
                      >
                        <option value="">— 그룹을 선택하세요 —</option>
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
                        className="w-full px-4 py-3 text-16 font-bold border-2 border-dashed border-green-400 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                      >
                        ➕ 새 그룹 만들기
                      </button>
                    ) : (
                      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-3">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="새 그룹 이름을 입력하세요"
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-16 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          autoFocus
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={handleCreateAndAssignGroup}
                            disabled={!newGroupName.trim() || creatingGroup}
                            className="flex-1 px-4 py-3 bg-green-600 text-white text-16 font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {creatingGroup ? "생성 중..." : "그룹 생성"}
                          </button>
                          <button
                            onClick={() => {
                              setShowNewGroupInput(false);
                              setNewGroupName("");
                            }}
                            className="px-4 py-3 border-2 border-gray-300 text-gray-700 text-16 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 담당자 지정 */}
                <div className="bg-white border-2 border-indigo-200 rounded-xl p-6">
                  <h3 className="text-20 font-bold text-indigo-900 mb-5">👤 담당자 지정</h3>
                  <div className="space-y-5">
                    {staffLoading ? (
                      <p className="text-16 text-gray-500 font-medium">담당자 목록을 불러오는 중...</p>
                    ) : (
                      <div>
                        <label className="block text-16 font-semibold text-gray-800 mb-3">담당할 직원을 선택하세요</label>
                        <select
                          value={selectedStaff}
                          onChange={(e) => setSelectedStaff(e.target.value)}
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-16 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                        >
                          <option value="">— 담당자를 선택하세요 —</option>
                          {staffList.length > 0 ? (
                            staffList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.displayName || s.loginId}
                              </option>
                            ))
                          ) : (
                            <option disabled>담당자가 없습니다.</option>
                          )}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-16 font-semibold text-gray-800 mb-3">변경 이유 (선택사항)</label>
                      <textarea
                        value={assignReason}
                        onChange={(e) => setAssignReason(e.target.value)}
                        placeholder="예: 팀 이동, 지역 담당 변경 등"
                        rows={3}
                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-16 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* 타임라인 */}
                {detailData && detailData.changeHistory.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl p-6">
                    <h3 className="text-20 font-bold text-amber-900 mb-5 flex items-center gap-3">
                      <Clock className="w-6 h-6" />
                      변경 이력
                    </h3>
                    <div className="space-y-4">
                      {detailData.changeHistory.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-4 p-4 bg-white rounded-lg border-2 border-amber-100 hover:shadow-md transition-all"
                        >
                          <span className="mt-1 shrink-0 text-24">✨</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-16 text-gray-900">
                              <span className="font-bold">{log.newValue}</span>
                              {log.reason && (
                                <>
                                  <br />
                                  <span className="text-14 text-gray-600 font-medium">이유: {log.reason}</span>
                                </>
                              )}
                            </p>
                            <p className="text-14 text-gray-600 mt-2 font-medium">
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
                    className={`px-6 py-4 rounded-xl text-16 font-bold border-2 ${
                      assignResult.startsWith("✅")
                        ? "bg-green-50 text-green-700 border-green-300"
                        : "bg-red-50 text-red-700 border-red-300"
                    }`}
                  >
                    {assignResult}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-4 justify-end pt-6 border-t-2 border-gray-200">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-6 py-4 border-2 border-gray-300 rounded-lg text-16 font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    닫기
                  </button>
                  <button
                    onClick={handleAssignStaff}
                    disabled={!selectedStaff || assigning}
                    className="px-8 py-4 bg-blue-600 rounded-lg text-16 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigning ? "저장 중..." : "담당자 저장"}
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
