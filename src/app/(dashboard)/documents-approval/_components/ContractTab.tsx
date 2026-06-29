'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Download,
  MessageSquare,
  Link2,
  Trash2,
  Ban,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { CRUISE_CANCELLATION_POLICY } from '@/lib/company-info';
import {
  type SaleResult,
  type SalesDocumentItem,
  formatMoney,
  formatDate,
  CustomerAutocomplete,
  ModalShell,
  useCurrentAgent,
} from './shared';
import ContractBody, { ALL_INCLUDE_ITEMS, ALL_EXCLUDE_ITEMS } from './ContractBody';

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
  refundPolicyText: string;
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
    refundPolicyText: '',
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
  refundPolicyText?: string;
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
  // #24 — 계약서 전달 모달(링크+메시지 복사). 자동 SMS 대신 운영자가 직접 복사해 전달.
  const [sendModal, setSendModal] = useState<{ signUrl: string; buyerName: string; message: string } | null>(null);

  // 우측 항상 표시 미리보기 (목록 행 클릭 시 업데이트)
  const [previewData, setPreviewData] = useState<ContractPreviewData>({});

  // 선택된 계약서(문자 발송·다운로드용) — 행 클릭 시 id/서명토큰/연락처 보관
  const [selectedDoc, setSelectedDoc] = useState<{
    id: string;
    signToken: string | null;
    buyerName: string | null;
    buyerTel: string | null;
  } | null>(null);
  const [sendingSms, setSendingSms] = useState(false);

  // 현재 로그인 사용자(권한 게이트용) — 관리자/지사: 전체, 대리점장(AGENT): 본인 생성분만
  const [me, setMe] = useState<{ role: string | null; userId: string | null }>({ role: null, userId: null });
  // 목록 선택(선택 삭제용) + 작업 진행 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  // 모달 폼 상태
  const [form, setForm] = useState<ContractFormData>(getEmptyForm);
  const [productCode, setProductCode] = useState('');
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [addingCompanion, setAddingCompanion] = useState(false);
  const [companionDraft, setCompanionDraft] = useState<Omit<Companion, 'id'>>({
    name: '', birthDate: '', relation: '배우자', phone: '', pnr: '',
  });

  // 상품 드롭다운 상태
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearchResults, setProductSearchResults] = useState<{ id: string; productCode: string; productName: string; basePrice: number }[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // 상품 검색 디바운스 (300ms) — 입력 시 자동으로 판매중 상품 드롭다운 표시
  useEffect(() => {
    if (productSearch.trim().length === 0) {
      setProductDropdownOpen(false);
      setProductSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchProducts(productSearch);
      setProductDropdownOpen(true);
    }, 300);
    return () => clearTimeout(t);
     
  }, [productSearch]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  // 현재 사용자 역할/ID 조회 (권한 게이트)
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setMe({ role: j.role ?? null, userId: j.userId ?? null }); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

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
    // 문자 발송·다운로드용으로 선택 문서 보관
    setSelectedDoc({
      id: doc.id,
      signToken: gdStr(gd, 'signToken'),
      buyerName: gdStr(gd, 'buyerName') ?? doc.contact?.name ?? null,
      buyerTel: gdStr(gd, 'buyerTel') ?? doc.contact?.phone ?? null,
    });
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
        // product-info API가 slots→{label,value}[]로 변환해 내려주는 계약서용 환불규정 라인
        refundPolicyLines?: { label: string; value: string }[];
      };
      setForm((prev) => ({
        ...prev,
        productName: p.productName || prev.productName,
        departureDate: p.startDate ? (p.startDate as string).split('T')[0] : prev.departureDate,
        nights: p.nights ?? prev.nights,
        includedItems: p.includedItems ?? prev.includedItems,
        excludedItems: p.excludedItems ?? prev.excludedItems,
        hasGuide: p.hasGuide ?? prev.hasGuide,
        // 상품별 환불정책(slots 변환 라인)이 있으면 사용, 없으면 크루즈 기본 취소료
        refundPolicy: (p.refundPolicyLines && p.refundPolicyLines.length > 0)
          ? p.refundPolicyLines
          : [...CRUISE_CANCELLATION_POLICY],
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
    // 하이브리드: 구매자 검색(orderId) 또는 수동 직접입력(이름·연락처·상품명·금액) 둘 다 발급 가능
    const hasManualFields = !!(form.buyerName.trim() && form.buyerTel.trim() && form.productName.trim() && form.amount);
    if (!form.orderId && !hasManualFields) {
      showError('구매자를 검색하거나, ③ 계약 기본 정보에 구매자 이름·연락처·상품명·금액을 직접 입력해주세요.');
      return;
    }
    setIssuing(true);
    try {
      const isManual = !form.orderId;
      const payload: Record<string, unknown> = {
        specialTerms: form.specialTerms || undefined,
        overrideProductName: form.productName || undefined,
        overrideDepartureDate: form.departureDate || undefined,
        overrideNights: form.nights ?? undefined,
        overrideIncludedItems: form.includedItems.length > 0 ? form.includedItems : undefined,
        overrideExcludedItems: form.excludedItems.length > 0 ? form.excludedItems : undefined,
        overrideHasGuide: form.hasGuide,
        overrideRefundPolicy: form.refundPolicy.length > 0 ? form.refundPolicy : undefined,
        companions: form.companions.map(({ id: _id, ...rest }) => rest),
        // ③-2 계약 추가 정보 (미리보기에만 보이고 저장 누락되던 필드 — 저장 반영)
        contractDetails: {
          contractType: form.contractType,
          travelGuarantee: form.travelGuarantee,
          hasInsurance: form.hasInsurance,
          insuranceCompany: form.insuranceCompany || undefined,
          minPax: form.minPax ?? undefined,
          maxPax: form.maxPax ?? undefined,
          pricePerPerson: form.pricePerPerson ?? undefined,
          transportTypes: form.transportTypes,
          shipName: form.shipName || undefined,
          accommodationTypes: form.accommodationTypes,
          hotelGrade: form.hotelGrade || undefined,
          mealDisplay: form.mealDisplay,
          breakfast: form.breakfast ?? undefined,
          lunch: form.lunch ?? undefined,
          dinner: form.dinner ?? undefined,
          localGuide: form.localGuide,
          localTransport: form.localTransport,
          localAgency: form.localAgency,
        },
      };
      if (isManual) {
        // 수동(직접입력) 모드 — 구매자 검색 없이 발급. 필수 4필드 + 선택 상품코드/출발일/박수.
        payload.mode = 'manual';
        payload.buyerName = form.buyerName.trim();
        payload.buyerTel = form.buyerTel.trim();
        payload.productName = form.productName.trim();
        payload.amount = form.amount ?? undefined;
        payload.productCode = productCode || undefined;
        payload.departureDate = form.departureDate || undefined;
        payload.nights = form.nights ?? undefined;
      } else {
        payload.mode = 'sale';
        payload.orderId = form.orderId;
      }
      const res = await fetch('/api/documents/purchase-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.status === 409) { showError('이미 발급된 계약서가 있습니다.'); return; }
      const json = await res.json();
      if (!res.ok || !json.ok) { showError((json.message as string) || '발급 실패'); return; }
      // #24 — 발급 직후 링크/메시지 복사 모달용 데이터 확보(자동 SMS 발송 안 함)
      const issuedBuyer = form.buyerName.trim() || '고객';
      const issuedSignUrl = typeof json.signUrl === 'string' ? json.signUrl : '';
      showSuccess('계약서가 발급되었습니다.');
      setModalOpen(false);
      setForm(getEmptyForm());
      setProductCode('');
      setAddingCompanion(false);
      setCompanionDraft({ name: '', birthDate: '', relation: '배우자', phone: '', pnr: '' });
      await loadDocuments();
      // 발급 완료 → 링크+메시지 복사 모달을 띄워 운영자가 직접 전달(카카오톡/문자)
      if (issuedSignUrl) {
        setSendModal({ signUrl: issuedSignUrl, buyerName: issuedBuyer, message: buildSignMessage(issuedBuyer, issuedSignUrl) });
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : '발급 중 오류가 발생했습니다.');
    } finally {
      setIssuing(false);
    }
  };

  /* ── 상품 검색 ── */
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

  const handleSelectProductFromDropdown = async (product: { id: string; productCode: string; productName: string; basePrice: number }) => {
    setProductSearch('');
    setProductDropdownOpen(false);
    setProductSearchResults([]);
    setProductCode(product.productCode);
    setForm((prev) => ({
      ...prev,
      productName: product.productName,
    }));
    // 자동으로 productInfo 로드 (productCode로)
    await loadProductInfoByCode(product.productCode);
  };

  const loadProductInfoByCode = async (code: string) => {
    if (!code.trim()) { showError('상품 코드를 입력해주세요.'); return; }
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
        // product-info API가 slots→{label,value}[]로 변환해 내려주는 계약서용 환불규정 라인
        refundPolicyLines?: { label: string; value: string }[];
      };
      setForm((prev) => ({
        ...prev,
        productName: p.productName || prev.productName,
        departureDate: p.startDate ? (p.startDate as string).split('T')[0] : prev.departureDate,
        nights: p.nights ?? prev.nights,
        includedItems: p.includedItems ?? prev.includedItems,
        excludedItems: p.excludedItems ?? prev.excludedItems,
        hasGuide: p.hasGuide ?? prev.hasGuide,
        // 상품별 환불정책(slots 변환 라인)이 있으면 사용, 없으면 크루즈 기본 취소료
        refundPolicy: (p.refundPolicyLines && p.refundPolicyLines.length > 0)
          ? p.refundPolicyLines
          : [...CRUISE_CANCELLATION_POLICY],
        refundPolicyText: '', // 초기화 (사용자가 직접 입력하도록)
      }));
      showSuccess('상품 정보가 자동 반영되었습니다.');
    } catch (e) {
      showError(e instanceof Error ? e.message : '상품 정보 로드 실패');
    } finally {
      setLoadingProduct(false);
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

  /* ── 계약서 PDF 다운로드 (서명 완료본 — contract-pdf 라우트) ── */
  const handleDownloadPdf = (docId: string | undefined) => {
    if (!docId) { showError('먼저 목록에서 계약서를 선택해주세요.'); return; }
    setPdfDownloading(true);
    try {
      // 인증 쿠키가 함께 전송되도록 같은 출처 새 창으로 PDF 라우트 호출
      window.open(`/api/documents/${docId}/contract-pdf`, '_blank', 'noopener,noreferrer');
    } finally {
      // 새 창 호출은 즉시 반환 — 짧게 로딩 표시만
      setTimeout(() => setPdfDownloading(false), 800);
    }
  };

  /* ── 권한 게이트: 관리자/지사=전체, 대리점장(AGENT)=본인 생성분만 ── */
  const canManageAll = me.role === 'OWNER' || me.role === 'GLOBAL_ADMIN';
  const canManageAny = canManageAll || me.role === 'AGENT';
  const canManageDoc = (doc: SalesDocumentItem): boolean => {
    if (canManageAll) return true;
    if (me.role === 'AGENT') {
      // 목록 응답에 createdBy 가 있으면 본인 것만, 없으면 서버 RBAC 를 신뢰(버튼 노출)
      const createdBy = (doc as { createdBy?: string | null }).createdBy ?? null;
      return createdBy ? createdBy === me.userId : true;
    }
    return false;
  };

  /* ── 목록 선택 토글 ── */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ── 선택 삭제 (행별 DELETE 반복 — purchase-contract/[id]) ── */
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (typeof window !== 'undefined' &&
        !window.confirm(`선택한 계약서 ${ids.length}건을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`)) {
      return;
    }
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/documents/purchase-contract/${id}`, { method: 'DELETE', credentials: 'include' })
            .then((r) => r.ok),
        ),
      );
      let ok = 0; let fail = 0;
      for (const r of results) { if (r.status === 'fulfilled' && r.value) ok++; else fail++; }
      if (ok > 0) showSuccess(`${ok}건을 삭제했어요.`);
      if (fail > 0) showError(`${fail}건은 삭제하지 못했어요. (권한 또는 상태를 확인해주세요)`);
      setSelectedIds(new Set());
      await loadDocuments();
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ── 행별 반려 (PATCH action=reject) ── */
  const handleReject = async (id: string) => {
    if (typeof window !== 'undefined' &&
        !window.confirm('이 계약서를 반려할까요?')) {
      return;
    }
    setRejectingId(id);
    try {
      const res = await fetch(`/api/documents/purchase-contract/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject' }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        showSuccess('반려 처리했어요.');
        await loadDocuments();
      } else {
        showError(json.message || '반려 처리에 실패했어요.');
      }
    } catch {
      showError('반려 처리 중 오류가 발생했어요.');
    } finally {
      setRejectingId(null);
    }
  };

  /* ── 공개 서명링크 생성 (클립보드 복사용) ── */
  const buildSignUrl = (): string | null => {
    if (!selectedDoc?.id || !selectedDoc.signToken) return null;
    const appUrl = (typeof window !== 'undefined' && window.location?.origin) || 'https://mabizcruisedot.com';
    return `${appUrl}/contract/sign/${selectedDoc.id}?token=${selectedDoc.signToken}`;
  };

  /* ── #24 전달용 안내 메시지 + 범용 복사 + 전달 모달 오픈 ── */
  const buildSignMessage = (buyerName: string, url: string) =>
    `[크루즈닷] ${buyerName}님, 계약서 서명을 요청드립니다.\n아래 링크에서 7일 이내에 서명해 주세요.\n${url}`;

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(okMsg);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
        showSuccess(okMsg);
      } catch {
        showError('복사에 실패했어요. 길게 눌러 직접 복사해주세요.');
      }
    }
  };

  // 이미 발급된 계약서를 다시 전달(링크+메시지 복사 모달)
  const openSendModal = () => {
    const url = buildSignUrl();
    if (!url) { showError('이 계약서에는 서명 링크가 없습니다.'); return; }
    const name = selectedDoc?.buyerName?.trim() || '고객';
    setSendModal({ signUrl: url, buyerName: name, message: buildSignMessage(name, url) });
  };

  /* ── 서명링크 클립보드 복사 ── */
  const handleCopyLink = async () => {
    const url = buildSignUrl();
    if (!url) {
      showError('이 계약서에는 서명 링크가 없습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showSuccess('서명 링크를 복사했어요. 원하는 곳에 붙여넣어 보내세요.');
    } catch {
      // clipboard API 미지원/거부 시 폴백: 임시 textarea 사용
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showSuccess('서명 링크를 복사했어요.');
      } catch {
        showError('복사에 실패했어요. 링크를 길게 눌러 직접 복사해주세요.');
      }
    }
  };

  /* ── 서명링크 문자(SMS) 발송 ── */
  const handleSendSms = async () => {
    if (!selectedDoc?.id) {
      showError('먼저 목록에서 계약서를 선택해주세요.');
      return;
    }
    if (!selectedDoc.signToken) {
      showError('이 계약서에는 서명 링크가 없습니다.');
      return;
    }
    // buyerTel 이 없으면 담당자에게 번호 입력 요청
    let phone = selectedDoc.buyerTel ?? '';
    if (!phone.trim()) {
      const input = typeof window !== 'undefined'
        ? window.prompt('받는 분 휴대폰 번호를 입력해주세요 (예: 010-1234-5678)')
        : null;
      if (!input || !input.trim()) return;
      phone = input.trim();
    }
    setSendingSms(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/send-contract-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        showSuccess(json.message || '계약서 서명 링크를 문자로 보냈어요.');
      } else {
        showError(json.message || '문자 발송에 실패했어요.');
      }
    } catch {
      showError('문자 발송 중 오류가 발생했어요.');
    } finally {
      setSendingSms(false);
    }
  };

  /* ── 전체 선택(관리 가능 행 한정) ── */
  const manageableDocs = filtered.filter(canManageDoc);
  const allManageableSelected = manageableDocs.length > 0 && manageableDocs.every((d) => selectedIds.has(d.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allManageableSelected) manageableDocs.forEach((d) => next.delete(d.id));
      else manageableDocs.forEach((d) => next.add(d.id));
      return next;
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

        {/* 선택 삭제 바 (관리 권한 + 선택 1건 이상) */}
        {canManageAny && selectedIds.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <span className="text-sm font-medium text-red-700">{selectedIds.size}건 선택됨</span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {bulkDeleting ? '삭제 중...' : '선택 삭제'}
            </button>
          </div>
        )}

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
                  {canManageAny && (
                    <th className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label="전체 선택"
                        checked={allManageableSelected}
                        onChange={toggleSelectAll}
                        disabled={manageableDocs.length === 0}
                        className="h-5 w-5 accent-orange-600"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">고객명 / 주문번호</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">상품명</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">발급일</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">상태</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">보기 / 관리</th>
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
                  const manageable = canManageDoc(doc);
                  const isCompleted = st.key === 'COMPLETED';
                  return (
                    <tr key={doc.id} onClick={() => handleRowClick(doc)}
                      className="cursor-pointer transition-colors hover:bg-orange-50">
                      {canManageAny && (
                        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {manageable ? (
                            <input
                              type="checkbox"
                              aria-label={`${buyerName ?? '계약서'} 선택`}
                              checked={selectedIds.has(doc.id)}
                              onChange={() => toggleSelect(doc.id)}
                              className="h-5 w-5 accent-orange-600"
                            />
                          ) : null}
                        </td>
                      )}
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
                        <div className="flex flex-wrap items-center gap-1.5">
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
                          {/* 반려 (관리 권한 + 완료 전) */}
                          {manageable && !isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleReject(doc.id)}
                              disabled={rejectingId === doc.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {rejectingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                              반려
                            </button>
                          )}
                        </div>
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
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
          <ContractBody data={previewData} agentName={agent.displayName} agentPhone={agent.phone} mode="preview" />
        </div>

        {/* ── 다운로드 · 보내기 액션 (계약서 선택 시 활성) ────────────────── */}
        {selectedDoc && (
          <div className="mt-3 space-y-2">
            {/* 계약서 PDF 다운로드 (서명 완료본) */}
            <button
              type="button"
              onClick={() => handleDownloadPdf(selectedDoc.id)}
              disabled={pdfDownloading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-base font-bold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {pdfDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {pdfDownloading ? '여는 중...' : '계약서 PDF 다운로드'}
            </button>

            {/* 서명 링크가 있을 때만 전달·문자·복사 노출 */}
            {selectedDoc.signToken ? (
              <>
              <button
                type="button"
                onClick={openSendModal}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e4a] px-4 py-3 text-base font-bold text-white hover:bg-[#243d5e]"
              >
                <Send className="h-5 w-5" />
                링크·메시지 전달하기
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSendSms}
                  disabled={sendingSms}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-base font-bold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {sendingSms ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
                  {sendingSms ? '보내는 중...' : '문자로 보내기'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Link2 className="h-5 w-5" />
                  링크 복사
                </button>
              </div>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm text-gray-400">
                이 계약서에는 서명 링크가 없어 문자 발송이 어렵습니다.
              </p>
            )}
            <p className="text-center text-xs text-gray-400">
              문자로 보내면 고객이 받은 링크에서 바로 서명할 수 있어요 (7일 이내).
            </p>
          </div>
        )}
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
              <button onClick={handleIssue} disabled={issuing || !(form.orderId || (form.buyerName.trim() && form.buyerTel.trim() && form.productName.trim() && form.amount))}
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
                <p className="mb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">① 구매자 검색 (선택)</p>
                <p className="mb-2 text-[11px] leading-relaxed text-gray-500">검색해서 주문 건을 선택하거나, <span className="font-semibold text-gray-700">검색 없이 아래 ③에 직접 입력</span>해도 계약서를 발급할 수 있어요.</p>
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

              {/* ② 상품 선택 (판매중 상품 드롭다운 + 코드 직접 조회) */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">② 상품 선택 (포함/불포함·환불정책 자동)</p>

                {/* 판매중 상품 검색 드롭다운 */}
                <div className="relative" ref={productDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onFocus={() => { if (productSearchResults.length > 0) setProductDropdownOpen(true); }}
                      placeholder="판매중 상품명·코드로 검색 후 클릭"
                      className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-8 text-xs focus:border-orange-400 focus:outline-none"
                    />
                    {isSearchingProducts && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gray-400" />
                    )}
                    {!isSearchingProducts && productSearch && (
                      <button type="button"
                        onClick={() => { setProductSearch(''); setProductSearchResults([]); setProductDropdownOpen(false); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {productDropdownOpen && productSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                      {productSearchResults.map((p) => (
                        <button key={p.id} type="button"
                          onClick={() => void handleSelectProductFromDropdown(p)}
                          className="flex w-full flex-col gap-0.5 border-b border-gray-50 px-3 py-2 text-left last:border-0 hover:bg-orange-50">
                          <span className="text-xs font-semibold text-gray-800">{p.productName}</span>
                          <span className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>{p.productCode}</span>
                            <span className="font-medium text-gray-600">{formatMoney(p.basePrice)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {productDropdownOpen && !isSearchingProducts && productSearch.trim().length > 0 && productSearchResults.length === 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-400 shadow-xl">
                      판매중 상품 검색 결과가 없습니다.
                    </div>
                  )}
                </div>

                {/* 상품 코드 직접 조회 */}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleLoadProduct(); }}
                    placeholder="또는 상품 코드 직접 입력 (예: MSC001)"
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
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">③ 계약 기본 정보 (직접 입력으로도 발급 가능)</p>
                <p className="text-[11px] leading-relaxed text-gray-500">구매자 검색 없이 <span className="font-semibold text-gray-700">이름·연락처·상품명·금액</span>만 입력하면 바로 발급할 수 있어요. (상품을 ②에서 선택하면 환불정책이 자동 연결됩니다)</p>

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
              <ContractBody data={formToPreview(form)} agentName={agent.displayName} agentPhone={agent.phone} mode="preview" />
            </div>
          </div>
        </ModalShell>
      )}

      {/* ═══ #24 계약서 전달 모달 (링크+메시지 복사 — 자동 SMS 안 함) ═══════════ */}
      {sendModal && (
        <ModalShell
          title="계약서 전달하기"
          maxWidth="max-w-lg"
          onClose={() => setSendModal(null)}
          footer={
            <button
              onClick={() => setSendModal(null)}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-base font-semibold text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
          }
        >
          <div className="space-y-5 p-1">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
              문자가 자동으로 발송되지 않습니다. 아래 <b>링크</b>와 <b>메시지</b>를 복사해서
              카카오톡·문자로 직접 보내주세요. (서명 유효기간 7일)
            </div>

            {/* 서명 링크 */}
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-800">서명 링크</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={sendModal.signUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-700"
                />
                <button
                  onClick={() => copyText(sendModal.signUrl, '링크를 복사했어요. 붙여넣어 보내세요.')}
                  className="shrink-0 rounded-xl bg-[#1a2e4a] px-4 py-3 text-base font-bold text-white hover:bg-[#243d5e]"
                >
                  링크 복사
                </button>
              </div>
            </div>

            {/* 전달 메시지 (수정 가능) */}
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-800">전달 메시지 (수정 가능)</label>
              <textarea
                value={sendModal.message}
                onChange={(e) => setSendModal((s) => (s ? { ...s, message: e.target.value } : s))}
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm leading-relaxed text-gray-700"
              />
              <button
                onClick={() => copyText(sendModal.message, '메시지를 복사했어요. 카카오톡·문자에 붙여넣어 보내세요.')}
                className="mt-2 w-full rounded-xl bg-green-600 px-4 py-3 text-base font-bold text-white hover:bg-green-700"
              >
                메시지 복사 (링크 포함)
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
