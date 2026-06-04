"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, X, Phone, ChevronDown, ChevronUp, Copy } from "lucide-react";
import {
  CRUISE_PRODUCTS,
  SEGMENT_COLORS,
  PASONA_COLORS,
  ProductCode,
  buildSearchIndex,
  SearchItem,
} from "@/constants/products";
import { useToast } from "@/lib/api/use-toast";

// ── DB 상품 타입 ──────────────────────────────────────────────────────────────
type DbProduct = {
  id: number;
  productCode: string;
  name: string;
  cruiseLine: string;
  ship: string;
  price: number | null;
  nights: number;
  startDate: string | null;
  saleStatus: string;
  availableCount: number | null;
  daysLeft: number | null;
  tourCities: string | null;
};

// ── 검색 하이라이트 ──────────────────────────────────────────────────────────
function highlight(text: string, q: string): React.ReactNode {
  if (!q.trim()) return text;
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {part}
      </mark>
    ) : part
  );
}

// ── 타입 배지 색상 ────────────────────────────────────────────────────────────
const TYPE_BADGE: Record<SearchItem["type"], { label: string; cls: string }> = {
  price:     { label: "💰 가격",        cls: "bg-green-100 text-green-800" },
  feature:   { label: "✅ 특징",        cls: "bg-blue-100 text-blue-800" },
  pasona:    { label: "📋 PASONA",      cls: "bg-purple-100 text-purple-800" },
  objection: { label: "❌ 거절",        cls: "bg-red-100 text-red-800" },
  response:  { label: "✅ 대응 스크립트", cls: "bg-emerald-100 text-emerald-800" },
};

// ── 검색 결과 카드 ────────────────────────────────────────────────────────────
function SearchResultCard({ item, q }: { item: SearchItem; q: string }) {
  const badge = TYPE_BADGE[item.type];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{item.emoji}</span>
        <span className="text-sm font-semibold text-gray-700">{item.productName}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <p className="text-sm text-gray-900 leading-relaxed">
        {highlight(item.content, q)}
      </p>
    </div>
  );
}

// ── DB 상품 카드 ──────────────────────────────────────────────────────────────
function DbProductCard({ product, q, onCopy }: { product: DbProduct; q: string; onCopy: (text: string) => void }) {
  const daysLeft = product.daysLeft;
  const urgentBadge = daysLeft !== null && daysLeft <= 7
    ? <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">D-{daysLeft}</span>
    : daysLeft !== null && daysLeft <= 30
    ? <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">D-{daysLeft}</span>
    : null;

  const copyText = [
    product.name,
    product.startDate ? `출발: ${product.startDate}` : '',
    product.price ? `${product.price.toLocaleString()}원` : '가격 문의',
    product.availableCount !== null ? `잔여 ${product.availableCount}석` : '',
    product.tourCities ?? '',
  ].filter(Boolean).join(' | ');

  return (
    <div className="bg-white border-2 border-blue-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">🚢</span>
          <span className="text-sm font-bold text-gray-900">{highlight(product.name, q)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {urgentBadge}
          <button
            onClick={() => onCopy(copyText)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"
            title="클립보드 복사"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {product.price && (
          <span className="font-bold text-blue-600 text-base">{product.price.toLocaleString()}원/인</span>
        )}
        {product.startDate && <span className="text-gray-500">출발 {product.startDate}</span>}
        <span className="text-gray-500">{product.nights}박{product.nights + 1}일</span>
        {product.availableCount !== null && (
          <span className={`font-semibold ${product.availableCount <= 5 ? 'text-red-600' : 'text-green-600'}`}>
            잔여 {product.availableCount}석
          </span>
        )}
        {product.tourCities && <span className="text-gray-400 text-xs">{product.tourCities}</span>}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-gray-400">{product.cruiseLine} · {product.ship}</span>
      </div>
    </div>
  );
}

// ── 거절 아코디언 ─────────────────────────────────────────────────────────────
function ObjectionItem({ objection, response }: { objection: string; response: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 bg-red-50 text-left flex items-center justify-between gap-3 hover:bg-red-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span>❌</span> {objection}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
      </button>
      {open && (
        <div className="p-4 bg-green-50 border-t border-green-200">
          <p className="text-xs font-bold text-green-700 uppercase mb-1">✅ 대응 스크립트</p>
          <p className="text-sm text-gray-900 leading-relaxed">{response}</p>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function TrainingPage() {
  const productCodes = useMemo(() => Object.keys(CRUISE_PRODUCTS) as ProductCode[], []);
  const [activeProduct, setActiveProduct] = useState<ProductCode>("GOLD_A");
  const [searchQ, setSearchQ] = useState("");
  const [inputVal, setInputVal] = useState("");
  const { toast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [dbProducts, setDbProducts] = useState<DbProduct[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbCache, setDbCache] = useState<{ data: DbProduct[]; ts: number } | null>(null);
  const dbDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchIndex = useMemo(() => buildSearchIndex(), []);
  const product = CRUISE_PRODUCTS[activeProduct];

  // DB 상품 검색 함수
  const fetchDbProducts = useCallback(async (q: string) => {
    // 캐시 확인 (5분)
    if (!q && dbCache && Date.now() - dbCache.ts < 5 * 60 * 1000) {
      setDbProducts(dbCache.data);
      return;
    }
    setDbLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/products/training-search?${params}`);
      const data = await res.json() as { ok: boolean; products?: DbProduct[] };
      if (data.ok && data.products) {
        setDbProducts(data.products);
        if (!q) setDbCache({ data: data.products, ts: Date.now() });
      }
    } catch {
      // 조용히 실패
    } finally {
      setDbLoading(false);
    }
  }, [dbCache]);

  // 페이지 로드 시 DB 상품 미리 fetch
  useEffect(() => {
    void fetchDbProducts('');
  }, [fetchDbProducts]);

  // 디바운스 검색
  const handleInput = useCallback((val: string) => {
    setInputVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQ(val.trim()), 150);
    // DB 상품 검색 (300ms 디바운스)
    if (dbDebounceRef.current) clearTimeout(dbDebounceRef.current);
    dbDebounceRef.current = setTimeout(() => {
      void fetchDbProducts(val.trim());
    }, 300);
  }, [fetchDbProducts]);

  // 전역 단축키: / 키로 검색창 포커스
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setInputVal("");
        setSearchQ("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 검색 결과
  const searchResults = useMemo(() => {
    if (!searchQ) return [];
    const q = searchQ.toLowerCase();
    return searchIndex.filter(
      (item) =>
        item.content.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [searchQ, searchIndex]);

  const isSearchMode = searchQ.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 상단 고정 검색바 ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-5 h-5 text-blue-600 shrink-0" />
            <h1 className="text-lg font-bold text-gray-900">상품 교육 — 전화 중 즉석 검색</h1>
            <span className="ml-auto text-xs text-gray-400 hidden sm:block">
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">/</kbd> 검색
              <kbd className="ml-1 px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">ESC</kbd> 초기화
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              value={inputVal}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="키워드 입력 (예: 가격, 일본, 해지, 거절, 헬스케어, 비싸다…)"
              className="w-full pl-9 pr-9 py-2.5 border-2 border-blue-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-blue-50 placeholder-gray-400"
              autoFocus
            />
            {inputVal && (
              <button
                onClick={() => { setInputVal(""); setSearchQ(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ── 검색 결과 모드 ── */}
        {isSearchMode ? (
          <div className="space-y-4">
            {/* DB 실시간 상품 */}
            {(dbLoading || dbProducts.filter(p => {
              const q2 = searchQ.toLowerCase();
              return !q2 || p.name.toLowerCase().includes(q2) || (p.tourCities ?? '').toLowerCase().includes(q2) || (p.cruiseLine ?? '').toLowerCase().includes(q2);
            }).length > 0) && (
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span>🚢</span> 현재 판매 상품
                  {dbLoading && <span className="text-gray-400 font-normal normal-case">(로딩 중...)</span>}
                </p>
                <div className="space-y-2">
                  {dbProducts
                    .filter(p => {
                      const q2 = searchQ.toLowerCase();
                      if (!q2) return true;
                      return p.name.toLowerCase().includes(q2)
                        || (p.tourCities ?? '').toLowerCase().includes(q2)
                        || (p.cruiseLine ?? '').toLowerCase().includes(q2)
                        || String(p.price ?? '').includes(q2);
                    })
                    .slice(0, 5)
                    .map((p) => (
                      <DbProductCard
                        key={p.id}
                        product={p}
                        q={searchQ}
                        onCopy={(text) => {
                          navigator.clipboard.writeText(text).then(() => {
                            toast({ title: '복사됨', description: '클립보드에 복사했습니다.' });
                          });
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
            {/* 정적 교육 결과 */}
            {searchResults.length > 0 && (
              <div>
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2">📚 멤버십 교육</p>
                <div className="space-y-2">
                  {searchResults.slice(0, 10).map((item, i) => (
                    <SearchResultCard key={i} item={item} q={searchQ} />
                  ))}
                </div>
              </div>
            )}
            {!dbLoading && dbProducts.filter(p => {
              const q2 = searchQ.toLowerCase();
              return !q2 || p.name.toLowerCase().includes(q2) || (p.tourCities ?? '').toLowerCase().includes(q2);
            }).length === 0 && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">"{searchQ}" 검색 결과가 없습니다.</p>
            )}
          </div>
        ) : (
          <>
            {/* ── 현재 판매 상품 빠른 뱃지 (탭 위) ── */}
            {dbProducts.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {dbProducts.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-800"
                  >
                    <span>🚢</span>
                    <span className="font-semibold truncate max-w-[120px]">{p.name}</span>
                    {p.price && <span className="text-blue-600 font-bold">{p.price.toLocaleString()}원</span>}
                    {p.daysLeft !== null && (
                      <span className={`font-bold ${p.daysLeft <= 7 ? 'text-red-600' : 'text-orange-600'}`}>
                        D-{p.daysLeft}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* ── 상품 탭 ── */}
            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-2 pb-2 flex-nowrap">
                {productCodes.map((code) => (
                  <button
                    key={code}
                    onClick={() => setActiveProduct(code)}
                    className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all border ${
                      activeProduct === code
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {CRUISE_PRODUCTS[code].emoji} {CRUISE_PRODUCTS[code].name}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 상품 상세 ── */}
            <div className="space-y-6">
              {/* 1. 상품 소개 */}
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {product.emoji} {product.name}
                    </h2>
                    <p className="text-gray-500 italic mt-1 text-sm">{product.tagline}</p>
                  </div>
                  {"price" in product && (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-blue-600">
                        {(product as { price: string }).price}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {product.type === "subscription" ? "구독형 (원하는 달만)" : "1회 구매"}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{product.description}</p>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">주요 특징</p>
                  <div className="flex flex-wrap gap-2">
                    {product.features.map((f, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-800 text-xs rounded-full border border-blue-100">
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* 2. PASONA */}
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4">📋 PASONA 판매 스크립트</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(product.pasona).map(([key, value]) => {
                    const c = PASONA_COLORS[key as keyof typeof PASONA_COLORS];
                    return (
                      <div key={key} className={`${c.bg} ${c.accent} p-4 rounded-lg`}>
                        <p className="text-xs font-bold text-gray-600 uppercase mb-1">
                          {c.emoji} {c.label}
                        </p>
                        <p className="text-sm text-gray-900 leading-relaxed">{value}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 3. 거절 대응 */}
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4">🛡️ 거절 & 대응 스크립트</h3>
                <div className="space-y-3">
                  {product.topObjections.map((obj, i) => (
                    <ObjectionItem key={i} objection={obj.objection} response={obj.response} />
                  ))}
                </div>
              </section>

              {/* 4. 추천 세그먼트 */}
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4">🎯 추천 고객 세그먼트</h3>
                <div className="grid grid-cols-5 gap-2">
                  {(["A", "B", "C", "D", "E"] as const).map((seg) => {
                    const isRec = product.recommendedSegments.some((s) => s === seg);
                    const c = SEGMENT_COLORS[seg];
                    return (
                      <div
                        key={seg}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          isRec ? `${c.bg} ${c.border}` : "bg-gray-50 border-gray-200 opacity-40"
                        }`}
                      >
                        <p className={`font-bold text-lg ${isRec ? c.text : "text-gray-400"}`}>{seg}</p>
                        {isRec && (
                          <span className="text-xs bg-white px-1.5 py-0.5 rounded font-semibold text-green-700 mt-1 inline-block">
                            추천
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
