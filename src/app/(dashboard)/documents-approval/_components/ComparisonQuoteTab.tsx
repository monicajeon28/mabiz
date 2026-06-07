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

// ─── 경쟁사 가격 행 타입 ─────────────────────────────────────────────────────
type CompetitorPrice = {
  companyName: string;
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
  includedItems: string[];
  excludedItems: string[];
  hasGuide: '' | 'Y' | 'N';
  hasCruisedotStaff: '' | 'Y' | 'N';
  optionItems: string[];
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
  competitorPrices: [{ companyName: '', price: 0, notes: '' }],
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

  const handleLoadProductInfo = async () => {
    const code = form.productCode.trim();
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

  const addCompetitor = () => {
    setForm((prev) => ({ ...prev, competitorPrices: [...prev.competitorPrices, { companyName: '', price: 0, notes: '' }] }));
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
          competitorPrices: form.competitorPrices.filter((cp) => cp.companyName && cp.price > 0).map((cp) => ({ name: cp.companyName, price: cp.price })),
          departureDate: form.departureDate || undefined,
        }),
      }).catch(() => {});
    } else {
      showError('이미지 다운로드 중 오류가 발생했습니다.');
    }
  };

  const validCompetitors = form.competitorPrices.filter((cp) => cp.companyName || cp.price > 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ═══ 좌측: 입력 폼 ═══════════════════════════════════════════════ */}
      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            직접 입력으로 새로 작성
          </button>
        </div>

        {/* 고객 정보 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">고객명 <span className="text-red-500">*</span></label>
            <input type="text" value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} placeholder="고객 이름"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
            <input type="text" value={form.customerPhone} onChange={(e) => setField('customerPhone', e.target.value)} placeholder="010-0000-0000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
            <input type="email" value={form.customerEmail} onChange={(e) => setField('customerEmail', e.target.value)} placeholder="customer@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>

        {/* 상품 정보 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">상품 정보</p>
          <div className="flex gap-2">
            <input type="text" value={form.productCode} onChange={(e) => setField('productCode', e.target.value)} placeholder="상품 코드"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="button" onClick={handleLoadProductInfo} disabled={isLoadingProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {isLoadingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              조회
            </button>
          </div>
          <input type="text" value={form.productName} onChange={(e) => setField('productName', e.target.value)} placeholder="상품명"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">당사 가격 <span className="text-red-500">*</span></label>
              <input type="number" value={form.ourPrice || ''} onChange={(e) => setField('ourPrice', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">인원 수</label>
              <input type="number" value={form.headcount} onChange={(e) => setField('headcount', e.target.value)} placeholder="2"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">객실 유형</label>
              <input type="text" value={form.cabinType} onChange={(e) => setField('cabinType', e.target.value)} placeholder="발코니"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">출발일</label>
              <input type="date" value={form.departureDate} onChange={(e) => setField('departureDate', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">일정표 (기항지)</label>
              <input type="text" value={form.itinerary} onChange={(e) => setField('itinerary', e.target.value)} placeholder="인천 → 오사카 → 인천"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
        </div>

        {/* 경쟁사 가격 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">경쟁사 가격</p>
            <button type="button" onClick={addCompetitor}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" />추가
            </button>
          </div>
          {form.competitorPrices.map((cp, i) => (
            <div key={i} className="flex items-start gap-2">
              <input type="text" value={cp.companyName} onChange={(e) => updateCompetitor(i, 'companyName', e.target.value)} placeholder="업체명"
                className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <input type="number" value={cp.price || ''} onChange={(e) => updateCompetitor(i, 'price', Number(e.target.value))} placeholder="가격"
                className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <input type="text" value={cp.notes} onChange={(e) => updateCompetitor(i, 'notes', e.target.value)} placeholder="비고"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              {form.competitorPrices.length > 1 && (
                <button type="button" onClick={() => removeCompetitor(i)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 서비스 비교 (인솔자 / 크루즈닷스탭) */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">서비스 비교</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">여행 인솔자</label>
              <div className="flex gap-4">
                {(['', 'Y', 'N'] as const).map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input type="radio" name="hasGuide" value={v} checked={form.hasGuide === v}
                      onChange={() => setField('hasGuide', v)}
                      className="accent-indigo-600" />
                    {v === '' ? '미정' : v === 'Y' ? '있음' : '없음'}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">크루즈닷 전담스탭</label>
              <div className="flex gap-4">
                {(['', 'Y', 'N'] as const).map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input type="radio" name="hasCruisedotStaff" value={v} checked={form.hasCruisedotStaff === v}
                      onChange={() => setField('hasCruisedotStaff', v)}
                      className="accent-indigo-600" />
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
          <div className="grid grid-cols-2 gap-1.5">
            {STANDARD_INCLUDES.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input type="checkbox" checked={form.includedItems.includes(item)}
                  onChange={(e) => toggleItem('includedItems', item, e.target.checked)}
                  className="rounded border-gray-300 accent-emerald-600" />
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
          <div className="grid grid-cols-2 gap-1.5">
            {STANDARD_EXCLUDES.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input type="checkbox" checked={form.excludedItems.includes(item)}
                  onChange={(e) => toggleItem('excludedItems', item, e.target.checked)}
                  className="rounded border-gray-300 accent-red-500" />
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
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" />추가
            </button>
          </div>
          {form.optionItems.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder="예: 온보드 음료 패키지"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <button type="button" onClick={() => removeOption(i)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50">
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isDownloading ? '다운로드 중...' : 'PNG 견적서 다운로드'}
        </button>
      </div>

      {/* ═══ 우측: 미리보기 ═══════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">미리보기 (다운로드 이미지)</p>
        <div
          ref={ref}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-8 text-sm shadow-sm"
        >
          {/* 레터헤드 */}
          <DocumentLetterhead title="타사 비교 견적서" accentClass="border-indigo-100" />

          {/* 고객 정보 */}
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">고객 정보</p>
            <div className="space-y-0.5 text-gray-700">
              <p><span className="font-semibold">고객명:</span> {form.customerName || '-'}</p>
              {form.customerPhone && <p><span className="font-semibold">연락처:</span> {form.customerPhone}</p>}
              {form.customerEmail && <p><span className="font-semibold">이메일:</span> {form.customerEmail}</p>}
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              <Package className="h-3.5 w-3.5" />상품 정보
            </p>
            <div className="space-y-0.5 text-gray-700">
              <p><span className="font-semibold">상품명:</span> {form.productName || '-'}</p>
              {form.cabinType && <p><span className="font-semibold">객실 유형:</span> {form.cabinType}</p>}
              {form.headcount && <p><span className="font-semibold">인원:</span> {form.headcount}명</p>}
              {form.departureDate && <p><span className="font-semibold">출발일:</span> {formatDate(form.departureDate)}</p>}
              {form.itinerary && <p><span className="font-semibold">일정표:</span> {form.itinerary}</p>}
            </div>
          </div>

          {/* VS 가격 비교 */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">가격 비교</p>
            <div className="flex items-stretch gap-3">
              {/* 타사 패널 */}
              <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-center text-[11px] font-bold text-gray-500">타사 비교</p>
                {validCompetitors.length > 0 ? (
                  validCompetitors.map((cp, i) => (
                    <div key={i} className={i > 0 ? 'mt-2 border-t border-gray-200 pt-2' : ''}>
                      <p className="text-xs text-gray-500">{cp.companyName || '경쟁사'}</p>
                      <p className="text-lg font-bold text-gray-600">{cp.price ? formatMoney(cp.price) : '-'}</p>
                      {cp.notes && <p className="text-[11px] text-gray-400">{cp.notes}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-gray-400">경쟁사 정보 없음</p>
                )}
              </div>

              {/* VS 배지 */}
              <div className="flex flex-col items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-xs font-extrabold text-gray-400">
                  VS
                </span>
              </div>

              {/* 크루즈닷 패널 */}
              <div className="flex-1 rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-red-100 p-4">
                <p className="mb-2 text-center text-[11px] font-bold text-red-600">크루즈닷 (당사)</p>
                <p className="text-center text-2xl font-extrabold text-red-600">{formatMoney(form.ourPrice)}</p>
                {savings > 0 && (
                  <div className="mt-2 rounded-lg bg-red-600 px-2 py-1 text-center">
                    <p className="text-[11px] font-bold text-white">🎉 {formatMoney(savings)} 더 저렴!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 서비스 비교표 */}
          {(form.hasGuide || form.hasCruisedotStaff) && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">서비스 비교</p>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600">항목</th>
                    <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-center font-semibold text-gray-500">타사</th>
                    <th className="border border-red-100 bg-red-50 px-3 py-2 text-center font-semibold text-red-700">크루즈닷</th>
                  </tr>
                </thead>
                <tbody>
                  {form.hasGuide && (
                    <tr>
                      <td className="border border-gray-200 px-3 py-2 font-medium text-gray-700">여행 인솔자</td>
                      <td className="border border-gray-200 px-3 py-2 text-center text-gray-400">정보없음</td>
                      <td className="border border-red-100 bg-red-50 px-3 py-2 text-center font-bold text-red-700">
                        {form.hasGuide === 'Y' ? '✓ 있음' : '없음'}
                      </td>
                    </tr>
                  )}
                  {form.hasCruisedotStaff && (
                    <tr>
                      <td className="border border-gray-200 px-3 py-2 font-medium text-gray-700">크루즈닷 전담스탭</td>
                      <td className="border border-gray-200 px-3 py-2 text-center text-gray-400">없음</td>
                      <td className="border border-red-100 bg-red-50 px-3 py-2 text-center font-bold text-red-700">
                        {form.hasCruisedotStaff === 'Y' ? '✓ 있음' : '없음'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 포함/불포함 내역 */}
          {(form.includedItems.length > 0 || form.excludedItems.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {form.includedItems.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckSquare className="h-3 w-3" />포함 내역
                  </p>
                  <ul className="space-y-0.5">
                    {form.includedItems.map((item) => (
                      <li key={item} className="text-[11px] text-emerald-700">✓ {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {form.excludedItems.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-red-600">
                    <MinusSquare className="h-3 w-3" />불포함 내역
                  </p>
                  <ul className="space-y-0.5">
                    {form.excludedItems.map((item) => (
                      <li key={item} className="text-[11px] text-red-600">✗ {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 옵션 비교 */}
          {form.optionItems.filter((o) => o.trim()).length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                <Layers className="h-3 w-3" />선택 가능 옵션
              </p>
              <ul className="space-y-1 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                {form.optionItems.filter((o) => o.trim()).map((opt, i) => (
                  <li key={i} className="text-xs text-indigo-700">◆ {opt}</li>
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
