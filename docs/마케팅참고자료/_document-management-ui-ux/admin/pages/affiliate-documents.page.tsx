'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiFileText,
  FiDownload,
  FiSend,
  FiSearch,
  FiRefreshCw,
  FiX,
  FiCheckCircle,
  FiDollarSign,
  FiUser,
  FiPackage,
  FiCalendar,
  FiImage,
  FiLoader,
  FiExternalLink,
  FiArrowLeft,
  FiHome,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import html2canvas from 'html2canvas';
import ComparisonQuoteImage from '@/components/admin/ComparisonQuoteImage';
import AffiliateCertificate from '@/components/affiliate/documents/AffiliateCertificate';
import CertificateApprovals from '@/components/admin/documents/CertificateApprovals';

type DocumentType = 'COMPARISON_QUOTE' | 'PURCHASE_CONFIRMATION' | 'REFUND_CERTIFICATE';

type AffiliateSale = {
  id: number;
  externalOrderCode: string | null;
  productCode: string | null;
  saleAmount: number;
  status: string;
  saleDate: string | null;
  refundedAt: string | null;
  cancellationReason: string | null;
  lead: {
    id: number;
    customerName: string | null;
    customerPhone: string | null;
  } | null;
  product: {
    productName: string | null;
  } | null;
  manager: {
    id: number;
    displayName: string | null;
  } | null;
  agent: {
    id: number;
    displayName: string | null;
  } | null;
};

type TabType = 'comparison' | 'purchase' | 'refund' | 'approvals';

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('comparison');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [sales, setSales] = useState<AffiliateSale[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    documentType: 'all' as DocumentType | 'all',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<AffiliateSale | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const quoteImageRef = useRef<HTMLDivElement>(null);

  // 판매원 프로필 정보 로드 (대시보드 경로 확인용)
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/partner/profile', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          // API 응답 형식: profile.user.mallUserId 또는 profile.User.mallUserId
          const mallUserId = data.profile?.user?.mallUserId || data.profile?.User?.mallUserId;
          if (mallUserId) {
            setPartnerId(mallUserId);
          }
        }
      } catch (error) {
        console.error('[AdminDocumentsPage] Failed to load profile:', error);
      }
    };
    loadProfile();
  }, []);

  // 타사 비교 견적서 폼 데이터
  const [comparisonQuoteData, setComparisonQuoteData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    productCode: '',
    productName: '',
    ourPrice: 0,
    competitorPrices: [{ companyName: '', price: 0, notes: '' }],
    headcount: undefined as number | undefined,
    cabinType: '',
    fareCategory: '',
  });

  // 고객 검색 관련 (비교견적서용)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingCustomerSearch, setIsLoadingCustomerSearch] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 제안 목록 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 고객 검색 함수
  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.trim().length < 1) {
      setCustomerSuggestions([]);
      setIsLoadingCustomerSearch(false);
      return;
    }

    try {
      setIsLoadingCustomerSearch(true);
      const response = await fetch(`/api/admin/affiliate/customers/search?q=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const result = await response.json();
        if (result.ok) {
          setCustomerSuggestions(result.customers || []);
        }
      }
    } catch (error) {
      console.error('Customer search error:', error);
    } finally {
      setIsLoadingCustomerSearch(false);
    }
  }, []);

  // 고객 검색 입력 핸들러
  const handleCustomerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerSearchQuery(value);
    setComparisonQuoteData(prev => ({ ...prev, customerName: value }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 1) {
      setShowSuggestions(true);
      searchTimeoutRef.current = setTimeout(() => {
        searchCustomers(value);
      }, 200);
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // 고객 선택 핸들러
  const handleCustomerSelect = (customer: any) => {
    setCustomerSearchQuery(customer.displayName || customer.name);
    setComparisonQuoteData(prev => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone || prev.customerPhone,
      customerEmail: customer.email || prev.customerEmail,
    }));
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  const loadSales = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filters.status !== 'all') {
        params.set('status', filters.status);
      }
      if (filters.search.trim()) {
        params.set('search', filters.search.trim());
      }

      const res = await fetch(`/api/admin/affiliate/sales?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '판매 목록을 불러오지 못했습니다.');
      }

      setSales(json.sales || []);
    } catch (error: any) {
      console.error('[AdminDocuments] load error', error);
      showError(error.message || '판매 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filters.status, filters.search]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleOpenModal = (sale: AffiliateSale, documentType: DocumentType) => {
    setSelectedSale(sale);
    setSelectedDocumentType(documentType);

    // 판매 정보로 폼 초기화
    if (documentType === 'COMPARISON_QUOTE') {
      setComparisonQuoteData({
        customerName: sale.lead?.customerName || '',
        customerPhone: sale.lead?.customerPhone || '',
        customerEmail: '',
        productCode: sale.productCode || '',
        productName: sale.product?.productName || '',
        ourPrice: sale.saleAmount,
        competitorPrices: [{ companyName: '', price: 0, notes: '' }],
        headcount: undefined,
        cabinType: '',
        fareCategory: '',
      });
      setCustomerSearchQuery(sale.lead?.customerName || '');
      setCustomerSearchQuery(sale.lead?.customerName || '');

      // 상품 코드가 있으면 상품 정보 자동 불러오기
      if (sale.productCode) {
        loadProductInfo(sale.productCode);
      }
    }

    setIsModalOpen(true);
  };

  const loadProductInfo = async (productCode: string) => {
    try {
      setIsLoadingProduct(true);
      const res = await fetch(`/api/admin/affiliate/documents/product-info?productCode=${encodeURIComponent(productCode)}`);
      const json = await res.json();

      if (res.ok && json.ok && json.product) {
        setComparisonQuoteData((prev) => ({
          ...prev,
          productName: json.product.productName,
          productCode: json.product.productCode,
          ourPrice: json.product.basePrice || prev.ourPrice,
        }));
        showSuccess('상품 정보를 불러왔습니다.');
      }
    } catch (error: any) {
      console.error('[Load Product Info] Error:', error);
      // 상품 정보 불러오기 실패해도 계속 진행
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleLoadProductInfo = () => {
    if (!comparisonQuoteData.productCode.trim()) {
      showError('상품 코드를 입력해주세요.');
      return;
    }
    loadProductInfo(comparisonQuoteData.productCode.trim());
  };

  const handleDownloadImage = async () => {
    if (!quoteImageRef.current) {
      showError('견적서 이미지를 찾을 수 없습니다.');
      return;
    }

    try {
      setIsDownloadingImage(true);

      // html2canvas로 이미지 생성
      const canvas = await html2canvas(quoteImageRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // 고해상도
        logging: false,
        useCORS: true,
      });

      // PNG로 다운로드
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const fileName = `비교견적서_${comparisonQuoteData.customerName}_${new Date().toISOString().split('T')[0]}.png`;
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('견적서 이미지가 다운로드되었습니다.');
    } catch (error: any) {
      console.error('[Download Image] Error:', error);
      showError('이미지 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleGenerateDocument = async () => {
    if (!selectedSale || !selectedDocumentType) return;

    try {
      setIsGenerating(true);

      // 비교견적서는 이미지 다운로드만 (API 호출 없음)
      if (selectedDocumentType === 'COMPARISON_QUOTE') {
        if (!comparisonQuoteData.customerName || !comparisonQuoteData.productCode || !comparisonQuoteData.ourPrice) {
          showError('필수 정보를 입력해주세요 (고객명, 상품코드, 가격)');
          return;
        }

        // 이미지 다운로드
        await handleDownloadImage();
        showSuccess('비교견적서 이미지가 다운로드되었습니다.');
        setIsModalOpen(false);
        setSelectedSale(null);
        setSelectedDocumentType(null);
        return;
      }

      // 구매확인서, 환불완료증서는 API 호출
      let requestBody: any = {
        documentType: selectedDocumentType,
        saleId: selectedSale.id,
        leadId: selectedSale.lead?.id,
      };

      const res = await fetch('/api/admin/affiliate/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '문서 생성에 실패했습니다.');
      }

      showSuccess(json.message || '문서가 생성되었습니다.');
      setIsModalOpen(false);
      setSelectedSale(null);
      setSelectedDocumentType(null);
    } catch (error: any) {
      console.error('[AdminDocuments] generate error', error);
      showError(error.message || '문서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addCompetitorPrice = () => {
    setComparisonQuoteData((prev) => ({
      ...prev,
      competitorPrices: [...prev.competitorPrices, { companyName: '', price: 0, notes: '' }],
    }));
  };

  const removeCompetitorPrice = (index: number) => {
    setComparisonQuoteData((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.filter((_, i) => i !== index),
    }));
  };

  const updateCompetitorPrice = (index: number, field: string, value: string | number) => {
    setComparisonQuoteData((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.map((cp, i) =>
        i === index ? { ...cp, [field]: value } : cp
      ),
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REFUNDED':
        return 'bg-red-50 text-red-700';
      case 'CONFIRMED':
      case 'PAID':
        return 'bg-emerald-50 text-emerald-700';
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'REFUNDED':
        return '환불됨';
      case 'CONFIRMED':
        return '확정됨';
      case 'PAID':
        return '지급완료';
      case 'PENDING':
        return '대기중';
      default:
        return status;
    }
  };

  const getDocumentTypeLabel = (type: DocumentType) => {
    switch (type) {
      case 'COMPARISON_QUOTE':
        return '타사 비교 견적서';
      case 'PURCHASE_CONFIRMATION':
        return '구매확인서';
      case 'REFUND_CERTIFICATE':
        return '환불완료증서';
    }
  };

  const canGenerateDocument = (sale: AffiliateSale, type: DocumentType) => {
    switch (type) {
      case 'COMPARISON_QUOTE':
        return sale.status !== 'REFUNDED' && sale.status !== 'CANCELLED';
      case 'PURCHASE_CONFIRMATION':
        return sale.status === 'CONFIRMED' || sale.status === 'PAID';
      case 'REFUND_CERTIFICATE':
        return sale.status === 'REFUNDED';
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-10 md:px-6">
        {/* 헤더 */}
        <header className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {partnerId && (
                <button
                  onClick={() => router.push(`/partner/${partnerId}/dashboard`)}
                  className="inline-flex items-center justify-center rounded-xl bg-white/20 p-2.5 text-white hover:bg-white/30 transition-colors"
                  title="판매원 대시보드로 돌아가기"
                >
                  <FiHome className="text-xl" />
                </button>
              )}
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold">서류관리</h1>
                <p className="text-sm text-slate-300">
                  타사 비교 견적서, 구매확인서, 환불완료증서를 생성하고 관리합니다.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30"
              >
                <FiHome className="text-base" />
                대시보드로 돌아가기
              </button>
              {activeTab === 'comparison' && (
                <button
                  onClick={loadSales}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30"
                >
                  <FiRefreshCw className="text-base" />
                  새로고침
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 탭 네비게이션 */}
        <div className="mb-6 border-b border-gray-200 bg-white rounded-lg shadow-sm">
          <nav className="flex gap-1 px-4" aria-label="문서 탭">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg ${activeTab === 'comparison'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              비교견적서
            </button>
            <button
              onClick={() => setActiveTab('purchase')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg ${activeTab === 'purchase'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              구매확인증서
            </button>
            <button
              onClick={() => setActiveTab('refund')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg ${activeTab === 'refund'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              환불인증서
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg ${activeTab === 'approvals'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              승인 관리
            </button>
          </nav>
        </div>

        {/* 탭 콘텐츠 */}
        {/* ... 나머지 콘텐츠 ... */}
      </div>
    </div>
  );
}
