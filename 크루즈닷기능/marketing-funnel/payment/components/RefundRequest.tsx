'use client';

import { useState } from 'react';
import { designSystem, typoClasses, colorClasses } from '@/lib/design/design-system';

interface RefundRequestProps {
  orderId: string;
  productName: string;
  paidAmount: number;
  departureDate: string;
  onSubmit: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function RefundRequest({
  orderId,
  productName,
  paidAmount,
  departureDate,
  onSubmit,
  isLoading = false,
}: RefundRequestProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const daysUntilDeparture = Math.ceil(
    (new Date(departureDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const refundPolicy = (() => {
    if (daysUntilDeparture >= 30) return { rate: 100, daysRequired: '30일 이상' };
    if (daysUntilDeparture >= 7) return { rate: 50, daysRequired: '7일 이상' };
    if (daysUntilDeparture > 0) return { rate: 25, daysRequired: '1일 이상' };
    return { rate: 0, daysRequired: '불가능' };
  })();

  const refundAmount = Math.floor(paidAmount * (refundPolicy.rate / 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError('환불 사유를 입력해주세요');
      return;
    }

    if (reason.length < 10) {
      setError('환불 사유는 10자 이상 입력해주세요');
      return;
    }

    try {
      setError(null);
      await onSubmit(reason);
      setSuccess(true);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '환불 신청 중 오류가 발생했습니다');
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-0 py-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className={`${typoClasses.h2} text-emerald-700 mb-2`}>
            환불 신청이 완료되었습니다
          </h2>
          <p className={`${typoClasses.body} ${colorClasses.textSecondary}`}>
            3~5일 이내에 환불이 진행됩니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0 py-8">
      <h2 className={`${typoClasses.h2} mb-8 text-neutral-900`}>환불 신청</h2>

      {/* 환불 정책 안내 */}
      <div className={`
        bg-gradient-to-r from-yellow-50 to-orange-50
        border border-yellow-200 rounded-xl p-6 mb-8
      `}>
        <p className={`${typoClasses.label} ${colorClasses.textMuted} mb-4 uppercase`}>
          환불 정책
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className={`${typoClasses.label} text-yellow-700 mb-2`}>출발까지</p>
            <p className={`${typoClasses.h4} text-neutral-900`}>{daysUntilDeparture}일</p>
          </div>
          <div className="text-center">
            <p className={`${typoClasses.label} text-yellow-700 mb-2`}>환불율</p>
            <p className={`${typoClasses.h4} text-neutral-900`}>{refundPolicy.rate}%</p>
          </div>
          <div className="text-center">
            <p className={`${typoClasses.label} text-yellow-700 mb-2`}>환불 금액</p>
            <p className={`${typoClasses.h4} text-yellow-600`}>
              {(refundAmount / 1000).toLocaleString()}원
            </p>
          </div>
          <div className="text-center">
            <p className={`${typoClasses.label} text-yellow-700 mb-2`}>소요 기간</p>
            <p className={`${typoClasses.h4} text-neutral-900`}>3~5일</p>
          </div>
        </div>

        <div className={`text-xs bg-white rounded-lg px-3 py-2 text-neutral-600`}>
          📌 출발 {refundPolicy.daysRequired} 전 신청 시 {refundPolicy.rate}% 환불 가능
        </div>
      </div>

      {/* 주문 정보 */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 sm:px-6 py-4 mb-8">
        <p className={`${colorClasses.textMuted} text-xs font-medium mb-3 uppercase`}>
          주문 정보
        </p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className={colorClasses.textSecondary}>상품</span>
            <span className={`${typoClasses.bodySmall} font-semibold text-neutral-900`}>
              {productName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colorClasses.textSecondary}>주문번호</span>
            <span className={`${typoClasses.bodySmall} font-mono text-neutral-700`}>
              {orderId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colorClasses.textSecondary}>결제 금액</span>
            <span className={`${typoClasses.bodySmall} font-semibold text-neutral-900`}>
              {(paidAmount / 1000).toLocaleString()}원
            </span>
          </div>
        </div>
      </div>

      {/* 환불 신청 폼 */}
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className={`${typoClasses.bodySmall} text-red-700`}>{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label className={`${typoClasses.label} text-neutral-900 block mb-3`}>
            환불 사유 *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="환불 사유를 입력해주세요 (최소 10자)"
            maxLength={500}
            disabled={isLoading}
            className={`
              w-full h-32 rounded-lg border-2 border-neutral-300 bg-white
              px-4 py-3 text-base resize-none
              placeholder-neutral-400 focus:outline-none
              focus:border-yellow-600 focus:ring-2 focus:ring-yellow-100
              transition-all ${designSystem.transition.base}
              disabled:bg-neutral-100 disabled:cursor-not-allowed
            `}
          />
          <div className={`mt-2 text-xs ${colorClasses.textMuted}`}>
            {reason.length}/500
          </div>
        </div>

        {/* 동의 체크 */}
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            required
            disabled={isLoading}
            className="mt-1 w-5 h-5 rounded accent-yellow-600 flex-shrink-0"
          />
          <span className={`${typoClasses.bodySmall} text-neutral-700`}>
            환불 정책을 확인했으며, 이에 동의합니다
          </span>
        </label>

        {/* CTA 버튼 */}
        <button
          type="submit"
          disabled={isLoading}
          className={`
            w-full h-14 rounded-lg font-semibold text-white
            transition-all ${designSystem.transition.base}
            ${
              isLoading
                ? 'bg-neutral-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 active:scale-98'
            }
            ${designSystem.shadow.md} hover:${designSystem.shadow.lg}
          `}
        >
          {isLoading ? '신청 중...' : '환불 신청하기'}
        </button>
      </form>
    </div>
  );
}
