'use client';

import { useState } from 'react';
import { designSystem, typoClasses, colorClasses } from '@/lib/design/design-system';

interface CheckoutFormProps {
  orderId: string;
  productName: string;
  amount: number;
  buyerName: string;
  buyerEmail?: string;
  buyerTel?: string;
  onSubmit: () => Promise<void>;
  isLoading?: boolean;
}

export function CheckoutForm({
  orderId,
  productName,
  amount,
  buyerName,
  buyerEmail,
  buyerTel,
  onSubmit,
  isLoading = false,
}: CheckoutFormProps) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!hasAgreed) {
      setError('약관에 동의해주세요');
      return;
    }

    try {
      setError(null);
      await onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제 중 오류가 발생했습니다');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0 py-8">
      {/* 주문 정보 */}
      <div className="mb-8">
        <h2 className={`${typoClasses.h3} mb-6 text-neutral-900`}>주문 확인</h2>

        <div className={`
          border border-neutral-200 rounded-xl overflow-hidden
          ${designSystem.shadow.md} mb-6
        `}>
          {/* 상품 정보 */}
          <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200">
            <p className={`${colorClasses.textMuted} mb-2`}>상품명</p>
            <p className={`${typoClasses.h4} text-neutral-900`}>{productName}</p>
          </div>

          {/* 금액 정보 */}
          <div className="px-6 py-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className={colorClasses.textSecondary}>상품 금액</span>
              <span className={`${typoClasses.body} font-semibold text-neutral-900`}>
                {(amount / 1000).toLocaleString()}원
              </span>
            </div>
            <div className="h-px bg-neutral-200" />
            <div className="flex justify-between items-center">
              <span className={`${typoClasses.h4} text-neutral-900`}>총 결제 금액</span>
              <span className="text-3xl font-bold text-yellow-600">
                {(amount / 1000).toLocaleString()}원
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 구매자 정보 */}
      <div className="mb-8">
        <h3 className={`${typoClasses.h4} mb-4 text-neutral-900`}>구매자 정보</h3>

        <div className={`
          bg-neutral-50 border border-neutral-200 rounded-lg
          px-4 sm:px-6 py-4 space-y-3
        `}>
          <div>
            <p className={`${colorClasses.textMuted} text-xs font-medium mb-1`}>이름</p>
            <p className={`${typoClasses.body} text-neutral-900`}>{buyerName}</p>
          </div>
          {buyerEmail && (
            <div>
              <p className={`${colorClasses.textMuted} text-xs font-medium mb-1`}>이메일</p>
              <p className={`${typoClasses.body} text-neutral-900`}>{buyerEmail}</p>
            </div>
          )}
          {buyerTel && (
            <div>
              <p className={`${colorClasses.textMuted} text-xs font-medium mb-1`}>연락처</p>
              <p className={`${typoClasses.body} text-neutral-900`}>{buyerTel}</p>
            </div>
          )}
          <div>
            <p className={`${colorClasses.textMuted} text-xs font-medium mb-1`}>주문번호</p>
            <p className={`${typoClasses.bodySmall} text-neutral-500 font-mono`}>{orderId}</p>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className={`${typoClasses.bodySmall} text-red-700`}>{error}</p>
        </div>
      )}

      {/* 약관 동의 */}
      <div className="mb-8">
        <label className={`
          flex items-start gap-3 cursor-pointer
          px-4 py-3 rounded-lg hover:bg-neutral-50 transition-colors
        `}>
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            className={`
              mt-1 w-5 h-5 rounded accent-yellow-600 cursor-pointer flex-shrink-0
            `}
            disabled={isLoading}
          />
          <span className={`${typoClasses.bodySmall} text-neutral-700 flex-1`}>
            상품 구매 및 결제에 동의합니다
          </span>
        </label>
      </div>

      {/* CTA 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !hasAgreed}
        className={`
          w-full h-14 rounded-lg font-semibold text-white
          transition-all ${designSystem.transition.base}
          text-base sm:text-lg
          ${
            isLoading || !hasAgreed
              ? 'bg-neutral-300 cursor-not-allowed'
              : 'bg-yellow-600 hover:bg-yellow-700 active:scale-98'
          }
          ${designSystem.shadow.md} hover:${designSystem.shadow.lg}
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> 결제 진행 중...
          </span>
        ) : (
          `${(amount / 1000).toLocaleString()}원 결제하기`
        )}
      </button>

      {/* 보안 배지 */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <span className="text-base">🔒</span>
        <p className={`${typoClasses.label} text-neutral-500`}>
          SSL 암호화 보안 결제
        </p>
      </div>
    </div>
  );
}
