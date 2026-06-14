'use client';

import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { CANCELLATION_POLICY } from '@/lib/company-info';
import { calcRefundAmount, type RefundPolicyJson } from '@/lib/refund-calculator';
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

  const [selectedSale, setSelectedSale] = useState<SaleResult | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [purchaseData, setPurchaseData] = useState<PurchaseData | null>(null);
  const [refundData, setRefundData] = useState<RefundData | null>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [isLoadingProductInfo, setIsLoadingProductInfo] = useState(false);

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

  const handleIssue = async () => {
    if (!selectedSale) { showError('먼저 고객을 선택해주세요.'); return; }
    if (!selectedSale.orderId) { showError('이 판매 건에는 주문번호가 없어 증서를 발급할 수 없습니다.'); return; }
    setIsIssuing(true);
    try {
      const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: selectedSale.orderId }),
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
  };

  return (
    <div className="space-y-6">
      {/* ═══ 안내 박스: 고객 선택 전에만 표시 ══════════════════════════════════════════ */}
      {!selectedSale && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600">
              <span className="text-base font-bold text-white">🚀</span>
            </div>
            <h4 className="text-lg font-bold text-gray-900">빠른 시작: {cfg.title} 발급</h4>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg">
                1️⃣
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-semibold text-gray-900">고객 검색</p>
                <p className="text-sm text-gray-600">이름·주문번호·전화번호 입력</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg">
                2️⃣
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-semibold text-gray-900">정보 확인</p>
                <p className="text-sm text-gray-600">고객·상품 정보 자동 로드</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg">
                3️⃣
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-semibold text-gray-900">미리보기 검토</p>
                <p className="text-sm text-gray-600">발급 전 최종 확인</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-lg">
                4️⃣
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-semibold text-gray-900">증서 발급</p>
                <p className="text-sm text-gray-600">PNG 다운로드 가능</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 상단: 검색 + 발급 영역 (모바일 우선) ══════════════════════════ */}
      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <cfg.Icon className="h-5 w-5 text-gray-700" />
          <h3 className="text-base font-bold text-gray-900">{cfg.title} 발급</h3>
        </div>

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

        <button
          type="button"
          onClick={handleIssue}
          disabled={!selectedSale || isIssuing}
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

      {/* ═══ 하단: 미리보기 영역 (모바일 우선 세로 배치) ═══════════════════ */}
      <div className="space-y-4">
        {/* 상태 헤더 */}
        <div className="flex items-center gap-2">
          <cfg.Icon className="h-5 w-5 text-gray-600" />
          <p className="text-base font-bold text-gray-900">
            {!hasIssued && selectedSale && '이렇게 저장됩니다'}
            {!hasIssued && !selectedSale && '발급 후 미리보기'}
            {hasIssued && '발급 완료증서'}
          </p>
        </div>

        {/* 미리보기 영역 */}
        {!hasIssued ? (
          selectedSale ? (
            <>
              {/* 발급 전: 큰 미리보기 강조 */}
              <div
                className={`rounded-2xl border-2 p-6 transition-all ${
                  mode === 'purchase'
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-red-300 bg-red-50'
                }`}
              >
                <p
                  className={`mb-6 flex items-center gap-2 text-sm font-semibold ${
                    mode === 'purchase'
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>3단계</span>: 발급 버튼을 누르면 이 내용으로 정식 증서가 생성됩니다
                </p>

                {mode === 'purchase' && (
                  <PurchasePreviewDraft
                    data={{
                      buyerName: selectedSale.buyerName,
                      buyerTel: selectedSale.buyerTel,
                      productName: selectedSale.productName,
                      amount: selectedSale.saleAmount,
                      paidAt: selectedSale.paidAt,
                      paymentMethod: undefined,
                    }}
                    productInfo={productInfo}
                  />
                )}
                {mode === 'refund' && (
                  <RefundPreviewDraft
                    data={{
                      buyerName: selectedSale.buyerName,
                      productName: selectedSale.productName,
                      amount: selectedSale.saleAmount,
                      paidAt: selectedSale.paidAt,
                    }}
                    productInfo={productInfo}
                  />
                )}
              </div>
            </>
          ) : (
            /* 고객 선택 전 placeholder */
            <div
              ref={ref}
              className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 py-12 text-center"
            >
              <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gray-200 mb-4">
                <cfg.Icon className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-gray-700">위의 단계를 따라 시작하세요</p>
              <p className="mt-2 text-sm text-gray-500">고객 검색으로 1단계부터 시작됩니다</p>
              <div className="mt-6 flex gap-2 text-xs text-gray-400">
                <span className="inline-block rounded-full bg-gray-200 px-3 py-1">1️⃣ 고객 검색</span>
                <span className="inline-block text-gray-300">→</span>
                <span className="inline-block rounded-full bg-gray-200 px-3 py-1">2️⃣ 정보 확인</span>
              </div>
            </div>
          )
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
              <RefundPreview cardRef={ref} data={refundData} agent={agent} />
            )}

            {/* 다운로드 버튼 - 항상 보이기 */}
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
      className="overflow-hidden rounded-xl border-4 border-gray-300 bg-white px-12 py-10 shadow-lg mx-auto max-w-[210mm] aspect-[210/297] print:max-w-none print:aspect-auto"
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
            <InfoRow icon={CreditCard} label="결제금액" value={formatMoney(data.amount ?? null)} strong size="lg" />
            <InfoRow icon={Calendar} label="결제일" value={formatDate(data.paidAt)} />
            <InfoRow icon={CreditCard} label="결제방법" value={data.paymentMethod || '-'} />
          </dl>
        </div>

        {/* 취소·환불 정책 */}
        <div className="mb-8 rounded-lg border-2 border-orange-200 bg-orange-50 p-6">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-700">
            <ShieldCheck className="h-4 w-4" />
            취소·환불 규정
            {productInfo?.refundPolicy?.slots && <span className="ml-2 rounded-full bg-orange-300 px-2 py-0.5 text-[10px] text-white">상품별 정책</span>}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-orange-300">
                <th className="pb-3 text-left font-bold text-orange-700">취소 시점</th>
                <th className="pb-3 text-right font-bold text-orange-700">위약금</th>
              </tr>
            </thead>
            <tbody>
              {(productInfo?.refundPolicy?.slots ?? CANCELLATION_POLICY.map((p) => ({
                daysBeforeDep: parseInt(p.label.match(/\d+/)?.[0] ?? '0'),
                penaltyRate: parseInt(p.value.match(/\d+/)?.[0] ?? '0'),
                label: p.label,
                value: p.value,
              }))).map((slot, idx) => {
                const isPolicy = productInfo?.refundPolicy?.slots;
                return (
                  <tr key={idx} className="border-b border-orange-100 last:border-0">
                    <td className="py-3 text-gray-700">
                      {isPolicy ? `출발 ${slot.daysBeforeDep}일 이전` : (slot as any).label}
                    </td>
                    <td className="py-3 text-right font-semibold text-gray-800">
                      {isPolicy ? `${slot.penaltyRate}%` : (slot as any).value}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs leading-relaxed text-gray-600">
            ※ {productInfo?.refundPolicy?.isStructured ? '상품별 환불정책 적용' : '관광진흥법 시행령 기준'}
          </p>
        </div>

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
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  data: RefundData;
  agent: CurrentAgent;
}) {
  const title = data.isRefundPending ? '환불예정확인서' : '환불완료증서';
  const hasPenalty = (data.penaltyRate ?? 0) > 0;

  return (
    <div
      ref={cardRef}
      className="overflow-hidden rounded-xl border-4 border-gray-300 bg-white px-12 py-10 shadow-lg mx-auto max-w-[210mm] aspect-[210/297] print:max-w-none print:aspect-auto"
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

        {data.note && (
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
    lg: 'text-xl',
  };

  return (
    <div className="flex items-center justify-between py-4">
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

function RefundPreviewDraft({
  data,
  productInfo,
}: {
  data: {
    buyerName?: string | null;
    productName?: string | null;
    amount?: number | null;
    paidAt?: string | null;
  };
  productInfo?: ProductInfo | null;
}) {
  const refundCalc = useMemo(() => {
    if (!data.amount || !productInfo?.startDate) return null;
    try {
      return calcRefundAmount(
        data.amount,
        new Date(productInfo.startDate),
        productInfo.refundPolicy ?? null,
      );
    } catch {
      return null;
    }
  }, [data.amount, productInfo?.startDate, productInfo?.refundPolicy]);

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
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">결제일</span>
          <span className="text-lg font-medium text-gray-900">{formatDate(data.paidAt)}</span>
        </div>
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
                위약금 <span className="font-bold">{refundCalc.penaltyRate}%</span> <span className="text-red-600 font-bold">- {formatMoney(refundCalc.penaltyAmount)}</span>
              </p>
            </div>
          )}
          <p className="text-xs text-gray-600">
            출발 <span className="font-semibold text-gray-700">{refundCalc.daysBeforeDep}일 전</span> 기준 · {refundCalc.basis}
          </p>
        </div>
      )}

      {/* 출발일 없으면 안내 */}
      {!productInfo?.startDate && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700 font-medium">⚠️ 출발일 정보 없음</p>
          <p className="text-xs text-amber-600 mt-1">발급 버튼을 눌러 정확한 환불액 확인</p>
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
