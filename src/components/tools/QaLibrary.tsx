"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { QaSearchBar } from "./QaSearchBar";
import { QaCard } from "./QaCard";
import { QaDetailModal } from "./QaDetailModal";

interface QaItem {
  id: string;
  key: string;
  question: string;
  answer: string;
  category: string;
  source: string;
  type: string;
  keywords: string[];
  salesTone: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  ok: boolean;
  data: QaItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const CATEGORIES = [
  "기타",
  "정책&수수료",
  "탑승&수속",
  "기술&앱",
  "식사&음료",
  "선상활동",
  "객실&카드",
  "기항지&투어",
];

export function QaLibrary() {
  const [items, setItems] = useState<QaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<QaItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 검색 상태
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tone, setTone] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // 검색 수행
  const performSearch = useCallback(
    async (q: string = query, cat: string = category, t: string = tone, p: number = 1) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (q) params.append("q", q);
        if (cat && cat !== "all") params.append("category", cat);
        if (t && t !== "all") params.append("tone", t);
        params.append("page", p.toString());
        params.append("limit", "20");

        const res = await fetch(`/api/tools/bot-guide-answers?${params}`);
        const data: ApiResponse = await res.json();

        if (data.ok) {
          setItems(data.data);
          setTotalPages(data.meta.totalPages);
          setTotal(data.meta.total);
          setPage(p);
        } else {
          setError("검색 실패");
        }
      } catch (err) {
        setError("검색 중 오류 발생");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [query, category, tone]
  );

  // 초기 로드
  useEffect(() => {
    performSearch(query, category, tone, 1);
  }, []);

  const handleSearch = (q: string, cat: string, t: string) => {
    setQuery(q);
    setCategory(cat);
    setTone(t);
    setPage(1);
    performSearch(q, cat, t, 1);
  };

  const handleSelectItem = (item: QaItem) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const handlePageChange = (newPage: number) => {
    performSearch(query, category, tone, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      {/* 검색 바 */}
      <QaSearchBar
        categories={CATEGORIES}
        onSearch={handleSearch}
        isLoading={loading}
      />

      {/* 결과 요약 */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {total > 0 ? (
            <>
              총 <span className="font-semibold text-gray-900">{total}</span>개 중{" "}
              <span className="font-semibold text-gray-900">
                {(page - 1) * 20 + 1}
              </span>
              ~
              <span className="font-semibold text-gray-900">
                {Math.min(page * 20, total)}
              </span>
              개 표시
            </>
          ) : (
            "검색 결과가 없습니다"
          )}
        </p>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-600">검색 중...</p>
          </div>
        </div>
      )}

      {/* Q&A 리스트 */}
      {!loading && items.length > 0 && (
        <div className="space-y-3 mb-6">
          {items.map((item) => (
            <QaCard
              key={item.id}
              item={item}
              onClick={handleSelectItem}
              highlight={query}
            />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && items.length === 0 && !error && (
        <div className="py-12 text-center">
          <p className="text-gray-400 text-sm">검색 결과가 없습니다.</p>
          <p className="text-gray-400 text-xs mt-1">다른 검색어를 시도해보세요.</p>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 border-t border-gray-200">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1 || loading}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            이전
          </button>

          {/* 페이지 번호 */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = page - 2 + i;
              if (pageNum < 1) pageNum += 5 - i;
              if (pageNum > totalPages) pageNum -= i;
              if (pageNum < 1 || pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum
                      ? "bg-navy-900 text-white"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                  } disabled:opacity-50`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages || loading}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            다음
          </button>
        </div>
      )}

      {/* 디테일 모달 */}
      {selectedItem && (
        <QaDetailModal
          item={selectedItem}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
