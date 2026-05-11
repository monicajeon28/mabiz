"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

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
                    <tr key={String(m.id)} className="hover:bg-gray-50 transition-colors">
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
    </div>
  );
}
