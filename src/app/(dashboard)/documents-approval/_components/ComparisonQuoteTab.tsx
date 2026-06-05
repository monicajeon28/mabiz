'use client';

// ─────────────────────────────────────────────────────────────────────────────
// 서류관리 > 비교견적서 탭 컴포넌트
// 수동 + 자동 이중 모드: 고객 자동완성으로 폼 자동 채움 또는 직접 입력
// 참고: docs/마케팅참고자료/_document-management-ui-ux/admin/pages/affiliate-documents.page.tsx
//       (ComparisonQuoteImage 견적서 레이아웃 / 고객검색 자동완성 / html2canvas 다운로드)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import {
  Search,
  Loader2,
  Plus,
  Trash2,
  Download,
  FilePlus2,
  Package,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import {
  CustomerAutocomplete,
  useImageDownload,
  formatMoney,
  todayKo,
  type SaleResult,
} from './shared';

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
  headcount: string; // 입력 편의를 위해 문자열 보관
  cabinType: string;
  competitorPrices: CompetitorPrice[];
};

// ─── 빈 폼 (직접 입력 새로 작성용) ───────────────────────────────────────────
const EMPTY_FORM: QuoteForm = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  productCode: '',
  productName: '',
  ourPrice: 0,
  headcount: '',
  cabinType: '',
  competitorPrices: [{ companyName: '', price: 0, notes: '' }],
};

export default function ComparisonQuoteTab() {
  // 폼 상태
  const [form, setForm] = useState<QuoteForm>(EMPTY_FORM);
  // 상품 조회 로딩
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  // 미리보기 PNG 다운로드 훅
  const { ref, isDownloading, download } = useImageDownload();

  // ─── 고객 자동완성 선택 → 폼 자동 채움 ──────────────────────────────────
  const handleSelectCustomer = (sale: SaleResult) => {
    setForm((prev) => ({
      ...prev,
      customerName: sale.buyerName || sale.refunderName || prev.customerName,
      customerPhone: sale.customerPhone || sale.buyerTel || prev.customerPhone,
      productName: sale.productName || prev.productName,
      ourPrice: sale.saleAmount || prev.ourPrice,
    }));
    showSuccess('고객 정보를 불러왔습니다.');
  };

  // ─── 직접 입력으로 새로 작성 (빈 폼 초기화) ─────────────────────────────
  const handleNewBlank = () => {
    setForm(EMPTY_FORM);
    showSuccess('새 견적서를 작성합니다.');
  };

  // ─── 단일 필드 업데이트 헬퍼 ────────────────────────────────────────────
  const setField = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ─── 상품코드 조회 (상품명/기준가격 자동 채움) ──────────────────────────
  const handleLoadProductInfo = async () => {
    const code = form.productCode.trim();
    if (!code) {
      showError('상품 코드를 입력해주세요.');
      return;
    }
    try {
      setIsLoadingProduct(true);
      const res = await fetch(
        `/api/admin/affiliate/documents/product-info?productCode=${encodeURIComponent(code)}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (!res.ok || !json.ok || !json.product) {
        throw new Error(json.error || '상품을 찾을 수 없습니다.');
      }
      setForm((prev) => ({
        ...prev,
        productName: json.product.productName || prev.productName,
        productCode: json.product.productCode || prev.productCode,
        ourPrice: json.product.basePrice || prev.ourPrice,
      }));
      showSuccess('상품 정보를 불러왔습니다.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '상품 정보 조회 실패';
      showError(msg);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  // ─── 경쟁사 가격 행 추가/삭제/수정 ──────────────────────────────────────
  const addCompetitor = () => {
    setForm((prev) => ({
      ...prev,
      competitorPrices: [...prev.competitorPrices, { companyName: '', price: 0, notes: '' }],
    }));
  };

  const removeCompetitor = (index: number) => {
    setForm((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.filter((_, i) => i !== index),
    }));
  };

  const updateCompetitor = (
    index: number,
    field: keyof CompetitorPrice,
    value: string | number
  ) => {
    setForm((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.map((cp, i) =>
        i === index ? { ...cp, [field]: value } : cp
      ),
    }));
  };

  // ─── 최저 경쟁사 대비 절감액 계산 (미리보기 강조 문구용) ────────────────
  const savings = useMemo(() => {
    const valid = form.competitorPrices.filter((cp) => cp.price > 0);
    if (form.ourPrice <= 0 || valid.length === 0) return 0;
    const minComp = Math.min(...valid.map((cp) => cp.price));
    return minComp - form.ourPrice;
  }, [form.ourPrice, form.competitorPrices]);

  // ─── PNG 다운로드 ────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!form.customerName.trim() || form.ourPrice <= 0) {
      showError('고객명과 당사 가격을 입력해주세요.');
      return;
    }
    const ok = await download(`비교견적서_${form.customerName.trim() || '고객'}`);
    if (ok) showSuccess('비교견적서 이미지가 다운로드되었습니다.');
    else showError('이미지 다운로드 중 오류가 발생했습니다.');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ═══ 좌측: 입력 폼 ═══════════════════════════════════════════════ */}
      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {/* 고객 자동완성 + 직접 입력 버튼 */}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              고객명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setField('customerName', e.target.value)}
              placeholder="고객 이름"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
            <input
              type="text"
              value={form.customerPhone}
              onChange={(e) => setField('customerPhone', e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
            <input
              type="email"
              value={form.customerEmail}
              onChange={(e) => setField('customerEmail', e.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* 상품 정보 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">상품 정보</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.productCode}
              onChange={(e) => setField('productCode', e.target.value)}
              placeholder="상품 코드"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={handleLoadProductInfo}
              disabled={isLoadingProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoadingProduct ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              조회
            </button>
          </div>
          <input
            type="text"
            value={form.productName}
            onChange={(e) => setField('productName', e.target.value)}
            placeholder="상품명"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                당사 가격 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.ourPrice || ''}
                onChange={(e) => setField('ourPrice', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">인원 수</label>
              <input
                type="number"
                value={form.headcount}
                onChange={(e) => setField('headcount', e.target.value)}
                placeholder="예: 2"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">객실 유형</label>
              <input
                type="text"
                value={form.cabinType}
                onChange={(e) => setField('cabinType', e.target.value)}
                placeholder="예: 발코니"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
        </div>

        {/* 경쟁사 가격 (동적 행) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">경쟁사 가격</p>
            <button
              type="button"
              onClick={addCompetitor}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              <Plus className="h-3.5 w-3.5" />
              추가
            </button>
          </div>
          {form.competitorPrices.map((cp, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                type="text"
                value={cp.companyName}
                onChange={(e) => updateCompetitor(i, 'companyName', e.target.value)}
                placeholder="업체명"
                className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="number"
                value={cp.price || ''}
                onChange={(e) => updateCompetitor(i, 'price', Number(e.target.value))}
                placeholder="가격"
                className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="text"
                value={cp.notes}
                onChange={(e) => updateCompetitor(i, 'notes', e.target.value)}
                placeholder="비고"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {form.competitorPrices.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCompetitor(i)}
                  className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* PNG 다운로드 버튼 */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isDownloading ? '다운로드 중...' : 'PNG 견적서 다운로드'}
        </button>
      </div>

      {/* ═══ 우측: 미리보기 (다운로드 대상) ═════════════════════════════ */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">미리보기 (다운로드 이미지)</p>
        <div
          ref={ref}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-8 text-sm shadow-sm"
        >
          {/* 제목 */}
          <div className="border-b-2 border-indigo-100 pb-4 text-center">
            <h3 className="text-2xl font-extrabold tracking-tight text-gray-900">
              타사 비교 견적서
            </h3>
            <p className="mt-1 text-xs text-gray-400">발행일: {todayKo()}</p>
          </div>

          {/* 고객 정보 */}
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
              고객 정보
            </p>
            <div className="space-y-1 text-gray-700">
              <p>
                <span className="font-semibold">고객명:</span>{' '}
                {form.customerName || '-'}
              </p>
              {form.customerPhone && (
                <p>
                  <span className="font-semibold">연락처:</span> {form.customerPhone}
                </p>
              )}
              {form.customerEmail && (
                <p>
                  <span className="font-semibold">이메일:</span> {form.customerEmail}
                </p>
              )}
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
              <Package className="h-3.5 w-3.5" />
              상품 정보
            </p>
            <div className="space-y-1 text-gray-700">
              <p>
                <span className="font-semibold">상품명:</span>{' '}
                {form.productName || '-'}
              </p>
              {form.cabinType && (
                <p>
                  <span className="font-semibold">객실 유형:</span> {form.cabinType}
                </p>
              )}
              {form.headcount && (
                <p>
                  <span className="font-semibold">인원:</span> {form.headcount}명
                </p>
              )}
            </div>
          </div>

          {/* 비교표 */}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-indigo-50 text-indigo-700">
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">
                  업체명
                </th>
                <th className="border border-gray-200 px-3 py-2 text-right font-semibold">
                  가격
                </th>
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">
                  비고
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 당사 (최저가 강조 emerald) */}
              <tr className="bg-emerald-50">
                <td className="border border-gray-200 px-3 py-2 font-semibold text-emerald-700">
                  당사 (최저가)
                </td>
                <td className="border border-gray-200 px-3 py-2 text-right font-bold text-emerald-700">
                  {formatMoney(form.ourPrice)}
                </td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500">-</td>
              </tr>
              {/* 경쟁사들 */}
              {form.competitorPrices
                .filter((cp) => cp.companyName || cp.price)
                .map((cp, i) => (
                  <tr key={i}>
                    <td className="border border-gray-200 px-3 py-2">
                      {cp.companyName || '-'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right">
                      {cp.price ? formatMoney(cp.price) : '-'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-500">
                      {cp.notes || '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* 절감액 강조 문구 */}
          {savings > 0 && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
              <p className="text-base font-bold text-emerald-600">
                최저 경쟁사 대비 {formatMoney(savings)} 저렴합니다!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
