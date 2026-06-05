'use client';

// ─────────────────────────────────────────────────────────────────────────────
// 서류관리 > 계약서 관리 탭
// - 계약서 샘플양식 미리보기 (실제 발송될 양식)
// - 구매자 자동완성 검색(CustomerAutocomplete) → 클릭 시 미리보기 자동 반영
// - 복수선택(체크박스 + 칩) 가능
// - 선택된 각 orderId 에 대해 개별(순차) 계약서 발급
// ※ 특약사항(specialTerms)은 사용자 요구로 표시/전송하지 않음
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Loader2,
  ExternalLink,
  Send,
  X,
  User,
  Package,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import {
  type SaleResult,
  type SalesDocumentItem,
  formatMoney,
  formatDate,
  CustomerAutocomplete,
  ModalShell,
  useCurrentAgent,
  DocumentLetterhead,
  DocumentSeal,
} from './shared';

// ─── 표준 취소·환불 규정 (계약서 양식 표시용 — API generatedData.cancellationPolicy 와 동일 기준) ──
const CANCELLATION_POLICY: { label: string; value: string }[] = [
  { label: '출발 30일 이전', value: '위약금 없음' },
  { label: '출발 20일 이전', value: '여행 요금의 10%' },
  { label: '출발 10일 이전', value: '여행 요금의 15%' },
  { label: '출발 8일 이전', value: '여행 요금의 20%' },
  { label: '출발 1일 이전', value: '여행 요금의 30%' },
  { label: '출발 당일', value: '여행 요금의 50%' },
];

// ─── 상태 필터 옵션 ──────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'DRAFT' | 'SENT' | 'SIGNED' | 'COMPLETED';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'DRAFT', label: '미발송' },
  { key: 'SENT', label: '발송됨' },
  { key: 'SIGNED', label: '서명완료' },
  { key: 'COMPLETED', label: '완료' },
];

// ─── 선택된 구매자(발급 대상) 타입 ──────────────────────────────────────────
type SelectedBuyer = {
  orderId: string;
  buyerName: string;
  buyerTel: string | null;
  productName: string | null;
  amount: number;
};

// generatedData 의 string 필드를 안전하게 추출
function gdStr(gd: Record<string, unknown>, key: string): string | null {
  const v = gd?.[key];
  return typeof v === 'string' ? v : null;
}

export default function ContractTab() {
  // ── 현재 담당자(대리점/판매원) 정보 — 직인 옆 담당자 연락처 표시용 ──
  const agent = useCurrentAgent();

  // ── 발급된 계약서 목록 ──
  const [documents, setDocuments] = useState<SalesDocumentItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── 계약서 보내기 모달 ──
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedBuyer[]>([]);
  const [previewBuyer, setPreviewBuyer] = useState<SelectedBuyer | null>(null);
  const [issuing, setIssuing] = useState(false);

  // ── 목록 조회 ───────────────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/documents/purchase-contract', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || '계약서 목록 조회 실패');
      setDocuments((json.documents || []) as SalesDocumentItem[]);
    } catch (e) {
      showError(e instanceof Error ? e.message : '계약서 목록을 불러오지 못했습니다.');
      setDocuments([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ── 상태 판정(목록 표시용) ────────────────────────────────────────────────
  const resolveStatus = (doc: SalesDocumentItem) => {
    const signStatus = gdStr(doc.generatedData, 'signStatus');
    const isComplete =
      doc.status === 'SIGNED' || doc.status === 'COMPLETED' || signStatus === 'SIGNED';
    const isSent =
      !isComplete &&
      (doc.status === 'SENT' ||
        doc.status === 'APPROVED' ||
        doc.status === 'PENDING_APPROVAL');
    if (isComplete) {
      return { key: 'COMPLETED' as const, icon: '✅', label: '완료', cls: 'bg-green-50 text-green-700 border-green-200' };
    }
    if (isSent) {
      return { key: 'SENT' as const, icon: '📤', label: '발송됨', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    return { key: 'DRAFT' as const, icon: '⏳', label: '미발송', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  };

  // ── 상태 필터 적용 ─────────────────────────────────────────────────────────
  const filtered = documents.filter((doc) => {
    if (statusFilter === 'all') return true;
    const st = resolveStatus(doc);
    if (statusFilter === 'SIGNED') return st.key === 'COMPLETED'; // SIGNED == 완료로 취급
    return st.key === statusFilter;
  });

  // ── 구매자 선택(자동완성 클릭) → 복수선택 토글 + 미리보기 반영 ──────────────
  const handlePickSale = (sale: SaleResult) => {
    if (!sale.orderId) {
      showError('주문번호가 없는 건은 계약서를 발급할 수 없습니다.');
      return;
    }
    const orderId = sale.orderId;
    const buyer: SelectedBuyer = {
      orderId,
      buyerName: sale.buyerName || '(이름없음)',
      buyerTel: sale.buyerTel || sale.customerPhone,
      productName: sale.productName,
      amount: sale.saleAmount,
    };
    setSelected((prev) => {
      if (prev.some((p) => p.orderId === orderId)) return prev; // 이미 선택됨
      return [...prev, buyer];
    });
    setPreviewBuyer(buyer); // 클릭한 구매자를 미리보기에 즉시 반영
  };

  const removeSelected = (orderId: string) => {
    setSelected((prev) => prev.filter((p) => p.orderId !== orderId));
    setPreviewBuyer((prev) => {
      if (prev?.orderId !== orderId) return prev;
      const rest = selected.filter((p) => p.orderId !== orderId);
      return rest.length > 0 ? rest[rest.length - 1] : null;
    });
  };

  // ── 일괄 발급 (선택된 각 orderId 에 대해 순차 POST) ──────────────────────────
  const handleBulkIssue = async () => {
    if (selected.length === 0) {
      showError('발급할 구매자를 1명 이상 선택해주세요.');
      return;
    }
    setIssuing(true);
    let success = 0;
    let conflict = 0;
    let failed = 0;

    // for...of + await 로 순차 처리 (각 건 개별 계약서)
    for (const buyer of selected) {
      try {
        const res = await fetch('/api/documents/purchase-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderId: buyer.orderId }), // specialTerms 전송 안 함
        });
        if (res.status === 409) {
          conflict += 1;
        } else if (res.ok) {
          const json = await res.json();
          if (json.ok) success += 1;
          else failed += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    setIssuing(false);

    // 집계 토스트
    const parts: string[] = [];
    if (success > 0) parts.push(`${success}건 발급`);
    if (conflict > 0) parts.push(`${conflict}건 중복`);
    if (failed > 0) parts.push(`${failed}건 실패`);
    const summary = parts.join(', ') || '처리된 건이 없습니다.';

    if (failed > 0 && success === 0) {
      showError(summary);
    } else {
      showSuccess(summary);
    }

    // 성공 또는 중복이 있으면 목록 새로고침 + 모달 정리
    if (success > 0 || conflict > 0) {
      setModalOpen(false);
      setSelected([]);
      setPreviewBuyer(null);
      await loadDocuments();
    }
  };

  const openModal = () => {
    setSelected([]);
    setPreviewBuyer(null);
    setModalOpen(true);
  };

  // ── 미리보기 표시용 값 (선택 전엔 플레이스홀더) ─────────────────────────────
  const pv = previewBuyer;

  return (
    <div>
      {/* ── 상단 액션 바 (계약서 보내기 + 상태 필터) ─────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          계약서 보내기
        </button>
      </div>

      {/* ── 발급된 계약서 목록 테이블 ───────────────────────────────────── */}
      {listLoading ? (
        <div className="flex items-center justify-center py-24 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          로드 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center text-gray-500">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p>
            {statusFilter === 'all'
              ? '아직 발급된 계약서가 없습니다.'
              : `해당 상태의 계약서가 없습니다.`}
          </p>
          <button
            onClick={openModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            계약서 보내기
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">고객명 / 주문번호</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">상품명</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">발급일</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">상태</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">계약서 보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((doc) => {
                const gd = doc.generatedData;
                const st = resolveStatus(doc);
                const driveFileId = gdStr(gd, 'driveFileId');
                const signToken = gdStr(gd, 'signToken');
                const buyerName = gdStr(gd, 'buyerName');
                const productName = gdStr(gd, 'productName');

                return (
                  <tr key={doc.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      <div className="flex flex-col gap-0.5">
                        {buyerName ? (
                          <span className="font-medium text-gray-800">{buyerName}</span>
                        ) : doc.contact?.name ? (
                          <span className="font-medium text-gray-800">{doc.contact.name}</span>
                        ) : (
                          <span className="italic text-gray-400">미지정</span>
                        )}
                        {doc.orderId && (
                          <span className="text-xs text-gray-400">{doc.orderId}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {productName ?? <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}
                      >
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {driveFileId ? (
                        <a
                          href={`https://drive.google.com/file/d/${driveFileId}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-700"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          PDF 보기
                        </a>
                      ) : signToken ? (
                        <a
                          href={`/contract/sign/${doc.id}?token=${signToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          계약서 확인
                        </a>
                      ) : (
                        <button
                          disabled
                          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          PDF 없음
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 계약서 보내기 모달 (미리보기 + 자동완성 + 복수선택 + 일괄발급) ── */}
      {modalOpen && (
        <ModalShell
          title="계약서 보내기"
          maxWidth="max-w-4xl"
          locked={issuing}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button
                onClick={() => setModalOpen(false)}
                disabled={issuing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                닫기
              </button>
              <button
                onClick={handleBulkIssue}
                disabled={issuing || selected.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {issuing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {issuing ? '발급 중...' : `선택 ${selected.length}명 일괄 발급`}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ── 좌측: 구매자 검색 + 복수선택 칩 ── */}
            <div className="space-y-4">
              <CustomerAutocomplete
                label="구매자 검색 (이름·주문번호·전화번호)"
                placeholder="이름을 입력하면 결제건이 검색됩니다"
                accent="orange"
                onlyPurchasable
                onSelect={handlePickSale}
              />

              {/* 선택된 구매자 칩 목록 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    선택된 구매자 ({selected.length}명)
                  </span>
                  {selected.length > 0 && (
                    <button
                      onClick={() => {
                        setSelected([]);
                        setPreviewBuyer(null);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      전체 해제
                    </button>
                  )}
                </div>
                {selected.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
                    검색 후 구매자를 클릭하면 여기에 추가됩니다.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selected.map((b) => (
                      <button
                        key={b.orderId}
                        type="button"
                        onClick={() => setPreviewBuyer(b)}
                        className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          previewBuyer?.orderId === b.orderId
                            ? 'border-orange-400 bg-orange-100 text-orange-800'
                            : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        }`}
                      >
                        <User className="h-3 w-3" />
                        <span>{b.buyerName}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelected(b.orderId);
                          }}
                          className="ml-0.5 rounded-full p-0.5 text-orange-400 hover:bg-orange-200 hover:text-orange-700"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {selected.length > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-orange-400" />
                    칩을 클릭하면 해당 구매자의 계약서 미리보기로 전환됩니다.
                  </p>
                )}
              </div>
            </div>

            {/* ── 우측: 계약서 샘플양식 미리보기 ── */}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                계약서 미리보기 (실제 발송 양식)
              </span>
              <div className="rounded-xl border border-gray-200 bg-white p-5 text-[13px] leading-relaxed text-gray-800 shadow-sm">
                {/* 가운데 상단: 회사 로고 + 제목 + 발행일 */}
                <DocumentLetterhead title="구매 계약서" accentClass="border-orange-100" />

                {/* 계약 당사자 */}
                <SectionTitle icon={<User className="h-3.5 w-3.5" />}>계약 당사자</SectionTitle>
                <PreviewRow label="구매자명" value={pv?.buyerName} />
                <PreviewRow label="연락처" value={pv?.buyerTel} />

                {/* 상품 정보 */}
                <SectionTitle icon={<Package className="h-3.5 w-3.5" />}>상품 정보</SectionTitle>
                <PreviewRow label="상품명" value={pv?.productName} />
                <PreviewRow label="출발일" value={null} placeholder="결제 정보 기준 자동 반영" />

                {/* 계약 금액 / 결제 */}
                <SectionTitle icon={<Calendar className="h-3.5 w-3.5" />}>계약 금액</SectionTitle>
                <PreviewRow
                  label="계약금액"
                  value={pv ? formatMoney(pv.amount) : null}
                />
                <PreviewRow label="결제방법" value={null} placeholder="결제 PG / 계좌이체 자동 표기" />

                {/* 취소·환불 규정 */}
                <SectionTitle icon={<FileText className="h-3.5 w-3.5" />}>취소·환불 규정</SectionTitle>
                <ul className="mb-3 space-y-1 rounded-lg bg-orange-50 px-3 py-2.5 text-xs text-gray-700">
                  {CANCELLATION_POLICY.map((p) => (
                    <li key={p.label} className="flex justify-between gap-2">
                      <span className="text-gray-500">{p.label}</span>
                      <span className="font-medium text-gray-800">{p.value}</span>
                    </li>
                  ))}
                </ul>

                {!pv && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-400">
                    좌측에서 구매자를 선택하면 계약 당사자·상품·금액이 자동 반영됩니다.
                  </p>
                )}

                {/* 양식 하단: 좌하단 직인 + 회사명/대표 + 우측 담당자 연락처 (유효기간 없음) */}
                <DocumentSeal agent={agent} />
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ─── 미리보기 보조 컴포넌트 ─────────────────────────────────────────────────

function SectionTitle({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-1.5 border-b border-gray-100 pb-1 text-xs font-semibold text-orange-700 first:mt-0">
      {icon}
      {children}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  placeholder,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-[13px]">
      <span className="shrink-0 text-gray-500">{label}</span>
      {value ? (
        <span className="text-right font-medium text-gray-800">{value}</span>
      ) : (
        <span className="text-right text-gray-300">{placeholder ?? '미선택'}</span>
      )}
    </div>
  );
}
