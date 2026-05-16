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
  createdAt: string | Date;
  isLocked: boolean;
  affiliateType: string | null;
  provider: "KAKAO" | "NAVER" | "GOOGLE" | "DIRECT";
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
  BRANCH_MANAGER: { label: "지사장",     color: "bg-purple-100 text-purple-700" },
  HQ:             { label: "본사",       color: "bg-indigo-100 text-indigo-700" },
  PRESALES:       { label: "프리세일즈", color: "bg-sky-100 text-sky-700" },
  SALES_AGENT:    { label: "영업직원",   color: "bg-orange-100 text-orange-700" },
};

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
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // 모달 관련 상태
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<{ user: any; changeHistory: ContactChangeLog[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState("");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const totalPages  = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q)        params.set("q",        q);
    if (provider) params.set("provider", provider);

    fetch(`/api/members?${params}`)
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
        if (e.message === "403") {
          setError("접근 권한이 없습니다. (GLOBAL_ADMIN 전용)");
        } else if (e.message === "401") {
          setError("로그인이 필요합니다.");
        } else {
          setError("서버 연결에 실패했습니다.");
        }
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, [page, q, provider]);

  useEffect(() => { load(); }, [load]);

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

  // 회원 상세 모달 열기
  const openDetailModal = async (member: Member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
    setDetailLoading(true);
    setAssignResult("");
    setSelectedStaff("");
    setAssignReason("");

    try {
      // 상세 정보 + 변경 이력 조회
      const detailRes = await fetch(`/api/members/${member.id}`);
      if (!detailRes.ok) throw new Error(String(detailRes.status));
      const detailJson = await detailRes.json();
      if (detailJson.ok) {
        setDetailData(detailJson);
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
        // 상세 정보 다시 로드
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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">크루즈닷 회원관리</h1>
        {!loading && total > 0 && (
          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
            총 {total.toLocaleString()}명
          </span>
        )}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <form onSubmit={handleSearch} className="relative flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
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
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 컨텐츠 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      ) : !error && members.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          검색 결과가 없습니다.
        </div>
      ) : !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">전화번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">이메일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">가입경로</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">파트너유형</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">카카오채널</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">가입일</th>
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
                      <td className="px-4 py-3 text-gray-400 text-xs">{rowNum}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {m.name ?? <span className="text-gray-400 font-normal">이름없음</span>}
                        {m.isLocked && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">잠금</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {m.phone ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {m.email ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${providerBadge.color}`}>
                          {providerBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {affiliateBadge ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${affiliateBadge.color}`}>
                            {affiliateBadge.label}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.kakaoChannelAdded ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
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
            <p className="text-xs text-gray-400">총 {total.toLocaleString()}명</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="이전 페이지"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 text-xs text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="다음 페이지"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
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
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
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
                      <p className="text-gray-500">카카오채널</p>
                      <p className="font-medium text-gray-900">
                        {selectedMember.kakaoChannelAdded ? "✅ 추가됨" : "-"}
                      </p>
                    </div>
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
                        <label className="text-xs text-gray-600 mb-2 block">담당자 선택</label>
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
                      <label className="text-xs text-gray-600 mb-2 block">변경 이유 (선택)</label>
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
                            <p className="text-xs text-gray-400 mt-1">
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
