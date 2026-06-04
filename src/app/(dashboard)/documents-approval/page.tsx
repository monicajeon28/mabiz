'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Send,
  Search,
  RefreshCw,
  X,
  DollarSign,
  User,
  Package,
  Calendar,
  Loader2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type DocumentType = 'COMPARISON_QUOTE' | 'PURCHASE_CONFIRMATION' | 'REFUND_CERTIFICATE';
type TabType = 'comparison' | 'purchase' | 'refund' | 'contracts';

// ─── SalesDocument types ──────────────────────────────────────────────────────

type ContractFilter = 'all' | 'complete' | 'incomplete';

interface SalesDocumentItem {
  id: string;
  status: string;         // DRAFT | SENT | SIGNED | COMPLETED | PENDING_APPROVAL | APPROVED
  documentType: string;   // PURCHASE_CONTRACT
  orderId: string | null;
  contactId: string | null;
  generatedData: Record<string, unknown>;
  approvedAt: string | null;
  createdAt: string;
  contact?: { name: string | null; phone: string | null } | null;
}

type AffiliateSale = {
  id: string;        // mapped from saleId
  orderId?: string | null;
  productName?: string | null;
  saleAmount: number;
  commissionAmount?: number;
  status: string;    // derived: 'REFUNDED'|'CONFIRMED'|'PAID'|'PENDING'|'CANCELLED'
  paidAt?: string | null;
  refundedAt?: string | null;    // mapped from cancelledAt when refund
  cancelReason?: string | null;
  customerPhone?: string | null;
  createdAt?: string | null;
  affiliateCode?: string | null;
  affiliateUserId?: string | null;
  // extra fields from search-sales
  buyerName?: string | null;
  canIssuePurchaseCert?: boolean;
  canIssueRefundCert?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SALE_STATUS_LABEL: Record<string, string> = {
  REFUNDED: '환불됨',
  CONFIRMED: '확정됨',
  PAID: '지급완료',
  PENDING: '대기중',
  CANCELLED: '취소됨',
};

const SALE_STATUS_COLOR: Record<string, string> = {
  REFUNDED: 'bg-red-50 text-red-700 border-red-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
};


function formatMoney(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

function formatDate(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR');
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsApprovalPage() {
  const [activeTab, setActiveTab] = useState<TabType>('comparison');

  // Sales state
  const [sales, setSales] = useState<AffiliateSale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [selectedSale, setSelectedSale] = useState<AffiliateSale | null>(null);
  const [modalDocType, setModalDocType] = useState<DocumentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Comparison quote form
  const [quoteData, setQuoteData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    productCode: '',
    productName: '',
    ourPrice: 0,
    headcount: '' as string | number,
    cabinType: '',
    fareCategory: '',
    competitorPrices: [{ companyName: '', price: 0, notes: '' }],
  });
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const quotePreviewRef = useRef<HTMLDivElement>(null);

  // ─── Contracts tab state ──────────────────────────────────────────────────
  const [salesDocuments, setSalesDocuments] = useState<SalesDocumentItem[]>([]);
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');
  const [contractLoading, setContractLoading] = useState(false);

  // Send contract modal
  const [sendContractOpen, setSendContractOpen] = useState(false);
  const [sendingContract, setSendingContract] = useState(false);
  const [sendForm, setSendForm] = useState({ orderId: '', specialTerms: '' });

  // ─── Load sales ────────────────────────────────────────────────────────────

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      // search-sales API uses 'q' param; status is handled client-side via filteredSales
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/documents/search-sales?${params}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '판매 목록을 불러오지 못했습니다.');
      }
      // Map search-sales response shape to AffiliateSale shape
      type RawSale = {
        saleId: string;
        orderId?: string | null;
        productName?: string | null;
        saleAmount: number;
        buyerName?: string | null;
        buyerTel?: string | null;
        customerPhone?: string | null;
        paidAt?: string | null;
        cancelledAt?: string | null;
        createdAt?: string | null;
        canIssuePurchaseCert?: boolean;
        canIssueRefundCert?: boolean;
      };
      const mapped: AffiliateSale[] = (json.sales || []).map((s: RawSale) => {
        // Derive status from capabilities
        let status = 'PENDING';
        if (s.cancelledAt && s.canIssueRefundCert) status = 'REFUNDED';
        else if (s.paidAt) status = 'PAID';
        else if (s.canIssuePurchaseCert) status = 'CONFIRMED';
        return {
          id: s.saleId,
          orderId: s.orderId,
          productName: s.productName,
          saleAmount: s.saleAmount,
          status,
          paidAt: s.paidAt,
          refundedAt: s.cancelledAt ?? null,
          createdAt: s.createdAt ?? null,
          customerPhone: s.customerPhone ?? s.buyerTel ?? null,
          buyerName: s.buyerName,
          canIssuePurchaseCert: s.canIssuePurchaseCert,
          canIssueRefundCert: s.canIssueRefundCert,
        };
      });
      setSales(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '판매 목록 로드 실패';
      showError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab !== 'contracts') {
      loadSales();
    }
    // activeTab 변경 시만 재로드 (searchQuery 타이핑마다 자동 호출 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── Load contracts (SalesDocument) ───────────────────────────────────────

  const loadContracts = useCallback(async () => {
    setContractLoading(true);
    try {
      const res = await fetch('/api/documents/purchase-contract');
      const json = await res.json();
      if (json.ok) {
        setSalesDocuments(json.documents || []);
      } else {
        showError(json.message || '계약서 목록 로드 실패');
      }
    } catch {
      showError('네트워크 오류');
    } finally {
      setContractLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'contracts') {
      loadContracts();
    }
  }, [activeTab, loadContracts]);

  // ─── Tab-filtered sales ───────────────────────────────────────────────────

  const filteredSales = sales.filter((s) => {
    // Tab-level filter
    if (activeTab === 'comparison') {
      if (s.status === 'REFUNDED' || s.status === 'CANCELLED') return false;
    } else if (activeTab === 'purchase') {
      if (s.status !== 'CONFIRMED' && s.status !== 'PAID') return false;
    } else if (activeTab === 'refund') {
      if (s.status !== 'REFUNDED') return false;
    } else {
      return false;
    }
    // Status dropdown filter (secondary)
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  // ─── Filtered contracts ───────────────────────────────────────────────────

  const filteredContracts = salesDocuments.filter((c) => {
    const signStatus = typeof c.generatedData?.signStatus === 'string' ? c.generatedData.signStatus : null;
    if (contractFilter === 'complete') {
      return c.status === 'SIGNED' || c.status === 'COMPLETED' || signStatus === 'SIGNED';
    }
    if (contractFilter === 'incomplete') {
      return (
        c.status === 'DRAFT' ||
        c.status === 'SENT' ||
        c.status === 'PENDING_APPROVAL' ||
        (c.status === 'APPROVED' && signStatus !== 'SIGNED')
      );
    }
    return true;
  });

  // ─── Modal open/close ──────────────────────────────────────────────────────

  const openModal = (sale: AffiliateSale, docType: DocumentType) => {
    setSelectedSale(sale);
    setModalDocType(docType);
    setQuoteData({
      customerName: '',
      customerPhone: sale.customerPhone || '',
      customerEmail: '',
      productCode: '',
      productName: sale.productName || '',
      ourPrice: sale.saleAmount,
      headcount: '',
      cabinType: '',
      fareCategory: '',
      competitorPrices: [{ companyName: '', price: 0, notes: '' }],
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSale(null);
    setModalDocType(null);
  };

  // ─── Load product info ─────────────────────────────────────────────────────

  const loadProductInfo = async (productCode: string) => {
    if (!productCode.trim()) {
      showError('상품 코드를 입력해주세요.');
      return;
    }
    setIsLoadingProduct(true);
    try {
      const res = await fetch(
        `/api/admin/affiliate/documents/product-info?productCode=${encodeURIComponent(productCode)}`
      );
      const json = await res.json();
      if (res.ok && json.ok && json.product) {
        setQuoteData((prev) => ({
          ...prev,
          productName: json.product.productName || prev.productName,
          productCode: json.product.productCode || prev.productCode,
          ourPrice: json.product.basePrice || prev.ourPrice,
        }));
        showSuccess('상품 정보를 불러왔습니다.');
      } else {
        showError(json.message || '상품 정보를 찾을 수 없습니다.');
      }
    } catch {
      showError('상품 정보 조회 실패');
    } finally {
      setIsLoadingProduct(false);
    }
  };

  // ─── Download comparison quote as image ───────────────────────────────────

  const handleDownloadImage = async () => {
    if (!quotePreviewRef.current) {
      showError('견적서 미리보기를 찾을 수 없습니다.');
      return;
    }
    setIsDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(quotePreviewRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `비교견적서_${quoteData.customerName || '고객'}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess('비교견적서 이미지가 다운로드되었습니다.');
    } catch {
      showError('이미지 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Generate / send document ──────────────────────────────────────────────

  const handleGenerateDocument = async () => {
    if (!selectedSale || !modalDocType) return;

    if (modalDocType === 'COMPARISON_QUOTE') {
      if (!quoteData.customerName || !quoteData.ourPrice) {
        showError('고객명과 가격은 필수입니다.');
        return;
      }
      await handleDownloadImage();
      closeModal();
      return;
    }

    if (!selectedSale.orderId) {
      showError('주문번호가 없어 문서를 발급할 수 없습니다.');
      return;
    }

    setIsGenerating(true);
    try {
      const endpoint =
        modalDocType === 'PURCHASE_CONFIRMATION'
          ? '/api/documents/purchase-cert'
          : '/api/documents/refund-cert';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: selectedSale.orderId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.message || '문서 생성에 실패했습니다.');
      }
      showSuccess(json.message || '문서가 생성되었습니다.');
      closeModal();
      loadSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '문서 생성 오류';
      showError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Send contract ─────────────────────────────────────────────────────────

  const handleSendContract = async () => {
    if (!sendForm.orderId.trim()) {
      showError('주문번호(orderId)를 입력해주세요.');
      return;
    }
    setSendingContract(true);
    try {
      const res = await fetch('/api/documents/purchase-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: sendForm.orderId.trim(),
          specialTerms: sendForm.specialTerms.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        showSuccess('구매계약서가 발급되었습니다.');
        setSendContractOpen(false);
        setSendForm({ orderId: '', specialTerms: '' });
        loadContracts();
      } else {
        showError(json.error || json.message || '계약서 발급 실패');
      }
    } catch {
      showError('계약서 발급 중 오류 발생');
    } finally {
      setSendingContract(false);
    }
  };

  // ─── Competitor price helpers ──────────────────────────────────────────────

  const addCompetitorPrice = () =>
    setQuoteData((prev) => ({
      ...prev,
      competitorPrices: [...prev.competitorPrices, { companyName: '', price: 0, notes: '' }],
    }));

  const removeCompetitorPrice = (i: number) =>
    setQuoteData((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.filter((_, idx) => idx !== i),
    }));

  const updateCompetitorPrice = (i: number, field: string, value: string | number) =>
    setQuoteData((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.map((cp, idx) =>
        idx === i ? { ...cp, [field]: value } : cp
      ),
    }));

  // ─── Tab config ───────────────────────────────────────────────────────────

  const TAB_CONFIG: { key: TabType; label: string; emptyMsg: string }[] = [
    { key: 'comparison', label: '비교견적서', emptyMsg: '비교견적서를 발급할 판매 내역이 없습니다.' },
    { key: 'purchase', label: '구매확인증서', emptyMsg: '구매확인서를 발급할 확정/지급완료 판매 내역이 없습니다.' },
    { key: 'refund', label: '환불인증서', emptyMsg: '환불인증서를 발급할 환불 내역이 없습니다.' },
    { key: 'contracts', label: '계약서 관리', emptyMsg: '' },
  ];

  const getDocTypeForTab = (tab: TabType): DocumentType | null => {
    if (tab === 'comparison') return 'COMPARISON_QUOTE';
    if (tab === 'purchase') return 'PURCHASE_CONFIRMATION';
    if (tab === 'refund') return 'REFUND_CERTIFICATE';
    return null;
  };

  const getActionLabel = (tab: TabType) => {
    if (tab === 'comparison') return '견적서 생성';
    if (tab === 'purchase') return '확인서 발송';
    if (tab === 'refund') return '환불증서 생성';
    return '';
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-10 md:px-6">

        {/* Header */}
        <header className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold">서류관리</h1>
              <p className="mt-1 text-sm text-slate-300">
                비교견적서, 구매확인증서, 환불인증서를 생성하고 관리합니다.
              </p>
            </div>
            <button
              onClick={() => {
                if (activeTab === 'contracts') loadContracts();
                else loadSales();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </button>
          </div>
        </header>

        {/* Tabs + filter bar */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-200">
          <nav className="flex gap-1 px-4 pt-2" aria-label="서류관리 탭">
            {TAB_CONFIG.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setStatusFilter('all'); setSearchQuery(''); }}
                className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all duration-200 ${
                  activeTab === key
                    ? key === 'contracts'
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Search / filter — non-contracts tabs */}
          {activeTab !== 'contracts' && (
            <div className="border-t border-gray-100 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadSales()}
                  placeholder="주문번호·상품명·고객 전화번호로 검색"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="all">전체 상태</option>
                <option value="PENDING">대기중</option>
                <option value="CONFIRMED">확정됨</option>
                <option value="PAID">지급완료</option>
                <option value="REFUNDED">환불됨</option>
                <option value="CANCELLED">취소됨</option>
              </select>
              <button
                onClick={loadSales}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                <Search className="h-4 w-4" />
                검색
              </button>
            </div>
          )}

          {/* Contracts filter bar */}
          {activeTab === 'contracts' && (
            <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSendContractOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                계약서 보내기
              </button>
              <div className="flex gap-1.5 ml-auto">
                {(['all', 'complete', 'incomplete'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setContractFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      contractFilter === f
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? '전체' : f === 'complete' ? '완료' : '미완료'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Sales list (comparison / purchase / refund tabs) ────────────── */}
        {activeTab !== 'contracts' && (
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-24 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                로드 중...
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center text-gray-500">
                <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p>{TAB_CONFIG.find((t) => t.key === activeTab)?.emptyMsg}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSales.map((sale) => {
                  const docType = getDocTypeForTab(activeTab)!;
                  return (
                    <div
                      key={sale.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">
                              {sale.productName || '(상품명 없음)'}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                                SALE_STATUS_COLOR[sale.status] || 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              {SALE_STATUS_LABEL[sale.status] || sale.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {sale.orderId && (
                              <span className="flex items-center gap-1">
                                <Package className="h-3.5 w-3.5" />
                                {sale.orderId}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3.5 w-3.5" />
                              {formatMoney(sale.saleAmount)}
                            </span>
                            {sale.customerPhone && (
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {sale.customerPhone}
                              </span>
                            )}
                            {(sale.paidAt || sale.createdAt) && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(sale.paidAt || sale.createdAt)}
                              </span>
                            )}
                            {sale.refundedAt && (
                              <span className="flex items-center gap-1 text-red-500">
                                <RotateCcw className="h-3.5 w-3.5" />
                                환불 {formatDate(sale.refundedAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => openModal(sale, docType)}
                          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                            activeTab === 'comparison'
                              ? 'bg-indigo-600 hover:bg-indigo-700'
                              : activeTab === 'purchase'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {activeTab === 'comparison' && <Download className="h-4 w-4" />}
                          {activeTab === 'purchase' && <Send className="h-4 w-4" />}
                          {activeTab === 'refund' && <FileText className="h-4 w-4" />}
                          {getActionLabel(activeTab)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Contracts tab ──────────────────────────────────────────────── */}
        {activeTab === 'contracts' && (
          <div>
            {contractLoading ? (
              <div className="flex items-center justify-center py-24 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                로드 중...
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center text-gray-500">
                <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p>계약서가 없습니다.</p>
                <button
                  onClick={() => setSendContractOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  계약서 보내기
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">고객명 / 주문번호</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">상품명</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">발급일</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">상태</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">계약서 보기</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredContracts.map((contract) => {
                      const gd = contract.generatedData;
                      const signStatus = typeof gd?.signStatus === 'string' ? gd.signStatus : null;
                      const isComplete = contract.status === 'SIGNED' || contract.status === 'COMPLETED' || signStatus === 'SIGNED';
                      const isSent = !isComplete && (contract.status === 'SENT' || contract.status === 'APPROVED' || contract.status === 'PENDING_APPROVAL');
                      const statusConfig = isComplete
                        ? { icon: '✅', label: '완료', cls: 'bg-green-50 text-green-700 border-green-200' }
                        : isSent
                        ? { icon: '📤', label: '발송됨', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
                        : { icon: '⏳', label: '미발송', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
                      const driveFileId = typeof gd?.driveFileId === 'string' ? gd.driveFileId : null;
                      const signToken = typeof gd?.signToken === 'string' ? gd.signToken : null;
                      const buyerName = typeof gd?.buyerName === 'string' ? gd.buyerName : null;
                      const productName = typeof gd?.productName === 'string' ? gd.productName : null;

                      return (
                        <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-900">
                            <div className="flex flex-col gap-0.5">
                              {buyerName ? (
                                <span className="font-medium text-gray-800">{buyerName}</span>
                              ) : contract.contact?.name ? (
                                <span className="font-medium text-gray-800">{contract.contact.name}</span>
                              ) : (
                                <span className="text-gray-400 italic">미지정</span>
                              )}
                              {contract.orderId && (
                                <span className="text-xs text-gray-400">{contract.orderId}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {productName ?? <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(contract.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusConfig.cls}`}
                            >
                              {statusConfig.icon} {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {driveFileId ? (
                              <a
                                href={`https://drive.google.com/file/d/${driveFileId}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                PDF 보기
                              </a>
                            ) : signToken ? (
                              <a
                                href={`/contract/sign/${contract.id}?token=${signToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                계약서 확인
                              </a>
                            ) : (
                              <button
                                disabled
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400 cursor-not-allowed"
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
          </div>
        )}
      </div>

      {/* ─── Document generation modal ──────────────────────────────────── */}
      {isModalOpen && selectedSale && modalDocType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl bg-white px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {modalDocType === 'COMPARISON_QUOTE' && '타사 비교 견적서 생성'}
                {modalDocType === 'PURCHASE_CONFIRMATION' && '구매확인서 발송'}
                {modalDocType === 'REFUND_CERTIFICATE' && '환불완료증서 생성'}
              </h2>
              <button
                onClick={closeModal}
                disabled={isGenerating || isDownloading}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Sale summary */}
              <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1">
                <p className="font-semibold text-gray-700">판매 정보</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-600 mt-1">
                  <span>{selectedSale.productName || '(상품명 없음)'}</span>
                  <span>{formatMoney(selectedSale.saleAmount)}</span>
                  {selectedSale.orderId && <span>주문번호: {selectedSale.orderId}</span>}
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      SALE_STATUS_COLOR[selectedSale.status] || 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {SALE_STATUS_LABEL[selectedSale.status] || selectedSale.status}
                  </span>
                </div>
              </div>

              {/* COMPARISON_QUOTE form */}
              {modalDocType === 'COMPARISON_QUOTE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        고객명 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={quoteData.customerName}
                        onChange={(e) => setQuoteData((p) => ({ ...p, customerName: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="고객 이름"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
                      <input
                        type="text"
                        value={quoteData.customerPhone}
                        onChange={(e) => setQuoteData((p) => ({ ...p, customerPhone: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="010-0000-0000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
                      <input
                        type="email"
                        value={quoteData.customerEmail}
                        onChange={(e) => setQuoteData((p) => ({ ...p, customerEmail: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="customer@example.com"
                      />
                    </div>
                  </div>

                  {/* Product info */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">상품 정보</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={quoteData.productCode}
                        onChange={(e) => setQuoteData((p) => ({ ...p, productCode: e.target.value }))}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="상품 코드"
                      />
                      <button
                        type="button"
                        onClick={() => loadProductInfo(quoteData.productCode)}
                        disabled={isLoadingProduct}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {isLoadingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        조회
                      </button>
                    </div>
                    <input
                      type="text"
                      value={quoteData.productName}
                      onChange={(e) => setQuoteData((p) => ({ ...p, productName: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="상품명"
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">
                          당사 가격 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={quoteData.ourPrice}
                          onChange={(e) => setQuoteData((p) => ({ ...p, ourPrice: Number(e.target.value) }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">인원 수</label>
                        <input
                          type="number"
                          value={quoteData.headcount}
                          onChange={(e) => setQuoteData((p) => ({ ...p, headcount: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="예: 2"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">객실 유형</label>
                        <input
                          type="text"
                          value={quoteData.cabinType}
                          onChange={(e) => setQuoteData((p) => ({ ...p, cabinType: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="예: 발코니"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Competitor prices */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">경쟁사 가격</p>
                      <button
                        type="button"
                        onClick={addCompetitorPrice}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        추가
                      </button>
                    </div>
                    {quoteData.competitorPrices.map((cp, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={cp.companyName}
                          onChange={(e) => updateCompetitorPrice(i, 'companyName', e.target.value)}
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="업체명"
                        />
                        <input
                          type="number"
                          value={cp.price}
                          onChange={(e) => updateCompetitorPrice(i, 'price', Number(e.target.value))}
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="가격"
                        />
                        <input
                          type="text"
                          value={cp.notes}
                          onChange={(e) => updateCompetitorPrice(i, 'notes', e.target.value)}
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="비고"
                        />
                        {quoteData.competitorPrices.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCompetitorPrice(i)}
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Preview */}
                  <div>
                    <p className="mb-2 text-sm font-semibold text-gray-700">미리보기 (다운로드 이미지)</p>
                    <div
                      ref={quotePreviewRef}
                      className="rounded-xl border border-gray-200 bg-white p-6 text-sm space-y-4"
                    >
                      <div className="text-center border-b pb-3">
                        <h3 className="text-xl font-extrabold text-gray-900">타사 비교 견적서</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          발행일: {new Date().toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <div className="space-y-1 text-gray-700">
                        <p><span className="font-semibold">고객명:</span> {quoteData.customerName || '-'}</p>
                        {quoteData.customerPhone && (
                          <p><span className="font-semibold">연락처:</span> {quoteData.customerPhone}</p>
                        )}
                      </div>
                      <div className="space-y-1 text-gray-700">
                        <p><span className="font-semibold">상품명:</span> {quoteData.productName || '-'}</p>
                        {quoteData.cabinType && (
                          <p><span className="font-semibold">객실 유형:</span> {quoteData.cabinType}</p>
                        )}
                        {quoteData.headcount && (
                          <p><span className="font-semibold">인원:</span> {quoteData.headcount}명</p>
                        )}
                      </div>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-indigo-50 text-indigo-700">
                            <th className="border border-gray-200 px-3 py-2 text-left font-semibold">업체명</th>
                            <th className="border border-gray-200 px-3 py-2 text-right font-semibold">가격</th>
                            <th className="border border-gray-200 px-3 py-2 text-left font-semibold">비고</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-emerald-50">
                            <td className="border border-gray-200 px-3 py-2 font-semibold text-emerald-700">
                              당사 (최저가)
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right font-bold text-emerald-700">
                              {formatMoney(quoteData.ourPrice)}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-500">-</td>
                          </tr>
                          {quoteData.competitorPrices
                            .filter((cp) => cp.companyName || cp.price)
                            .map((cp, i) => (
                              <tr key={i}>
                                <td className="border border-gray-200 px-3 py-2">{cp.companyName || '-'}</td>
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
                      {(() => {
                        const validComp = quoteData.competitorPrices.filter((cp) => cp.price > 0);
                        if (quoteData.ourPrice > 0 && validComp.length > 0) {
                          const minComp = Math.min(...validComp.map((cp) => cp.price));
                          const diff = minComp - quoteData.ourPrice;
                          if (diff > 0) {
                            return (
                              <p className="text-center font-bold text-emerald-600 text-base">
                                최저 경쟁사 대비 {formatMoney(diff)} 저렴합니다!
                              </p>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* PURCHASE_CONFIRMATION info */}
              {modalDocType === 'PURCHASE_CONFIRMATION' && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
                  <p className="font-semibold mb-1">구매확인서 발송</p>
                  <p>선택한 판매 건에 대한 구매확인서를 생성하고 발송합니다.</p>
                  <p className="mt-1 text-emerald-600">
                    결제 금액: <strong>{formatMoney(selectedSale.saleAmount)}</strong>
                  </p>
                </div>
              )}

              {/* REFUND_CERTIFICATE info */}
              {modalDocType === 'REFUND_CERTIFICATE' && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                  <p className="font-semibold mb-1">환불완료증서 생성</p>
                  <p>해당 판매 건의 환불완료증서를 생성합니다.</p>
                  <p className="mt-1 text-red-600">
                    환불 금액: <strong>{formatMoney(selectedSale.saleAmount)}</strong>
                  </p>
                  {selectedSale.refundedAt && (
                    <p className="text-red-600">
                      환불일: <strong>{formatDate(selectedSale.refundedAt)}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 z-10 flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-white px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleGenerateDocument}
                disabled={isGenerating || isDownloading}
                className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                  modalDocType === 'COMPARISON_QUOTE'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : modalDocType === 'PURCHASE_CONFIRMATION'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {(isGenerating || isDownloading) && <Loader2 className="h-4 w-4 animate-spin" />}
                {modalDocType === 'COMPARISON_QUOTE' && '이미지 다운로드'}
                {modalDocType === 'PURCHASE_CONFIRMATION' && '발송하기'}
                {modalDocType === 'REFUND_CERTIFICATE' && '증서 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Send contract modal ─────────────────────────────────────────── */}
      {sendContractOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-2xl border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">계약서 보내기</h2>
              <button
                onClick={() => { setSendContractOpen(false); setSendForm({ orderId: '', specialTerms: '' }); }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  주문번호 (orderId) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sendForm.orderId}
                  onChange={(e) => setSendForm((p) => ({ ...p, orderId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="결제 완료된 주문번호 입력"
                />
                <p className="mt-1 text-xs text-gray-400">결제 완료(completed) 건만 발급 가능합니다.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  특약사항 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <textarea
                  value={sendForm.specialTerms}
                  onChange={(e) => setSendForm((p) => ({ ...p, specialTerms: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  placeholder="특약사항이 있으면 입력 (없으면 빈칸)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => { setSendContractOpen(false); setSendForm({ orderId: '', specialTerms: '' }); }}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSendContract}
                disabled={sendingContract || !sendForm.orderId.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {sendingContract && <Loader2 className="h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4" />
                계약서 발급
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
