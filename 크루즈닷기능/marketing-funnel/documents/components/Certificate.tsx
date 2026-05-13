'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import Image from 'next/image';
import { Download, Mail } from 'lucide-react';
import { showSuccess, showError } from '@/components/ui/Toast';
import { Customer } from '@/types/customer';

interface CertificateProps {
    type: 'purchase' | 'refund';
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

// 인증서에서 사용하는 확장 Customer 타입
interface CertificateCustomer extends Customer {
    email: string;
    displayName: string;
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

export default function Certificate({ type }: CertificateProps) {
    const certificateRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [customerEmail, setCustomerEmail] = useState('');
    const [isRequesting, setIsRequesting] = useState(false); // 승인 요청 중
    const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');

    const [data, setData] = useState<CertificateData>({
        customerName: '',
        birthDate: '',
        productName: '',
        paymentAmount: 0,
        paymentDate: '',
        refundAmount: 0,
        refundDate: '',
    });

    // 확인된 환불금액과 환불일자 (미리보기 표시용)
    const [confirmedRefundAmount, setConfirmedRefundAmount] = useState<number | null>(null);
    const [confirmedRefundDate, setConfirmedRefundDate] = useState<string>('');

    // 고객 검색 관련
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [customerSuggestions, setCustomerSuggestions] = useState<CertificateCustomer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
    const [isLoadingCustomerInfo, setIsLoadingCustomerInfo] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const customerInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // 상품 검색 관련
    const [activeProducts, setActiveProducts] = useState<ActiveProduct[]>([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productInputRef = useRef<HTMLInputElement>(null);
    const productSuggestionsRef = useRef<HTMLDivElement>(null);

    // 오늘 날짜 자동 생성 (202X년 X월 X일 형식)
    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        return `${year}년 ${month}월 ${day}일`;
    };

    const [issueDate, setIssueDate] = useState(getTodayDate());

    // type이 변경될 때 상태 초기화
    useEffect(() => {
        setData({
            customerName: '',
            birthDate: '',
            productName: '',
            paymentAmount: 0,
            paymentDate: '',
            refundAmount: 0,
            refundDate: '',
        });
        setCustomerEmail('');
        setCustomerSearchQuery('');
        setCustomerSuggestions([]);
        setShowSuggestions(false);
        setSelectedCustomerId(null);
        setProductDetails(null);
        setIssueDate(getTodayDate());
        setRequestStatus('idle');
        setIsRequesting(false);
        setConfirmedRefundAmount(null);
        setConfirmedRefundDate('');
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

    // 고객 검색 - 인증서 유형에 따라 필터링
    // purchase: 구매완료 고객만, refund: 환불완료 고객만
    const searchCustomers = useCallback(async (query: string) => {
        if (!query || query.trim().length < 1) {
            setCustomerSuggestions([]);
            setIsLoadingCustomerInfo(false);
            return;
        }

        try {
            setIsLoadingCustomerInfo(true);
            // Partner API 호출 - certificateType 파라미터 추가
            const response = await fetch(`/api/partner/customers/search?q=${encodeURIComponent(query)}&limit=10&certificateType=${type}`);

            if (response.ok) {
                const result = await response.json();
                if (result.ok) {
                    setCustomerSuggestions(result.customers || []);
                    console.log('[Certificate] 검색 결과:', result.customers?.length || 0, '명 (', type, ')');
                }
            }
        } catch (error) {
            console.error('[Certificate] Customer search error:', error);
        } finally {
            setIsLoadingCustomerInfo(false);
        }
    }, [type]);

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

    // 고객 선택 시 정보 로드 (구매/환불 정보 자동 입력)
    const loadCustomerInfo = useCallback(async (customerId: number) => {
        setIsLoadingCustomerInfo(true);
        try {
            // Partner API 호출
            const response = await fetch(`/api/partner/customers/${customerId}/purchase-info`);

            if (response.ok) {
                const result = await response.json();
                if (result.ok && result.customer) {
                    // 고객 정보 설정
                    setData(prev => ({
                        ...prev,
                        customerName: result.customer.name || '',
                        birthDate: result.customer.birthDate || '', // 여권 제출 완료한 경우 자동 입력
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
                            productName: product.packageName || '',
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
                        setRequestStatus('approved');
                    } else if (result.customer.customerStatus === 'refunded' && type === 'refund') {
                        setRequestStatus('approved');
                    }
                }
            }
        } catch (error) {
            console.error('[Certificate] Load customer info error:', error);
            showError('고객 정보를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoadingCustomerInfo(false);
        }
    }, [type]);

    // 고객 선택 핸들러
    const handleCustomerSelect = (customer: CertificateCustomer) => {
        setCustomerSearchQuery(customer.displayName);
        setData(prev => ({ ...prev, customerName: customer.name }));
        setSelectedCustomerId(customer.id);
        setShowSuggestions(false);
        setCustomerSuggestions([]);
        loadCustomerInfo(customer.id);
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

    const handleRequestApproval = async () => {
        if (!data.customerName) {
            showError('고객명을 입력해주세요.');
            return;
        }

        if (!selectedCustomerId) {
            showError('고객을 선택해주세요.');
            return;
        }

        // 환불인증완료인 경우 환불금액과 환불일자 확인
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

        try {
            setIsRequesting(true);

            const requestBody: any = {
                customerId: selectedCustomerId,
                type: type, // 'purchase' or 'refund'
                customerName: data.customerName,
                birthDate: data.birthDate,
            };

            // 환불인증완료인 경우 환불금액과 환불일자 추가
            if (type === 'refund') {
                requestBody.refundAmount = confirmedRefundAmount;
                requestBody.refundDate = confirmedRefundDate;
            }

            // Partner API 호출
            const response = await fetch(`/api/partner/documents/certify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            // 응답 상태 확인
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = '요청 처리 중 오류가 발생했습니다.';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorMessage;
                } catch (e) {
                    errorMessage = `서버 오류 (${response.status}): ${errorText}`;
                }
                showError(errorMessage);
                return;
            }

            const result = await response.json();

            if (result.ok) {
                setRequestStatus('pending');
                showSuccess('승인 요청이 완료되었습니다. 관리자 승인 후 발급 가능합니다.');
            } else {
                showError(result.error || '요청 처리 중 오류가 발생했습니다.');
            }
        } catch (error: any) {
            console.error('[Request Approval] Error:', error);
            showError(`요청 처리 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`);
        } finally {
            setIsRequesting(false);
        }
    };

    // 이미지 저장 (PNG)
    const handleDownloadImage = async () => {
        if (requestStatus !== 'approved') {
            showError('승인이 완료된 후 다운로드할 수 있습니다.');
            return;
        }

        if (!certificateRef.current) {
            showError('인증서를 찾을 수 없습니다.');
            return;
        }

        try {
            setIsDownloading(true);

            const canvas = await html2canvas(certificateRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
            });

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const fileName = `${type === 'purchase' ? '구매확인증서' : '환불인증서'}_${data.customerName}_${new Date().toISOString().split('T')[0]}.png`;
            link.download = fileName;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccess('인증서 이미지가 다운로드되었습니다.');
        } catch (error: any) {
            console.error('[Download Image] Error:', error);
            showError('이미지 다운로드 중 오류가 발생했습니다.');
        } finally {
            setIsDownloading(false);
        }
    };

    // 이메일 발송
    const handleSendEmail = async () => {
        if (requestStatus !== 'approved') {
            showError('승인이 완료된 후 발송할 수 있습니다.');
            return;
        }

        // ... 이메일 발송 로직 (Admin과 동일하게 유지하되, 승인 체크 추가)
        // 여기서는 생략하거나 Admin과 동일하게 구현
        // 편의상 Admin 로직 복사
        if (!data.customerName || !data.productName || !data.paymentAmount) {
            showError('필수 정보를 입력해주세요.');
            return;
        }

        if (!certificateRef.current) {
            showError('인증서를 찾을 수 없습니다.');
            return;
        }

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

            const canvas = await html2canvas(certificateRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
            });

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas to blob conversion failed'));
                    }
                }, 'image/png');
            });

            const formData = new FormData();
            formData.append('to', email);
            formData.append('subject', `[크루즈닷] 요청하신 ${type === 'purchase' ? '구매확인증서' : '환불인증서'}입니다`);
            formData.append('file', blob, `${type === 'purchase' ? '구매확인증서' : '환불인증서'}_${data.customerName}_${new Date().toISOString().split('T')[0]}.png`);

            const response = await fetch('/api/email/send', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                showSuccess('메일이 성공적으로 발송되었습니다! 🚀');
            } else {
                showError('전송 실패. 다시 시도해주세요.');
            }

        } catch (error: any) {
            console.error('[Send Email] Error:', error);
            showError('전송 실패. 다시 시도해주세요.');
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <div className="space-y-6">
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
                            {!isLoadingCustomerInfo && customerSearchQuery && customerSuggestions.length === 0 && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                    결과 없음
                                </div>
                            )}
                        </div>
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
                                    {data.customerName !== customerSearchQuery && (
                                        <button
                                            onClick={() => {
                                                setCustomerSearchQuery('');
                                                setSelectedCustomerId(null);
                                                setData(prev => ({ ...prev, customerName: '', birthDate: '' }));
                                                setCustomerEmail('');
                                                setProductDetails(null);
                                            }}
                                            className="ml-auto text-xs text-red-600 hover:text-red-700 font-medium"
                                        >
                                            다시 선택
                                        </button>
                                    )}
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

                    {/* 인증 상태 표시 (구매완료/환불완료 고객만 선택 가능하므로 자동 인증) */}
                    <div className="md:col-span-2">
                        {selectedCustomerId && requestStatus === 'approved' ? (
                            <div className={`w-full py-3 px-6 rounded-lg font-bold text-white text-center ${type === 'purchase'
                                ? 'bg-green-600'
                                : 'bg-red-600'
                                }`}>
                                {type === 'purchase' ? '✓ 구매완료 고객 - 인증서 발송 가능' : '✓ 환불완료 고객 - 인증서 발송 가능'}
                            </div>
                        ) : selectedCustomerId && requestStatus !== 'approved' ? (
                            <div className="w-full py-3 px-6 rounded-lg font-bold text-yellow-800 text-center bg-yellow-100 border border-yellow-300">
                                고객 정보 확인 중...
                            </div>
                        ) : (
                            <div className="w-full py-3 px-6 rounded-lg font-bold text-gray-500 text-center bg-gray-100 border border-gray-300">
                                {type === 'purchase' ? '구매완료 고객을 선택하세요' : '환불완료 고객을 선택하세요'}
                            </div>
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
                                    {/* 상품 상세 정보 표시 (Admin과 동일) */}
                                    {productDetails.tags && productDetails.tags.length > 0 && (
                                        <div>
                                            <span className="font-medium text-gray-700">후킹태그: </span>
                                            <span className="text-gray-600">{productDetails.tags.join(', ')}</span>
                                        </div>
                                    )}
                                    {/* ... 기타 상세 정보 ... */}
                                    <div>
                                        <span className="font-medium text-gray-700">여행기간: </span>
                                        <span className="text-gray-600">
                                            {productDetails.nights}박 {productDetails.days}일
                                        </span>
                                    </div>
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
                                            setData(prev => ({ ...prev, refundAmount: numValue }));
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
                                        onChange={(e) => setData(prev => ({ ...prev, refundDate: e.target.value }))}
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
                </div>
            </div>

            {/* 인증서 미리보기 */}
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
                                {/* 상품 상세 정보 표시 */}
                                {productDetails && (
                                    <tr className="border-b border-gray-300">
                                        <td className="py-1.5 px-2 font-semibold text-gray-900 bg-gray-50 align-top text-xs">상품 상세 정보</td>
                                        <td className="py-1.5 px-2 text-gray-900">
                                            <div className="space-y-0.5 text-xs leading-tight">
                                                {(productDetails.nights || productDetails.days) && (
                                                    <div>
                                                        <span className="font-medium">여행기간: </span>
                                                        <span>{productDetails.nights}박 {productDetails.days}일</span>
                                                    </div>
                                                )}
                                                {/* ... 기타 상세 정보 ... */}
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {/* 구매인증서: 결제금액, 결제일자만 */}
                                {type === 'purchase' && (
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
                                )}
                                {/* 환불인증서: 결제금액, 결제일자, 환불금액, 환불일자 */}
                                {type === 'refund' && (
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
                                                {confirmedRefundAmount ? (
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
                                                {confirmedRefundDate ? (
                                                    <span className="text-black font-bold">
                                                        {new Date(confirmedRefundDate).toLocaleDateString('ko-KR')}
                                                    </span>
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

            {/* 하단 버튼 */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1 max-w-md">
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
                    <div className="flex gap-3">
                        <button
                            onClick={handleDownloadImage}
                            disabled={isDownloading || requestStatus !== 'approved'}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
                            title={requestStatus !== 'approved' ? '승인이 완료된 후 다운로드 가능합니다' : ''}
                        >
                            <Download className="w-4 h-4" />
                            {isDownloading ? '저장 중...' : '이미지 저장 (PNG)'}
                        </button>
                        <button
                            onClick={handleSendEmail}
                            disabled={isSendingEmail || requestStatus !== 'approved'}
                            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
                            title={requestStatus !== 'approved' ? '승인이 완료된 후 발송 가능합니다' : ''}
                        >
                            <Mail className="w-4 h-4" />
                            {isSendingEmail ? '전송 중...' : '이메일 발송'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
