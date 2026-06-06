'use client';

import { useState } from 'react';
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

  const hasIssued = mode === 'purchase' ? !!purchaseData : !!refundData;

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ═══ 좌측: 검색 + 발급 영역 ══════════════════════════════════════ */}
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
          }}
        />

        {/* 선택된 판매 건 요약 */}
        {selectedSale && (
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
        )}

        <button
          type="button"
          onClick={handleIssue}
          disabled={!selectedSale || isIssuing}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cfg.issueBtn}`}
        >
          {isIssuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <cfg.Icon className="h-4 w-4" />}
          {isIssuing ? '발급 중...' : hasIssued ? '재발급' : '증서 발급'}
        </button>

        {hasIssued && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            새 증서 발급
          </button>
        )}
      </div>

      {/* ═══ 우측: 미리보기 (항상 표시) ════════════════════════════════════ */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">
          미리보기 {hasIssued ? '(발급 완료)' : '(발급 후 표시)'}
        </p>

        {!hasIssued ? (
          /* 발급 전 placeholder */
          <div
            ref={ref}
            className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center shadow-sm"
          >
            <cfg.Icon className="h-12 w-12 text-gray-200" />
            <p className="mt-3 text-sm font-medium text-gray-400">{cfg.placeholderText}</p>
            <p className="mt-1 text-xs text-gray-300">발급 후 증서 미리보기가 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mode === 'purchase' && purchaseData && (
              <PurchasePreview cardRef={ref} data={purchaseData} agent={agent} />
            )}
            {mode === 'refund' && refundData && (
              <RefundPreview cardRef={ref} data={refundData} agent={agent} />
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50 ${cfg.issueBtn}`}
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? '다운로드 중...' : 'PNG 다운로드'}
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
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  data: PurchaseData;
  agent: CurrentAgent;
}) {
  return (
    <div
      ref={cardRef}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-md"
    >
      <DocumentLetterhead title="구매확인증서" accentClass="border-emerald-100" />

      <div className="pt-5">
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          아래와 같이 정상적으로 구매·결제가 완료되었음을 확인합니다.
        </p>

        {/* 구매자 정보 */}
        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">구매자 정보</p>
          <dl className="divide-y divide-gray-100">
            <InfoRow icon={User} label="구매자명" value={data.buyerName || '-'} />
            <InfoRow icon={Phone} label="연락처" value={data.buyerTel || '-'} />
          </dl>
        </div>

        {/* 상품 및 결제 정보 */}
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-emerald-600">상품 · 결제 정보</p>
          <dl className="divide-y divide-emerald-100">
            <InfoRow icon={Package} label="상품명" value={data.productName || '-'} strong />
            <InfoRow icon={CreditCard} label="결제금액" value={formatMoney(data.amount ?? null)} strong />
            <InfoRow icon={Calendar} label="결제일" value={formatDate(data.paidAt)} />
            <InfoRow icon={CreditCard} label="결제방법" value={data.paymentMethod || '-'} />
          </dl>
        </div>

        {/* 취소·환불 정책 */}
        <div className="mb-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">
            <ShieldCheck className="h-3.5 w-3.5" />취소·환불 규정
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-orange-200">
                <th className="pb-1 text-left font-medium text-orange-600">취소 시점</th>
                <th className="pb-1 text-right font-medium text-orange-600">위약금</th>
              </tr>
            </thead>
            <tbody>
              {CANCELLATION_POLICY.map((p) => (
                <tr key={p.label} className="border-b border-orange-100 last:border-0">
                  <td className="py-1 text-gray-600">{p.label}</td>
                  <td className="py-1 text-right font-semibold text-gray-700">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-gray-400">
            ※ 관광진흥법 시행령 기준 적용. 출발 당일 취소 시 여행 요금의 50% 위약금 발생.
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
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-md"
    >
      <DocumentLetterhead title={title} accentClass="border-red-100" />

      <div className="pt-5">
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          {data.isRefundPending
            ? '아래와 같이 환불이 예정되어 있음을 확인합니다.'
            : '아래와 같이 환불이 정상적으로 처리·완료되었음을 확인합니다.'}
        </p>

        {/* 상품 내역 */}
        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">상품 내역</p>
          <dl className="divide-y divide-gray-100">
            <InfoRow icon={User} label="구매자명" value={data.buyerName || '-'} />
            <InfoRow icon={Package} label="상품명" value={data.productName || '-'} strong />
            <InfoRow icon={CreditCard} label="원결제금액" value={formatMoney(data.amount ?? null)} />
            <InfoRow icon={Calendar} label="결제일" value={formatDate(data.paidAt)} />
          </dl>
        </div>

        {/* 환불금액 강조 */}
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-red-700">환불금액</span>
            <span className="text-2xl font-extrabold text-red-600">{formatMoney(data.refundAmount ?? null)}</span>
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
        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">환불 상세</p>
          <dl className="divide-y divide-gray-100">
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
          <p className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500">{data.note}</p>
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
