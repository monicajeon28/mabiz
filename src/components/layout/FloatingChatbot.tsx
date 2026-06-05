"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageCircle, X, Search, Copy, Check, ChevronRight
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface BotAnswer {
  id: string;           // number → string (통합 검색 소스별 ID)
  source: 'qa' | 'script' | 'product';  // 추가
  key?: string;
  question: string;
  answer: string;
  category: string;
  salesTone?: string;
}

// ─── 상수 ───────────────────────────────────────────────────────────────────

const QUICK_TOOLS = [
  { icon: "📚", label: "상품교육",   href: "/tools?tab=training" },
  { icon: "🎤", label: "콜스크립트", href: "/tools?tab=scripts" },
  { icon: "📖", label: "플레이북",   href: "/tools?tab=playbook" },
  { icon: "📱", label: "SMS템플릿",  href: "/tools?tab=sms-templates" },
  { icon: "🔊", label: "콜AI분석",   href: "/tools?tab=call-feedback" },
  { icon: "🔍", label: "키워드검색", href: "/tools/keyword-volume" },
];

const SITUATION_CHIPS = [
  { label: "가격이 비싸요",      keyword: "가격" },
  { label: "생각해볼게요",       keyword: "생각" },
  { label: "다음에 갈게요",      keyword: "다음에" },
  { label: "비행기 무서워요",    keyword: "비행기" },
  { label: "처음 크루즈예요",    keyword: "처음" },
  { label: "배우자 상의 필요",   keyword: "배우자" },
  { label: "크루즈 지루할 것 같아요", keyword: "지루" },
  { label: "영어 못해요",        keyword: "영어" },
  { label: "왜 이렇게 싸요",     keyword: "싸요" },
];

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function FloatingChatbot() {
  const router = useRouter();
  const [isOpen, setIsOpen]         = useState(false);
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<BotAnswer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId]  = useState<string | null>(null);
  const [searchError, setSearchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 검색 실행
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(false);
    try {
      const res = await fetch(
        `/api/tools/unified-search?q=${encodeURIComponent(q)}&limit=8`
      );
      const json = await res.json();
      setResults(json.ok ? (json.data ?? []) : []);
    } catch {
      setResults([]);
      setSearchError(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 디바운스 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // 봇 열릴 때 포커스 + Escape 키로 닫기
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setExpandedId(null);
      setSearchError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) setIsOpen(false); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen]);

  // 상황 칩 클릭 — setQuery만 (useEffect debounce가 doSearch 처리)
  const handleChip = (keyword: string) => {
    setQuery(keyword);
    inputRef.current?.focus();
  };

  // 도구 이동
  const handleToolNav = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  // 답변 복사
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* ── 패널 ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="세일즈봇"
          aria-modal="true"
          className="fixed bottom-[140px] right-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-40 flex flex-col md:bottom-28 md:right-6"
          style={{ maxHeight: "min(75vh, 600px)" }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-bold text-gray-900 text-base">세일즈봇</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="챗봇 닫기"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto">

            {/* 검색 바 */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="키워드 검색 (예: 가격, 비행기...)"
                  className="w-full pl-9 pr-3 py-2.5 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* 상황별 빠른 칩 */}
            {!hasSearched && (
              <div className="px-4 pb-3 shrink-0">
                <p className="text-sm text-gray-500 font-medium mb-2">💬 고객이 이렇게 말한다면?</p>
                <div className="flex flex-wrap gap-1.5">
                  {SITUATION_CHIPS.map((chip) => (
                    <button
                      key={chip.keyword}
                      onClick={() => handleChip(chip.keyword)}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-full border border-blue-100 hover:bg-blue-100 hover:border-blue-300 transition-colors font-medium"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 검색 결과 */}
            {hasSearched && (
              <div className="px-4 pb-3">
                {isSearching ? (
                  <div className="flex items-center justify-center py-6 text-gray-400 text-sm gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    검색 중...
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 font-medium">🔍 연관 검색 결과 {results.length}건</p>
                    {results.map((item) => {
                      const isExpanded = expandedId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                        >
                          <p className="text-sm font-semibold text-gray-700 mb-1.5 leading-snug">
                            Q. {item.question}
                          </p>
                          <p className={`text-sm text-gray-600 leading-relaxed mb-1 ${isExpanded ? "" : "line-clamp-3"}`}>
                            {item.answer}
                          </p>
                          {/* 펼치기 / 접기 */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="text-xs text-blue-500 hover:text-blue-700 mb-2"
                          >
                            {isExpanded ? "▲ 접기" : "▼ 전체 보기"}
                          </button>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            {item.source === 'script' && (
                              <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100 font-medium">
                                🎤 콜스크립트
                              </span>
                            )}
                            {item.source === 'product' && (
                              <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100 font-medium">
                                📚 상품교육
                              </span>
                            )}
                            {item.source === 'qa' && (
                              <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full border border-gray-100">
                                📖 Q&A
                              </span>
                            )}
                            {item.category && (
                              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                                {item.category}
                              </span>
                            )}
                            <button
                              onClick={() => handleCopy(item.id, item.answer)}
                              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              {copiedId === item.id ? (
                                <><Check className="w-3 h-3 text-green-500" /> 복사됨</>
                              ) : (
                                <><Copy className="w-3 h-3" /> 복사</>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {/* Q&A 전체 보기 */}
                    <Link
                      href={`/tools?tab=qa&q=${encodeURIComponent(query)}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center gap-1 w-full py-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      전체 Q&A에서 더 보기 <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    {searchError ? (
                      <p className="text-sm font-medium text-red-500">검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
                    ) : (
                      <>
                        <p className="text-base font-medium text-gray-500">"{query}"에 대한 결과가 없습니다.</p>
                        <p className="text-sm text-gray-400 mt-1">다른 키워드로 검색하거나 아래를 눌러보세요.</p>
                      </>
                    )}
                    {/* 결과 없을 때도 칩 표시 */}
                    <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                      {SITUATION_CHIPS.slice(0, 5).map((chip) => (
                        <button
                          key={chip.keyword}
                          onClick={() => handleChip(chip.keyword)}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 도구 탐색 버튼 — 검색 결과 없을 때 항상 표시 */}
            {!hasSearched && (
              <div className="px-4 pb-4 shrink-0">
                <p className="text-sm text-gray-500 font-medium mb-2">🚀 도구 바로가기</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_TOOLS.map((tool) => (
                    <button
                      key={tool.label}
                      onClick={() => handleToolNav(tool.href)}
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-gray-100 transition-colors"
                    >
                      <span className="text-xl">{tool.icon}</span>
                      <span className="text-xs text-gray-700 font-medium text-center leading-tight">
                        {tool.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 검색 결과 있을 때도 도구 탐색 작게 표시 */}
            {hasSearched && results.length > 0 && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 shrink-0">
                <p className="text-xs text-gray-400 font-medium mb-2">도구 바로가기</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TOOLS.map((tool) => (
                    <button
                      key={tool.label}
                      onClick={() => handleToolNav(tool.href)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-50 text-gray-700 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      {tool.icon} {tool.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB 버튼 ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[72px] right-4 w-14 h-14 rounded-full shadow-xl transition-all duration-200 z-50 flex items-center justify-center md:bottom-8 md:right-6 ${
          isOpen
            ? "bg-gray-800 hover:bg-gray-900 rotate-0"
            : "bg-blue-600 hover:bg-blue-700"
        } text-white`}
        aria-label="세일즈봇"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </>
  );
}
