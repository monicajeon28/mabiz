'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import Image from 'next/image';
import { Download, Send, CheckCircle, Clock, XCircle, Mail } from 'lucide-react';
import { showSuccess, showError } from '@/components/ui/Toast';

interface AffiliateCertificateProps {
  type: 'purchase' | 'refund';
  searchApiUrl?: string;
}

interface CertificateData {
  customerName: string;
  birthDate: string;
  productName: string;
  paymentAmount: number;
  paymentDate: string;
  refundAmount?: number;
  refundDate?: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  displayName: string;
}

interface ApprovalRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  rejectedReason?: string;
  approvedByType?: string;
}

interface ProductDetails {
  tags?: string[];
  visitedCountries?: string[];
  destinations?: string[];
  nights?: number;
  days?: number;
  cruiseLine?: string;
  shipName?: string;
  included?: string[];
  excluded?: string[];
  refundPolicy?: string;
  flightInfo?: any;
  hasGuide?: boolean;
  hasEscort?: boolean;
  hasCruiseDotStaff?: boolean;
  hasTravelInsurance?: boolean;
}

interface ActiveProduct {
  id: number;
  productCode: string;
  packageName: string;
  cruiseLine: string;
  shipName: string;
  nights: number;
  days: number;
  basePrice: number;
  tags?: string[];
  visitedCountries?: string[];
  destinations?: string[];
  included?: string[];
  excluded?: string[];
  refundPolicy?: string;
  flightInfo?: any;
  hasGuide?: boolean;
  hasEscort?: boolean;
  hasCruiseDotStaff?: boolean;
  hasTravelInsurance?: boolean;
}

export default function AffiliateCertificate({ type, searchApiUrl }: AffiliateCertificateProps) {
  console.log('[AffiliateCertificate] Rendering with type:', type);

  const certificateRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCreatingSample, setIsCreatingSample] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');

  const [data, setData] = useState<CertificateData>({
    customerName: '',
    birthDate: '',
    productName: '',
    paymentAmount: 0,
    paymentDate: '',
    refundAmount: 0,
    refundDate: '',
  });

  const [confirmedRefundAmount, setConfirmedRefundAmount] = useState<number | null>(null);
  const [confirmedRefundDate, setConfirmedRefundDate] = useState<string>('');

  // 고객 검색 관련
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isLoadingCustomerInfo, setIsLoadingCustomerInfo] = useState(false);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 상품 검색 관련
  const [activeProducts, setActiveProducts] = useState<ActiveProduct[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);
  const productSuggestionsRef = useRef<HTMLDivElement>(null);

  // 승인 요청 관련
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);

  const [issueDate, setIssueDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  });

  // type이 변경될 때 상태 초기화
  useEffect(() => {
    console.log('[AffiliateCertificate] Type changed, resetting state. New type:', type);
    setData({
      customerName: '',
      birthDate: '',
      productName: '',
      paymentAmount: 0,
      paymentDate: '',
      refundAmount: 0,
      refundDate: '',
    });
    setCustomerSearchQuery('');
    setCustomerSuggestions([]);
    setShowSuggestions(false);
    setSelectedCustomerId(null);
    setConfirmedRefundAmount(null);
    setConfirmedRefundDate('');
    setApprovalRequest(null);
    setCustomerEmail('');
    setProductDetails(null);
    setShowProductDropdown(false);
  }, [type]);

  // 활성 상품 목록 로드
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/partner/products/active');
        if (res.ok) {
          const json = await res.json();
          if (json.ok) {
            setActiveProducts(json.products || []);
          }
        }
      } catch (error) {
        console.error('Failed to load active products:', error);
      }
    };
    loadProducts();
  }, []);

  // 고객 검색 (판매원의 고객만) - 인증서 유형에 따라 필터링
  // purchase: 구매완료 고객만, refund: 환불완료 고객만
  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.trim().length < 1) {
      setCustomerSuggestions([]);
      setIsLoadingCustomerInfo(false);
      return;
    }

    try {
      setIsLoadingCustomerInfo(true);
      // 판매원의 고객만 검색하는 API 사용 (또는 전달받은 API) - certificateType 파라미터 추가
      const apiUrl = searchApiUrl || '/api/affiliate/customers/search';
      const response = await fetch(`${apiUrl}?q=${encodeURIComponent(query)}&limit=10&certificateType=${type}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.ok) {
          setCustomerSuggestions(result.customers || []);
          console.log('[AffiliateCertificate] 검색 결과:', result.customers?.length || 0, '명 (', type, ')');
        } else {
          // 고객이 없으면 샘플 고객 생성 제안
          if (result.error && result.error.includes('고객')) {
            console.log('[AffiliateCertificate] 고객이 없습니다. 샘플 고객 생성 가능.');
          }
        }
      }
    } catch (error) {
      console.error('[AffiliateCertificate] Customer search error:', error);
    } finally {
      setIsLoadingCustomerInfo(false);
    }
  }, [type, searchApiUrl]);

  // 고객 검색 입력 핸들러
  const handleCustomerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerSearchQuery(value);
    setData(prev => ({ ...prev, customerName: value }));

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

  // 고객 정보 로드 (구매/환불 정보 자동 입력)
  const loadCustomerInfo = useCallback(async (customerId: number) => {
    setIsLoadingCustomerInfo(true);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/purchase-info`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.ok && result.customer) {
          // 고객 정보 설정
          setData(prev => ({
            ...prev,
            customerName: result.customer.name || '',
            birthDate: result.customer.birthDate || '',
          }));

          // 고객 이메일 자동 설정
          if (result.customer.email) {
            setCustomerEmail(result.customer.email);
          }

          // 상품 및 결제 정보 설정
          if (result.product) {
            const product = result.product;
            setData(prev => ({
              ...prev,
              productName: product.packageName || product.productName || '',
              paymentAmount: result.payment?.amount || product.basePrice || 0,
              paymentDate: result.payment?.date
                ? new Date(result.payment.date).toISOString().split('T')[0]
                : '',
            }));

            // 상품 상세 정보 설정
            setProductDetails({
              tags: product.tags || [],
              visitedCountries: product.visitedCountries || [],
              destinations: product.destinations || [],
              nights: product.nights,
              days: product.days,
              cruiseLine: product.cruiseLine,
              shipName: product.shipName,
              included: product.included || [],
              excluded: product.excluded || [],
              refundPolicy: product.refundPolicy || '',
              flightInfo: product.flightInfo,
              hasGuide: product.hasGuide || false,
              hasEscort: product.hasEscort || false,
              hasCruiseDotStaff: product.hasCruiseDotStaff || false,
              hasTravelInsurance: product.hasTravelInsurance || false,
            });
          }

          // 환불 정보 자동 설정 (환불인증서인 경우)
          if (type === 'refund' && result.refund) {
            const refundAmount = result.refund.amount || result.payment?.amount || 0;
            const refundDate = result.refund.date
              ? new Date(result.refund.date).toISOString().split('T')[0]
              : '';

            setData(prev => ({
              ...prev,
              refundAmount: refundAmount,
              refundDate: refundDate,
            }));

            // 환불 정보 확인 상태로 자동 설정
            setConfirmedRefundAmount(refundAmount);
            setConfirmedRefundDate(refundDate);
          }

          // 구매/환불 고객 선택 시 바로 발송 가능 (승인요청 불필요)
          if (result.customer.customerStatus === 'purchase_confirmed' && type === 'purchase') {
            setApprovalRequest({ id: 0, status: 'approved' });
          } else if (result.customer.customerStatus === 'refunded' && type === 'refund') {
            setApprovalRequest({ id: 0, status: 'approved' });
          }
        }
      }
    } catch (error) {
      console.error('[AffiliateCertificate] Load customer info error:', error);
      showError('고객 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingCustomerInfo(false);
    }
  }, [type]);

  // 고객 선택
  const handleCustomerSelect = async (customer: Customer) => {
    setCustomerSearchQuery(customer.displayName || customer.name);
    setData(prev => ({ ...prev, customerName: customer.name }));
    setSelectedCustomerId(customer.id);
    setShowSuggestions(false);
    setCustomerSuggestions([]);

    // 고객 정보 로드
    await loadCustomerInfo(customer.id);

    // 기존 승인 요청 확인
    checkExistingApproval(customer.id);
  };

  // 외부 클릭 시 제안 목록 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        customerInputRef.current &&
        !customerInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }

      if (
        productSuggestionsRef.current &&
        !productSuggestionsRef.current.contains(event.target as Node) &&
        productInputRef.current &&
        !productInputRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 상품 선택 핸들러
  const handleProductSelect = (product: ActiveProduct) => {
    setData(prev => ({
      ...prev,
      productName: product.packageName,
      paymentAmount: product.basePrice || 0,
    }));
    setProductDetails({
      tags: product.tags,
      visitedCountries: product.visitedCountries,
      destinations: product.destinations,
      nights: product.nights,
      days: product.days,
      cruiseLine: product.cruiseLine,
      shipName: product.shipName,
      included: product.included,
      excluded: product.excluded,
      refundPolicy: product.refundPolicy,
      flightInfo: product.flightInfo,
      hasGuide: product.hasGuide,
      hasEscort: product.hasEscort,
      hasCruiseDotStaff: product.hasCruiseDotStaff,
      hasTravelInsurance: product.hasTravelInsurance,
    });
    setShowProductDropdown(false);
  };

  // 기존 승인 요청 확인
  const checkExistingApproval = async (customerId: number) => {
    try {
      // 판매원은 /api/partner/certificate-approvals를 사용
      const response = await fetch(`/api/partner/certificate-approvals?customerId=${customerId}&type=${type}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        if (result.approval) {
          setApprovalRequest(result.approval);
        }
      }
    } catch (error) {
      console.error('[AffiliateCertificate] Failed to check existing approval:', error);
    }
  };

  // 승인 요청 제출
  const handleRequestApproval = async () => {
    if (!selectedCustomerId) {
      showError('고객을 선택해주세요.');
      return;
    }

    if (!data.customerName || !data.productName || !data.paymentAmount) {
      showError('필수 정보를 모두 입력해주세요.');
      return;
    }

    if (type === 'refund') {
      if (!confirmedRefundAmount || confirmedRefundAmount <= 0) {
        showError('환불금액을 입력하고 확인 버튼을 클릭해주세요.');
        return;
      }
      if (!confirmedRefundDate || confirmedRefundDate.trim() === '') {
        showError('환불일자를 선택하고 확인 버튼을 클릭해주세요.');
        return;
      }
    }

    setIsRequesting(true);

    try {
      const requestBody: any = {
        certificateType: type,
        customerId: selectedCustomerId,
        customerName: data.customerName,
        birthDate: data.birthDate,
        productName: data.productName,
        paymentAmount: data.paymentAmount,
        paymentDate: data.paymentDate,
      };

      if (type === 'refund') {
        requestBody.refundAmount = confirmedRefundAmount;
        requestBody.refundDate = confirmedRefundDate;
      }

      const response = await fetch('/api/partner/certificate-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        showSuccess('승인 요청이 제출되었습니다.');
        setApprovalRequest(result.approval);
      } else {
        showError(result.error || '승인 요청 실패');
      }
    } catch (error) {
      console.error('[AffiliateCertificate] Request approval error:', error);
      showError('승인 요청 중 오류가 발생했습니다.');
    } finally {
      setIsRequesting(false);
    }
  };

  // PNG 다운로드
  const handleDownload = async () => {
    if (!approvalRequest || approvalRequest.status !== 'approved') {
      showError('승인 완료 후 다운로드할 수 있습니다.');
      return;
    }

    if (!certificateRef.current) {
      showError('인증서를 찾을 수 없습니다.');
      return;
    }

    if (!data.customerName || !data.productName || !data.paymentAmount) {
      showError('필수 정보를 입력해주세요.');
      return;
    }

    setIsDownloading(true);

    try {
      const canvas = await html2canvas(certificateRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const fileName = type === 'purchase'
        ? `구매확인증서_${data.customerName}_${new Date().toISOString().split('T')[0]}.png`
        : `환불인증서_${data.customerName}_${new Date().toISOString().split('T')[0]}.png`;

      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('인증서 이미지가 다운로드되었습니다.');
    } catch (error) {
      console.error('[AffiliateCertificate] Download error:', error);
      showError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 이메일 발송
  const handleSendEmail = async () => {
    if (!approvalRequest || approvalRequest.status !== 'approved') {
      showError('승인 완료 후 이메일을 발송할 수 있습니다.');
      return;
    }

    if (!data.customerName || !data.productName || !data.paymentAmount) {
      showError('필수 정보를 입력해주세요.');
      return;
    }

    if (!certificateRef.current) {
      showError('인증서를 찾을 수 없습니다.');
      return;
    }

    // 입력된 이메일 주소 사용
    if (!customerEmail || !customerEmail.trim()) {
      showError('고객 이메일 주소를 입력해주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail.trim())) {
      showError('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    const email = customerEmail.trim();

    try {
      setIsSendingEmail(true);

      // html2canvas로 문서 영역 캡처
      const canvas = await html2canvas(certificateRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // canvas를 blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to blob conversion failed'));
          }
        }, 'image/png');
      });

      // FormData 생성
      const formData = new FormData();
      formData.append('to', email);
      formData.append('subject', `[크루즈닷] 요청하신 ${type === 'purchase' ? '구매확인증서' : '환불인증서'}입니다`);
      formData.append('file', blob, `${type === 'purchase' ? '구매확인증서' : '환불인증서'}_${data.customerName}_${new Date().toISOString().split('T')[0]}.png`);

      // API 요청
      const response = await fetch('/api/email/send', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('메일이 성공적으로 발송되었습니다! 🚀');
      } else {
        showError('전송 실패. 다시 시도해주세요.');
        console.error('[Send Email] API Error:', result.error);
      }

    } catch (error: any) {
      console.error('[Send Email] Error:', error);
      showError('전송 실패. 다시 시도해주세요.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 권한별 버튼 렌더링
  const renderActionButton = () => {
    // 구매완료/환불완료 고객이 선택된 경우 (승인 자동 완료)
    if (approvalRequest?.status === 'approved') {
      return (
        <div className="space-y-4">
          <div className={`flex items-center gap-2 p-4 rounded-lg ${type === 'purchase' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <CheckCircle className={`w-5 h-5 ${type === 'purchase' ? 'text-green-600' : 'text-red-600'}`} />
            <div className="flex-1">
              <p className={`font-semibold ${type === 'purchase' ? 'text-green-900' : 'text-red-900'}`}>
                {type === 'purchase' ? '✓ 구매완료 고객 - 인증서 발송 가능' : '✓ 환불완료 고객 - 인증서 발송 가능'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 py-3 px-6 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              {isDownloading ? 'PNG 생성 중...' : 'PNG 다운로드'}
            </button>
            {customerEmail && (
              <button
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="flex-1 py-3 px-6 rounded-lg font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                {isSendingEmail ? '전송 중...' : '이메일 발송'}
              </button>
            )}
          </div>
        </div>
      );
    }

    // 고객 선택 대기 중
    if (!selectedCustomerId) {
      return (
        <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <Clock className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <p className="font-semibold text-gray-700">{type === 'purchase' ? '구매완료 고객을 선택하세요' : '환불완료 고객을 선택하세요'}</p>
            <p className="text-sm text-gray-500">
              고객을 선택하면 자동으로 인증서 발송이 가능합니다.
            </p>
          </div>
        </div>
      );
    }

    // 고객 정보 로딩 중 (선택은 되었지만 아직 인증 상태가 확인되지 않은 경우)
    return (
      <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <Clock className="w-5 h-5 text-yellow-600 animate-spin" />
        <div className="flex-1">
          <p className="font-semibold text-yellow-900">고객 정보 확인 중...</p>
          <p className="text-sm text-yellow-700">
            잠시만 기다려주세요.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 사용 안내 */}
      <div className={`border rounded-lg p-4 ${type === 'purchase' ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
        <h3 className={`font-semibold mb-2 ${type === 'purchase' ? 'text-indigo-900' : 'text-red-900'}`}>📋 사용 안내</h3>
        <ul className={`text-sm space-y-1 ${type === 'purchase' ? 'text-indigo-800' : 'text-red-800'}`}>
          {type === 'purchase' ? (
            <>
              <li>• 구매완료 상태의 고객만 검색됩니다</li>
              <li>• 고객 선택 시 정보가 자동으로 입력됩니다</li>
              <li>• PNG 다운로드 또는 이메일로 직접 발송 가능합니다</li>
            </>
          ) : (
            <>
              <li>• 환불완료 상태의 고객만 검색됩니다</li>
              <li>• 고객 선택 시 환불 정보가 자동으로 입력됩니다</li>
              <li>• PNG 다운로드 또는 이메일로 직접 발송 가능합니다</li>
            </>
          )}
        </ul>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">고객 정보 입력</h2>

        {/* 인증서 유형에 따른 안내 메시지 */}
        <div className={`mb-4 p-3 rounded-lg border ${type === 'purchase' ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-medium ${type === 'purchase' ? 'text-indigo-700' : 'text-red-700'}`}>
            {type === 'purchase'
              ? '구매확인증서는 "구매완료" 상태의 고객만 검색됩니다. 이름, 연락처로 검색하세요.'
              : '환불인증서는 "환불완료" 상태의 고객만 검색됩니다. 이름, 연락처로 검색하세요.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              고객명 <span className="text-red-500">*</span>
              {selectedCustomerId && (
                <span className="ml-2 text-xs text-green-600 font-semibold">✓ 선택됨</span>
              )}
            </label>
            <div className="relative">
              <input
                ref={customerInputRef}
                type="text"
                value={customerSearchQuery}
                onChange={handleCustomerSearchChange}
                onFocus={() => {
                  if (customerSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder={type === 'purchase' ? '구매완료 고객 검색 (이름, 연락처)...' : '환불완료 고객 검색 (이름, 연락처)...'}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 pr-24"
              />
              {isLoadingCustomerInfo && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                  <span className="text-xs text-gray-500">검색 중...</span>
                </div>
              )}
              {!isLoadingCustomerInfo && customerSearchQuery && customerSuggestions.length === 0 && customerSearchQuery.trim().length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  결과 없음
                </div>
              )}
            </div>
            {/* 샘플 고객 생성 버튼 (고객이 없을 때) */}
            {!isLoadingCustomerInfo && customerSuggestions.length === 0 && customerSearchQuery.trim().length === 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 mb-2">
                  💡 구매 고객이 없습니다. 테스트용 샘플 고객을 생성하시겠습니까?
                </p>
                <button
                  onClick={async () => {
                    setIsCreatingSample(true);
                    try {
                      const response = await fetch('/api/affiliate/customers/create-sample', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ count: 1 }),
                      });
                      const result = await response.json();
                      if (response.ok && result.ok) {
                        showSuccess(result.message || '샘플 고객이 생성되었습니다.');
                        // 고객 검색 다시 실행
                        await searchCustomers('');
                      } else {
                        showError(result.error || '샘플 고객 생성에 실패했습니다.');
                      }
                    } catch (error) {
                      console.error('[AffiliateCertificate] Create sample error:', error);
                      showError('샘플 고객 생성 중 오류가 발생했습니다.');
                    } finally {
                      setIsCreatingSample(false);
                    }
                  }}
                  disabled={isCreatingSample}
                  className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-300 font-semibold text-sm"
                >
                  {isCreatingSample ? '생성 중...' : '샘플 구매고객 생성'}
                </button>
              </div>
            )}
            {showSuggestions && customerSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-2 bg-white border-2 border-indigo-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
              >
                <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-200 text-xs font-semibold text-indigo-700">
                  {customerSuggestions.length}명의 고객 찾음 (클릭하여 선택)
                </div>
                {customerSuggestions.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => handleCustomerSelect(customer)}
                    className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-base">{customer.name}</div>
                        <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                          {customer.phone && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">📱</span>
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">✉️</span>
                              <span>{customer.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-2 text-indigo-600 font-medium text-sm">
                        선택 →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedCustomerId && data.customerName && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-semibold text-sm">✓ 선택된 고객:</span>
                  <span className="text-gray-900 font-medium">{data.customerName}</span>
                  <button
                    onClick={() => {
                      setCustomerSearchQuery('');
                      setSelectedCustomerId(null);
                      setData(prev => ({ ...prev, customerName: '', birthDate: '' }));
                      setCustomerEmail('');
                      setProductDetails(null);
                      setApprovalRequest(null);
                    }}
                    className="ml-auto text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    다시 선택
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              생년월일 <span className="text-gray-400 font-normal">(선택)</span>
              {data.birthDate && (
                <span className="ml-2 text-xs text-green-600">(여권 정보에서 자동 입력됨)</span>
              )}
            </label>
            <input
              type="text"
              value={data.birthDate}
              onChange={(e) => setData(prev => ({ ...prev, birthDate: e.target.value }))}
              placeholder="1990-01-01 (여권 제출 완료 시 자동 입력)"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {!data.birthDate && (
              <p className="mt-1 text-xs text-gray-500">입력하지 않아도 됩니다.</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              상품명 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={productInputRef}
                type="text"
                value={data.productName}
                onChange={(e) => {
                  setData(prev => ({ ...prev, productName: e.target.value }));
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="지중해 7박 8일 크루즈 (상품명 검색)"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {showProductDropdown && (
                <div
                  ref={productSuggestionsRef}
                  className="absolute z-50 w-full mt-2 bg-white border-2 border-indigo-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
                >
                  {activeProducts.filter(p =>
                    p.packageName.toLowerCase().includes(data.productName.toLowerCase())
                  ).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">검색 결과가 없습니다.</div>
                  ) : (
                    activeProducts
                      .filter(p => p.packageName.toLowerCase().includes(data.productName.toLowerCase()))
                      .map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleProductSelect(product)}
                          className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-semibold text-gray-900 text-sm">{product.packageName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {product.cruiseLine} | {product.shipName} | {product.nights}박 {product.days}일
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
            {productDetails && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">상품 상세 정보</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {productDetails.tags && productDetails.tags.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">후킹태그: </span>
                      <span className="text-gray-600">{productDetails.tags.join(', ')}</span>
                    </div>
                  )}
                  {productDetails.visitedCountries && productDetails.visitedCountries.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">방문국가: </span>
                      <span className="text-gray-600">{productDetails.visitedCountries.join(', ')}</span>
                    </div>
                  )}
                  {productDetails.destinations && productDetails.destinations.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">목적지: </span>
                      <span className="text-gray-600">{productDetails.destinations.join(', ')}</span>
                    </div>
                  )}
                  {(productDetails.nights || productDetails.days) && (
                    <div>
                      <span className="font-medium text-gray-700">여행기간: </span>
                      <span className="text-gray-600">
                        {productDetails.nights}박 {productDetails.days}일
                      </span>
                    </div>
                  )}
                  {productDetails.cruiseLine && (
                    <div>
                      <span className="font-medium text-gray-700">크루즈 회사: </span>
                      <span className="text-gray-600">{productDetails.cruiseLine}</span>
                    </div>
                  )}
                  {productDetails.shipName && (
                    <div>
                      <span className="font-medium text-gray-700">선박명: </span>
                      <span className="text-gray-600">{productDetails.shipName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {type === 'purchase' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  결제금액 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={data.paymentAmount || ''}
                  onChange={(e) => setData(prev => ({ ...prev, paymentAmount: parseInt(e.target.value) || 0 }))}
                  placeholder="3500000"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  결제일자 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={data.paymentDate}
                  onChange={(e) => setData(prev => ({ ...prev, paymentDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  결제금액
                </label>
                <input
                  type="number"
                  value={data.paymentAmount || ''}
                  onChange={(e) => setData(prev => ({ ...prev, paymentAmount: parseInt(e.target.value) || 0 }))}
                  placeholder="3500000"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  결제일자
                </label>
                <input
                  type="date"
                  value={data.paymentDate}
                  onChange={(e) => setData(prev => ({ ...prev, paymentDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  환불금액 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={data.refundAmount !== undefined && data.refundAmount !== null && data.refundAmount !== 0 ? data.refundAmount : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value === '' ? 0 : parseInt(value) || 0;
                      setData(prev => ({
                        ...prev,
                        refundAmount: numValue
                      }));
                    }}
                    placeholder="3500000"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    onClick={() => {
                      if (data.refundAmount && data.refundAmount > 0) {
                        setConfirmedRefundAmount(data.refundAmount);
                        showSuccess('환불금액이 확인되었습니다.');
                      } else {
                        showError('환불금액을 입력해주세요.');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm whitespace-nowrap"
                  >
                    확인
                  </button>
                </div>
                {confirmedRefundAmount && (
                  <p className="mt-1 text-xs text-green-600 font-semibold">
                    ✓ 확인됨: {confirmedRefundAmount.toLocaleString()}원
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  환불일자 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={data.refundDate || ''}
                    onChange={(e) => {
                      setData(prev => ({ ...prev, refundDate: e.target.value }));
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    onClick={() => {
                      if (data.refundDate && data.refundDate.trim() !== '') {
                        setConfirmedRefundDate(data.refundDate);
                        showSuccess('환불일자가 확인되었습니다.');
                      } else {
                        showError('환불일자를 선택해주세요.');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm whitespace-nowrap"
                  >
                    확인
                  </button>
                </div>
                {confirmedRefundDate && (
                  <p className="mt-1 text-xs text-green-600 font-semibold">
                    ✓ 확인됨: {new Date(confirmedRefundDate).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              발행일자
            </label>
            <input
              type="text"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              고객 이메일 주소
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {renderActionButton()}
      </div>

      {/* 인증서 미리보기 - 승인 완료 후에만 표시 */}
      {approvalRequest?.status === 'approved' && (
        <div className="bg-gray-100 rounded-lg shadow-md p-6 overflow-auto">
          <div
            ref={certificateRef}
            className="bg-white mx-auto shadow-lg"
            style={{
              width: '210mm',
              height: '297mm',
              padding: '15mm 20mm',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 헤더: 로고 */}
            <div className="flex justify-center mb-2 flex-shrink-0">
              <Image
                src="/images/ai-cruise-logo.png"
                alt="크루즈닷 로고"
                width={80}
                height={32}
                priority
                style={{ objectFit: 'contain' }}
              />
            </div>

            {/* 제목 */}
            <div className="text-center mb-4 flex-shrink-0">
              <h1
                className="text-2xl font-bold text-gray-900 mb-1"
                style={{
                  fontFamily: 'serif, "Times New Roman", "Malgun Gothic", sans-serif',
                  letterSpacing: '0.03em',
                }}
              >
                {type === 'purchase' ? '구 매 확 인 증 서' : '환 불 인 증 서'}
              </h1>
            </div>

            {/* 본문: 테이블 */}
            <div className="mb-3 flex-grow overflow-hidden">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 w-1/4 text-xs">성명</td>
                    <td className="py-1.5 px-2 text-gray-900 text-xs">{data.customerName || '(고객명)'}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">생년월일</td>
                    <td className="py-1.5 px-2 text-gray-900 text-xs">{data.birthDate || '(생년월일)'}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">상품명</td>
                    <td className="py-1.5 px-2 text-gray-900 text-xs">{data.productName || '(상품명)'}</td>
                  </tr>
                  {type === 'purchase' ? (
                    <>
                      <tr className="border-b border-gray-300">
                        <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">결제금액</td>
                        <td className="py-1.5 px-2 text-gray-900 font-bold text-xs">
                          {data.paymentAmount ? `${data.paymentAmount.toLocaleString()}원` : '(결제금액)'}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">결제일자</td>
                        <td className="py-1.5 px-2 text-gray-900 text-xs">
                          {data.paymentDate ? new Date(data.paymentDate).toLocaleDateString('ko-KR') : '(결제일자)'}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr className="border-b border-gray-300">
                        <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">결제금액</td>
                        <td className="py-1.5 px-2 text-gray-900 text-xs">
                          {data.paymentAmount ? `${data.paymentAmount.toLocaleString()}원` : '(결제금액)'}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">결제일자</td>
                        <td className="py-1.5 px-2 text-gray-900 text-xs">
                          {data.paymentDate ? new Date(data.paymentDate).toLocaleDateString('ko-KR') : '(결제일자)'}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">환불금액</td>
                        <td className="py-1.5 px-2 text-xs">
                          {confirmedRefundAmount !== null && confirmedRefundAmount !== undefined && typeof confirmedRefundAmount === 'number' && confirmedRefundAmount > 0 ? (
                            <span className="text-red-600 font-bold">
                              {confirmedRefundAmount.toLocaleString()}원
                            </span>
                          ) : (
                            <span className="text-gray-400">(환불금액)</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 text-xs">환불일자</td>
                        <td className="py-1.5 px-2 text-xs">
                          {confirmedRefundDate && typeof confirmedRefundDate === 'string' && confirmedRefundDate.trim() !== '' ? (
                            (() => {
                              try {
                                const date = new Date(confirmedRefundDate);
                                if (!isNaN(date.getTime())) {
                                  return (
                                    <span className="text-black font-bold">
                                      {date.toLocaleDateString('ko-KR')}
                                    </span>
                                  );
                                }
                              } catch (e) {
                                console.error('[AffiliateCertificate] 날짜 파싱 오류:', e);
                              }
                              return <span className="text-gray-400">(환불일자)</span>;
                            })()
                          ) : (
                            <span className="text-gray-400">(환불일자)</span>
                          )}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* 하단 신뢰 요소 */}
            <div className="mt-auto pt-2 flex-shrink-0">
              {/* 날짜 */}
              <div className="text-right mb-2">
                <p className="text-xs text-gray-900">{issueDate}</p>
              </div>

              {/* 서명 및 도장 */}
              <div className="relative flex justify-end items-end mb-2 min-h-[60px]">
                <div className="text-right">
                  <div className="relative inline-block pr-6 pt-6">
                    {/* 도장 이미지 */}
                    <div
                      className="absolute -top-1 -left-1 opacity-75"
                      style={{ zIndex: 1 }}
                    >
                      <div className="relative w-12 h-12">
                        <Image
                          src="/images/cruisedot-stamp.png"
                          alt="크루즈닷 인도장"
                          fill
                          className="object-contain"
                        />
                      </div>
                    </div>
                    {/* 서명 텍스트 */}
                    <p className="text-xs text-gray-900 relative z-10">
                      크루즈닷 대표이사 [인]
                    </p>
                  </div>
                </div>
              </div>

              {/* 슬로건 (Footer) */}
              <div className="text-center pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 italic leading-tight">
                  크루즈 첫여행 크루즈닷, 두번째 부터 행복하게 크루즈닷 감사합니다
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

