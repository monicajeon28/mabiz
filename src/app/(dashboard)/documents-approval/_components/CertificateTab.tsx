'use client';

// ─────────────────────────────────────────────────────────────────────────────
// 서류관리 > 구매확인증서 / 환불인증서 탭 (단일 컴포넌트, mode prop으로 구분)
//
// - mode='purchase' : 구매확인증서 (emerald accent, onlyPurchasable)
// - mode='refund'   : 환불완료증서 / 환불예정확인서 (red accent, onlyRefundable)
//
// 흐름: 고객 검색·선택 → "증서 발급" 버튼 → POST API 호출 → generatedData로
//       미리보기 카드 렌더 → PNG 다운로드 + 이메일 자동발송 안내 → 새 증서 발급 리셋
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  FileCheck2,
  FileX2,
  Download,
  Loader2,
  Mail,
  RotateCcw,
  User,
  Phone,
  Package,
  CreditCard,
  Calendar,
  Building2,
  AlertTriangle,
  Stamp,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import {
  SaleResult,
  formatMoney,
  formatDate,
  todayKo,
  CustomerAutocomplete,
  useImageDownload,
} from './shared';

// ─── 발급 응답 generatedData 타입 ───────────────────────────────────────────────

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

type CertMode = 'purchase' | 'refund';

// ─── mode별 설정 ────────────────────────────────────────────────────────────────

const CONFIG = {
  purchase: {
    title: '구매확인증서',
    apiUrl: '/api/documents/purchase-cert',
    accent: 'emerald' as const,
    issueBtn: 'bg-emerald-600 hover:bg-emerald-700',
    Icon: FileCheck2,
    headerBar: 'from-emerald-600 to-emerald-700',
    placeholderText: '구매확인증서를 발급할 고객을 먼저 검색·선택하세요.',
  },
  refund: {
    title: '환불완료증서',
    apiUrl: '/api/documents/refund-cert',
    accent: 'red' as const,
    issueBtn: 'bg-red-600 hover:bg-red-700',
    Icon: FileX2,
    headerBar: 'from-red-600 to-red-700',
    placeholderText: '환불증서를 발급할 고객을 먼저 검색·선택하세요.',
  },
};

export default function CertificateTab({ mode }: { mode: CertMode }) {
  const cfg = CONFIG[mode];
  const { ref, isDownloading, download } = useImageDownload();

  // 선택된 판매 건
  const [selectedSale, setSelectedSale] = useState<SaleResult | null>(null);
  // 발급 진행 상태
  const [isIssuing, setIsIssuing] = useState(false);
  // 발급 결과 (미리보기용)
  const [purchaseData, setPurchaseData] = useState<PurchaseData | null>(null);
  const [refundData, setRefundData] = useState<RefundData | null>(null);

  const hasIssued = mode === 'purchase' ? !!purchaseData : !!refundData;

  // ─── 증서 발급 ────────────────────────────────────────────────────────────────
  const handleIssue = async () => {
    if (!selectedSale) {
      showError('먼저 고객을 선택해주세요.');
      return;
    }
    if (!selectedSale.orderId) {
      showError('이 판매 건에는 주문번호가 없어 증서를 발급할 수 없습니다.');
      return;
    }

    setIsIssuing(true);
    try {
      const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: selectedSale.orderId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || '증서 발급에 실패했습니다.');
      }

      const gen = (json.generatedData || {}) as PurchaseData & RefundData;
      if (mode === 'purchase') {
        setPurchaseData(gen as PurchaseData);
      } else {
        setRefundData(gen as RefundData);
      }
      showSuccess(`${cfg.title}가 발급되었습니다.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '증서 발급 중 오류가 발생했습니다.';
      showError(msg);
    } finally {
      setIsIssuing(false);
    }
  };

  // ─── PNG 다운로드 ─────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    const buyerName =
      (mode === 'purchase' ? purchaseData?.buyerName : refundData?.buyerName) || '고객';
    const fileName =
      mode === 'purchase' ? `구매확인증서_${buyerName}` : `환불완료증서_${buyerName}`;
    const ok = await download(fileName);
    if (ok) showSuccess('증서 이미지가 다운로드되었습니다.');
    else showError('이미지 다운로드 중 오류가 발생했습니다.');
  };

  // ─── 새 증서 발급 리셋 ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setSelectedSale(null);
    setPurchaseData(null);
    setRefundData(null);
  };

  return (
    <div className="space-y-6">
      {/* ── 고객 검색 + 발급 영역 ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <cfg.Icon className="h-5 w-5 text-gray-700" />
          <h3 className="text-base font-bold text-gray-900">{cfg.title} 발급</h3>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <CustomerAutocomplete
              label="고객 검색"
              placeholder="이름·주문번호·전화번호 입력"
              accent={cfg.accent}
              onlyPurchasable={mode === 'purchase'}
              onlyRefundable={mode === 'refund'}
              onSelect={(s) => {
                setSelectedSale(s);
                // 새 고객 선택 시 이전 미리보기 초기화
                setPurchaseData(null);
                setRefundData(null);
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleIssue}
            disabled={!selectedSale || isIssuing || hasIssued}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cfg.issueBtn}`}
          >
            {isIssuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <cfg.Icon className="h-4 w-4" />}
            증서 발급
          </button>
        </div>

        {/* 선택된 판매 건 요약 */}
        {selectedSale && (
          <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2 text-gray-700">
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{selectedSale.buyerName || '(이름없음)'}</span>
              {selectedSale.customerPhone && (
                <span className="text-xs text-gray-400">{selectedSale.customerPhone}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Package className="h-4 w-4 text-gray-400" />
              <span className="truncate">{selectedSale.productName || '(상품명 없음)'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <span>{formatMoney(selectedSale.saleAmount)}</span>
            </div>
            {selectedSale.orderId && (
              <div className="text-xs text-gray-400">주문 {selectedSale.orderId}</div>
            )}
          </div>
        )}
      </div>

      {/* ── 발급 전 placeholder ─────────────────────────────────────────────── */}
      {!hasIssued && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <cfg.Icon className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">{cfg.placeholderText}</p>
          <p className="mt-1 text-xs text-gray-300">
            발급 후 미리보기와 PNG 다운로드 버튼이 표시됩니다.
          </p>
        </div>
      )}

      {/* ── 발급 후: 미리보기 + 다운로드 ─────────────────────────────────────── */}
      {hasIssued && (
        <div className="space-y-4">
          {/* 이메일 자동발송 안내 */}
          <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <Mail className="h-4 w-4 shrink-0" />
            <span>고객 이메일로 증서가 자동 발송되었습니다.</span>
          </div>

          {/* 미리보기 카드 */}
          {mode === 'purchase' && purchaseData && (
            <PurchasePreview cardRef={ref} data={purchaseData} headerBar={cfg.headerBar} />
          )}
          {mode === 'refund' && refundData && (
            <RefundPreview cardRef={ref} data={refundData} />
          )}

          {/* 액션 버튼 */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${cfg.issueBtn}`}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PNG 다운로드
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              새 증서 발급
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 구매확인증서 미리보기 카드
// ─────────────────────────────────────────────────────────────────────────────

function PurchasePreview({
  cardRef,
  data,
  headerBar,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  data: PurchaseData;
  headerBar: string;
}) {
  return (
    <div className="flex justify-center">
      <div
        ref={cardRef}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md"
      >
        {/* 헤더 */}
        <div className={`bg-gradient-to-r ${headerBar} px-8 py-7 text-center text-white`}>
          <p className="text-xs font-medium tracking-widest text-white/70">CRUISE.DOT</p>
          <h2 className="mt-1 text-2xl font-extrabold">구매확인증서</h2>
          <p className="mt-2 text-xs text-white/80">
            발행일: {data.issuedAt ? formatDate(data.issuedAt) : todayKo()}
          </p>
        </div>

        {/* 본문 */}
        <div className="px-8 py-6">
          <p className="mb-5 text-sm leading-relaxed text-gray-600">
            아래와 같이 정상적으로 구매·결제가 완료되었음을 확인합니다.
          </p>

          <dl className="divide-y divide-gray-100">
            <InfoRow icon={User} label="구매자명" value={data.buyerName || '-'} />
            <InfoRow icon={Phone} label="연락처" value={data.buyerTel || '-'} />
            <InfoRow icon={Package} label="상품명" value={data.productName || '-'} />
            <InfoRow
              icon={CreditCard}
              label="결제금액"
              value={formatMoney(data.amount ?? null)}
              strong
            />
            <InfoRow icon={Calendar} label="결제일" value={formatDate(data.paidAt)} />
            <InfoRow icon={CreditCard} label="결제방법" value={data.paymentMethod || '-'} />
          </dl>

          {/* 발급기관 + 직인 박스 */}
          <div className="mt-6 flex items-end justify-between border-t border-gray-100 pt-5">
            <div className="text-sm">
              <p className="font-semibold text-gray-800">발급기관</p>
              <p className="mt-0.5 flex items-center gap-1 text-gray-600">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                크루즈닷 (CRUISE.DOT)
              </p>
            </div>
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-emerald-200 text-emerald-600">
              <Stamp className="h-5 w-5" />
              <span className="mt-0.5 text-[10px] font-bold">직인</span>
              <span className="text-[10px] font-bold">CRUISE</span>
            </div>
          </div>
        </div>
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
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  data: RefundData;
}) {
  const title = data.isRefundPending ? '환불예정확인서' : '환불완료증서';
  const hasPenalty = (data.penaltyRate ?? 0) > 0;

  return (
    <div className="flex justify-center">
      <div
        ref={cardRef}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md"
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-7 text-center text-white">
          <p className="text-xs font-medium tracking-widest text-white/70">CRUISE.DOT</p>
          <h2 className="mt-1 text-2xl font-extrabold">{title}</h2>
          <p className="mt-2 text-xs text-white/80">발행일: {todayKo()}</p>
        </div>

        {/* 본문 */}
        <div className="px-8 py-6">
          <p className="mb-5 text-sm leading-relaxed text-gray-600">
            {data.isRefundPending
              ? '아래와 같이 환불이 예정되어 있음을 확인합니다.'
              : '아래와 같이 환불이 정상적으로 처리·완료되었음을 확인합니다.'}
          </p>

          <dl className="divide-y divide-gray-100">
            <InfoRow icon={User} label="구매자명" value={data.buyerName || '-'} />
            <InfoRow icon={Package} label="상품명" value={data.productName || '-'} />
            <InfoRow icon={CreditCard} label="원결제금액" value={formatMoney(data.amount ?? null)} />
          </dl>

          {/* 환불금액 강조 박스 */}
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-red-700">환불금액</span>
              <span className="text-xl font-extrabold text-red-600">
                {formatMoney(data.refundAmount ?? null)}
              </span>
            </div>
            {hasPenalty && (
              <div className="mt-2 flex items-center justify-between border-t border-red-200 pt-2 text-sm text-red-600">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  위약금 ({data.penaltyRate}%)
                </span>
                <span className="font-semibold">- {formatMoney(data.penaltyAmount ?? null)}</span>
              </div>
            )}
          </div>

          {/* 환불 상세 */}
          <dl className="mt-4 divide-y divide-gray-100">
            {data.refundBasis && (
              <InfoRow icon={AlertTriangle} label="환불기준" value={data.refundBasis} />
            )}
            <InfoRow icon={Calendar} label="출발일" value={formatDate(data.departureDate)} />
            {data.daysBeforeDep != null && (
              <InfoRow
                icon={Calendar}
                label="출발 전 잔여일"
                value={`${data.daysBeforeDep}일 전`}
              />
            )}
            <InfoRow icon={Calendar} label="환불처리일" value={formatDate(data.cancelledAt)} />
            {data.companyAccount && (
              <InfoRow icon={Building2} label="환불계좌" value={data.companyAccount} />
            )}
          </dl>

          {data.note && (
            <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500">
              {data.note}
            </p>
          )}

          {/* 발급기관 + 직인 박스 */}
          <div className="mt-6 flex items-end justify-between border-t border-gray-100 pt-5">
            <div className="text-sm">
              <p className="font-semibold text-gray-800">발급기관</p>
              <p className="mt-0.5 flex items-center gap-1 text-gray-600">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                크루즈닷 (CRUISE.DOT)
              </p>
            </div>
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-red-200 text-red-600">
              <Stamp className="h-5 w-5" />
              <span className="mt-0.5 text-[10px] font-bold">직인</span>
              <span className="text-[10px] font-bold">CRUISE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 정보 행 (라벨 + 값) ─────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  strong,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="flex items-center gap-1.5 text-sm text-gray-500">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        {label}
      </dt>
      <dd className={`text-sm ${strong ? 'font-bold text-gray-900' : 'text-gray-800'}`}>{value}</dd>
    </div>
  );
}
