'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiCreditCard, FiUser, FiMail, FiPhone, FiLock } from 'react-icons/fi';
import { logger } from '@/lib/logger';

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productCode = searchParams.get('productCode') || '';
  const productName = searchParams.get('productName') || '상품';
  const amount = parseInt(searchParams.get('amount') || '0', 10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [formData, setFormData] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerTel: '',
  });

  // 로그인한 사용자 정보 가져오기
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.user) {
            // 로그인한 사용자 정보로 자동 입력
            setFormData({
              buyerName: data.user.name || '',
              buyerEmail: data.user.email || '',
              buyerTel: data.user.phone || '',
            });
          }
        }
      } catch (error) {
        // 에러는 항상 로깅 (사용자 정보 로드 실패는 중요)
        logger.error('Failed to load user info', { error: error instanceof Error ? error.message : String(error) });
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUserInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.buyerName || !formData.buyerTel) {
      alert('이름과 연락처는 필수 입력 항목입니다.');
      return;
    }

    try {
      setIsProcessing(true);

      // 결제 요청 API 호출
      const response = await fetch('/api/payment/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productCode,
          amount,
          buyerName: formData.buyerName,
          buyerEmail: formData.buyerEmail,
          buyerTel: formData.buyerTel,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // 결제 체크아웃 페이지로 리다이렉트
        if (data.checkoutUrl) {
          logger.log('[Payment] Redirecting to checkout');
          router.push(data.checkoutUrl);
        } else {
          alert('결제 정보를 받을 수 없습니다. 다시 시도해주세요.');
          logger.error('[Payment] No checkout URL received');
        }
      } else {
        const errorMessage = data.error || 'Unknown error';
        alert('결제 요청 실패: ' + errorMessage);
        logger.error('[Payment] Request failed', { error: data.error });
      }
    } catch (error) {
      // 에러는 항상 로깅 (결제 오류는 중요)
      logger.error('Payment request error', { error: error instanceof Error ? error.message : String(error) });
      alert('결제 요청 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-gray-600">사용자 정보를 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">결제하기</h1>
            <p className="text-gray-600">아래 정보를 입력하고 결제를 진행해주세요.</p>
          </div>

          {/* 상품 정보 */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6 border-2 border-blue-200">
            <div className="text-sm text-gray-600 mb-1">상품명</div>
            <div className="font-semibold text-gray-900 text-lg">{productName}</div>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">결제 금액</span>
                <span className="text-2xl font-bold text-blue-600">
                  {amount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          {/* 결제 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 구매자 이름 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <FiUser className="inline mr-2" />
                구매자 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.buyerName}
                onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="이름을 입력하세요"
              />
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <FiPhone className="inline mr-2" />
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.buyerTel}
                onChange={(e) => setFormData({ ...formData, buyerTel: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="010-1234-5678"
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <FiMail className="inline mr-2" />
                이메일
              </label>
              <input
                type="email"
                value={formData.buyerEmail}
                onChange={(e) => setFormData({ ...formData, buyerEmail: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="example@email.com"
              />
            </div>

            {/* 안내 메시지 */}
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <FiLock className="text-yellow-600 mt-1" size={20} />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">안전한 결제</p>
                  <p>웰컴페이먼츠를 통해 안전하게 결제됩니다. 카드 정보는 암호화되어 전송됩니다.</p>
                </div>
              </div>
            </div>

            {/* 결제 버튼 */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isProcessing}
                className={`w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'shadow-lg hover:shadow-xl'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    결제 진행 중...
                  </>
                ) : (
                  <>
                    <FiCreditCard size={20} />
                    {amount.toLocaleString()}원 결제하기
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <PaymentPageContent />
    </Suspense>
  );
}
