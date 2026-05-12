"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Ship,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  AlertCircle,
} from "lucide-react";

/* ── 타입 ── */
type CabinCounts = {
  inside: number;
  oceanview: number;
  balcony: number;
  suite: number;
};

type Voyage = {
  id: number;
  name: string;
  departureDate: string;
  shipName: string;
  status: "ON_SALE" | "SOLD_OUT" | "CLOSED";
  totalCabins: CabinCounts;
  remainingCabins: CabinCounts;
};

type SummaryData = {
  onSaleCount: number;
  soldOutCount: number;
  totalRemaining: number;
  totalCapacity: number;
};

/* ── 상수 ── */
const LIMIT = 20;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ON_SALE:  { label: "판매중", color: "bg-green-100 text-green-700" },
  SOLD_OUT: { label: "매진",   color: "bg-red-100 text-red-700" },
  CLOSED:   { label: "종료",   color: "bg-gray-100 text-gray-500" },
};

const EMPTY_CABINS: CabinCounts = { inside: 0, oceanview: 0, balcony: 0, suite: 0 };

/* ── 유틸 ── */
function formatDate(val: string | null | undefined): string {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function cabinTotal(c: CabinCounts): number {
  return c.inside + c.oceanview + c.balcony + c.suite;
}

function remainingColor(n: number): string {
  if (n === 0) return "text-red-600 font-semibold";
  if (n <= 3) return "text-yellow-600 font-semibold";
  return "text-green-600 font-semibold";
}

function remainingDot(n: number): string {
  if (n === 0) return "bg-red-500";
  if (n <= 3) return "bg-yellow-400";
  return "bg-green-500";
}

/* ── 컴포넌트 ── */
export default function CabinInventoryPage() {
  /* 데이터 */
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryData>({
    onSaleCount: 0,
    soldOutCount: 0,
    totalRemaining: 0,
    totalCapacity: 0,
  });
  const [page, setPage] = useState(1);
  const [inputQ, setInputQ] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  /* 모달 */
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Voyage | null>(null);
  const [saving, setSaving] = useState(false);

  /* 폼 */
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formShip, setFormShip] = useState("");
  const [formStatus, setFormStatus] = useState<"ON_SALE" | "SOLD_OUT" | "CLOSED">("ON_SALE");
  const [formTotal, setFormTotal] = useState<CabinCounts>({ ...EMPTY_CABINS });
  const [formRemaining, setFormRemaining] = useState<CabinCounts>({ ...EMPTY_CABINS });

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  /* ── 데이터 로드 ── */
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/cabin-inventory?${params}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        if (d.ok) {
          setVoyages(d.voyages ?? []);
          setTotal(d.total ?? 0);
          setSummary(d.summary ?? { onSaleCount: 0, soldOutCount: 0, totalRemaining: 0, totalCapacity: 0 });
          setIsAdmin(d.isAdmin ?? false);
          if ((d.voyages ?? []).length === 0 && page > 1) setPage(1);
        } else {
          setError(d.error ?? "데이터를 불러올 수 없습니다.");
          setVoyages([]);
        }
      })
      .catch((e: Error) => {
        if (e.message === "403") {
          setError("접근 권한이 없습니다. (GLOBAL_ADMIN / OWNER 전용)");
        } else if (e.message === "401") {
          setError("로그인이 필요합니다.");
        } else {
          setError("서버 연결에 실패했습니다.");
        }
        setVoyages([]);
      })
      .finally(() => setLoading(false));
  }, [page, q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  /* ── 디바운스 검색 ── */
  const handleQChange = (val: string) => {
    setInputQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(val);
      setPage(1);
    }, 350);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputQ === q && page === 1) {
      load();
    } else {
      setQ(inputQ);
      setPage(1);
    }
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  /* ── 모달 열기 ── */
  const openAddModal = () => {
    setFormName("");
    setFormDate("");
    setFormShip("");
    setFormStatus("ON_SALE");
    setFormTotal({ ...EMPTY_CABINS });
    setFormRemaining({ ...EMPTY_CABINS });
    setShowAddModal(true);
  };

  const openEditModal = (v: Voyage) => {
    setEditTarget(v);
    setFormName(v.name);
    setFormDate(v.departureDate?.slice(0, 10) ?? "");
    setFormShip(v.shipName);
    setFormStatus(v.status);
    setFormTotal({ ...v.totalCabins });
    setFormRemaining({ ...v.remainingCabins });
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditTarget(null);
    setSaving(false);
  };

  /* ── CRUD ── */
  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/cabin-inventory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          departureDate: formDate,
          shipName: formShip,
          totalCabins: formTotal,
          remainingCabins: formRemaining,
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      closeModals();
      load();
    } catch {
      setError("여행 추가에 실패했습니다.");
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cabin-inventory", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          name: formName,
          departureDate: formDate,
          shipName: formShip,
          status: formStatus,
          totalCabins: formTotal,
          remainingCabins: formRemaining,
        }),
      });
      if (!res.ok) throw new Error("수정 실패");
      closeModals();
      load();
    } catch {
      setError("여행 수정에 실패했습니다.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editTarget) return;
    if (!confirm(`"${editTarget.name}" 여행을 삭제하시겠습니까?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cabin-inventory?id=${editTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("삭제 실패");
      closeModals();
      load();
    } catch {
      setError("여행 삭제에 실패했습니다.");
      setSaving(false);
    }
  };

  /* ── 객실 수량 입력 핸들러 ── */
  const updateTotal = (key: keyof CabinCounts, val: number) =>
    setFormTotal((prev) => ({ ...prev, [key]: Math.max(0, val) }));
  const updateRemaining = (key: keyof CabinCounts, val: number) =>
    setFormRemaining((prev) => ({ ...prev, [key]: Math.max(0, val) }));

  /* ── 객실타입 라벨 ── */
  const CABIN_LABELS: { key: keyof CabinCounts; label: string }[] = [
    { key: "inside",    label: "인사이드" },
    { key: "oceanview", label: "오션뷰" },
    { key: "balcony",   label: "발코니" },
    { key: "suite",     label: "스위트" },
  ];

  /* ── 모달 공통 렌더 ── */
  const renderModal = (title: string, onSubmit: () => void, isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* 여행명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">여행명</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="예: 2026 지중해 크루즈"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 출발일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">출발일</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 선박명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">선박명</label>
            <input
              value={formShip}
              onChange={(e) => setFormShip(e.target.value)}
              placeholder="예: MSC Bellissima"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 상태 (수정 시에만) */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as Voyage["status"])}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              >
                <option value="ON_SALE">판매중</option>
                <option value="SOLD_OUT">매진</option>
                <option value="CLOSED">종료</option>
              </select>
            </div>
          )}

          {/* 객실 수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">객실 수량 (총 / 잔여)</label>
            <div className="space-y-2">
              {CABIN_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-20 text-sm text-gray-600">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={formTotal[key]}
                    onChange={(e) => updateTotal(key, parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="총"
                  />
                  <span className="text-gray-400">/</span>
                  <input
                    type="number"
                    min={0}
                    value={formRemaining[key]}
                    onChange={(e) => updateRemaining(key, parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="잔여"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={closeModals}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={onSubmit}
              disabled={saving || !formName || !formDate || !formShip}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "저장" : "추가"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── 렌더 ── */
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5 flex items-center gap-3">
        <Ship className="w-5 h-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">잔여 객실 관리</h1>
        {!loading && total > 0 && (
          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
            총 {total.toLocaleString()}개 여행
          </span>
        )}
      </div>

      {/* 요약 카드 */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {/* 판매 가능 */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">판매 가능 여행</p>
            <p className="text-2xl font-bold text-green-600">{summary.onSaleCount}<span className="text-sm font-normal text-gray-400 ml-1">개</span></p>
          </div>
          {/* 매진 */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">매진 여행</p>
            <p className="text-2xl font-bold text-red-600">{summary.soldOutCount}<span className="text-sm font-normal text-gray-400 ml-1">개</span></p>
          </div>
          {/* 전체 잔여 */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">전체 잔여 객실</p>
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalRemaining}<span className="text-sm font-normal text-gray-400 ml-1">개</span>
              <span className="text-sm font-normal text-gray-400 ml-1">/ {summary.totalCapacity}개</span>
            </p>
          </div>
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <form onSubmit={handleSearch} className="relative flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={inputQ}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="여행명 / 선박명"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-52"
          />
        </form>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700"
        >
          <option value="">전체 상태</option>
          <option value="ON_SALE">판매중</option>
          <option value="SOLD_OUT">매진</option>
          <option value="CLOSED">종료</option>
        </select>

        {/* GLOBAL_ADMIN만 여행 추가 가능 */}
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            여행 추가
          </button>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 컨텐츠 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      ) : !error && voyages.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          검색 결과가 없습니다.
        </div>
      ) : !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">여행</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">출발일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">선박</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">인사이드</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">오션뷰</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">발코니</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">스위트</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">전체 잔여</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {voyages.map((v) => {
                  const rem = v.remainingCabins ?? EMPTY_CABINS;
                  const tot = v.totalCabins ?? EMPTY_CABINS;
                  const totalRem = cabinTotal(rem);
                  const totalCap = cabinTotal(tot);
                  const badge = STATUS_BADGE[v.status] ?? STATUS_BADGE.ON_SALE;

                  return (
                    <tr
                      key={String(v.id)}
                      onClick={() => openEditModal(v)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {v.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(v.departureDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {v.shipName}
                      </td>

                      {/* 객실타입별 잔여 */}
                      {(["inside", "oceanview", "balcony", "suite"] as const).map((key) => (
                        <td key={key} className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${remainingDot(rem[key])}`} />
                            <span className={`text-xs ${remainingColor(rem[key])}`}>
                              {rem[key]}
                            </span>
                            <span className="text-xs text-gray-300">/ {tot[key]}</span>
                          </div>
                        </td>
                      ))}

                      {/* 전체 잔여 */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${remainingColor(totalRem)}`}>
                          {totalRem}
                        </span>
                        <span className="text-xs text-gray-300 ml-0.5">/ {totalCap}</span>
                      </td>

                      {/* 상태 */}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">총 {total.toLocaleString()}개 여행</p>
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

      {/* 추가 모달 */}
      {showAddModal && renderModal("여행 추가", handleAdd, false)}

      {/* 수정 모달 */}
      {showEditModal && editTarget && renderModal("여행 수정", handleUpdate, true)}
    </div>
  );
}
