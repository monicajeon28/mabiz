'use client';

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
  CheckCircle2,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { CANCELLATION_POLICY, COMPANY_INFO } from '@/lib/company-info';
import {
  type SaleResult,
  type SalesDocumentItem,
  type CurrentAgent,
  formatMoney,
  formatDate,
  todayKo,
  CustomerAutocomplete,
  ModalShell,
  useCurrentAgent,
  DocumentLetterhead,
  DocumentSeal,
  COMPANY,
} from './shared';

type StatusFilter = 'all' | 'DRAFT' | 'SENT' | 'SIGNED' | 'COMPLETED';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'DRAFT', label: '미발송' },
  { key: 'SENT', label: '발송됨' },
  { key: 'SIGNED', label: '서명완료' },
  { key: 'COMPLETED', label: '완료' },
];

type SelectedBuyer = {
  orderId: string;
  buyerName: string;
  buyerTel: string | null;
  productName: string | null;
  amount: number;
};

// generatedData 안전 추출 헬퍼
function gdStr(gd: Record<string, unknown>, key: string): string | null {
  const v = gd?.[key];
  return typeof v === 'string' ? v : null;
}
function gdNum(gd: Record<string, unknown>, key: string): number | null {
  const v = gd?.[key];
  return typeof v === 'number' ? v : null;
}
function gdArr(gd: Record<string, unknown>, key: string): string[] {
  const v = gd?.[key];
  return Array.isArray(v) ? (v as string[]) : [];
}

// 계약서 미리보기에 사용할 데이터 타입
type ContractPreviewData = {
  buyerName?: string | null;
  buyerTel?: string | null;
  productName?: string | null;
  amount?: number | null;
  departureDate?: string | null;
  includedItems?: string[];
  excludedItems?: string[];
  hasGuide?: 'Y' | 'N' | '';
};

export default function ContractTab() {
  const agent = useCurrentAgent();
  const [documents, setDocuments] = useState<SalesDocumentItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedBuyer[]>([]);
  const [previewBuyer, setPreviewBuyer] = useState<SelectedBuyer | null>(null);
  const [issuing, setIssuing] = useState(false);

  // 우측 항상 표시 미리보기용: 목록 행 클릭 시 업데이트
  const [previewData, setPreviewData] = useState<ContractPreviewData>({});

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

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const resolveStatus = (doc: SalesDocumentItem) => {
    const signStatus = gdStr(doc.generatedData, 'signStatus');
    const isComplete = doc.status === 'SIGNED' || doc.status === 'COMPLETED' || signStatus === 'SIGNED';
    const isSent = !isComplete && (doc.status === 'SENT' || doc.status === 'APPROVED' || doc.status === 'PENDING_APPROVAL');
    if (isComplete) return { key: 'COMPLETED' as const, icon: '✅', label: '완료', cls: 'bg-green-50 text-green-700 border-green-200' };
    if (isSent) return { key: 'SENT' as const, icon: '📤', label: '발송됨', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    return { key: 'DRAFT' as const, icon: '⏳', label: '미발송', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  };

  const filtered = documents.filter((doc) => {
    if (statusFilter === 'all') return true;
    const st = resolveStatus(doc);
    if (statusFilter === 'SIGNED') return st.key === 'COMPLETED';
    return st.key === statusFilter;
  });

  const handlePickSale = (sale: SaleResult) => {
    if (!sale.orderId) { showError('주문번호가 없는 건은 계약서를 발급할 수 없습니다.'); return; }
    const buyer: SelectedBuyer = {
      orderId: sale.orderId,
      buyerName: sale.buyerName || '(이름없음)',
      buyerTel: sale.buyerTel || sale.customerPhone,
      productName: sale.productName,
      amount: sale.saleAmount,
    };
    setSelected((prev) => prev.some((p) => p.orderId === sale.orderId) ? prev : [...prev, buyer]);
    setPreviewBuyer(buyer);
    // 모달 밖 우측 미리보기도 업데이트
    setPreviewData({ buyerName: buyer.buyerName, buyerTel: buyer.buyerTel, productName: buyer.productName, amount: buyer.amount });
  };

  const removeSelected = (orderId: string) => {
    setSelected((prev) => prev.filter((p) => p.orderId !== orderId));
    setPreviewBuyer((prev) => (prev?.orderId === orderId ? null : prev));
  };

  const handleBulkIssue = async () => {
    if (selected.length === 0) { showError('발급할 구매자를 1명 이상 선택해주세요.'); return; }
    setIssuing(true);
    let success = 0; let conflict = 0; let failed = 0;
    for (const buyer of selected) {
      try {
        const res = await fetch('/api/documents/purchase-contract', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ orderId: buyer.orderId }),
        });
        if (res.status === 409) conflict += 1;
        else if (res.ok) { const json = await res.json(); if (json.ok) success += 1; else failed += 1; }
        else failed += 1;
      } catch { failed += 1; }
    }
    setIssuing(false);
    const parts: string[] = [];
    if (success > 0) parts.push(`${success}건 발급`);
    if (conflict > 0) parts.push(`${conflict}건 중복`);
    if (failed > 0) parts.push(`${failed}건 실패`);
    const summary = parts.join(', ') || '처리된 건이 없습니다.';
    if (failed > 0 && success === 0) showError(summary);
    else showSuccess(summary);
    if (success > 0 || conflict > 0) {
      setModalOpen(false); setSelected([]); setPreviewBuyer(null);
      await loadDocuments();
    }
  };

  // 목록 행 클릭 → 우측 미리보기 업데이트
  const handleRowClick = (doc: SalesDocumentItem) => {
    const gd = doc.generatedData;
    const inc = gdArr(gd, 'includedItems');
    const exc = gdArr(gd, 'excludedItems');
    const hg = gdStr(gd, 'hasGuide') as 'Y' | 'N' | '' | null;
    setPreviewData({
      buyerName: gdStr(gd, 'buyerName') ?? doc.contact?.name,
      buyerTel: gdStr(gd, 'buyerTel') ?? doc.contact?.phone,
      productName: gdStr(gd, 'productName'),
      amount: gdNum(gd, 'amount'),
      departureDate: gdStr(gd, 'departureDate'),
      includedItems: inc.length > 0 ? inc : undefined,
      excludedItems: exc.length > 0 ? exc : undefined,
      hasGuide: hg ?? '',
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* ═══ 좌측: 필터 + 목록 (3 cols) ══════════════════════════════════ */}
      <div className="lg:col-span-3">
        {/* 상단 액션 바 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === f.key ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => { setSelected([]); setPreviewBuyer(null); setModalOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            <Plus className="h-4 w-4" />계약서 보내기
          </button>
        </div>

        {/* 계약서 목록 */}
        {listLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />로드 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p>{statusFilter === 'all' ? '아직 발급된 계약서가 없습니다.' : '해당 상태의 계약서가 없습니다.'}</p>
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">보기</th>
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
                    <tr key={doc.id} onClick={() => handleRowClick(doc)}
                      className="cursor-pointer transition-colors hover:bg-orange-50">
                      <td className="px-4 py-3 text-gray-900">
                        <div className="flex flex-col gap-0.5">
                          {buyerName ? <span className="font-medium">{buyerName}</span>
                            : doc.contact?.name ? <span className="font-medium">{doc.contact.name}</span>
                            : <span className="italic text-gray-400">미지정</span>}
                          {doc.orderId && <span className="text-xs text-gray-400">{doc.orderId}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{productName ?? <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(doc.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {driveFileId ? (
                          <a href={`https://drive.google.com/file/d/${driveFileId}/view`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700">
                            <ExternalLink className="h-3.5 w-3.5" />PDF
                          </a>
                        ) : signToken ? (
                          <a href={`/contract/sign/${doc.id}?token=${signToken}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700">
                            <ExternalLink className="h-3.5 w-3.5" />확인
                          </a>
                        ) : (
                          <button disabled className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400">
                            <FileText className="h-3.5 w-3.5" />없음
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
        <p className="mt-2 text-xs text-gray-400">목록 행을 클릭하면 오른쪽 미리보기가 업데이트됩니다.</p>
      </div>

      {/* ═══ 우측: 항상 표시 계약서 미리보기 (2 cols) ══════════════════════ */}
      <div className="lg:col-span-2">
        <p className="mb-2 text-sm font-semibold text-gray-700">계약서 미리보기</p>
        <FullContractPreview data={previewData} agent={agent} />
      </div>

      {/* ═══ 계약서 보내기 모달 ════════════════════════════════════════════ */}
      {modalOpen && (
        <ModalShell
          title="계약서 보내기"
          maxWidth="max-w-3xl"
          locked={issuing}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button onClick={() => setModalOpen(false)} disabled={issuing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                닫기
              </button>
              <button onClick={handleBulkIssue} disabled={issuing || selected.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40">
                {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {issuing ? '발급 중...' : `선택 ${selected.length}명 일괄 발급`}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <CustomerAutocomplete
              label="구매자 검색 (이름·주문번호·전화번호)"
              placeholder="이름을 입력하면 결제건이 검색됩니다"
              accent="orange"
              onlyPurchasable
              onSelect={handlePickSale}
            />
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">선택된 구매자 ({selected.length}명)</span>
                {selected.length > 0 && (
                  <button onClick={() => { setSelected([]); setPreviewBuyer(null); }} className="text-xs text-gray-400 hover:text-gray-600">
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
                    <button key={b.orderId} type="button" onClick={() => setPreviewBuyer(b)}
                      className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${previewBuyer?.orderId === b.orderId ? 'border-orange-400 bg-orange-100 text-orange-800' : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
                      <User className="h-3 w-3" />
                      <span>{b.buyerName}</span>
                      <span role="button" tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); removeSelected(b.orderId); }}
                        className="ml-0.5 rounded-full p-0.5 text-orange-400 hover:bg-orange-200">
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

            {/* 모달 내 소형 미리보기 */}
            {previewBuyer && (
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold text-orange-700">선택된 구매자 계약서</p>
                <div className="flex flex-wrap gap-4 text-gray-700">
                  <span><span className="text-gray-400">구매자:</span> {previewBuyer.buyerName}</span>
                  {previewBuyer.productName && <span><span className="text-gray-400">상품:</span> {previewBuyer.productName}</span>}
                  <span><span className="text-gray-400">금액:</span> {formatMoney(previewBuyer.amount)}</span>
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 전체 가능 포함/불포함 항목 목록 (체크박스 렌더링용)
// ─────────────────────────────────────────────────────────────────────────────
const ALL_INCLUDE_ITEMS = [
  '선박/항공기 운임', '숙박/식사료', '안내자경비', '항만세·관광기금',
  '제세금', '여행알선수수료', '관광지 입장료', '유류할증료', '여행보험료',
  '항공기 추가 운임',
];
const ALL_EXCLUDE_ITEMS = [
  '선상팁', '쇼핑비', '선택관광',
  '일본 관광 입국세', '여권·비자 개인 부담', '여권발급비', '비자발급비',
];

function CheckBox({ checked }: { checked: boolean }) {
  return checked
    ? <span className="inline-flex h-3 w-3 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-white text-[8px] font-bold">✓</span>
    : <span className="inline-block h-3 w-3 rounded border border-gray-300 bg-white" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 크루즈닷 여행계약서 전체 미리보기
// ─────────────────────────────────────────────────────────────────────────────

function FullContractPreview({
  data,
  agent,
}: {
  data: ContractPreviewData;
  agent: CurrentAgent;
}) {
  const hasData = !!(data.buyerName || data.productName);

  // 체크 상태: generatedData에서 가져온 배열이 있으면 그것 기준, 없으면 기본값
  const checkedIncludes = data.includedItems ?? [];
  const checkedExcludes = data.excludedItems ?? [];
  const guideRow = data.hasGuide === 'Y' ? '■ 있음  □ 없음' : data.hasGuide === 'N' ? '□ 있음  ■ 없음' : '□ 있음  □ 없음';

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto rounded-xl border border-gray-200 bg-white text-[12px] leading-relaxed text-gray-800 shadow-sm">
      <div className="p-5 space-y-4">
        {/* 헤더 */}
        <DocumentLetterhead title="크루즈닷 여행계약서" accentClass="border-orange-100" />

        {/* 계약 유형 */}
        <div className="flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-2 text-xs">
          <span className="font-medium text-gray-600">계약 구분:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="inline-block h-3.5 w-3.5 rounded border border-gray-400 bg-white" />
            기획여행
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="inline-block h-3.5 w-3.5 rounded border border-gray-400 bg-white" />
            희망여행
          </label>
        </div>

        {/* 계약 기본 정보 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">계약 정보</p>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {[
                ['상품명', data.productName || <span className="italic text-gray-300">여행일정표 참조</span>],
                ['여행기간', data.departureDate ? `${data.departureDate} ~ (출발일 기준)` : <span className="italic text-gray-300">여행일정표 참조</span>],
                ['여행보증', '□ 공제  □ 예치금  □ 영업보증보험'],
                ['여행자보험', '□ 가입  □ 미가입 / 보험회사: ___'],
                ['행사인원', '최저 ___ 명 / 최대 ___ 명'],
                ['여행요금', data.amount ? `1인당 ${formatMoney(data.amount)} (총액: ___)` : '1인당 ___ 원  /  총액 ___ 원'],
                ['교통수단', '□ 항공기  □ 선박  □ 기차  선박명: ___'],
                ['숙박', '□ 일정표 표시  □ 관광호텔 (___ 등급)  □ 기타'],
                ['식사', '□ 일정표 표시  /  조식 _회, 중식 _회, 석식 _회'],
                ['여행 인솔자', guideRow],
                ['현지 안내원', '□ 있음  □ 없음  *여행일정표 참조'],
                ['현지 교통', '□ 버스  □ 승용차  □ 기타  □ 없음'],
                ['현지 여행사', '□ 있음  □ 없음  *여행일정표 참조'],
              ].map(([label, value], i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="w-28 bg-gray-50 px-3 py-2 font-medium text-gray-600 align-top">{label}</td>
                  <td className="px-3 py-2 text-gray-700">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 여행요금 포함내역 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">여행요금 포함/불포함 내역</p>
          <div className="grid grid-cols-2 gap-3">
            {/* 포함 */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="mb-1.5 text-[11px] font-semibold text-emerald-700">▸ 포함 항목</p>
              <div className="space-y-1">
                {ALL_INCLUDE_ITEMS.map((item) => (
                  <label key={item} className="flex items-center gap-1.5 text-[11px]">
                    <CheckBox checked={checkedIncludes.includes(item)} />
                    <span className={checkedIncludes.length > 0 && !checkedIncludes.includes(item) ? 'text-gray-300 line-through' : ''}>{item}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* 불포함 */}
            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="mb-1.5 text-[11px] font-semibold text-red-700">▸ 불포함 항목</p>
              <div className="space-y-1">
                {ALL_EXCLUDE_ITEMS.map((item) => (
                  <label key={item} className="flex items-center gap-1.5 text-[11px]">
                    <CheckBox checked={checkedExcludes.includes(item)} />
                    <span className={checkedExcludes.length > 0 && !checkedExcludes.includes(item) ? 'text-gray-300 line-through' : ''}>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 서명란 */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-orange-700">약관 교부 및 서명</p>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600 leading-5">
            여행자( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )은 담당자( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )으로부터 크루즈여행계약서, 국외여행표준약관,
            크루즈여행특별약관 및 여행일정표를 교부받았으며, 주요사항에 대한 충분한 설명을 들었습니다.
          </div>
          <div className="mt-3 flex justify-between gap-4">
            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-[11px]">
              <p className="text-gray-500">여행자</p>
              <p className="mt-3 font-medium text-gray-700">{data.buyerName || '___________'}</p>
              <p className="mt-2 text-gray-400">(인 / 서명)</p>
            </div>
            <div className="flex-1 rounded-lg border border-orange-100 bg-orange-50 px-3 py-4 text-center text-[11px]">
              <p className="text-gray-500">여행업자</p>
              <p className="mt-1 font-bold text-orange-700">{COMPANY.name}</p>
              <p className="text-gray-500">대표 {COMPANY_INFO.ceo}</p>
              <p className="mt-1 text-gray-400">(인 / 서명)</p>
            </div>
          </div>
        </div>

        {/* 취소·환불 규정 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">취소·환불 규정</p>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-orange-50">
                <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold text-orange-700">취소 시점</th>
                <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-orange-700">위약금</th>
              </tr>
            </thead>
            <tbody>
              {CANCELLATION_POLICY.map((p) => (
                <tr key={p.label} className="border-b border-gray-100">
                  <td className="border border-gray-200 px-3 py-1.5 text-gray-600">{p.label}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-right font-medium text-gray-700">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 국외여행표준약관 요약 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">국외여행표준약관 (요약)</p>
          <div className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">
            <p><span className="font-semibold">제1조 (목적)</span> 이 약관은 {COMPANY.name}(이하 '당사')와 여행자가 체결한 국외여행계약의 세부 이행 및 준수사항을 정함을 목적으로 합니다.</p>
            <p><span className="font-semibold">제2조 (의무)</span> ① 당사는 안전하고 만족스러운 여행서비스를 제공하기 위해 맡은 바 임무를 충실히 수행합니다. ② 여행자는 여행 질서 유지에 협조합니다.</p>
            <p><span className="font-semibold">제4조 (계약 구성)</span> 여행계약은 여행계약서·여행약관·여행일정표를 계약내용으로 합니다.</p>
            <p><span className="font-semibold">제8조 (책임)</span> 당사는 여행 출발 시부터 여행 종료 시까지 여행자에게 발생한 손해에 대해 배상책임을 집니다.</p>
            <p><span className="font-semibold">제12조 (최저행사인원)</span> 최저행사인원 미달 시 여행출발 7일 전까지 여행자에게 통보합니다.</p>
            <p><span className="font-semibold">제15조 (취소)</span> 여행자 사정으로 계약 해제 시, 약관에 따른 위약금이 발생합니다.</p>
            <p><span className="font-semibold">제18조 (분쟁 해결)</span> 본 계약과 관련한 분쟁은 관광불편신고처리위원회(☎1588-8692) 또는 소재지 도청 문화관광과에 중재 신청 가능합니다.</p>
          </div>
        </div>

        {/* 여행업자 정보 */}
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-[11px]">
          <p className="mb-1 font-bold text-orange-700">여행업자 정보</p>
          <div className="grid grid-cols-2 gap-1 text-gray-600">
            <span>상호: {COMPANY.name}</span>
            <span>대표: {COMPANY_INFO.ceo}</span>
            <span>전화: {COMPANY_INFO.hqPhone}</span>
            <span>담당자: {agent.displayName || '___'} {agent.phone || ''}</span>
          </div>
        </div>

        {!hasData && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">
            목록에서 행을 클릭하거나 &apos;계약서 보내기&apos;에서 구매자를 선택하면 정보가 자동 반영됩니다.
          </div>
        )}

        {/* 발행일 / 직인 */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-center text-[11px] text-gray-500">{todayKo()} 발행</p>
        </div>
        <DocumentSeal agent={agent} />
      </div>
    </div>
  );
}
