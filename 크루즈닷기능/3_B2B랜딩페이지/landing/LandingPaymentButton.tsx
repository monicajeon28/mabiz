'use client';

import { useState } from 'react';

// 고객 정보 타입
export interface CustomerInfo {
  name: string;
  phone: string;
}

interface LandingPaymentButtonProps {
  productPurchase: {
    enabled?: boolean;
    paymentProvider?: 'payapp' | 'welcomepay' | string;
    productName?: string;
    sellingPrice?: number | string | null;
    useQuantity?: boolean;
    purchaseQuantity?: number | string | null;
    paymentType?: 'basic' | 'cardInput' | string;
    paymentGroupId?: number | string | null;
    dbGroupId?: number | string | null;
  };
  landingPageId: number;
  landingPageSlug: string;
  // 등록 폼에서 가져온 고객 정보 (자동 입력용)
  initialCustomerInfo?: CustomerInfo;
}

export function LandingPaymentButton({
  productPurchase,
  landingPageId,
  landingPageSlug,
  initialCustomerInfo
}: LandingPaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 상품 정보 (관리자가 랜딩페이지에서 설정한 값)
  const productName = productPurchase.productName || '상품';
  const amount = parseInt(String(productPurchase.sellingPrice || 0));
  // 랜딩페이지는 무조건 PayApp 결제만 사용 (웰컴페이먼츠는 크루즈몰 전용)

  // 고객 정보 (등록 폼에서 자동으로 가져온 값)
  const customerName = initialCustomerInfo?.name?.trim() || '';
  const customerPhone = initialCustomerInfo?.phone?.replace(/[^0-9]/g, '') || '';

  // 고객 정보가 있는지 확인
  const hasCustomerInfo = customerName && customerPhone && customerPhone.length >= 10;

  const handlePaymentClick = () => {
    if (!hasCustomerInfo) {
      alert('먼저 위의 신청 폼에서 이름과 연락처를 입력해주세요.');
      return;
    }
    setShowModal(true);
  };

  const handlePaymentRequest = async () => {
    if (isProcessing) return;

    // 고객 정보 재확인
    if (!hasCustomerInfo) {
      alert('고객 정보가 없습니다. 먼저 신청 폼을 작성해주세요.');
      setShowModal(false);
      return;
    }

    setIsProcessing(true);

    try {
      // 랜딩페이지는 무조건 PayApp 결제만 사용 (웰컴페이먼츠는 크루즈몰 전용)
      const response = await fetch('/api/payapp/landing/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingPageId,
          productName,
          amount,
          customerName,
          customerPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || '결제 요청에 실패했습니다.');
      }

      if (data.payUrl) {
        window.location.href = data.payUrl;
      } else {
        throw new Error('결제 URL을 받지 못했습니다.');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '결제 요청 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
    }
  };

  // 전화번호 포맷팅 (010-1234-5678)
  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    } else if (phone.length === 10) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  return (
    <>
      <button
        type="button"
        className="lp-secondary-button"
        onClick={handlePaymentClick}
        disabled={amount <= 0}
      >
        {amount > 0 ? `${amount.toLocaleString()}원 결제하기` : '결제 정보 없음'}
      </button>

      {/* 결제 확인 모달 - 입력 폼 없이 확인만 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
              <h3 className="text-xl font-bold">결제 확인</h3>
              <p className="text-blue-100 text-sm mt-1">아래 정보를 확인하고 결제를 진행해주세요</p>
            </div>

            {/* 결제 정보 확인 */}
            <div className="p-5 space-y-4">
              {/* 상품 정보 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-3">상품 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">상품명</span>
                    <span className="font-medium text-gray-900">{productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">결제 금액</span>
                    <span className="text-xl font-bold text-blue-600">{amount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>

              {/* 고객 정보 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-3">고객 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">이름</span>
                    <span className="font-medium text-gray-900">{customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">연락처</span>
                    <span className="font-medium text-gray-900">{formatPhone(customerPhone)}</span>
                  </div>
                </div>
              </div>

              {/* 안내 문구 */}
              <p className="text-sm text-gray-500 text-center">
                결제하기 버튼을 누르면 결제 페이지로 이동합니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="p-5 pt-0 flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                disabled={isProcessing}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePaymentRequest}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
                disabled={isProcessing}
              >
                {isProcessing ? '처리 중...' : '결제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
