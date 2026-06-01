"use client";

import { Search, X, Filter, Loader2 } from "lucide-react";
import { useState } from "react";

interface QaSearchBarProps {
  categories: string[];
  onSearch: (query: string, category: string, tone: string) => void;
  isLoading?: boolean;
}

const TONES = [
  { id: "all", label: "모든 톤" },
  { id: "neutral", label: "중립" },
  { id: "friendly", label: "친근" },
  { id: "urgent", label: "긴급" },
  { id: "professional", label: "전문" },
  { id: "empathetic", label: "공감" },
  { id: "assertive", label: "단호" },
];

export function QaSearchBar({
  categories,
  onSearch,
  isLoading,
}: QaSearchBarProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tone, setTone] = useState("all");
  const [showFilters, setShowFilters] = useState(true);

  const handleSearch = (q: string = query, cat: string = category, t: string = tone) => {
    onSearch(q, cat, t);
  };

  const handleClearFilters = () => {
    setQuery("");
    setCategory("all");
    setTone("all");
    onSearch("", "all", "all");
  };

  const activeFilterCount =
    (query ? 1 : 0) + (category !== "all" ? 1 : 0) + (tone !== "all" ? 1 : 0);

  return (
    <div className="space-y-3 mb-6">
      {/* 검색창 - 50대 사용자 개선 + 로딩 상태 */}
      <div className="relative">
        {isLoading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400 animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
        )}
        <input
          type="text"
          placeholder={isLoading ? "검색 중..." : "질문 또는 답변으로 검색..."}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value, category, tone);
          }}
          disabled={isLoading}
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-600"
        />
        {query && !isLoading && (
          <button
            onClick={() => {
              setQuery("");
              handleSearch("", category, tone);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* 필터 토글 - 50대 사용자 개선 + 로딩 상태 */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium transition-colors w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${
          showFilters || activeFilterCount > 0
            ? "bg-blue-100 text-blue-700 border border-blue-200"
            : "bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300"
        }`}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
        필터
        {activeFilterCount > 0 && (
          <span className="ml-auto flex items-center justify-center w-5 h-5 text-sm font-bold bg-blue-600 text-white rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          {/* 카테고리 필터 - 50대 사용자 개선 */}
          <div>
            <p className="text-base font-semibold text-gray-700 mb-2">카테고리</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setCategory("all");
                  handleSearch(query, "all", tone);
                }}
                className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === "all"
                    ? "bg-navy-900 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                }`}
              >
                전체
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    handleSearch(query, cat, tone);
                  }}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    category === cat
                      ? "bg-navy-900 text-white"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 판매톤 필터 - 50대 사용자 개선 */}
          <div>
            <p className="text-base font-semibold text-gray-700 mb-2">판매톤</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTone(t.id);
                    handleSearch(query, category, t.id);
                  }}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    tone === t.id
                      ? "bg-navy-900 text-white"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 필터 초기화 - 50대 사용자 개선 */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="w-full px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-base font-medium hover:bg-red-50 transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
}
