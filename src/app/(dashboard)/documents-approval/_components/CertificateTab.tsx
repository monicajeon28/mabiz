'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileCheck2,
  FileX2,
  Download,
  Loader2,
  RotateCcw,
  User,
  Phone,
  Package,
  CreditCard,
  Calendar,
  Building2,
  AlertTriangle,
  ShieldCheck,
  Search,
  PenLine,
  X,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { CANCELLATION_POLICY } from '@/lib/company-info';
import { calcRefundAmount, refundPolicyToLines, LEGAL_REFUND_POLICY, type RefundPolicyJson } from '@/lib/refund-calculator';
import {
  SaleResult,
  CurrentAgent,
  formatMoney,
  formatDate,
  CustomerAutocomplete,
  useImageDownload,
  useCurrentAgent,
  DocumentLetterhead,
  DocumentSeal,
} from './shared';

type PurchaseData = {
  buyerName?: string | null;
  buyerTel?: string | null;
  buyerEmail?: string | null;
  amount?: number | null;
  productName?: string | null;
  paidAt?: string | null;
  paymentMethod?: string | null;
  issuedAt?: string | null;
  // 발급 시점 환불정책 스냅샷 (서버 generatedData) — 재조회/새로고침에도 보존
  refundPolicy?: RefundPolicyJson | null;
  refundPolicyLines?: { label: string; value: string }[];
  // 직접입력 모드에서 사용자가 작성한 환불규정 자유서식
  refundPolicyText?: string | null;
};

type RefundData = {
  buyerName?: string | null;
  buyerTel?: string | null;
  amount?: number | null;
  productName?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  isRefundPending?: boolean;
  departureDate?: string | null;
  refundAmount?: number | null;
  penaltyRate?: number | null;
  penaltyAmount?: number | null;
  daysBeforeDep?: number | null;
  refundBasis?: string | null;
  paymentMethod?: string | null;
  companyAccount?: string | null;
  note?: string | null;
  // 직접입력 환불규정 자유서식 — 환불완료증서 본문에 렌더
  refundPolicyText?: string | null;
  // 발급 시점 환불정책 스냅샷 (서버 generatedData) — 재조회/새로고침/PNG 재생성에도 보존
  // 상품 환불규정이 나중에 비워져도 발급본의 규정이 사라지지 않게 함 (법무 요건)
  refundPolicy?: RefundPolicyJson | null;
  refundPolicyLines?: { label: string; value: string }[];
};

type ProductInfo = {
  productCode: string;
  productName: string;
  cruiseLine: string;
  shipName: string;
  packageName: string;
  nights: number;
  days: number;
  basePrice: number;
  itineraryPattern: unknown;
  includedItems: string[];
  excludedItems: string[];
  hasGuide: 'Y' | 'N';
  isJapan?: boolean;
  isDomestic?: boolean;
  tourType?: string;
  airlineName?: string | null;
  startDate?: string | null;
  refundPolicy?: RefundPolicyJson | null;
};

type CertMode = 'purchase' | 'refund';

// 상품 검색 결과 타입
type ProductSearchResult = {
  id: string;
  productCode: string;
  productName: string;
  basePrice: number;
};

// 직접 입력 상태 타입
type DirectInput = {
  buyerName: string;
  buyerTel: string;
  productName: string;
  productCode: string; // 드롭다운 선택 시 저장 → product-info 호출로 환불규정 자동
  amount: string;
  paidAt: string;
  refundPolicyText: string; // 환불규정 텍스트
  // 환불인증서 전용
  cancelDate: string;
  departureDate: string;
};

const DIRECT_INPUT_INITIAL: DirectInput = {
  buyerName: '',
  buyerTel: '',
  productName: '',
  productCode: '',
  amount: '',
  paidAt: '',
  refundPolicyText: '',
  cancelDate: '',
  departureDate: '',
};

const CONFIG = {
  purchase: {
    title: '구매확인증서',
    apiUrl: '/api/documents/purchase-cert',
    accent: 'emerald' as const,
    issueBtn: 'bg-emerald-600 hover:bg-emerald-700',
    Icon: FileCheck2,
    accentClass: 'border-emerald-100',
    placeholderText: '구매확인증서를 발급할 고객을 먼저 검색·선택하세요.',
  },
  refund: {
    title: '환불완료증서',
    apiUrl: '/api/documents/refund-cert',
    accent: 'red' as const,
    issueBtn: 'bg-red-600 hover:bg-red-700',
    Icon: FileX2,
    accentClass: 'border-red-100',
    placeholderText: '환불증서를 발급할 고객을 먼저 검색·선택하세요.',
  },
};

export default function CertificateTab({ mode }: { mode: CertMode }) {
  const cfg = CONFIG[mode];
  const { ref, isDownloading, download } = useImageDownload();
  const agent = useCurrentAgent();

  // 입력 모드: 검색 vs 직접 입력
  const [inputMode, setInputMode] = useState<'search' | 'direct'>('search');
  const [directInput, setDirectInput] = useState<DirectInput>(DIRECT_INPUT_INITIAL);

  const [selectedSale, setSelectedSale] = useState<SaleResult | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [purchaseData, setPurchaseData] = useState<PurchaseData | null>(null);
  const [refundData, setRefundData] = useState<RefundData | null>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [isLoadingProductInfo, setIsLoadingProductInfo] = useState(false);

  // 상품 검색 드롭다운 상태
  const [productSearch, setProductSearch] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<ProductSearchResult[]>([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const hasIssued = mode === 'purchase' ? !!purchaseData : !!refundData;

  // 고객 선택 시 상품 정보 조회
  useEffect(() => {
    if (!selectedSale?.productCode) {
      setProductInfo(null);
      return;
    }

    setIsLoadingProductInfo(true);
    fetch(
      `/api/admin/affiliate/documents/product-info?productCode=${encodeURIComponent(
        selectedSale.productCode
      )}`,
      { credentials: 'include' }
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.product) {
          setProductInfo(json.product);
        }
      })
      .catch((err) => {
        console.warn('상품 정보 조회 실패', err);
      })
      .finally(() => setIsLoadingProductInfo(false));
  }, [selectedSale?.productCode]);

  // 상품 검색 디바운싱 (300ms) — 입력 시 자동으로 드롭다운 표시
  useEffect(() => {
    if (productSearch.trim().length > 0) {
      const timer = setTimeout(() => {
        searchProducts(productSearch);
        setProductDropdownOpen(true);
      }, 300);

      return () => clearTimeout(timer);
    }
    setProductDropdownOpen(false);
  }, [productSearch]);

  // 상품 검색 함수
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
    } catch {
      setProductSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  // 직접입력 모드: 선택된 상품코드로 환불규정·상품정보 자동 로드
  // (검색모드는 selectedSale.productCode useEffect가 담당 — 여기는 direct 전용)
  const loadProductInfoForDirect = async (code: string) => {
    if (!code) return;
    setIsLoadingProductInfo(true);
    try {
      const res = await fetch(
        `/api/admin/affiliate/documents/product-info?productCode=${encodeURIComponent(code)}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (!res.ok || !json.ok || !json.product) return;
      const prod = json.product as ProductInfo & { refundPolicyLines?: { label: string; value: string }[] };
      // 상품에 환불정책이 없으면 법정 기본값(국외여행 특수약관)으로 폴백 — 계약서와 동일 패턴.
      // productInfo.refundPolicy 도 폴백값으로 채워 발급 시 generatedData 에 규정이 누락되지 않게 함.
      const effectivePolicy = prod.refundPolicy ?? LEGAL_REFUND_POLICY;
      setProductInfo({ ...prod, refundPolicy: effectivePolicy });
      // 출발일 자동 채움 — 상품의 startDate를 환불정보 출발일 칸에 (사용자가 아직 안 넣었을 때만 보존)
      if (prod.startDate) {
        const ymd = prod.startDate.slice(0, 10);
        setDirectInput((prev) => (prev.departureDate.trim().length === 0 ? { ...prev, departureDate: ymd } : prev));
      }
      // 상품별 환불규정이 있으면 사람이 읽는 문자열로 refundPolicyText 자동 채움
      // (사용자가 아직 직접 입력 안 했을 때만 — 입력값 보존). 50자 게이트 자연 통과.
      const lines = (prod.refundPolicyLines && prod.refundPolicyLines.length > 0)
        ? prod.refundPolicyLines
        : refundPolicyToLines(effectivePolicy);
      if (lines.length > 0) {
        const text = `[${prod.productName} 취소·환불 규정]\n` + lines.map((l) => `· ${l.label}: ${l.value}`).join('\n');
        setDirectInput((prev) => (prev.refundPolicyText.trim().length === 0 ? { ...prev, refundPolicyText: text } : prev));
      }
    } catch {
      // 조회 실패 시 무시 — 사용자가 환불규정 수기 입력 가능
    } finally {
      setIsLoadingProductInfo(false);
    }
  };

  // 상품 드롭다운에서 상품 선택
  const handleSelectProductFromDropdown = (product: ProductSearchResult) => {
    setDirectInput((prev) => ({
      ...prev,
      productName: product.productName,
      productCode: product.productCode,
      amount: product.basePrice.toString(),
    }));
    setProductSearch('');
    setProductDropdownOpen(false);
    setProductSearchResults([]);
    // 선택 직후 상품 환불규정 자동 로드 (요구② — 직접입력에서도 그 상품 규정 자동)
    void loadProductInfoForDirect(product.productCode);
  };

  // 바깥 클릭으로 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── 미리보기에 사용할 데이터 타입 (SaleResult의 미리보기 관련 필드만) ────────
  type PreviewSaleData = {
    buyerName: string | null;
    buyerTel: string | null;
    customerPhone: string | null;
    productName: string | null;
    saleAmount: number | null;
    paidAt: string | null;
    orderId: string | null;
    productCode: string | null;
  };

  // ── 미리보기 데이터 통합 (검색 선택 우선, 없으면 직접 입력 사용) ───────────
  const previewSale = useMemo((): PreviewSaleData | null => {
    if (selectedSale) {
      return {
        buyerName: selectedSale.buyerName,
        buyerTel: selectedSale.buyerTel,
        customerPhone: selectedSale.customerPhone,
        productName: selectedSale.productName,
        saleAmount: selectedSale.saleAmount,
        paidAt: selectedSale.paidAt,
        orderId: selectedSale.orderId,
        productCode: selectedSale.productCode,
      };
    }
    if (inputMode === 'direct') {
      return {
        buyerName: directInput.buyerName || null,
        buyerTel: directInput.buyerTel || null,
        customerPhone: directInput.buyerTel || null,
        productName: directInput.productName || null,
        saleAmount: directInput.amount ? Number(directInput.amount) : null,
        paidAt: directInput.paidAt || null,
        orderId: null,
        productCode: null,
      };
    }
    return null;
  }, [selectedSale, inputMode, directInput]);

  // 직접 입력에서 환불 계산 전용 날짜 데이터
  const directRefundDates = useMemo(() => {
    if (inputMode !== 'direct') return null;
    return {
      cancelDate: directInput.cancelDate || null,
      departureDate: directInput.departureDate || null,
      amount: directInput.amount ? Number(directInput.amount) : null,
    };
  }, [inputMode, directInput.cancelDate, directInput.departureDate, directInput.amount]);

  // 발급 버튼 활성화 조건
  const canIssue = (() => {
    if (inputMode === 'search') return !!selectedSale;
    // 직접 입력: 이름 + 상품명 + 금액 + 환불규정 (50자 이상) 필수
    return !!(
      directInput.buyerName &&
      directInput.productName &&
      directInput.amount &&
      directInput.refundPolicyText.length >= 50
    );
  })();

  const handleIssue = async () => {
    if (!canIssue) {
      if (inputMode === 'search') {
        showError('먼저 고객을 선택해주세요.');
      } else if (!directInput.refundPolicyText || directInput.refundPolicyText.length < 50) {
        showError('환불규정을 50자 이상 입력해주세요.');
      } else {
        showError('고객 이름, 상품명, 금액을 입력해주세요.');
      }
      return;
    }
    if (inputMode === 'search' && !selectedSale?.orderId) {
      showError('이 판매 건에는 주문번호가 없어 증서를 발급할 수 없습니다.');
      return;
    }
    setIsIssuing(true);
    try {
      let body: Record<string, unknown>;

      if (inputMode === 'search' && selectedSale) {
        body = { orderId: selectedSale.orderId };
      } else {
        // 직접 입력 모드: 클라이언트가 데이터를 구성한 뒤 API로 저장(승인큐·감사·이메일·보관)
        const gen: PurchaseData & RefundData = {
          buyerName: directInput.buyerName || null,
          buyerTel: directInput.buyerTel || null,
          productName: directInput.productName || null,
          amount: directInput.amount ? Number(directInput.amount) : null,
          paidAt: directInput.paidAt || null,
          note: directInput.refundPolicyText || null,
          // 직접입력 환불규정 자유서식 — 구매확인증서 본문 환불규정 영역에 렌더(우선순위 최상)
          refundPolicyText: directInput.refundPolicyText || null,
          cancelledAt: directInput.cancelDate || null,
          // 출발일: 사용자 입력 우선, 없으면 선택한 상품의 출발일(startDate) — 미리보기와 동일 규칙
          departureDate: directInput.departureDate || productInfo?.startDate || null,
        };

        // 환불인증서 직접 입력: 자동 계산
        // 상품을 드롭다운으로 선택해 productInfo가 로드됐으면 그 상품정책/출발일로 계산,
        // 아니면 법정기준(null). 미리보기(RefundPreviewDraft)와 동일 입력으로 통일.
        const effectiveDepartureDate = directInput.departureDate || productInfo?.startDate || '';
        if (mode === 'refund' && gen.amount && effectiveDepartureDate) {
          try {
            const baseDate = directInput.cancelDate ? new Date(directInput.cancelDate) : undefined;
            const calc = calcRefundAmount(
              gen.amount,
              new Date(effectiveDepartureDate),
              productInfo?.refundPolicy ?? null,
              baseDate
            );
            gen.refundAmount = calc.refundAmount;
            gen.penaltyRate = calc.penaltyRate;
            gen.penaltyAmount = calc.penaltyAmount;
            gen.daysBeforeDep = calc.daysBeforeDep;
            gen.refundBasis = calc.basis;
            // 발급 시점 환불정책 스냅샷 저장 (상품 환불규정이 나중에 비워져도 발급본 보존 — 법무 요건)
            if (productInfo?.refundPolicy) {
              gen.refundPolicy = productInfo.refundPolicy;
              gen.refundPolicyLines = refundPolicyToLines(productInfo.refundPolicy);
            }
          } catch {
            // 계산 실패 시 원금 그대로
            gen.refundAmount = gen.amount;
          }
        }

        // 직접입력도 API로 저장 — orderId 없이 direct 페이로드 전송(검색모드와 동일 흐름)
        body = { direct: gen };
      }

      const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || '증서 발급에 실패했습니다.');
      const gen = (json.generatedData || {}) as PurchaseData & RefundData;
      if (mode === 'purchase') setPurchaseData(gen as PurchaseData);
      else setRefundData(gen as RefundData);
      showSuccess(`${cfg.title}가 발급되었습니다.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : '증서 발급 중 오류가 발생했습니다.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleDownload = async () => {
    const buyerName = (mode === 'purchase' ? purchaseData?.buyerName : refundData?.buyerName) || '고객';
    const fileName = mode === 'purchase' ? `구매확인증서_${buyerName}` : `환불완료증서_${buyerName}`;
    const ok = await download(fileName);
    if (ok) showSuccess('증서 이미지가 다운로드되었습니다.');
    else showError('이미지 다운로드 중 오류가 발생했습니다.');
  };

  const handleReset = () => {
    setSelectedSale(null);
    setPurchaseData(null);
    setRefundData(null);
    setDirectInput(DIRECT_INPUT_INITIAL);
  };

  // 입력 모드 전환 시 기존 상태 초기화
  const handleInputModeChange = (next: 'search' | 'direct') => {
    setInputMode(next);
    setSelectedSale(null);
    setPurchaseData(null);
    setRefundData(null);
    setProductInfo(null);
    setDirectInput(DIRECT_INPUT_INITIAL);
  };

  const handleDirectInputChange = (field: keyof DirectInput, value: string) => {
    setDirectInput((prev) => ({ ...prev, [field]: value }));
    // 직접 입력 변경 시 이미 발급된 증서 초기화
    setPurchaseData(null);
    setRefundData(null);
  };

  return (
    <div className="space-y-6">
      {/* ═══ 상단: 입력 영역 ════════════════════════════════════════════════════ */}
      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <cfg.Icon className="h-5 w-5 text-gray-700" />
          <h3 className="text-base font-bold text-gray-900">{cfg.title} 발급</h3>
        </div>

        {/* ─── 입력 모드 선택 탭 ─────────────────────────────────────────── */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleInputModeChange('search')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors ${
              inputMode === 'search'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Search className="h-4 w-4" />
            고객 검색
          </button>
          <button
            type="button"
            onClick={() => handleInputModeChange('direct')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors ${
              inputMode === 'direct'
                ? 'border-violet-500 bg-violet-50 text-violet-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <PenLine className="h-4 w-4" />
            직접 입력
          </button>
        </div>

        {/* ─── 검색 모드 ─────────────────────────────────────────────────── */}
        {inputMode === 'search' && (
          <>
            <CustomerAutocomplete
              label="고객 검색"
              placeholder="이름·주문번호·전화번호 입력"
              accent={cfg.accent}
              onlyPurchasable={mode === 'purchase'}
              onlyRefundable={mode === 'refund'}
              onSelect={(s) => {
                setSelectedSale(s);
                setPurchaseData(null);
                setRefundData(null);
                setProductInfo(null);
              }}
            />

            {/* 선택된 판매 건 요약 */}
            {selectedSale && (
              <>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{selectedSale.buyerName || '(이름없음)'}</span>
                      {selectedSale.customerPhone && <span className="text-xs text-gray-400">{selectedSale.customerPhone}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="truncate text-sm">{selectedSale.productName || '(상품명 없음)'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <CreditCard className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold">{formatMoney(selectedSale.saleAmount)}</span>
                    </div>
                    {selectedSale.orderId && <div className="text-xs text-gray-400">주문 {selectedSale.orderId}</div>}
                  </div>
                </div>

                {/* 상품 정보 카드 (로딩 또는 성공) */}
                {isLoadingProductInfo ? (
                  <div className="flex items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    <span className="ml-2 text-sm text-indigo-600">상품 정보 조회 중...</span>
                  </div>
                ) : (
                  productInfo && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm">
                      <p className="mb-2 text-xs font-bold text-indigo-600">📦 상품 정보</p>
                      <div className="space-y-1 text-xs text-indigo-700">
                        <p>
                          <span className="font-medium">선박:</span> {productInfo.shipName || '-'}
                        </p>
                        <p>
                          <span className="font-medium">포함 항목:</span>{' '}
                          {productInfo.includedItems?.join(', ') || '-'}
                        </p>
                        {productInfo.excludedItems && productInfo.excludedItems.length > 0 && (
                          <p>
                            <span className="font-medium">불포함 항목:</span>{' '}
                            {productInfo.excludedItems.join(', ')}
                          </p>
                        )}
                        {productInfo.itineraryPattern ? (
                          <p>
                            <span className="font-medium">기항지:</span>{' '}
                            {buildItinerary(productInfo.itineraryPattern as unknown) as React.ReactNode}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </>
        )}

        {/* ─── 직접 입력 모드 ────────────────────────────────────────────── */}
        {inputMode === 'direct' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">고객 정보를 직접 입력하면 미리보기에 즉시 반영됩니다.</p>

            {/* 공통 필드 */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">
                  고객 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={directInput.buyerName}
                  onChange={(e) => handleDirectInputChange('buyerName', e.target.value)}
                  placeholder="예: 홍길동"
                  className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">연락처</label>
                <input
                  type="text"
                  value={directInput.buyerTel}
                  onChange={(e) => handleDirectInputChange('buyerTel', e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
            </div>

            {/* 상품명 드롭다운 섹션 */}
            <div className="flex flex-col gap-1.5" ref={productDropdownRef}>
              <label className="text-sm font-semibold text-gray-700">
                상품명 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={productSearch || directInput.productName}
                  onChange={(e) => {
                    // 검색은 디바운스 useEffect에 일임 (중복 fetch 방지). 여기선 입력값만 갱신.
                    setProductSearch(e.target.value);
                  }}
                  onFocus={() => {
                    if (productSearch.length > 0) setProductDropdownOpen(true);
                  }}
                  placeholder="상품명 입력 후 선택"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                />

                {/* 로딩 표시 */}
                {isSearchingProducts && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}

                {/* 입력창 초기화 버튼 */}
                {!isSearchingProducts && productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('');
                      setProductSearchResults([]);
                      setProductDropdownOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {/* 드롭다운 목록 */}
                {productDropdownOpen && productSearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 border border-gray-300 bg-white rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                    {productSearchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProductFromDropdown(product)}
                        className="w-full px-4 py-3 hover:bg-violet-50 cursor-pointer border-b last:border-b-0 text-left transition-colors"
                      >
                        <div className="font-semibold text-gray-900 text-sm">{product.productName}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {product.basePrice ? `기본가: ${product.basePrice.toLocaleString()}원` : '가격 미정'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 검색 결과 없음 */}
                {productDropdownOpen && !isSearchingProducts && productSearch.length > 0 && productSearchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 border border-gray-300 bg-white rounded-xl shadow-lg z-10 px-4 py-3 text-sm text-gray-500">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">
                  결제 금액 (원) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={directInput.amount}
                  onChange={(e) => handleDirectInputChange('amount', e.target.value)}
                  placeholder="예: 3000000"
                  min={0}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">결제일</label>
                <input
                  type="date"
                  value={directInput.paidAt}
                  onChange={(e) => handleDirectInputChange('paidAt', e.target.value)}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
            </div>

            {/* 환불규정 필드 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">
                취소·환불규정 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={directInput.refundPolicyText}
                onChange={(e) => handleDirectInputChange('refundPolicyText', e.target.value)}
                placeholder="환불규정을 상세히 입력하세요 (50자 이상 필수)"
                minLength={50}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 resize-none h-28"
              />

              {/* 글자 수 카운터 */}
              <div className="flex justify-between items-center px-1">
                <div className="text-xs text-gray-500">
                  {directInput.refundPolicyText.length}/최소 50자
                </div>
                {directInput.refundPolicyText.length < 50 && (
                  <div className="text-xs text-rose-600 font-semibold">
                    {50 - directInput.refundPolicyText.length}자 더 입력해주세요
                  </div>
                )}
                {directInput.refundPolicyText.length >= 50 && (
                  <div className="text-xs text-emerald-600 font-semibold">
                    ✅ 입력 완료
                  </div>
                )}
              </div>
            </div>

            {/* 환불인증서 전용 추가 필드 */}
            {mode === 'refund' && (
              <div className="rounded-xl border-2 border-red-100 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-bold text-red-700">환불 정보 (자동 계산)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-gray-700">출발일</label>
                    <input
                      type="date"
                      value={directInput.departureDate}
                      onChange={(e) => handleDirectInputChange('departureDate', e.target.value)}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-gray-700">환불 요청일</label>
                    <input
                      type="date"
                      value={directInput.cancelDate}
                      onChange={(e) => handleDirectInputChange('cancelDate', e.target.value)}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                </div>
                <p className="text-xs text-red-600">
                  출발일과 금액을 입력하면 환불액이 자동 계산됩니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── 발급 버튼 ──────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleIssue}
          disabled={!canIssue || isIssuing}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cfg.issueBtn}`}
        >
          {isIssuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <cfg.Icon className="h-5 w-5" />}
          {isIssuing ? '발급 중...' : hasIssued ? '재발급' : '증서 발급'}
        </button>

        {hasIssued && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            새 증서 발급
          </button>
        )}
      </div>

      {/* ═══ 하단: 미리보기 영역 ═══════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* 상태 헤더 */}
        <div className="flex items-center gap-2">
          <cfg.Icon className="h-5 w-5 text-gray-600" />
          <p className="text-base font-bold text-gray-900">
            {!hasIssued && previewSale && '이렇게 저장됩니다'}
            {!hasIssued && !previewSale && '미리보기'}
            {hasIssued && '발급 완료증서'}
          </p>
        </div>

        {/* 미리보기 영역 */}
        {!hasIssued ? (
          // 발급 전: 항상 미리보기 표시 (고객 선택 전에는 빈 데이터로 표시)
          <div
            className={`rounded-2xl border-2 p-6 transition-all ${
              previewSale
                ? mode === 'purchase'
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            {previewSale && (
              <p
                className={`mb-6 flex items-center gap-2 text-sm font-semibold ${
                  mode === 'purchase'
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              >
                <ShieldCheck className="h-5 w-5" />
                발급 버튼을 누르면 이 내용으로 정식 증서가 생성됩니다
              </p>
            )}

            {!previewSale && (
              <p className="mb-4 text-sm font-semibold text-gray-500">
                고객 정보를 입력하면 아래 미리보기에 자동 반영됩니다.
              </p>
            )}

            {mode === 'purchase' && (
              <PurchasePreviewDraft
                data={{
                  buyerName: previewSale?.buyerName ?? null,
                  buyerTel: previewSale?.buyerTel ?? null,
                  productName: previewSale?.productName ?? null,
                  amount: previewSale?.saleAmount ?? null,
                  paidAt: previewSale?.paidAt ?? null,
                  paymentMethod: undefined,
                }}
                productInfo={productInfo}
              />
            )}
            {mode === 'refund' && (
              <RefundPreviewDraft
                data={{
                  buyerName: previewSale?.buyerName ?? null,
                  productName: previewSale?.productName ?? null,
                  amount: previewSale?.saleAmount ?? null,
                  paidAt: previewSale?.paidAt ?? null,
                }}
                productInfo={productInfo}
                directRefundDates={directRefundDates}
              />
            )}
          </div>
        ) : (
          /* 발급 후: 완성된 증서 + 다운로드 */
          <div className="space-y-4">
            {/* 발급 완료 뱃지 */}
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 border border-green-200">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-700">발급 완료됨</span>
            </div>

            {/* 증서 미리보기 */}
            {mode === 'purchase' && purchaseData && (
              <PurchasePreview cardRef={ref} data={purchaseData} agent={agent} productInfo={productInfo} />
            )}
            {mode === 'refund' && refundData && (
              <RefundPreview cardRef={ref} data={refundData} agent={agent} productInfo={productInfo} />
            )}

            {/* 다운로드 버튼 */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold text-white disabled:opacity-50 ${cfg.issueBtn}`}
            >
              {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {isDownloading ? 'PNG 다운로드 중...' : 'PNG로 다운로드'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 구매확인증서 미리보기 카드 (상세 상품 정보 + 환불 정책 포함)
// ─────────────────────────────────────────────────────────────────────────────

function PurchasePreview({
  cardRef,
  data,
  agent,
  productInfo,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  data: PurchaseData;
  agent: CurrentAgent;
  productInfo?: ProductInfo | null;
}) {
  return (
    <div
      ref={cardRef}
      className="rounded-xl border-4 border-gray-300 bg-white px-10 py-8 shadow-lg mx-auto max-w-[210mm] min-h-[297mm] print:max-w-none print:min-h-0"
    >
      <DocumentLetterhead title="구매확인증서" accentClass="border-emerald-100" />

      <div className="pt-8">
        <p className="mb-8 text-lg leading-relaxed text-gray-700">
          아래와 같이 정상적으로 구매·결제가 완료되었음을 확인합니다.
        </p>

        {/* 구매자 정보 */}
        <div className="mb-6 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-600">구매자 정보</p>
          <dl className="divide-y divide-gray-200 space-y-0">
            <InfoRow icon={User} label="구매자명" value={data.buyerName || '-'} />
            <InfoRow icon={Phone} label="연락처" value={data.buyerTel || '-'} />
          </dl>
        </div>

        {/* 상품 및 결제 정보 */}
        <div className="mb-6 rounded-lg border-2 border-emerald-200 bg-emerald-50 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-700">상품 · 결제 정보</p>
          <dl className="divide-y divide-emerald-200 space-y-0">
            <InfoRow icon={Package} label="상품명" value={data.productName || '-'} strong />
            {/* 어떤 여행인지 — 상품 상세(선사·선박·기간·출발일) 자동 표시 */}
            {productInfo && (productInfo.cruiseLine || productInfo.shipName) && (
              <InfoRow icon={Package} label="크루즈" value={[productInfo.cruiseLine, productInfo.shipName].filter(Boolean).join(' · ') || '-'} />
            )}
            {productInfo && (productInfo.nights > 0 || productInfo.days > 0) && (
              <InfoRow icon={Calendar} label="여행기간" value={`${productInfo.nights}박 ${productInfo.days}일`} />
            )}
            {productInfo?.startDate && (
              <InfoRow icon={Calendar} label="출발일" value={formatDate(productInfo.startDate)} />
            )}
            <InfoRow icon={CreditCard} label="결제금액" value={formatMoney(data.amount ?? null)} strong size="lg" />
            <InfoRow icon={Calendar} label="결제일" value={formatDate(data.paidAt)} />
            <InfoRow icon={CreditCard} label="결제방법" value={data.paymentMethod || '-'} />
          </dl>
        </div>

        {/* 취소·환불 정책 — 우선순위: 직접입력 자유서식 > 발급본 스냅샷 > 라이브 상품정보 > 법정요약 */}
        {(() => {
          const directText = data.refundPolicyText?.trim();
          // 발급본 스냅샷(snapshot) 우선 → 없으면 라이브 productInfo
          const snapshotLines = data.refundPolicyLines && data.refundPolicyLines.length > 0
            ? data.refundPolicyLines
            : null;
          const liveLines = refundPolicyToLines(data.refundPolicy ?? productInfo?.refundPolicy ?? null);
          const policyLines = snapshotLines ?? (liveLines.length > 0 ? liveLines : CANCELLATION_POLICY);
          const isProductPolicy = !!(snapshotLines || liveLines.length > 0);
          return (
            <div className="mb-8 rounded-lg border-2 border-orange-200 bg-orange-50 p-6">
              <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-700">
                <ShieldCheck className="h-4 w-4" />
                취소·환불 규정
                {(directText || isProductPolicy) && <span className="ml-2 rounded-full bg-orange-300 px-2 py-0.5 text-[10px] text-white">{directText ? '입력 규정' : '상품별 정책'}</span>}
              </p>
              {directText ? (
                // 직접입력 모드: 사용자가 작성한 환불규정 자유서식 그대로 표시
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{directText}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-orange-300">
                      <th className="pb-3 text-left font-bold text-orange-700">취소 시점</th>
                      <th className="pb-3 text-right font-bold text-orange-700">위약금</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policyLines.map((row, idx) => (
                      <tr key={`${row.label}-${idx}`} className="border-b border-orange-100 last:border-0">
                        <td className="py-3 text-gray-700">{row.label}</td>
                        <td className="py-3 text-right font-semibold text-gray-800">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!directText && (
                <p className="mt-4 text-xs leading-relaxed text-gray-600">
                  ※ {isProductPolicy ? '상품별 환불정책 적용' : '관광진흥법 시행령 기준'}
                </p>
              )}
            </div>
          );
        })()}

        <DocumentSeal agent={agent} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불완료증서 / 환불예정확인서 미리보기 카드
// ─────────────────────────────────────────────────────────────────────────────

function RefundPreview({
  cardRef,
  data,
  agent,
  productInfo,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  data: RefundData;
  agent: CurrentAgent;
  productInfo?: ProductInfo | null;
}) {
  const title = data.isRefundPending ? '환불예정확인서' : '환불완료증서';
  const hasPenalty = (data.penaltyRate ?? 0) > 0;

  // 취소료 단계표 — 우선순위: 직접입력 자유서식 > 발급본 스냅샷 > 라이브 상품정보 > 법정요약
  // (구매확인증서 PurchasePreview 와 동일 규칙. 상품 환불규정이 나중에 비워져도 발급본 스냅샷이 보존)
  const directText = data.refundPolicyText?.trim();
  const snapshotLines = data.refundPolicyLines && data.refundPolicyLines.length > 0
    ? data.refundPolicyLines
    : null;
  const liveLines = refundPolicyToLines(data.refundPolicy ?? productInfo?.refundPolicy ?? null);
  const cancellationRows = snapshotLines ?? (liveLines.length > 0 ? liveLines : CANCELLATION_POLICY);
  const isProductPolicy = !!(snapshotLines || liveLines.length > 0);

  return (
    <div
      ref={cardRef}
      className="rounded-xl border-4 border-gray-300 bg-white px-10 py-8 shadow-lg mx-auto max-w-[210mm] min-h-[297mm] print:max-w-none print:min-h-0"
    >
      <DocumentLetterhead title={title} accentClass="border-red-100" />

      <div className="pt-8">
        <p className="mb-8 text-lg leading-relaxed text-gray-700">
          {data.isRefundPending
            ? '아래와 같이 환불이 예정되어 있음을 확인합니다.'
            : '아래와 같이 환불이 정상적으로 처리·완료되었음을 확인합니다.'}
        </p>

        {/* 상품 내역 */}
        <div className="mb-6 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-600">상품 내역</p>
          <dl className="divide-y divide-gray-200 space-y-0">
            <InfoRow icon={User} label="구매자명" value={data.buyerName || '-'} />
            <InfoRow icon={Package} label="상품명" value={data.productName || '-'} strong />
            {/* 어떤 여행인지 — 상품 상세(구매확인증서와 동일) */}
            {productInfo && (productInfo.cruiseLine || productInfo.shipName) && (
              <InfoRow icon={Package} label="크루즈" value={[productInfo.cruiseLine, productInfo.shipName].filter(Boolean).join(' · ') || '-'} />
            )}
            {productInfo && (productInfo.nights > 0 || productInfo.days > 0) && (
              <InfoRow icon={Calendar} label="여행기간" value={`${productInfo.nights}박 ${productInfo.days}일`} />
            )}
            <InfoRow icon={CreditCard} label="원결제금액" value={formatMoney(data.amount ?? null)} />
            <InfoRow icon={Calendar} label="결제일" value={formatDate(data.paidAt)} />
          </dl>
        </div>

        {/* 환불금액 강조 */}
        <div className="mb-6 rounded-lg border-2 border-red-200 bg-red-50 px-6 py-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-red-200">
            <span className="text-sm font-bold text-red-700 uppercase tracking-widest">환불금액</span>
            <span className="text-4xl font-extrabold text-red-600">{formatMoney(data.refundAmount ?? null)}</span>
          </div>
          {hasPenalty && (
            <div className="flex items-center justify-between text-base text-red-600">
              <span className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                위약금 ({data.penaltyRate}%)
              </span>
              <span className="font-bold">- {formatMoney(data.penaltyAmount ?? null)}</span>
            </div>
          )}
        </div>

        {/* 환불 상세 */}
        <div className="mb-8 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-600">환불 상세</p>
          <dl className="divide-y divide-gray-200 space-y-0">
            {data.refundBasis && <InfoRow icon={AlertTriangle} label="환불기준" value={data.refundBasis} />}
            <InfoRow icon={Calendar} label="출발일" value={formatDate(data.departureDate)} />
            {data.daysBeforeDep != null && (
              <InfoRow icon={Calendar} label="출발 전 잔여일" value={`${data.daysBeforeDep}일 전`} />
            )}
            <InfoRow icon={Calendar} label="환불처리일" value={formatDate(data.cancelledAt)} />
            {data.companyAccount && <InfoRow icon={Building2} label="환불계좌" value={data.companyAccount} />}
          </dl>
        </div>

        {/* 취소·환불 규정 단계표 (요구② — 환불증서에도 그 상품의 규정 표시) */}
        <div className="mb-8 rounded-lg border-2 border-orange-200 bg-orange-50 p-6">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-700">
            <ShieldCheck className="h-4 w-4" />
            취소·환불 규정
            {(directText || isProductPolicy) && <span className="ml-2 rounded-full bg-orange-300 px-2 py-0.5 text-[10px] text-white">{directText ? '입력 규정' : '상품별 정책'}</span>}
          </p>
          {directText ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{directText}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-orange-300">
                  <th className="pb-3 text-left font-bold text-orange-700">취소 시점</th>
                  <th className="pb-3 text-right font-bold text-orange-700">위약금</th>
                </tr>
              </thead>
              <tbody>
                {cancellationRows.map((row, idx) => (
                  <tr key={`${row.label}-${idx}`} className="border-b border-orange-100 last:border-0">
                    <td className="py-3 text-gray-700">{row.label}</td>
                    <td className="py-3 text-right font-semibold text-gray-800">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!directText && (
            <p className="mt-4 text-xs leading-relaxed text-gray-600">
              ※ {isProductPolicy ? '상품별 환불정책 적용' : '관광진흥법 시행령 기준'}
            </p>
          )}
        </div>

        {data.note && !directText && (
          <p className="mb-8 rounded-lg bg-gray-50 px-6 py-5 text-sm leading-relaxed text-gray-600 border border-gray-200">{data.note}</p>
        )}

        <DocumentSeal agent={agent} />
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  strong,
  size = 'base',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  strong?: boolean;
  size?: 'base' | 'lg';
}) {
  const sizeClasses = {
    base: 'text-sm',
    lg: 'text-lg',
  };

  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className={`flex items-center gap-1.5 ${size === 'lg' ? 'text-base font-semibold' : 'text-sm'} text-gray-600`}>
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </dt>
      <dd
        className={`${sizeClasses[size]} ${
          strong ? 'font-bold text-gray-900' : 'text-gray-800'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 발급 전 미리보기 (구매확인증서 임시 정보)
// ─────────────────────────────────────────────────────────────────────────────

function PurchasePreviewDraft({
  data,
  productInfo,
}: {
  data: PurchaseData;
  productInfo?: ProductInfo | null;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-white p-6">
      <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
        <span className="text-sm font-semibold text-gray-600">구매자명</span>
        <span className="text-lg font-semibold text-gray-900">{data.buyerName || '-'}</span>
      </div>
      <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
        <span className="text-sm font-semibold text-gray-600">연락처</span>
        <span className="text-lg font-medium text-gray-900">{data.buyerTel || '-'}</span>
      </div>
      <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
        <span className="text-sm font-semibold text-gray-600">상품명</span>
        <span className="text-lg font-medium text-gray-900 truncate">{data.productName || '-'}</span>
      </div>
      <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
        <span className="text-sm font-semibold text-gray-600">결제금액</span>
        <span className="text-2xl font-extrabold text-emerald-600">{formatMoney(data.amount ?? null)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">결제일</span>
        <span className="text-lg font-medium text-gray-900">{formatDate(data.paidAt)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 발급 전 미리보기 (환불완료증서 임시 정보)
// ─────────────────────────────────────────────────────────────────────────────

type DirectRefundDates = {
  cancelDate: string | null;
  departureDate: string | null;
  amount: number | null;
} | null;

function RefundPreviewDraft({
  data,
  productInfo,
  directRefundDates,
}: {
  data: {
    buyerName?: string | null;
    productName?: string | null;
    amount?: number | null;
    paidAt?: string | null;
  };
  productInfo?: ProductInfo | null;
  directRefundDates?: DirectRefundDates;
}) {
  // 환불 계산: productInfo.startDate 우선, 없으면 directRefundDates.departureDate 사용
  const refundCalc = useMemo(() => {
    const amount = data.amount;
    const startDateStr = productInfo?.startDate ?? directRefundDates?.departureDate;
    if (!amount || !startDateStr) return null;
    try {
      // cancelDate를 기준일(baseDate)로 사용 (있으면), 없으면 오늘
      const baseDate = directRefundDates?.cancelDate
        ? new Date(directRefundDates.cancelDate)
        : undefined;
      return calcRefundAmount(
        amount,
        new Date(startDateStr),
        productInfo?.refundPolicy ?? null,
        baseDate
      );
    } catch {
      return null;
    }
  }, [
    data.amount,
    productInfo?.startDate,
    productInfo?.refundPolicy,
    directRefundDates?.departureDate,
    directRefundDates?.cancelDate,
  ]);

  const showDepartureMissing =
    !productInfo?.startDate && !directRefundDates?.departureDate;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-red-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-red-100 pb-4">
          <span className="text-sm font-semibold text-gray-600">구매자명</span>
          <span className="text-lg font-semibold text-gray-900">{data.buyerName || '-'}</span>
        </div>
        <div className="flex items-center justify-between border-b border-red-100 pb-4">
          <span className="text-sm font-semibold text-gray-600">상품명</span>
          <span className="text-lg font-medium text-gray-900">{data.productName || '-'}</span>
        </div>
        <div className="flex items-center justify-between border-b border-red-100 pb-4">
          <span className="text-sm font-semibold text-gray-600">원결제금액</span>
          <span className="text-2xl font-extrabold text-red-700">{formatMoney(data.amount ?? null)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-red-100 pb-4">
          <span className="text-sm font-semibold text-gray-600">결제일</span>
          <span className="text-lg font-medium text-gray-900">{formatDate(data.paidAt)}</span>
        </div>
        {/* 직접 입력 날짜 표시 */}
        {directRefundDates?.departureDate && (
          <div className="flex items-center justify-between border-b border-red-100 pb-4">
            <span className="text-sm font-semibold text-gray-600">출발일</span>
            <span className="text-lg font-medium text-gray-900">
              {formatDate(directRefundDates.departureDate)}
            </span>
          </div>
        )}
        {directRefundDates?.cancelDate && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">환불 요청일</span>
            <span className="text-lg font-medium text-gray-900">
              {formatDate(directRefundDates.cancelDate)}
            </span>
          </div>
        )}
      </div>

      {/* 환불 계산 결과 */}
      {refundCalc && (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 p-6">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">예상 환불액</p>
          <div className="text-4xl font-extrabold text-red-600 mb-4">
            {formatMoney(refundCalc.refundAmount)}
          </div>
          {refundCalc.penaltyRate > 0 && (
            <div className="rounded bg-white px-3 py-2 mb-3 border border-red-200">
              <p className="text-sm text-red-700">
                위약금 <span className="font-bold">{refundCalc.penaltyRate}%</span>{' '}
                <span className="text-red-600 font-bold">- {formatMoney(refundCalc.penaltyAmount)}</span>
              </p>
            </div>
          )}
          <p className="text-xs text-gray-600">
            출발 <span className="font-semibold text-gray-700">{refundCalc.daysBeforeDep}일 전</span> 기준 · {refundCalc.basis}
          </p>
        </div>
      )}

      {/* 출발일 없으면 안내 */}
      {showDepartureMissing && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700 font-medium">출발일 정보 없음</p>
          <p className="text-xs text-amber-600 mt-1">출발일을 입력하면 자동으로 환불액이 계산됩니다.</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 기항지 패턴 포맷팅 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function buildItinerary(pattern: unknown): string {
  if (!pattern) return '-';
  if (typeof pattern === 'string') return pattern;
  if (Array.isArray(pattern)) {
    return (pattern as Array<{ port?: string; city?: string }>)
      .map((p) => p.port || p.city || '?')
      .join(' → ');
  }
  if (typeof pattern === 'object') {
    const obj = pattern as Record<string, unknown>;
    if ('ports' in obj && Array.isArray(obj.ports)) {
      return (obj.ports as Array<{ name?: string; code?: string }>)
        .map((p) => p.name || p.code || '?')
        .join(' → ');
    }
  }
  return '-';
}
