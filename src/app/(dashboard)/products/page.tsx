"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Calculator,
  X,
} from "lucide-react";

type CabinEntry = { total: number; booked: number; remaining: number };
type CabinSummary = Record<string, CabinEntry>;

type Product = {
  id: number;
  code: string;
  name: string;
  cruiseLine: string;
  shipName: string | null;
  nights: number;
  days: number;
  price: number;
  isActive: boolean;
  saleStatus: string | null;
  availableCount: number | null;
  reservedCount: number | null;
  refundPolicy: unknown;
  createdAt: string;
  departureDate: string | null;
  daysLeft: number | null;
  cabinSummary: CabinSummary | null;
};

interface ApiResponse {
  ok: boolean;
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

type ActiveFilter = "all" | "true" | "false";

const LIMIT = 20;

// 객실 타입 한글 레이블 (순서 고정)
const CABIN_LABELS: { key: string; label: string }[] = [
  { key: "inside",    label: "내측" },
  { key: "oceanview", label: "오션뷰" },
  { key: "balcony",   label: "발코니" },
  { key: "suite",     label: "스위트" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR") + "원";
}

function SaleStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">-</span>;
  const map: Record<string, string> = {
    "판매중": "bg-green-100 text-green-700",
    "판매완료": "bg-gray-100 text-gray-500",
    "마감임박": "bg-orange-100 text-orange-700",
    "준비중": "bg-blue-100 text-blue-700",
    "취소": "bg-red-100 text-red-700",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function DdayBadge({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) return <span className="text-gray-400 text-xs">-</span>;
  if (daysLeft === 0)
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">D-day</span>;
  if (daysLeft < 0)
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-500">D+{Math.abs(daysLeft)}</span>;
  if (daysLeft <= 7)
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">D-{daysLeft}</span>;
  if (daysLeft <= 30)
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">D-{daysLeft}</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">D-{daysLeft}</span>;
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        활성
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      비활성
    </span>
  );
}

function CabinSummaryCell({ summary }: { summary: CabinSummary | null }) {
  if (!summary || Object.keys(summary).length === 0) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  // CABIN_LABELS 순서로 + summary에 있는 키만 표시
  const known = CABIN_LABELS.filter(({ key }) => key in summary);
  const extra = Object.keys(summary).filter(
    (k) => !CABIN_LABELS.some((l) => l.key === k)
  );

  const all = [
    ...known.map(({ key, label }) => ({ key, label, entry: summary[key]! })),
    ...extra.map((key) => ({ key, label: key, entry: summary[key]! })),
  ];

  return (
    <div className="space-y-0.5 min-w-[120px]">
      {all.map(({ key, label, entry }) => {
        const isSoldOut = entry.remaining <= 0;
        return (
          <div key={key} className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 w-[44px] shrink-0">{label}</span>
            {isSoldOut ? (
              <span className="font-semibold text-red-600">마감</span>
            ) : (
              <span className={entry.remaining <= 2 ? "font-semibold text-orange-600" : "text-gray-800"}>
                {entry.total - entry.booked}/{entry.total}석
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (  /* 상품코드/상품명/출발일/D-day/객실/가격/판매상태/도구 */
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ── 환불기준 팝업 ──────────────────────────────────────────────────

type RefundSlot = { daysBeforeDep: number; penaltyRate: number; label?: string };
type RefundResult = {
  refundAmount: number;
  penaltyRate: number;
  penaltyAmount: number;
  daysBeforeDep: number;
  basis: string;
  appliedSlot: RefundSlot;
};

// 법정 기준 (국외여행 특수약관) — 서버와 동일
const LEGAL_SLOTS: RefundSlot[] = [
  { daysBeforeDep: 30, penaltyRate: 0,   label: "위약금 없음" },
  { daysBeforeDep: 20, penaltyRate: 10 },
  { daysBeforeDep: 10, penaltyRate: 15 },
  { daysBeforeDep: 8,  penaltyRate: 20 },
  { daysBeforeDep: 1,  penaltyRate: 30 },
  { daysBeforeDep: 0,  penaltyRate: 50 },
];

function calcRefundClient(amount: number, daysLeft: number): RefundResult {
  const sorted = [...LEGAL_SLOTS].sort((a, b) => b.daysBeforeDep - a.daysBeforeDep);
  const appliedSlot = sorted.find((s) => daysLeft >= s.daysBeforeDep) ??
    sorted[sorted.length - 1] ??
    { daysBeforeDep: 0, penaltyRate: 100, label: "당일 취소" };

  const penaltyAmount = Math.round((amount * appliedSlot.penaltyRate) / 100);
  return {
    refundAmount: amount - penaltyAmount,
    penaltyRate: appliedSlot.penaltyRate,
    penaltyAmount,
    daysBeforeDep: daysLeft,
    basis: "법정기준(관광진흥법 시행령)",
    appliedSlot,
  };
}

interface RefundModalProps {
  product: Product;
  onClose: () => void;
}

function RefundModal({ product, onClose }: RefundModalProps) {
  const [amountInput, setAmountInput] = useState(
    product.price > 0 ? String(product.price) : ""
  );

  const amount = parseInt(amountInput.replace(/,/g, ""), 10) || 0;
  const daysLeft = product.daysLeft ?? 0;
  const result = amount > 0 ? calcRefundClient(amount, daysLeft) : null;

  const depLabel = product.departureDate ? formatDate(product.departureDate) : "-";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">환불기준 계산기</h2>
        </div>

        {/* 상품 정보 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">상품명</span>
            <span className="font-medium text-gray-900 text-right max-w-[60%]">{product.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">출발일</span>
            <span className="font-medium text-gray-900">{depLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">오늘 기준</span>
            <DdayBadge daysLeft={daysLeft} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">적용 기준</span>
            <span className="text-gray-600 text-xs">관광진흥법 시행령</span>
          </div>
        </div>

        {/* 금액 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            결제금액 입력
          </label>
          <div className="relative">
            <input
              type="text"
              value={amountInput ? Number(amountInput.replace(/,/g, "")).toLocaleString("ko-KR") : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "").replace(/[^0-9]/g, "");
                setAmountInput(raw);
              }}
              placeholder="예: 1,290,000"
              className="w-full pr-8 pl-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
          </div>
        </div>

        {/* 계산 결과 */}
        {result && amount > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="bg-blue-50 px-4 py-2 border-b border-gray-200">
              <span className="text-xs font-medium text-blue-700">환불 계산 결과</span>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-gray-500">결제금액</span>
                <span className="font-medium">{amount.toLocaleString()}원</span>
              </div>
              {result.penaltyRate > 0 && (
                <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                  <span className="text-gray-500">
                    위약금 ({result.penaltyRate}%)
                    {result.appliedSlot.label ? ` — ${result.appliedSlot.label}` : ""}
                  </span>
                  <span className="font-medium text-orange-600">-{result.penaltyAmount.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
                <span className="font-semibold text-gray-800">환불금액</span>
                <span className={`text-lg font-bold ${result.penaltyRate > 0 ? "text-red-600" : "text-green-600"}`}>
                  {result.refundAmount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 법정 기준표 */}
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="font-medium text-gray-600 mb-1">법정 위약금 기준표</p>
          {LEGAL_SLOTS.slice().reverse().map((s) => (
            <div key={s.daysBeforeDep} className={`flex justify-between ${daysLeft <= s.daysBeforeDep + 9 && daysLeft >= s.daysBeforeDep ? "text-orange-600 font-medium" : ""}`}>
              <span>출발 {s.daysBeforeDep}일 전 이후</span>
              <span>{s.penaltyRate}% {s.label ? `(${s.label})` : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [refundProduct, setRefundProduct] = useState<Product | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // 세션 역할 조회 (APIS 버튼 표시 여부)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d?.role) setUserRole(d.role); })
      .catch(() => {});
  }, []);

  const canDownloadApis = userRole === "OWNER" || userRole === "GLOBAL_ADMIN";

  const fetchProducts = useCallback(
    (currentPage: number, q: string, isActive: ActiveFilter) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(LIMIT));
      if (q) params.set("q", q);
      if (isActive !== "all") params.set("isActive", isActive);

      fetch(`/api/products?${params.toString()}`)
        .then((res) => res.json())
        .then((data: ApiResponse) => {
          if (data.ok) {
            setProducts(data.products ?? []);
            setTotal(data.total ?? 0);
            setPage(data.page ?? 1);
            setTotalPages(data.totalPages ?? 1);
          } else {
            setError("데이터를 불러오지 못했습니다.");
          }
        })
        .catch(() => {
          setError("네트워크 오류가 발생했습니다.");
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchProducts(page, searchQuery, activeFilter);
  }, [fetchProducts, page, searchQuery, activeFilter]);

  function handleFilterChange(filter: ActiveFilter) {
    setActiveFilter(filter);
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  }

  function handleSearchClear() {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

  async function handleDownloadApis(product: Product) {
    if (!canDownloadApis) return;
    setDownloadingCode(product.code);
    try {
      const res = await fetch(`/api/admin/apis/excel?productCode=${encodeURIComponent(product.code)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "다운로드에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      a.href = url;
      a.download = `APIS_${product.code}_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloadingCode(null);
    }
  }

  const filterTabs: { label: string; value: ActiveFilter }[] = [
    { label: "전체", value: "all" },
    { label: "활성", value: "true" },
    { label: "비활성", value: "false" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <ShoppingBag className="w-6 h-6 text-navy-900" />
        <h1 className="text-2xl font-bold text-navy-900">상품 관리</h1>
        {!loading && (
          <span className="ml-2 text-sm text-gray-500">
            총 {total.toLocaleString()}개
          </span>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleFilterChange(tab.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFilter === tab.value
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="상품명 또는 상품코드 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            검색
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              초기화
            </button>
          )}
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">상품코드</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">상품명</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">출발일</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">D-day</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">객실 잔여</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">가격</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">판매상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">도구</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && !error && products.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    등록된 상품이 없습니다
                  </td>
                </tr>
              )}

              {!loading &&
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                        {product.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px]">
                      <div className="truncate">{product.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {product.cruiseLine} {product.shipName ? `· ${product.shipName}` : ""}
                        {product.nights > 0 ? ` · ${product.nights}박${product.days}일` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap">
                      {product.departureDate ? formatDate(product.departureDate) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <DdayBadge daysLeft={product.daysLeft} />
                    </td>
                    <td className="px-4 py-3">
                      <CabinSummaryCell summary={product.cabinSummary} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums whitespace-nowrap">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SaleStatusBadge status={product.saleStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 환불기준 버튼 */}
                        {product.departureDate && (
                          <button
                            onClick={() => setRefundProduct(product)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            환불기준
                          </button>
                        )}
                        {/* APIS 다운로드 버튼 (OWNER/GLOBAL_ADMIN만) */}
                        {canDownloadApis && (
                          <button
                            onClick={() => handleDownloadApis(product)}
                            disabled={downloadingCode === product.code}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {downloadingCode === product.code ? "생성 중..." : "APIS"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {page} / {totalPages} 페이지
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="이전 페이지"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      pageNum === page
                        ? "bg-navy-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="다음 페이지"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 환불기준 팝업 */}
      {refundProduct && (
        <RefundModal
          product={refundProduct}
          onClose={() => setRefundProduct(null)}
        />
      )}
    </div>
  );
}
