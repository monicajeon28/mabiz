"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Search, Star, X, Plus, Loader2
} from "lucide-react";

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
};

const COURSE_LABEL: Record<string, string> = { A: "A코스", B: "B코스", C: "C코스", HEALTH: "건강" };

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  SUSPENDED: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    "활성",
  SUSPENDED: "정지",
  CANCELLED: "해지",
};

const COURSE_BADGE: Record<string, string> = {
  A: "bg-blue-100 text-blue-700",
  B: "bg-purple-100 text-purple-700",
  C: "bg-indigo-100 text-indigo-700",
  HEALTH: "bg-emerald-100 text-emerald-700",
};

const INITIAL_FORM = {
  name: "", phone: "", email: "",
  courseType: "A" as "A" | "B" | "C" | "HEALTH",
  joinDate: new Date().toISOString().slice(0, 10),
  paymentDay: "",
  totalPayments: "",
  memo: "",
};

export default function GoldMembersPage() {
  const router = useRouter();
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
            <h1 className="text-xl font-bold text-navy-900">골드회원 관리</h1>
          </div>
          <p className="text-sm text-gray-500">CRM 골드회원 수동 등록 및 관리</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          골드회원 등록
        </button>
      </div>

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
          <p>골드회원이 없습니다.</p>
          <button
            onClick={() => setDrawerOpen(true)}
            className="mt-4 px-4 py-2 text-sm bg-navy-900 text-white rounded-lg hover:opacity-90"
          >
            첫 골드회원 등록
          </button>
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
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/gold-members/${m.id}`); }}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        상세보기
                      </button>
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

      {/* 등록 드로어 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 오버레이 */}
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
          {/* 패널 */}
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-navy-900">골드회원 등록</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
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
