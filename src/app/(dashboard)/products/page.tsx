"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

type Product = {
  id: number;
  productCode: string;
  name: string;
  description: string | null;
  price: number;
  commissionRate: number | null;
  isActive: boolean;
  createdAt: string;
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

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${y}-${M}-${D}`;
}

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR") + "원";
}

function formatCommission(rate: number | null) {
  if (rate === null) return "-";
  return (rate * 100).toFixed(1) + "%";
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

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

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

  const filterTabs: { label: string; value: ActiveFilter }[] = [
    { label: "전체", value: "all" },
    { label: "활성", value: "true" },
    { label: "비활성", value: "false" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
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
        {/* Active filter tabs */}
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

        {/* Search bar */}
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
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  상품코드
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  상품명
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  가격
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  커미션율
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  상태
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  등록일
                </th>
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
                  <td
                    colSpan={6}
                    className="text-center py-16 text-gray-400 text-sm"
                  >
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    등록된 상품이 없습니다
                  </td>
                </tr>
              )}

              {!loading &&
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                        {product.productCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {formatCommission(product.commissionRate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActiveBadge isActive={product.isActive} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(product.createdAt)}
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
    </div>
  );
}
