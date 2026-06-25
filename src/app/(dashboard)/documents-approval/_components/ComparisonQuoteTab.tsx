'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Loader2,
  Plus,
  Trash2,
  Download,
  FilePlus2,
  Package,
  CheckSquare,
  MinusSquare,
  Layers,
  X,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import {
  CustomerAutocomplete,
  useImageDownload,
  formatMoney,
  formatDate,
  useCurrentAgent,
  DocumentLetterhead,
  DocumentSeal,
  type SaleResult,
} from './shared';

// ─── 포함/불포함 기본 항목 상수 ──────────────────────────────────────────────
const STANDARD_INCLUDES = [
  '선박/항공기 운임', '숙박/식사료', '안내자경비', '항만세·관광기금',
  '제세금', '여행알선수수료', '관광지 입장료', '유류할증료', '여행보험료',
  '항공기 추가 운임',
];

const STANDARD_EXCLUDES = [
  '선상팁', '쇼핑비', '선택관광', '여권발급비', '비자발급비', '봉사료', '포터비',
  '일본 관광 입국세', '여권·비자 개인 부담',
];

// ─── 경쟁사 가격 행 타입 (익명화: companyName 제거) ──────────────────────────────
type CompetitorPrice = {
  price: number;
  notes: string;
};

// ─── 비교견적서 폼 상태 타입 ─────────────────────────────────────────────────
type QuoteForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  productCode: string;
  productName: string;
  ourPrice: number;
  headcount: string;
  cabinType: string;
  departureDate: string;
  itinerary: string;
  competitorPrices: CompetitorPrice[];
  competitorIncludedItems: string[];    // ✅ 신규: 타사 포함 항목 (수동 입력)
  competitorExcludedItems: string[];    // ✅ 신규: 타사 불포함 항목 (수동 입력)
  competitorServiceNotes: string;       // ✅ 신규: 타사 서비스 특이사항
  includedItems: string[];
  excludedItems: string[];
  hasGuide: '' | 'Y' | 'N';
  hasCruisedotStaff: '' | 'Y' | 'N';
  optionItems: string[];
};

// 상품 검색 결과 타입
type ProductSearchResult = {
  id: string;
  productCode: string;
  productName: string;
  basePrice: number;
};

const EMPTY_FORM: QuoteForm = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  productCode: '',
  productName: '',
  ourPrice: 0,
  headcount: '',
  cabinType: '',
  departureDate: '',
  itinerary: '',
  competitorPrices: [{ price: 0, notes: '' }],
  competitorIncludedItems: [],
  competitorExcludedItems: [],
  competitorServiceNotes: '',
  includedItems: ['선박/항공기 운임', '숙박/식사료', '안내자경비', '항만세·관광기금'],
  excludedItems: ['선상팁'],
  hasGuide: '',
  hasCruisedotStaff: '',
  optionItems: [],
};

function buildItinerary(pattern: unknown): string {
  if (!Array.isArray(pattern)) return '';
  const parts = pattern
    .map((p) => {
      if (!p || typeof p !== 'object') return '';
      const item = p as { type?: string; location?: string; country?: string };
      if (item.type === 'sea') return '해상';
      const loc = (item.location || '').trim();
      if (!loc) return '';
      const country = (item.country || '').trim();
      return country ? `${loc}(${country})` : loc;
    })
    .filter(Boolean);
  return parts.join(' → ');
}

export default function ComparisonQuoteTab() {
  const [form, setForm] = useState<QuoteForm>(EMPTY_FORM);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearchResults, setProductSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { ref, isDownloading, download } = useImageDownload();
  const agent = useCurrentAgent();

  const handleSelectCustomer = (sale: SaleResult) => {
    setSelectedAffiliateId(sale.saleId);
    setForm((prev) => ({
      ...prev,
      customerName: sale.buyerName || sale.refunderName || prev.customerName,
      customerPhone: sale.customerPhone || sale.buyerTel || prev.customerPhone,
      productName: sale.productName || prev.productName,
      ourPrice: sale.saleAmount || prev.ourPrice,
    }));
    showSuccess('고객 정보를 불러왔습니다.');
  };

  const handleNewBlank = () => {
    setForm(EMPTY_FORM);
    setSelectedAffiliateId(null);
    showSuccess('새 견적서를 작성합니다.');
  };

  const setField = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setProductSearchResults([]);
      return;
    }
    try {
      setIsSearchingProducts(true);
      const res = await fetch(
        `/api/products?q=${encodeURIComponent(query)}&isActive=true&limit=20`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (res.ok && Array.isArray(json.products)) {
        // /api/products 응답 필드(code/name/price)를 드롭다운 타입(productCode/productName/basePrice)으로 매핑
        setProductSearchResults(
          json.products.map((p: { id: number | string; code: string; name: string; price: number }) => ({
            id: String(p.id),
            productCode: p.code,
            productName: p.name,
            basePrice: p.price,
          }))
        );
      } else {
        setProductSearchResults([]);
      }
    } catch (error) {
      setProductSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const handleSelectProductFromDropdown = async (product: ProductSearchResult) => {
    setProductSearch('');
    setProductDropdownOpen(false);
    setProductSearchResults([]);
    setForm((prev) => ({
      ...prev,
      productCode: product.productCode,
      productName: product.productName,
      ourPrice: product.basePrice,
    }));
    // 자동으로 productInfo 로드
    await loadProductInfo(product.productCode);
  };

  const loadProductInfo = async (code: string) => {
    if (!code) { showError('상품 코드를 입력해주세요.'); return; }
    try {
      setIsLoadingProduct(true);
      const res = await fetch(
        `/api/admin/affiliate/documents/product-info?productCode=${encodeURIComponent(code)}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (!res.ok || !json.ok || !json.product) throw new Error(json.error || '상품을 찾을 수 없습니다.');
      const startRaw = json.product.startDate;
      let departureDate = '';
      if (startRaw) {
        const d = new Date(startRaw);
        if (!isNaN(d.getTime())) departureDate = d.toISOString().slice(0, 10);
      }
      const itinerary = buildItinerary(json.product.itineraryPattern);
      setForm((prev) => ({
        ...prev,
        productName: json.product.productName || prev.productName,
        productCode: json.product.productCode || prev.productCode,
        ourPrice: json.product.basePrice || prev.ourPrice,
        departureDate: departureDate || prev.departureDate,
        itinerary: itinerary || prev.itinerary,
        // 상품 설정에서 자동 도출된 포함/불포함/인솔자
        includedItems: Array.isArray(json.product.includedItems) && json.product.includedItems.length > 0
          ? json.product.includedItems as string[]
          : prev.includedItems,
        excludedItems: Array.isArray(json.product.excludedItems) && json.product.excludedItems.length > 0
          ? json.product.excludedItems as string[]
          : prev.excludedItems,
        hasGuide: (json.product.hasGuide as '' | 'Y' | 'N') || prev.hasGuide,
      }));
      showSuccess('상품 정보를 불러왔습니다. 포함/불포함 항목이 자동 반영되었습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '상품 정보 조회 실패');
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleLoadProductInfo = async () => {
    const code = form.productCode.trim();
    await loadProductInfo(code);
  };

  const addCompetitor = () => {
    setForm((prev) => ({ ...prev, competitorPrices: [...prev.competitorPrices, { price: 0, notes: '' }] }));
  };
  const removeCompetitor = (index: number) => {
    setForm((prev) => ({ ...prev, competitorPrices: prev.competitorPrices.filter((_, i) => i !== index) }));
  };
  const updateCompetitor = (index: number, field: keyof CompetitorPrice, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.map((cp, i) => i === index ? { ...cp, [field]: value } : cp),
    }));
  };

  const toggleItem = (key: 'includedItems' | 'excludedItems', item: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: checked ? [...prev[key], item] : prev[key].filter((i) => i !== item),
    }));
  };

  const addOption = () => setField('optionItems', [...form.optionItems, '']);
  const updateOption = (i: number, val: string) => {
    const next = [...form.optionItems]; next[i] = val; setField('optionItems', next);
  };
  const removeOption = (i: number) => setField('optionItems', form.optionItems.filter((_, j) => j !== i));

  const savings = useMemo(() => {
    const valid = form.competitorPrices.filter((cp) => cp.price > 0);
    if (form.ourPrice <= 0 || valid.length === 0) return 0;
    return Math.min(...valid.map((cp) => cp.price)) - form.ourPrice;
  }, [form.ourPrice, form.competitorPrices]);

  const handleDownload = async () => {
    if (!form.customerName.trim() || form.ourPrice <= 0) {
      showError('고객명과 당사 가격을 입력해주세요.'); return;
    }
    const ok = await download(`비교견적서_${form.customerName.trim() || '고객'}`);
    if (ok) {
      showSuccess('비교견적서 이미지가 다운로드되었습니다.');
      void fetch('/api/documents/comparison-quote', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(selectedAffiliateId ? { affiliateSaleId: selectedAffiliateId } : {}),
          productName: form.productName || form.customerName,
          cruiseLine: form.cabinType || undefined,
          price: form.ourPrice,
          competitorPrices: form.competitorPrices.filter((cp) => cp.price > 0).map((cp, i) => ({
            label: String.fromCharCode(65 + i) + '사',
            price: cp.price
          })),
          departureDate: form.departureDate || undefined,
        }),
      }).catch(() => {});
    } else {
      showError('이미지 다운로드 중 오류가 발생했습니다.');
    }
  };

  const validCompetitors = form.competitorPrices.filter((cp) => cp.price > 0);

  // 타사와 크루즈닷 포함 항목 합집합
  const allIncludedItems = useMemo(() => Array.from(
    new Set([...form.competitorIncludedItems, ...form.includedItems])
  ), [form.competitorIncludedItems, form.includedItems]);

  // 타사와 크루즈닷 불포함 항목 합집합
  const allExcludedItems = useMemo(() => Array.from(
    new Set([...form.competitorExcludedItems, ...form.excludedItems])
  ), [form.competitorExcludedItems, form.excludedItems]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_40%)_minmax(0,_60%)]">
      {/* ═══ 좌측: 입력 폼 (모바일: 100% 너비, 데스크톱: 40%) ═══════════════ */}
      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm min-w-0">
        {/* 고객 자동완성 + 직접 입력 */}
        <div className="space-y-2">
          <CustomerAutocomplete
            label="고객 검색 (자동 채움)"
            placeholder="이름·주문번호·전화번호로 검색"
            accent="indigo"
            onSelect={handleSelectCustomer}
          />
          <button
            type="button"
            onClick={handleNewBlank}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 h-10 min-h-10 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            직접 입력으로 새로 작성
          </button>
        </div>

        {/* 필수 정보: 고객명 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">고객명 <span className="text-red-500">*</span></label>
          <input type="text" value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} placeholder="고객 이름"
            className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>

        {/* 고급옵션: 연락처, 이메일 */}
        {showAdvanced && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
              <input type="tel" value={form.customerPhone} onChange={(e) => setField('customerPhone', e.target.value)} placeholder="010-0000-0000"
                className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
              <input type="email" value={form.customerEmail} onChange={(e) => setField('customerEmail', e.target.value)} placeholder="customer@example.com"
                className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
        )}

        {/* 상품 정보 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">상품 정보</p>

          {/* 상품 검색 드롭다운 */}
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setProductSearch(val);
                  searchProducts(val);
                  setProductDropdownOpen(val.length > 0);
                }}
                onFocus={() => productSearch && setProductDropdownOpen(true)}
                placeholder="상품명이나 코드로 검색..."
                className="flex-1 h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setProductSearch('');
                    setProductDropdownOpen(false);
                    setProductSearchResults([]);
                  }}
                  className="rounded-lg px-2 h-11 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label="검색 초기화"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* 드롭다운 메뉴 */}
            {productDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                {isSearchingProducts ? (
                  <div className="flex items-center justify-center px-3 py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    <span className="ml-2 text-sm text-gray-600">검색 중...</span>
                  </div>
                ) : productSearchResults.length > 0 ? (
                  productSearchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelectProductFromDropdown(product)}
                      className="w-full border-b border-gray-100 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{product.productName}</p>
                          <p className="text-xs text-gray-500">{product.productCode}</p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap ml-2">
                          {formatMoney(product.basePrice)}
                        </span>
                      </div>
                    </button>
                  ))
                ) : productSearch.length > 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    검색 결과가 없습니다.
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* 상품 코드 & 조회 버튼 (직접 입력용) */}
          <div className="flex gap-2">
            <input type="text" value={form.productCode} onChange={(e) => setField('productCode', e.target.value)} placeholder="상품 코드 (직접 입력)"
              className="flex-1 h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="button" onClick={handleLoadProductInfo} disabled={isLoadingProduct}
              className="inline-flex items-center gap-1.5 h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 min-h-11">
              {isLoadingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              조회
            </button>
          </div>
          <input type="text" value={form.productName} onChange={(e) => setField('productName', e.target.value)} placeholder="상품명"
            className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">당사 가격 <span className="text-red-500">*</span></label>
              <input type="number" value={form.ourPrice || ''} onChange={(e) => setField('ourPrice', Number(e.target.value))}
                className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">인원 수</label>
              <input type="number" value={form.headcount} onChange={(e) => setField('headcount', e.target.value)} placeholder="2"
                className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">객실 유형</label>
              <input type="text" value={form.cabinType} onChange={(e) => setField('cabinType', e.target.value)} placeholder="발코니"
                className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">출발일</label>
              <input type="date" value={form.departureDate} onChange={(e) => setField('departureDate', e.target.value)}
                className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">일정표 (기항지)</label>
              <input type="text" value={form.itinerary} onChange={(e) => setField('itinerary', e.target.value)} placeholder="인천 → 오사카 → 인천"
                className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
        </div>

        {/* 타사 비교 정보 (익명화: 업체명 제거, 자동 라벨 표시) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">타사 비교 정보</p>
            <button type="button" onClick={addCompetitor}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 h-9 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" />추가
            </button>
          </div>
          {form.competitorPrices.length > 0 ? (
            form.competitorPrices.map((cp, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex min-w-max items-center gap-2">
                  <span className="rounded-full bg-gray-300 h-8 w-8 flex items-center justify-center text-xs font-bold text-white">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">{String.fromCharCode(65 + i)}사</span>
                </div>
                <input type="number" value={cp.price || ''} onChange={(e) => updateCompetitor(i, 'price', Number(e.target.value))} placeholder="가격"
                  className="h-10 sm:w-28 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <input type="text" value={cp.notes} onChange={(e) => updateCompetitor(i, 'notes', e.target.value)} placeholder="비고 (선택)"
                  className="flex-1 h-10 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                {form.competitorPrices.length > 1 && (
                  <button type="button" onClick={() => removeCompetitor(i)} className="rounded-lg p-2 h-10 w-10 text-red-400 hover:bg-red-50 flex items-center justify-center" aria-label="항목 삭제">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 italic">타사 정보가 없습니다. 추가 버튼으로 항목을 입력하세요.</p>
          )}
        </div>

        {/* 타사 포함 항목 (태그 입력) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">타사 포함 항목</label>
          <input type="text" placeholder="예: 선박 운임, 숙박, 식사 (Enter로 추가)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                setForm((prev) => ({
                  ...prev,
                  competitorIncludedItems: [...prev.competitorIncludedItems, e.currentTarget.value.trim()]
                }));
                e.currentTarget.value = '';
                e.preventDefault();
              }
            }}
            className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <div className="flex flex-wrap gap-2">
            {form.competitorIncludedItems.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {item}
                <button type="button" onClick={() => setForm((prev) => ({
                  ...prev,
                  competitorIncludedItems: prev.competitorIncludedItems.filter((_, i) => i !== idx)
                }))} className="ml-0.5 hover:text-emerald-900">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* 타사 불포함 항목 (태그 입력) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">타사 불포함 항목</label>
          <input type="text" placeholder="예: 선상팁, 쇼핑비, 선택관광 (Enter로 추가)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                setForm((prev) => ({
                  ...prev,
                  competitorExcludedItems: [...prev.competitorExcludedItems, e.currentTarget.value.trim()]
                }));
                e.currentTarget.value = '';
                e.preventDefault();
              }
            }}
            className="w-full h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <div className="flex flex-wrap gap-2">
            {form.competitorExcludedItems.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                {item}
                <button type="button" onClick={() => setForm((prev) => ({
                  ...prev,
                  competitorExcludedItems: prev.competitorExcludedItems.filter((_, i) => i !== idx)
                }))} className="ml-0.5 hover:text-red-900">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* 타사 서비스 특이사항 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">타사 서비스 특이사항</label>
          <textarea value={form.competitorServiceNotes} onChange={(e) => setField('competitorServiceNotes', e.target.value)} placeholder="타사의 추가 서비스나 특이사항을 자유롭게 기입해주세요."
            rows={3}
            className="w-full min-h-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>

        {/* 서비스 비교 (인솔자 / 크루즈닷스탭) */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">서비스 비교</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-500">여행 인솔자</label>
              <div className="flex gap-3 sm:gap-4">
                {(['', 'Y', 'N'] as const).map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="hasGuide" value={v} checked={form.hasGuide === v}
                      onChange={() => setField('hasGuide', v)}
                      className="accent-indigo-600 w-4 h-4" />
                    {v === '' ? '미정' : v === 'Y' ? '있음' : '없음'}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-500">크루즈닷 전담스탭</label>
              <div className="flex gap-3 sm:gap-4">
                {(['', 'Y', 'N'] as const).map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="hasCruisedotStaff" value={v} checked={form.hasCruisedotStaff === v}
                      onChange={() => setField('hasCruisedotStaff', v)}
                      className="accent-indigo-600 w-4 h-4" />
                    {v === '' ? '미정' : v === 'Y' ? '있음' : '없음'}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 포함 내역 */}
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <CheckSquare className="h-4 w-4 text-emerald-500" />
            포함 내역
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STANDARD_INCLUDES.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 text-xs min-h-8">
                <input type="checkbox" checked={form.includedItems.includes(item)}
                  onChange={(e) => toggleItem('includedItems', item, e.target.checked)}
                  className="rounded border-gray-300 accent-emerald-600 w-4 h-4" />
                {item}
              </label>
            ))}
          </div>
        </div>

        {/* 불포함 내역 */}
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <MinusSquare className="h-4 w-4 text-red-400" />
            불포함 내역
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STANDARD_EXCLUDES.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 text-xs min-h-8">
                <input type="checkbox" checked={form.excludedItems.includes(item)}
                  onChange={(e) => toggleItem('excludedItems', item, e.target.checked)}
                  className="rounded border-gray-300 accent-red-500 w-4 h-4" />
                {item}
              </label>
            ))}
          </div>
        </div>

        {/* 옵션 비교 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Layers className="h-4 w-4 text-indigo-400" />
              옵션 비교
            </p>
            <button type="button" onClick={addOption}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 h-9 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" />추가
            </button>
          </div>
          {form.optionItems.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder="예: 온보드 음료 패키지"
                className="flex-1 h-10 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <button type="button" onClick={() => removeOption(i)} className="rounded-lg p-2 h-10 w-10 text-red-400 hover:bg-red-50 flex items-center justify-center" aria-label="항목 삭제">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {form.optionItems.length === 0 && (
            <p className="text-xs text-gray-400">추가 버튼으로 옵션 항목을 입력하세요.</p>
          )}
        </div>

        {/* PNG 다운로드 버튼 */}
        <button type="button" onClick={handleDownload} disabled={isDownloading}
          className="inline-flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isDownloading ? '다운로드 중...' : 'PNG 견적서 다운로드'}
        </button>
      </div>

      {/* ═══ 우측: 미리보기 (모바일: 100% 너비, 데스크톱: 60%) ════════════════ */}
      <div className="space-y-2 min-w-0">
        <p className="text-sm sm:text-base font-bold text-gray-800 px-0">📄 미리보기 (다운로드 이미지)</p>
        <div
          ref={ref}
          className="space-y-4 sm:space-y-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-10 text-xs sm:text-sm shadow-lg overflow-auto mx-auto"
          style={{ maxWidth: '210mm', aspectRatio: '210 / 297' }}
        >
          {/* 레터헤드 */}
          <DocumentLetterhead title="타사 비교 견적서" accentClass="border-indigo-100" />

          {/* 고객 정보 */}
          <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-5 border border-gray-150">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">고객 정보</p>
            <div className="space-y-1 text-gray-700">
              <p><span className="font-bold text-gray-800">{form.customerName || '(고객명 미입력)'}</span></p>
              {form.customerPhone && <p className="text-sm text-gray-600"><span className="text-gray-500">T.</span> {form.customerPhone}</p>}
              {form.customerEmail && <p className="text-sm text-gray-600"><span className="text-gray-500">E.</span> {form.customerEmail}</p>}
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 p-5 border border-indigo-100">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-600">
              <Package className="h-4 w-4" />상품 정보
            </p>
            <div className="space-y-1.5 text-gray-700">
              <p className="font-bold text-gray-900 text-sm">{form.productName || '(상품명 미입력)'}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {form.cabinType && <p><span className="text-gray-500">객실:</span> <span className="font-medium">{form.cabinType}</span></p>}
                {form.headcount && <p><span className="text-gray-500">인원:</span> <span className="font-medium">{form.headcount}명</span></p>}
                {form.departureDate && <p className="col-span-2"><span className="text-gray-500">출발:</span> <span className="font-medium">{formatDate(form.departureDate)}</span></p>}
                {form.itinerary && <p className="col-span-2"><span className="text-gray-500">일정:</span> <span className="font-medium">{form.itinerary}</span></p>}
              </div>
            </div>
          </div>

          {/* VS 가격 비교 */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">💰 가격 비교</p>
            {validCompetitors.length > 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-4">
                {/* 타사 패널 */}
                <div className="flex-1 rounded-2xl border border-gray-300 bg-gray-50 p-4 sm:p-5">
                  <p className="mb-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wide">타사 (익명)</p>
                  {validCompetitors.map((cp, i) => (
                    <div key={i} className={i > 0 ? 'mt-3 border-t border-gray-200 pt-3' : ''}>
                      <p className="text-xs text-gray-600 font-bold">{String.fromCharCode(65 + i)}사</p>
                      <p className="text-xl sm:text-2xl font-extrabold text-gray-700 mt-1">{cp.price ? formatMoney(cp.price) : '-'}</p>
                      {cp.notes && <p className="text-xs text-gray-500 mt-1">{cp.notes}</p>}
                    </div>
                  ))}
                </div>

                {/* VS 배지 */}
                <div className="hidden sm:flex flex-col items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-400 bg-white text-xs font-extrabold text-indigo-600">
                    VS
                  </span>
                </div>

                {/* 크루즈닷 패널 */}
                <div className="flex-1 rounded-2xl border-3 border-red-400 bg-gradient-to-br from-red-50 via-red-50 to-orange-50 p-4 sm:p-5 shadow-md">
                  <p className="mb-2 text-center text-xs font-bold text-red-700 uppercase tracking-wide">✨ 크루즈닷 (당사)</p>
                  <p className="text-center text-2xl sm:text-3xl font-extrabold text-red-600 mt-2">{formatMoney(form.ourPrice)}</p>
                  {savings > 0 && (
                    <div className="mt-3 sm:mt-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 px-4 py-2 sm:py-3 text-center shadow-md">
                      <p className="text-xs sm:text-sm font-bold text-white">🎉 {formatMoney(savings)}</p>
                      <p className="text-xs text-red-100 font-semibold">더 저렴!</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 sm:p-5 text-center text-sm text-gray-600 font-medium">
                타사 가격 정보를 입력하세요.
              </div>
            )}
          </div>

          {/* 서비스 비교표 */}
          {(form.hasGuide || form.hasCruisedotStaff || form.competitorServiceNotes) && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">🎯 서비스 비교</p>
              <div className="overflow-hidden rounded-xl border border-gray-300">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 px-4 py-3 text-left font-bold text-gray-700">항목</th>
                      <th className="border border-gray-300 bg-gray-100 px-4 py-3 text-center font-bold text-gray-700">타사 (익명)</th>
                      <th className="border border-red-200 bg-red-100 px-4 py-3 text-center font-bold text-red-700">크루즈닷</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.hasGuide && (
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2.5 font-medium text-gray-800">여행 인솔자</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-center text-gray-400">-</td>
                        <td className="border border-red-200 bg-red-50 px-4 py-2.5 text-center font-bold text-green-600">
                          {form.hasGuide === 'Y' ? '✓ 있음' : '없음'}
                        </td>
                      </tr>
                    )}
                    {form.hasCruisedotStaff && (
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2.5 font-medium text-gray-800">크루즈닷 전담스탭</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-center text-gray-400">-</td>
                        <td className="border border-red-200 bg-red-50 px-4 py-2.5 text-center font-bold text-green-600">
                          {form.hasCruisedotStaff === 'Y' ? '✓ 있음' : '없음'}
                        </td>
                      </tr>
                    )}
                    {form.competitorServiceNotes && (
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2.5 font-medium text-gray-800">특이사항</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-gray-700">{form.competitorServiceNotes}</td>
                        <td className="border border-red-200 bg-red-50 px-4 py-2.5 text-center text-gray-400">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 포함/불포함 내역 - 3열 비교표 */}
          {(allIncludedItems.length > 0 || allExcludedItems.length > 0) && (
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
                <CheckSquare className="h-4 w-4" />포함/불포함 항목 비교
              </p>
              <div className="overflow-hidden rounded-xl border border-gray-300">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 px-4 py-3 text-left font-bold text-gray-700">항목</th>
                      <th className="border border-gray-300 bg-gray-100 px-4 py-3 text-center font-bold text-gray-700">타사 (익명)</th>
                      <th className="border border-red-200 bg-red-100 px-4 py-3 text-center font-bold text-red-700">크루즈닷</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 포함 항목 */}
                    {allIncludedItems.length > 0 && (
                      <>
                        {allIncludedItems.map((item) => (
                          <tr key={item} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2.5 text-gray-800 font-medium">{item}</td>
                            <td className="border border-gray-300 px-4 py-2.5 text-center">
                              {form.competitorIncludedItems.includes(item) ? (
                                <span className="text-green-600 font-extrabold text-sm">✓</span>
                              ) : (
                                <span className="text-gray-300 font-bold">○</span>
                              )}
                            </td>
                            <td className="border border-red-200 bg-red-50 px-4 py-2.5 text-center">
                              {form.includedItems.includes(item) ? (
                                <span className="text-green-600 font-extrabold text-sm">✓</span>
                              ) : (
                                <span className="text-gray-300 font-bold">○</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                    {/* 불포함 항목 */}
                    {allExcludedItems.length > 0 && (
                      <>
                        {allExcludedItems.map((item) => (
                          <tr key={item} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2.5 text-gray-800 font-medium">{item}</td>
                            <td className="border border-gray-300 px-4 py-2.5 text-center">
                              {form.competitorExcludedItems.includes(item) ? (
                                <span className="text-red-500 font-extrabold text-sm">✗</span>
                              ) : (
                                <span className="text-gray-300 font-bold">-</span>
                              )}
                            </td>
                            <td className="border border-red-200 bg-red-50 px-4 py-2.5 text-center">
                              {form.excludedItems.includes(item) ? (
                                <span className="text-red-500 font-extrabold text-sm">✗</span>
                              ) : (
                                <span className="text-gray-300 font-bold">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 옵션 비교 */}
          {form.optionItems.filter((o) => o.trim()).length > 0 && (
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
                <Layers className="h-4 w-4" />선택 가능 옵션
              </p>
              <ul className="space-y-1.5 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
                {form.optionItems.filter((o) => o.trim()).map((opt, i) => (
                  <li key={i} className="text-sm text-indigo-900 font-medium flex items-start gap-2">
                    <span className="text-indigo-600 font-bold mt-0.5">◆</span>
                    <span>{opt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 직인 + 담당자 + 유효기간 */}
          <DocumentSeal agent={agent} validDays={3} />
        </div>
      </div>
    </div>
  );
}
