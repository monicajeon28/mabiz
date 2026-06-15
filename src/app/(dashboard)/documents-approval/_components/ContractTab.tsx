'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Loader2,
  ExternalLink,
  Send,
  X,
  Search,
  CheckCircle2,
  RefreshCcw,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { CANCELLATION_POLICY, CRUISE_CANCELLATION_POLICY, COMPANY_INFO } from '@/lib/company-info';
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

/* ────────────────── Status filter ────────────────── */
type StatusFilter = 'all' | 'DRAFT' | 'SENT' | 'SIGNED' | 'COMPLETED';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'DRAFT', label: '미발송' },
  { key: 'SENT', label: '발송됨' },
  { key: 'SIGNED', label: '서명완료' },
  { key: 'COMPLETED', label: '완료' },
];

/* ────────────────── Companion types ────────────────── */
type CompanionRelation = '배우자' | '자녀' | '부모' | '형제자매' | '친구' | '기타';
type Companion = {
  id: string;
  name: string;
  birthDate: string;
  relation: CompanionRelation;
  phone: string;
  pnr?: string;
};
const COMPANION_RELATIONS: CompanionRelation[] = ['배우자', '자녀', '부모', '형제자매', '친구', '기타'];

/* ────────────────── Form data type ────────────────── */
type ContractFormData = {
  orderId: string;
  buyerName: string;
  buyerTel: string;
  productName: string;
  departureDate: string;
  nights: number | null;
  amount: number | null;
  includedItems: string[];
  excludedItems: string[];
  hasGuide: 'Y' | 'N';
  refundPolicy: { label: string; value: string }[];
  specialTerms: string;
  companions: Companion[];
  // 새로 추가 필드
  contractType: '기획여행' | '희망여행';
  travelGuarantee: ('공제' | '예치금' | '영업보증보험')[];
  hasInsurance: boolean;
  insuranceCompany: string;
  minPax: number | null;
  maxPax: number | null;
  pricePerPerson: number | null;
  transportTypes: ('항공기' | '선박' | '기차')[];
  shipName: string;
  accommodationTypes: ('일정표표시' | '관광호텔' | '기타')[];
  hotelGrade: string;
  mealDisplay: '일정표표시' | '개별';
  breakfast: number | null;
  lunch: number | null;
  dinner: number | null;
  localGuide: '있음' | '없음';
  localTransport: ('버스' | '승용차' | '기타' | '없음')[];
  localAgency: '있음' | '없음';
};

function getEmptyForm(): ContractFormData {
  return {
    orderId: '',
    buyerName: '',
    buyerTel: '',
    productName: '',
    departureDate: '',
    nights: null,
    amount: null,
    includedItems: [
      '선박/항공기 운임', '숙박/식사료', '항만세·관광기금',
      '제세금', '여행알선수수료', '유류할증료', '관광지 입장료', '여행보험료',
    ],
    excludedItems: ['선상팁', '쇼핑비', '선택관광'],
    hasGuide: 'Y',
    refundPolicy: CRUISE_CANCELLATION_POLICY.map((p) => ({ ...p })),
    specialTerms: '',
    companions: [],
    contractType: '기획여행',
    travelGuarantee: [],
    hasInsurance: false,
    insuranceCompany: '',
    minPax: null,
    maxPax: null,
    pricePerPerson: null,
    transportTypes: ['선박'],
    shipName: '',
    accommodationTypes: ['일정표표시'],
    hotelGrade: '',
    mealDisplay: '일정표표시',
    breakfast: null,
    lunch: null,
    dinner: null,
    localGuide: '없음',
    localTransport: ['버스'],
    localAgency: '없음',
  };
}

/* ────────────────── Preview data type ────────────────── */
type ContractPreviewData = {
  buyerName?: string | null;
  buyerTel?: string | null;
  productName?: string | null;
  amount?: number | null;
  departureDate?: string | null;
  includedItems?: string[];
  excludedItems?: string[];
  hasGuide?: 'Y' | 'N' | '';
  refundPolicy?: { label: string; value: string }[];
  specialTerms?: string | null;
  companions?: Companion[];
  // 새로 추가 필드 (optional)
  contractType?: '기획여행' | '희망여행';
  travelGuarantee?: ('공제' | '예치금' | '영업보증보험')[];
  hasInsurance?: boolean;
  insuranceCompany?: string;
  minPax?: number | null;
  maxPax?: number | null;
  pricePerPerson?: number | null;
  transportTypes?: ('항공기' | '선박' | '기차')[];
  shipName?: string;
  accommodationTypes?: ('일정표표시' | '관광호텔' | '기타')[];
  hotelGrade?: string;
  mealDisplay?: '일정표표시' | '개별';
  breakfast?: number | null;
  lunch?: number | null;
  dinner?: number | null;
  localGuide?: '있음' | '없음';
  localTransport?: ('버스' | '승용차' | '기타' | '없음')[];
  localAgency?: '있음' | '없음';
};

/* ────────────────── generatedData helpers ────────────────── */
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
function gdRefundPolicy(gd: Record<string, unknown>): { label: string; value: string }[] | undefined {
  const v = gd?.refundPolicy;
  if (!Array.isArray(v)) return undefined;
  return v as { label: string; value: string }[];
}

/* ────────────────── form → preview adapter ────────────────── */
function formToPreview(f: ContractFormData): ContractPreviewData {
  return {
    buyerName: f.buyerName || null,
    buyerTel: f.buyerTel || null,
    productName: f.productName || null,
    amount: f.amount,
    departureDate: f.departureDate || null,
    includedItems: f.includedItems,
    excludedItems: f.excludedItems,
    hasGuide: f.hasGuide,
    refundPolicy: f.refundPolicy,
    specialTerms: f.specialTerms || null,
    companions: f.companions,
    contractType: f.contractType,
    travelGuarantee: f.travelGuarantee,
    hasInsurance: f.hasInsurance,
    insuranceCompany: f.insuranceCompany,
    minPax: f.minPax,
    maxPax: f.maxPax,
    pricePerPerson: f.pricePerPerson,
    transportTypes: f.transportTypes,
    shipName: f.shipName,
    accommodationTypes: f.accommodationTypes,
    hotelGrade: f.hotelGrade,
    mealDisplay: f.mealDisplay,
    breakfast: f.breakfast,
    lunch: f.lunch,
    dinner: f.dinner,
    localGuide: f.localGuide,
    localTransport: f.localTransport,
    localAgency: f.localAgency,
  };
}

/* ═══════════════════════════════════════════════════════════
   ContractTab (main export)
════════════════════════════════════════════════════════════ */
export default function ContractTab() {
  const agent = useCurrentAgent();
  const [documents, setDocuments] = useState<SalesDocumentItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);

  // 우측 항상 표시 미리보기 (목록 행 클릭 시 업데이트)
  const [previewData, setPreviewData] = useState<ContractPreviewData>({});

  // 모달 폼 상태
  const [form, setForm] = useState<ContractFormData>(getEmptyForm);
  const [productCode, setProductCode] = useState('');
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [addingCompanion, setAddingCompanion] = useState(false);
  const [companionDraft, setCompanionDraft] = useState<Omit<Companion, 'id'>>({
    name: '', birthDate: '', relation: '배우자', phone: '', pnr: '',
  });

  /* ── document list ── */
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

  /* ── status display ── */
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

  /* ── 목록 행 클릭 → 우측 미리보기 ── */
  const handleRowClick = (doc: SalesDocumentItem) => {
    const gd = doc.generatedData;
    const inc = gdArr(gd, 'includedItems');
    const exc = gdArr(gd, 'excludedItems');
    const hg = gdStr(gd, 'hasGuide') as 'Y' | 'N' | '' | null;
    const rp = gdRefundPolicy(gd);
    const rawCompanions = gd.companions;
    const companions = Array.isArray(rawCompanions) ? (rawCompanions as Companion[]) : [];

    const rawContractType = gdStr(gd, 'contractType');
    const rawLocalGuide = gdStr(gd, 'localGuide');
    const rawLocalAgency = gdStr(gd, 'localAgency');
    const rawMealDisplay = gdStr(gd, 'mealDisplay');

    const rawTravelGuarantee = gd.travelGuarantee;
    const rawTransportTypes = gd.transportTypes;
    const rawAccommodationTypes = gd.accommodationTypes;
    const rawLocalTransport = gd.localTransport;

    setPreviewData({
      buyerName: gdStr(gd, 'buyerName') ?? doc.contact?.name,
      buyerTel: gdStr(gd, 'buyerTel') ?? doc.contact?.phone,
      productName: gdStr(gd, 'productName'),
      amount: gdNum(gd, 'amount'),
      departureDate: gdStr(gd, 'departureDate'),
      includedItems: inc.length > 0 ? inc : undefined,
      excludedItems: exc.length > 0 ? exc : undefined,
      hasGuide: hg ?? '',
      refundPolicy: rp,
      specialTerms: gdStr(gd, 'specialTerms'),
      companions: companions.length > 0 ? companions : undefined,
      contractType: (rawContractType === '기획여행' || rawContractType === '희망여행') ? rawContractType : undefined,
      travelGuarantee: Array.isArray(rawTravelGuarantee) ? (rawTravelGuarantee as ('공제' | '예치금' | '영업보증보험')[]) : undefined,
      hasInsurance: typeof gd.hasInsurance === 'boolean' ? (gd.hasInsurance as boolean) : undefined,
      insuranceCompany: gdStr(gd, 'insuranceCompany') ?? undefined,
      minPax: gdNum(gd, 'minPax'),
      maxPax: gdNum(gd, 'maxPax'),
      pricePerPerson: gdNum(gd, 'pricePerPerson'),
      transportTypes: Array.isArray(rawTransportTypes) ? (rawTransportTypes as ('항공기' | '선박' | '기차')[]) : undefined,
      shipName: gdStr(gd, 'shipName') ?? undefined,
      accommodationTypes: Array.isArray(rawAccommodationTypes) ? (rawAccommodationTypes as ('일정표표시' | '관광호텔' | '기타')[]) : undefined,
      hotelGrade: gdStr(gd, 'hotelGrade') ?? undefined,
      mealDisplay: (rawMealDisplay === '일정표표시' || rawMealDisplay === '개별') ? rawMealDisplay : undefined,
      breakfast: gdNum(gd, 'breakfast'),
      lunch: gdNum(gd, 'lunch'),
      dinner: gdNum(gd, 'dinner'),
      localGuide: (rawLocalGuide === '있음' || rawLocalGuide === '없음') ? rawLocalGuide : undefined,
      localTransport: Array.isArray(rawLocalTransport) ? (rawLocalTransport as ('버스' | '승용차' | '기타' | '없음')[]) : undefined,
      localAgency: (rawLocalAgency === '있음' || rawLocalAgency === '없음') ? rawLocalAgency : undefined,
    });
  };

  /* ── 모달: 고객 선택 ── */
  const handleCustomerSelect = (sale: SaleResult) => {
    if (!sale.orderId) { showError('주문번호가 없는 건은 계약서를 발급할 수 없습니다.'); return; }
    setForm((prev) => ({
      ...prev,
      orderId: sale.orderId as string,
      buyerName: sale.buyerName || prev.buyerName,
      buyerTel: sale.buyerTel || sale.customerPhone || prev.buyerTel,
      productName: sale.productName || prev.productName,
      amount: sale.saleAmount != null ? sale.saleAmount : prev.amount,
    }));
  };

  /* ── 모달: 상품 코드 조회 ── */
  const handleLoadProduct = async () => {
    if (loadingProduct) return;
    const code = productCode.trim().toUpperCase();
    if (!code) { showError('상품 코드를 입력해주세요.'); return; }
    setLoadingProduct(true);
    try {
      const res = await fetch(
        `/api/admin/affiliate/documents/product-info?productCode=${encodeURIComponent(code)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) { showError((json.error as string) || '상품 정보 조회 실패'); return; }
      const p = json.product as {
        productName?: string;
        startDate?: string;
        nights?: number;
        includedItems?: string[];
        excludedItems?: string[];
        hasGuide?: 'Y' | 'N';
        refundPolicy?: { label: string; value: string }[];
      };
      setForm((prev) => ({
        ...prev,
        productName: p.productName || prev.productName,
        departureDate: p.startDate ? (p.startDate as string).split('T')[0] : prev.departureDate,
        nights: p.nights ?? prev.nights,
        includedItems: p.includedItems ?? prev.includedItems,
        excludedItems: p.excludedItems ?? prev.excludedItems,
        hasGuide: p.hasGuide ?? prev.hasGuide,
        refundPolicy: Array.isArray(p.refundPolicy) ? p.refundPolicy : [...CRUISE_CANCELLATION_POLICY],
      }));
      showSuccess('상품 정보가 자동 반영되었습니다.');
    } catch (e) {
      showError(e instanceof Error ? e.message : '상품 정보 로드 실패');
    } finally {
      setLoadingProduct(false);
    }
  };

  /* ── 모달: 계약서 발급 ── */
  const handleIssue = async () => {
    if (!form.orderId) { showError('구매자를 검색하여 주문 건을 선택해주세요.'); return; }
    setIssuing(true);
    try {
      const res = await fetch('/api/documents/purchase-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: form.orderId,
          specialTerms: form.specialTerms || undefined,
          overrideProductName: form.productName || undefined,
          overrideDepartureDate: form.departureDate || undefined,
          overrideNights: form.nights ?? undefined,
          overrideIncludedItems: form.includedItems.length > 0 ? form.includedItems : undefined,
          overrideExcludedItems: form.excludedItems.length > 0 ? form.excludedItems : undefined,
          overrideHasGuide: form.hasGuide,
          overrideRefundPolicy: form.refundPolicy.length > 0 ? form.refundPolicy : undefined,
          companions: form.companions.map(({ id: _id, ...rest }) => rest),
        }),
      });
      if (res.status === 409) { showError('이미 발급된 계약서가 있습니다.'); return; }
      const json = await res.json();
      if (!res.ok || !json.ok) { showError((json.message as string) || '발급 실패'); return; }
      showSuccess('계약서가 발급되었습니다.');
      setModalOpen(false);
      setForm(getEmptyForm());
      setProductCode('');
      setAddingCompanion(false);
      setCompanionDraft({ name: '', birthDate: '', relation: '배우자', phone: '', pnr: '' });
      await loadDocuments();
    } catch (e) {
      showError(e instanceof Error ? e.message : '발급 중 오류가 발생했습니다.');
    } finally {
      setIssuing(false);
    }
  };

  /* ── 포함/불포함 항목 토글 ── */
  const toggleItem = (type: 'inc' | 'exc', item: string) => {
    setForm((prev) => {
      const key = type === 'inc' ? 'includedItems' : 'excludedItems';
      const arr = prev[key];
      return { ...prev, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_60%)_minmax(0,_40%)]">
      {/* ═══ 좌측: 필터 + 목록 (모바일: 100%, 데스크톱: 60%) ═══════════════ */}
      <div className="min-w-0">
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
          <button
            onClick={() => {
              setForm(getEmptyForm());
              setProductCode('');
              setAddingCompanion(false);
              setCompanionDraft({ name: '', birthDate: '', relation: '배우자', phone: '', pnr: '' });
              setModalOpen(true);
            }}
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

      {/* ═══ 우측: 항상 표시 계약서 미리보기 (모바일: 100%, 데스크톱: 40%) ═══════ */}
      <div className="min-w-0">
        <p className="mb-2 text-sm font-semibold text-gray-700">계약서 미리보기</p>
        <FullContractPreview data={previewData} agent={agent} />
      </div>

      {/* ═══ 계약서 작성 모달 (2-panel: 입력 폼 + 실시간 미리보기) ═════════ */}
      {modalOpen && (
        <ModalShell
          title="계약서 작성 및 발급"
          maxWidth="max-w-[90rem]"
          locked={issuing}
          onClose={() => {
            setModalOpen(false);
            setAddingCompanion(false);
            setCompanionDraft({ name: '', birthDate: '', relation: '배우자', phone: '', pnr: '' });
          }}
          footer={
            <>
              <button onClick={() => {
                setModalOpen(false);
                setAddingCompanion(false);
                setCompanionDraft({ name: '', birthDate: '', relation: '배우자', phone: '', pnr: '' });
              }} disabled={issuing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                닫기
              </button>
              <button onClick={handleIssue} disabled={issuing || !form.orderId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40">
                {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {issuing ? '발급 중...' : '발급 및 서명 요청'}
              </button>
            </>
          }
        >
          {/* 2-panel flex layout (모바일: 세로, 데스크톱: 가로) */}
          <div className="flex flex-col lg:flex-row h-full min-h-0 gap-5 overflow-hidden">

            {/* ─ 좌측: 입력 폼 (모바일: 100%, 데스크톱: 400px) ────────────────── */}
            <div className="lg:w-96 lg:flex-shrink-0 space-y-3 overflow-y-auto pr-0 lg:pr-1 min-w-0">

              {/* ① 고객 검색 */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">① 구매자 검색 (주문 건 선택)</p>
                <CustomerAutocomplete
                  label=""
                  placeholder="이름·주문번호·전화번호로 검색"
                  accent="orange"
                  onlyPurchasable
                  onSelect={handleCustomerSelect}
                />
                {form.orderId && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-orange-100 px-3 py-1.5 text-xs text-orange-700">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                    <span className="flex-1 truncate">주문: {form.orderId}</span>
                    <button type="button" onClick={() => setForm((p) => ({ ...p, orderId: '' }))}
                      className="text-orange-400 hover:text-orange-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ② 상품 코드 검색 */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">② 상품 코드 조회 (포함/불포함·환불정책 자동)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleLoadProduct(); }}
                    placeholder="상품 코드 (예: MSC001)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-orange-400 focus:outline-none"
                  />
                  <button type="button" onClick={() => void handleLoadProduct()} disabled={loadingProduct}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                    {loadingProduct ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    조회
                  </button>
                </div>
              </div>

              {/* ③ 계약 기본 정보 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">③ 계약 기본 정보 (수동 수정 가능)</p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] text-gray-500">구매자 이름</label>
                    <input type="text" value={form.buyerName}
                      onChange={(e) => setForm((p) => ({ ...p, buyerName: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] text-gray-500">연락처</label>
                    <input type="text" value={form.buyerTel}
                      onChange={(e) => setForm((p) => ({ ...p, buyerTel: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="mb-0.5 block text-[11px] text-gray-500">상품명</label>
                  <input type="text" value={form.productName}
                    onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] text-gray-500">출발일</label>
                    <input type="date" value={form.departureDate}
                      onChange={(e) => setForm((p) => ({ ...p, departureDate: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] text-gray-500">계약 금액 (원)</label>
                    <input type="number" value={form.amount ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">여행 인솔자</label>
                  <div className="flex gap-4">
                    {(['Y', 'N'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="radio" name="modal-hasGuide" value={v} checked={form.hasGuide === v}
                          onChange={() => setForm((p) => ({ ...p, hasGuide: v }))} className="accent-orange-500" />
                        {v === 'Y' ? '있음' : '없음'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ③-2 계약 추가 정보 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">③-2 계약 추가 정보</p>

                {/* 계약 구분 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">계약 구분</label>
                  <div className="flex gap-4">
                    {(['기획여행', '희망여행'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="radio" name="modal-contractType" value={v}
                          checked={form.contractType === v}
                          onChange={() => setForm((p) => ({ ...p, contractType: v }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 여행보증 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">여행보증 (복수 선택)</label>
                  <div className="flex flex-wrap gap-3">
                    {(['공제', '예치금', '영업보증보험'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="checkbox"
                          checked={form.travelGuarantee.includes(v)}
                          onChange={() => setForm((p) => ({
                            ...p,
                            travelGuarantee: p.travelGuarantee.includes(v)
                              ? p.travelGuarantee.filter((x) => x !== v)
                              : [...p.travelGuarantee, v],
                          }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 여행자보험 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">여행자보험</label>
                  <div className="flex gap-4">
                    {([true, false] as const).map((v) => (
                      <label key={String(v)} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="radio" name="modal-hasInsurance" value={String(v)}
                          checked={form.hasInsurance === v}
                          onChange={() => setForm((p) => ({ ...p, hasInsurance: v }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v ? '가입' : '미가입'}
                      </label>
                    ))}
                  </div>
                  {form.hasInsurance && (
                    <input type="text" value={form.insuranceCompany}
                      onChange={(e) => setForm((p) => ({ ...p, insuranceCompany: e.target.value }))}
                      placeholder="보험회사 이름"
                      className="mt-1.5 w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                  )}
                </div>

                {/* 행사인원 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">행사인원</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] text-gray-400">최저 (명)</label>
                      <input type="number" min="0" value={form.minPax ?? ''}
                        onChange={(e) => setForm((p) => ({ ...p, minPax: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-gray-400">최대 (명)</label>
                      <input type="number" min="0" value={form.maxPax ?? ''}
                        onChange={(e) => setForm((p) => ({ ...p, maxPax: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                    </div>
                  </div>
                </div>

                {/* 1인당 여행요금 */}
                <div>
                  <label className="mb-0.5 block text-[11px] text-gray-500">1인당 여행요금 (원)</label>
                  <input type="number" min="0" value={form.pricePerPerson ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, pricePerPerson: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                </div>

                {/* 교통수단 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">교통수단 (복수 선택)</label>
                  <div className="flex flex-wrap gap-3">
                    {(['항공기', '선박', '기차'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="checkbox"
                          checked={form.transportTypes.includes(v)}
                          onChange={() => setForm((p) => ({
                            ...p,
                            transportTypes: p.transportTypes.includes(v)
                              ? p.transportTypes.filter((x) => x !== v)
                              : [...p.transportTypes, v],
                          }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v}
                      </label>
                    ))}
                  </div>
                  {form.transportTypes.includes('선박') && (
                    <input type="text" value={form.shipName}
                      onChange={(e) => setForm((p) => ({ ...p, shipName: e.target.value }))}
                      placeholder="선박명 (예: MSC 벨리시마)"
                      className="mt-1.5 w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                  )}
                </div>

                {/* 숙박 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">숙박 (복수 선택)</label>
                  <div className="flex flex-wrap gap-3">
                    {(['일정표표시', '관광호텔', '기타'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="checkbox"
                          checked={form.accommodationTypes.includes(v)}
                          onChange={() => setForm((p) => ({
                            ...p,
                            accommodationTypes: p.accommodationTypes.includes(v)
                              ? p.accommodationTypes.filter((x) => x !== v)
                              : [...p.accommodationTypes, v],
                          }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v === '일정표표시' ? '일정표 표시' : v}
                      </label>
                    ))}
                  </div>
                  {form.accommodationTypes.includes('관광호텔') && (
                    <input type="text" value={form.hotelGrade}
                      onChange={(e) => setForm((p) => ({ ...p, hotelGrade: e.target.value }))}
                      placeholder="호텔 등급 (예: 5성, 특급)"
                      className="mt-1.5 w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                  )}
                </div>

                {/* 식사 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">식사</label>
                  <div className="flex gap-4">
                    {(['일정표표시', '개별'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="radio" name="modal-mealDisplay" value={v}
                          checked={form.mealDisplay === v}
                          onChange={() => setForm((p) => ({ ...p, mealDisplay: v }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v === '일정표표시' ? '일정표 표시' : '개별 입력'}
                      </label>
                    ))}
                  </div>
                  {form.mealDisplay === '개별' && (
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      {([['breakfast', '조식'], ['lunch', '중식'], ['dinner', '석식']] as [keyof Pick<ContractFormData, 'breakfast' | 'lunch' | 'dinner'>, string][]).map(([field, label]) => (
                        <div key={field}>
                          <label className="mb-0.5 block text-[10px] text-gray-400">{label} (회)</label>
                          <input type="number" min="0" value={form[field] ?? ''}
                            onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value ? Number(e.target.value) : null }))}
                            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 현지 안내원 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">현지 안내원</label>
                  <div className="flex gap-4">
                    {(['있음', '없음'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="radio" name="modal-localGuide" value={v}
                          checked={form.localGuide === v}
                          onChange={() => setForm((p) => ({ ...p, localGuide: v }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 현지 교통 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">현지 교통 (복수 선택)</label>
                  <div className="flex flex-wrap gap-3">
                    {(['버스', '승용차', '기타', '없음'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="checkbox"
                          checked={form.localTransport.includes(v)}
                          onChange={() => setForm((p) => ({
                            ...p,
                            localTransport: p.localTransport.includes(v)
                              ? p.localTransport.filter((x) => x !== v)
                              : [...p.localTransport, v],
                          }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 현지 여행사 */}
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">현지 여행사</label>
                  <div className="flex gap-4">
                    {(['있음', '없음'] as const).map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="radio" name="modal-localAgency" value={v}
                          checked={form.localAgency === v}
                          onChange={() => setForm((p) => ({ ...p, localAgency: v }))}
                          className="h-4 w-4 accent-orange-500" />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ④ 포함/불포함 체크박스 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">④ 포함/불포함 내역</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-emerald-700">포함 항목</p>
                    <div className="space-y-1">
                      {ALL_INCLUDE_ITEMS.map((item) => (
                        <label key={item} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                          <input type="checkbox" checked={form.includedItems.includes(item)}
                            onChange={() => toggleItem('inc', item)}
                            className="h-3 w-3 accent-emerald-500" />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-red-700">불포함 항목</p>
                    <div className="space-y-1">
                      {ALL_EXCLUDE_ITEMS.map((item) => (
                        <label key={item} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                          <input type="checkbox" checked={form.excludedItems.includes(item)}
                            onChange={() => toggleItem('exc', item)}
                            className="h-3 w-3 accent-red-500" />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ⑤ 환불 규정 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">⑤ 환불 규정</p>
                  <button type="button"
                    onClick={() => setForm((p) => ({ ...p, refundPolicy: CRUISE_CANCELLATION_POLICY.map((rp) => ({ ...rp })) }))}
                    className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-orange-500">
                    <RefreshCcw className="h-3 w-3" />기본값
                  </button>
                </div>
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-red-50">
                      <th className="border border-red-100 px-2 py-1 text-left text-red-700">해지 시기</th>
                      <th className="border border-red-100 px-2 py-1 text-right text-red-700">취소료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.refundPolicy.map((p) => (
                      <tr key={p.label} className="border-b border-gray-100">
                        <td className="border border-gray-100 px-2 py-1 text-gray-600">{p.label}</td>
                        <td className="border border-gray-100 px-2 py-1 text-right font-semibold text-red-600">{p.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[10px] text-gray-400">상품 코드 조회 시 상품별 환불 규정으로 자동 교체됩니다.</p>
              </div>

              {/* ⑥ 특약사항 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <label className="mb-1 block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">⑥ 특약사항 (선택)</label>
                <textarea
                  value={form.specialTerms}
                  onChange={(e) => setForm((p) => ({ ...p, specialTerms: e.target.value }))}
                  placeholder="특별 약정 사항이 있으면 입력하세요..."
                  rows={3}
                  className="w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-orange-400 focus:outline-none"
                />
              </div>

              {/* ⑦ 동행인 등록 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">⑦ 동행인 (1인 결제 + 복수 탑승자)</p>
                  <button type="button" onClick={() => setAddingCompanion(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100">
                    <Plus className="h-3 w-3" />추가
                  </button>
                </div>

                {/* 동행인 목록 */}
                {form.companions.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {form.companions.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px]">
                        <span className="flex-1 font-medium text-gray-800">{c.name}</span>
                        <span className="text-gray-500">{c.relation}</span>
                        <span className="text-gray-400">{c.birthDate}</span>
                        {c.pnr && <span className="rounded bg-blue-50 px-1 text-[10px] text-blue-600">PNR:{c.pnr}</span>}
                        <button type="button"
                          onClick={() => setForm((p) => ({ ...p, companions: p.companions.filter((x) => x.id !== c.id) }))}
                          className="text-gray-300 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 동행인 입력 폼 */}
                {addingCompanion && (
                  <div className="mt-1 space-y-1.5 rounded-lg border border-blue-100 bg-blue-50 p-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="mb-0.5 block text-[10px] text-gray-500">이름</label>
                        <input type="text" value={companionDraft.name}
                          onChange={(e) => setCompanionDraft((d) => ({ ...d, name: e.target.value }))}
                          placeholder="홍길동"
                          className="w-full rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px] text-gray-500">관계</label>
                        <select value={companionDraft.relation}
                          onChange={(e) => setCompanionDraft((d) => ({ ...d, relation: e.target.value as CompanionRelation }))}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none">
                          {COMPANION_RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="mb-0.5 block text-[10px] text-gray-500">생년월일</label>
                        <input type="date" value={companionDraft.birthDate}
                          onChange={(e) => setCompanionDraft((d) => ({ ...d, birthDate: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px] text-gray-500">연락처</label>
                        <input type="text" value={companionDraft.phone}
                          onChange={(e) => setCompanionDraft((d) => ({ ...d, phone: e.target.value }))}
                          placeholder="010-0000-0000"
                          className="w-full rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-gray-500">PNR (선택)</label>
                      <input type="text" value={companionDraft.pnr ?? ''}
                        onChange={(e) => setCompanionDraft((d) => ({ ...d, pnr: e.target.value }))}
                        placeholder="APIS PNR 번호"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none" />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => {
                        setAddingCompanion(false);
                        setCompanionDraft({ name: '', birthDate: '', relation: '배우자', phone: '', pnr: '' });
                      }}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-50">
                        취소
                      </button>
                      <button type="button" onClick={() => {
                        if (!companionDraft.name) { return; }
                        const newCompanion: Companion = {
                          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
                          ...companionDraft,
                          pnr: companionDraft.pnr || undefined,
                        };
                        setForm((p) => ({ ...p, companions: [...p.companions, newCompanion] }));
                        setAddingCompanion(false);
                        setCompanionDraft({ name: '', birthDate: '', relation: '배우자', phone: '', pnr: '' });
                      }}
                        className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700">
                        추가
                      </button>
                    </div>
                  </div>
                )}

                {form.companions.length === 0 && !addingCompanion && (
                  <p className="text-[10px] text-gray-400">동행인이 없는 경우 건너뛰어도 됩니다.</p>
                )}
              </div>
            </div>

            {/* ─ 우측: 실시간 미리보기 (모바일: 숨김, 데스크톱: 표시) ──────────── */}
            <div className="hidden lg:block min-w-0 flex-1 overflow-y-auto">
              <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">실시간 계약서 미리보기</p>
              <FullContractPreview data={formToPreview(form)} agent={agent} />
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   포함/불포함 전체 항목 목록 (체크박스 렌더링용)
───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   크루즈닷 여행계약서 전체 미리보기
───────────────────────────────────────────────────────────────────────────── */
function FullContractPreview({
  data,
  agent,
}: {
  data: ContractPreviewData;
  agent: CurrentAgent;
}) {
  const hasData = !!(data.buyerName || data.productName);

  const checkedIncludes = data.includedItems ?? [];
  const checkedExcludes = data.excludedItems ?? [];
  const guideRow = data.hasGuide === 'Y' ? '■ 있음  □ 없음' : data.hasGuide === 'N' ? '□ 있음  ■ 없음' : '□ 있음  □ 없음';

  // 상품별 환불 규정 우선, 없으면 크루즈 기본
  const cancellationRows = data.refundPolicy ?? CRUISE_CANCELLATION_POLICY;

  // ── 새 필드 렌더링 헬퍼 ──
  const contractType = data.contractType;
  const travelGuarantee = data.travelGuarantee ?? [];
  const transportTypes = data.transportTypes ?? [];
  const accommodationTypes = data.accommodationTypes ?? [];
  const localTransport = data.localTransport ?? [];

  // 여행보증 표시
  const guaranteeCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      {(['공제', '예치금', '영업보증보험'] as const).map((g) => (
        <span key={g} className="inline-flex items-center gap-1">
          <CheckBox checked={travelGuarantee.includes(g)} />{g}
        </span>
      ))}
    </span>
  );

  // 여행자보험 표시
  const insuranceCell = (() => {
    if (data.hasInsurance === undefined) {
      return <span className="text-xs">□ 가입  □ 미가입 / 보험회사: ___</span>;
    }
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1"><CheckBox checked={data.hasInsurance === true} />가입</span>
        <span className="inline-flex items-center gap-1"><CheckBox checked={data.hasInsurance === false} />미가입</span>
        {data.hasInsurance && data.insuranceCompany && (
          <span className="text-gray-600">/ 보험회사: {data.insuranceCompany}</span>
        )}
      </span>
    );
  })();

  // 행사인원 표시
  const paxCell = (data.minPax != null || data.maxPax != null)
    ? `최저 ${data.minPax ?? '___'} 명 / 최대 ${data.maxPax ?? '___'} 명`
    : '최저 ___ 명 / 최대 ___ 명';

  // 여행요금 표시
  const fareCell = (() => {
    const pp = data.pricePerPerson;
    const total = data.amount;
    if (pp != null && total != null) {
      return `1인당 ${formatMoney(pp)} / 총액 ${formatMoney(total)}`;
    }
    if (total != null) {
      return `1인당 ___ 원 / 총액 ${formatMoney(total)}`;
    }
    if (pp != null) {
      return `1인당 ${formatMoney(pp)} / 총액 ___ 원`;
    }
    return '1인당 ___ 원  /  총액 ___ 원';
  })();

  // 교통수단 표시
  const transportCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      {(['항공기', '선박', '기차'] as const).map((t) => (
        <span key={t} className="inline-flex items-center gap-1">
          <CheckBox checked={transportTypes.includes(t)} />{t}
        </span>
      ))}
      {transportTypes.includes('선박') && data.shipName && (
        <span className="text-gray-600">선박명: {data.shipName}</span>
      )}
    </span>
  );

  // 숙박 표시
  const accommodationCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      <span className="inline-flex items-center gap-1">
        <CheckBox checked={accommodationTypes.includes('일정표표시')} />일정표 표시
      </span>
      <span className="inline-flex items-center gap-1">
        <CheckBox checked={accommodationTypes.includes('관광호텔')} />관광호텔
        {accommodationTypes.includes('관광호텔') && data.hotelGrade && ` (${data.hotelGrade} 등급)`}
      </span>
      <span className="inline-flex items-center gap-1">
        <CheckBox checked={accommodationTypes.includes('기타')} />기타
      </span>
    </span>
  );

  // 식사 표시
  const mealCell = (() => {
    if (data.mealDisplay === '개별') {
      return (
        <span className="text-xs">
          □ 일정표 표시 ■ 개별 입력 /
          조식 {data.breakfast ?? '_'}회, 중식 {data.lunch ?? '_'}회, 석식 {data.dinner ?? '_'}회
        </span>
      );
    }
    if (data.mealDisplay === '일정표표시') {
      return <span className="text-xs">■ 일정표 표시 / 조식 _회, 중식 _회, 석식 _회</span>;
    }
    return <span className="text-xs">□ 일정표 표시  /  조식 _회, 중식 _회, 석식 _회</span>;
  })();

  // 현지 안내원 표시
  const localGuideCell = (() => {
    if (data.localGuide === '있음') return '■ 있음  □ 없음  *여행일정표 참조';
    if (data.localGuide === '없음') return '□ 있음  ■ 없음  *여행일정표 참조';
    return '□ 있음  □ 없음  *여행일정표 참조';
  })();

  // 현지 교통 표시
  const localTransportCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      {(['버스', '승용차', '기타', '없음'] as const).map((t) => (
        <span key={t} className="inline-flex items-center gap-1">
          <CheckBox checked={localTransport.includes(t)} />{t}
        </span>
      ))}
    </span>
  );

  // 현지 여행사 표시
  const localAgencyCell = (() => {
    if (data.localAgency === '있음') return '■ 있음  □ 없음  *여행일정표 참조';
    if (data.localAgency === '없음') return '□ 있음  ■ 없음  *여행일정표 참조';
    return '□ 있음  □ 없음  *여행일정표 참조';
  })();

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto rounded-xl border border-gray-200 bg-white text-[12px] leading-relaxed text-gray-800 shadow-sm">
      <div className="p-5 space-y-4">
        {/* 헤더 */}
        <DocumentLetterhead title="크루즈닷 여행계약서" accentClass="border-orange-100" />

        {/* 계약 유형 */}
        <div className="flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-2 text-xs">
          <span className="font-medium text-gray-600">계약 구분:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <CheckBox checked={contractType === '기획여행'} />
            기획여행
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <CheckBox checked={contractType === '희망여행'} />
            희망여행
          </label>
        </div>

        {/* 계약 기본 정보 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">계약 정보</p>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {([
                ['상품명', data.productName || <span className="italic text-gray-300">여행일정표 참조</span>],
                ['여행기간', data.departureDate ? `${data.departureDate} ~ (출발일 기준)` : <span className="italic text-gray-300">여행일정표 참조</span>],
                ['여행보증', guaranteeCell],
                ['여행자보험', insuranceCell],
                ['행사인원', paxCell],
                ['여행요금', fareCell],
                ['교통수단', transportCell],
                ['숙박', accommodationCell],
                ['식사', mealCell],
                ['여행 인솔자', guideRow],
                ['현지 안내원', localGuideCell],
                ['현지 교통', localTransportCell],
                ['현지 여행사', localAgencyCell],
              ] as [string, React.ReactNode][]).map(([label, value], i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="w-28 bg-gray-50 px-3 py-2 font-medium text-gray-600 align-top">{label}</td>
                  <td className="px-3 py-2 text-gray-700">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 탑승자 명단 (동행인 있을 때만) */}
        {data.companions && data.companions.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">탑승자 명단</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-orange-50">
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">이름</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">관계</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">생년월일</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">연락처</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">PNR</th>
                </tr>
              </thead>
              <tbody>
                {data.companions.map((c, i) => (
                  <tr key={c.id ?? i} className="border-b border-gray-100">
                    <td className="border border-gray-100 px-3 py-1.5 font-medium text-gray-800">{c.name}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-600">{c.relation}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-600">{c.birthDate || '-'}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-600">{c.phone || '-'}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-500">{c.pnr || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 여행요금 포함/불포함 내역 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">여행요금 포함/불포함 내역</p>
          <div className="grid grid-cols-2 gap-3">
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

        {/* 특약사항 (있을 때만) */}
        {data.specialTerms && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-yellow-700">특약사항</p>
            <p className="whitespace-pre-wrap text-[11px] text-gray-700">{data.specialTerms}</p>
          </div>
        )}

        {/* ── 크루즈 여행 특별약관 ────────────────────────────────── */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-red-700">크루즈 여행 특별약관</p>
          <p className="mb-1 text-[11px] font-semibold text-red-600">제1조 (목적)</p>
          <p className="mb-2 text-[10px] text-gray-600">본 특약은 국외여행표준약관을 보완하고 크루즈 여행 고유의 여행조건, 취소규정, 유의사항 등을 여행자에게 사전 고지함에 그 목적이 있습니다.</p>

          {/* 환불고지 — 상품별 or 기본 크루즈 취소료 */}
          <p className="mb-1 text-[11px] font-semibold text-red-600">제2조 (크루즈 취소료 규정) — 환불 고지</p>
          <div className="mb-1 rounded-lg bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700">
            ⚠ 본 상품은 항공사·선사 비용 사전 지급으로 인해 <strong>일반여행 취소료 규정이 아닌 크루즈 특별 취소료를 우선 적용</strong>합니다.
          </div>
          <table className="mb-2 w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-red-200">
                <th className="border border-red-200 px-2 py-1 text-left font-semibold text-red-800">해지 시기</th>
                <th className="border border-red-200 px-2 py-1 text-right font-semibold text-red-800">취소료</th>
              </tr>
            </thead>
            <tbody>
              {cancellationRows.map((p) => (
                <tr key={p.label} className="border-b border-red-100">
                  <td className="border border-red-100 px-2 py-1 text-gray-700">{p.label}</td>
                  <td className="border border-red-100 px-2 py-1 text-right font-bold text-red-700">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-0.5 text-[10px] text-gray-600">
            <p>1) 총 경비는 할인가격이 아닌 <strong>정상가격</strong> 기준으로 계산합니다.</p>
            <p>2) 크루즈 예약 후 발생되는 모든 예약 변경은 비용이 부과됩니다.</p>
            <p>3) 연휴·연말·휴가기간에는 특별 취소료 규정이 적용됩니다. (예약 시 별도 고지)</p>
            <p>4) 질병·부상·사망·천재지변 등으로 인한 취소에도 상기 규정이 적용됩니다.</p>
            <p>5) 기상악화 및 선사 사정으로 기항지 투어 진행 불가 시 선사 책정 금액 외 추가 보상은 없습니다.</p>
          </div>

          <p className="mb-0.5 mt-2 text-[11px] font-semibold text-red-600">제3조 (유의사항)</p>
          <div className="space-y-0.5 text-[10px] text-gray-600">
            <p>1) 여권 유효기간은 여행 출발일 기준 <strong>6개월 이상</strong> 남아있어야 합니다.</p>
            <p>2) 예약 후 3일 이내 계약금 결제 必 — 미결제 시 예약 자동취소.</p>
            <p>3) 잔금은 출발 전 지정일까지 완납하여야 하며, 미납 시 자동취소됩니다. (위약금 발생)</p>
            <p>4) 18세 이하 어린이는 보호자 동반 필수 / 6개월 미만 유아는 탑승 제한될 수 있음.</p>
            <p>5) 임신 6개월 이상 임산부는 탑승 불가 / 미만은 의사 소견서(영문) + 동의서 제출 필요.</p>
            <p>6) 여행자 본인 과실로 인한 안전사고는 여행자 본인이 책임집니다.</p>
            <p>7) 선내 면세점·현지 관광 중 구매한 쇼핑 물품은 단순 변심·훼손 시 교환·환불 불가.</p>
          </div>

          <div className="mt-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-[10px]">
            <strong>약관 교부 확인:</strong> 여행자( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )은 담당자( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )으로부터 크루즈여행특별약관을 교부받았으며, 취소료 규정·유의사항 및 본 약관이 국외여행표준약관에 우선함을 충분히 설명 들었습니다.
            <p className="mt-1.5 text-right text-gray-500">여행자: ( 인 / 서명 )</p>
          </div>
        </div>

        {/* ── 국외여행표준약관 ─────────────────────────────────────── */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">국외여행표준약관</p>
          <p className="mb-1 text-[10px] text-gray-500">{COMPANY.name}은 공정거래위원회 표준약관을 준수합니다.</p>
          <div className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[10px] text-gray-600">
            <p><span className="font-semibold text-gray-700">제1조 (목적)</span> 이 약관은 {COMPANY.name}(이하 '당사')와 여행자가 체결한 국외여행계약의 세부 이행 및 준수사항을 정함을 목적으로 합니다.</p>
            <p><span className="font-semibold text-gray-700">제2조 (당사와 여행자 의무)</span> ① 당사는 여행자에게 안전하고 만족스러운 여행서비스를 제공하기 위하여 맡은 바 임무를 충실히 수행합니다. ② 여행자는 안전하고 즐거운 여행을 위하여 여행자 간 화합 도모 및 당사의 여행 질서 유지에 적극 협조합니다.</p>
            <p><span className="font-semibold text-gray-700">제3조 (용어의 정의)</span> ① 기획여행: 당사가 미리 여행일정·요금을 정하여 여행자를 모집하여 실시하는 여행. ② 희망여행: 여행자가 희망하는 조건에 따라 당사가 계획을 수립하여 실시하는 여행.</p>
            <p><span className="font-semibold text-gray-700">제4조 (계약 구성)</span> 여행계약은 여행계약서·여행약관·여행일정표(또는 여행설명서)를 계약내용으로 합니다.</p>
            <p><span className="font-semibold text-gray-700">제5조 (특약)</span> 당사와 여행자는 관계법규에 위반되지 않는 범위에서 서면으로 특약을 맺을 수 있습니다. 크루즈 특별약관은 본 약관에 우선하여 적용합니다.</p>
            <p><span className="font-semibold text-gray-700">제6조 (계약서 및 약관 교부)</span> 당사는 여행자와 여행계약 체결 시 계약서·여행약관·여행일정표를 각 1부씩 여행자에게 교부합니다.</p>
            <p><span className="font-semibold text-gray-700">제8조 (당사의 책임)</span> 당사는 여행 출발 시부터 도착 시까지 당사 또는 그 사용인이 여행자에게 고의 또는 과실로 손해를 가한 경우 배상책임을 집니다.</p>
            <p><span className="font-semibold text-gray-700">제9조 (최저행사인원 미충족)</span> 당사는 최저행사인원 미충족으로 계약 해제 시 여행출발 7일 전까지 여행자에게 통지합니다. 기일 내 미통지 해제 시 출발 1일 전까지 통지: 여행요금의 30%, 당일 통지: 50% 배상합니다.</p>
            <p><span className="font-semibold text-gray-700">제11조 (여행요금)</span> 여행요금에는 운임·숙박·식사·안내자경비·각종 세금·관광기금·공항항만세·관광지 입장료 등이 포함됩니다. 계약금(여행요금의 10% 이하)은 계약 체결 시 지급합니다.</p>
            <p><span className="font-semibold text-gray-700">제12조 (여행요금 변경)</span> 이용 운송·숙박기관 요금이 계약 시보다 5% 이상 증감하거나 환율이 2% 이상 증감하면 요금 증감을 청구할 수 있습니다. 요금 증액 시 출발 15일 전에 통지합니다.</p>
            <p><span className="font-semibold text-gray-700">제13조 (여행조건 변경 및 정산)</span> 여행조건 변경 및 요금 증감으로 생긴 차액은 여행 출발 전 변경분은 출발 이전에, 여행 중 변경분은 여행 종료 후 10일 이내에 정산·환급합니다.</p>
            <p><span className="font-semibold text-gray-700">제14조 (손해배상)</span> ① 당사는 현지 여행사 등의 고의·과실로 여행자에게 손해를 가한 경우 배상합니다. ② 당사 귀책으로 사증·재입국 허가 등 미취득 시 수수료 전액 및 그 100% 상당액을 배상합니다. ③ 교통기관 연발착으로 인한 손해는 당사 고의·과실 없음 입증 시 제외됩니다.</p>
            <p><span className="font-semibold text-gray-700">제15조 (여행 출발 전 계약 해제)</span> 당사 또는 여행자는 출발 전 계약 해제 가능. 발생 손해는 소비자분쟁해결기준(공정거래위원회 고시)에 따라 배상합니다. 천재지변·여행자 사망·질병 등 불가항력 사유는 위약금 없이 해제 가능합니다.</p>
            <p><span className="font-semibold text-gray-700">제16조 (여행 출발 후 계약 해지)</span> 부득이한 사유로 계약 해지 시, 당사는 여행자 귀국에 필요한 사항을 협조하며, 당사 귀책이 아닌 비용은 여행자가 부담합니다.</p>
            <p><span className="font-semibold text-gray-700">제17조 (여행의 시작과 종료)</span> 여행의 시작은 탑승수속(선박의 경우 승선수속) 완료 시점, 종료는 여행자가 입국장 보세구역을 벗어나는 시점으로 합니다.</p>
            <p><span className="font-semibold text-gray-700">제18조 (설명의무)</span> 당사는 계약서에 정해진 중요한 내용 및 변경사항을 여행자가 이해할 수 있도록 설명합니다.</p>
            <p><span className="font-semibold text-gray-700">제19조 (보험 가입)</span> 당사는 여행자에게 손해가 발생한 경우 보험금을 지급하기 위한 보험 또는 공제에 가입하거나 영업보증금을 예치합니다.</p>
            <p><span className="font-semibold text-gray-700">제20조 (기타)</span> 이 계약에 명시되지 않은 사항은 당사 또는 여행자가 합의하여 결정하되, 미합의 시 관계법령 및 일반관례에 따릅니다.</p>
            <p className="mt-1 text-gray-400">※ 본 계약 관련 분쟁 시 관광불편신고처리위원회(☎1588-8692) 또는 소재지 도청 문화관광과에 중재 신청 가능합니다.</p>
          </div>
        </div>

        {/* ── 일반 취소료 규정 (참고용) ──────────────────────────── */}
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-orange-700">일반여행 취소·환불 규정 (참고)</p>
          <p className="mb-1 text-[10px] text-red-500">※ 크루즈 여행은 위 특별약관 제2조 취소료 규정이 우선 적용됩니다.</p>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">취소 시점</th>
                <th className="border border-gray-200 px-2 py-1 text-right font-semibold text-gray-600">위약금</th>
              </tr>
            </thead>
            <tbody>
              {CANCELLATION_POLICY.map((p) => (
                <tr key={p.label} className="border-b border-gray-100">
                  <td className="border border-gray-200 px-2 py-1 text-gray-500">{p.label}</td>
                  <td className="border border-gray-200 px-2 py-1 text-right text-gray-600">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 개인정보처리 동의 ─────────────────────────────────── */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">개인정보처리 동의사항</p>

          <p className="mb-0.5 text-[10px] font-semibold text-blue-600">1. 개인정보 수집·이용 동의 (필수)</p>
          <div className="mb-2 space-y-0.5 text-[10px] text-gray-600">
            <p><strong>수집·이용 목적:</strong> 크루즈여행계약 체결·심사·관리, 서비스 제공, 고객관리, 대금결제, 민원처리</p>
            <p><strong>수집 항목:</strong> 성명, 생년월일, 주소(자택/직장), 연락처(휴대폰/자택/직장), 이메일</p>
            <p><strong>보유 기간:</strong> 목적 달성 시까지 / 계약·청약철회 기록 5년 / 대금결제 기록 5년 / 분쟁처리 기록 3년</p>
            <p className="text-right text-gray-500">계약자: ( 인 / 서명 )</p>
          </div>

          <p className="mb-0.5 text-[10px] font-semibold text-blue-600">2. 제3자 제공 동의 (필수)</p>
          <div className="mb-2 space-y-0.5 text-[10px] text-gray-600">
            <p><strong>제공 대상:</strong> 각 항공사·선사·랜드사, {COMPANY.name}</p>
            <p><strong>제공 항목:</strong> 성명, 생년월일, 주소, 연락처</p>
            <p><strong>제공 목적:</strong> 크루즈 여행 서비스 제공</p>
            <p><strong>보유 기간:</strong> 크루즈 여행 서비스 종료 시 삭제</p>
            <p className="text-right text-gray-500">계약자: ( 인 / 서명 )</p>
          </div>

          <p className="mb-0.5 text-[10px] font-semibold text-blue-600">3. 마케팅 활용 동의 (선택)</p>
          <div className="space-y-0.5 text-[10px] text-gray-600">
            <p><strong>활용 목적:</strong> {COMPANY.name}이 제공하는 서비스 홍보 및 소개</p>
            <p><strong>방법:</strong> 우편·전화·이메일·방문·문자</p>
            <p><strong>보유 기간:</strong> 계약 종료 후 5년</p>
            <p>※ 상기 동의를 거부할 수 있으나, 미동의 시 정상 서비스 제공이 어려울 수 있습니다.</p>
            <p className="text-right text-gray-500">계약자: ( 인 / 서명 )</p>
          </div>
        </div>

        {/* ── 여행업자 정보 ─────────────────────────────────────── */}
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-[11px]">
          <p className="mb-1 font-bold text-orange-700">여행업자 정보</p>
          <div className="grid grid-cols-2 gap-1 text-gray-600">
            <span>상호: {COMPANY.name}</span>
            <span>대표: {COMPANY_INFO.ceo}</span>
            <span>전화: {COMPANY_INFO.hqPhone}</span>
            <span>담당자: {agent.displayName || '___'} {agent.phone || ''}</span>
            <span className="col-span-2">계좌: {COMPANY_INFO.bankName} {COMPANY_INFO.bankAccount} ({COMPANY_INFO.bankHolder})</span>
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
