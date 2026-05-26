'use client';

import { AlertCircle, Zap, Gift } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OfferSectionProps {
  /** 할인율 (예: 40) */
  discountPercent?: number;
  /** 원가 (예: 1500000) */
  originalPrice?: number;
  /** 마감 시간 (ISO string) */
  deadlineAt?: string;
  /** 남은 예약 (선택) */
  remainingSlots?: number;
}

/**
 * L10 렌즈 + L6 손실회피 - 혜택 섹션
 *
 * 심리학 원리:
 * 1. Loss Aversion: 손실의 가중치가 이득의 2.25배 (Kahneman & Tversky)
 * 2. Scarcity: 시간/수량 제한으로 FOMO 유발
 * 3. Social Proof: 기존 고객 수로 신뢰도 증가
 *
 * 구현:
 * - 시간 기반 희소성: "이번 주 금요일까지"
 * - 수량 기반 희소성: "남은 예약: 3개" (선택)
 * - 가격 기반 희소성: "할인은 이번 주까지"
 */
export function OfferSection({
  discountPercent = 40,
  originalPrice = 1500000,
  deadlineAt,
  remainingSlots,
}: OfferSectionProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
  const monthlyPrice = Math.round(discountedPrice / 12);

  // 남은 시간 계산
  useEffect(() => {
    if (!deadlineAt) return;

    const updateTimeLeft = () => {
      const now = new Date();
      const deadline = new Date(deadlineAt);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('마감됨');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`D-${days}일 ${hours}시간`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}시간 ${minutes}분`);
      } else {
        setTimeLeft(`${minutes}분`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000); // 1분마다 업데이트

    return () => clearInterval(interval);
  }, [deadlineAt]);

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 md:p-8 my-8">
      {/* 헤더 */}
      <div className="flex items-start gap-3 mb-6">
        <Gift className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
        <div>
          <h3 className="font-bold text-lg text-amber-900">🎁 이번 주 특별 혜택</h3>
          <p className="text-sm text-amber-700 mt-1">
            한정된 시간에만 제공되는 프리미엄 패키지 할인
          </p>
        </div>
      </div>

      {/* 3가지 혜택 카드 */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* 혜택 1: 특별 할인 */}
        <div className="bg-white rounded-lg p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-orange-500" />
            <h4 className="font-semibold text-gray-900">그룹 특별 할인</h4>
          </div>
          <p className="text-2xl font-bold text-amber-600 mb-2">
            {discountPercent}% 할인
          </p>
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              정가: <span className="line-through">{originalPrice.toLocaleString()}원</span>
            </p>
            <p className="text-sm font-semibold text-amber-700">
              할인가: {discountedPrice.toLocaleString()}원
            </p>
            <p className="text-gray-500">월 {monthlyPrice.toLocaleString()}원 (12개월 무이자)</p>
          </div>
        </div>

        {/* 혜택 2: 추가 서비스 */}
        <div className="bg-white rounded-lg p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-pink-500" />
            <h4 className="font-semibold text-gray-900">추가 서비스</h4>
          </div>
          <ul className="text-xs text-gray-700 space-y-2">
            <li>✓ 입실 시 전문 촬영 (인생샷 3장)</li>
            <li>✓ 스파 에센셜 오일 마사지 (1회)</li>
            <li>✓ 배우자/동반인 40% 추가 할인</li>
          </ul>
        </div>

        {/* 혜택 3: 보장 및 유연성 */}
        <div className="bg-white rounded-lg p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-green-500" />
            <h4 className="font-semibold text-gray-900">환불보장</h4>
          </div>
          <ul className="text-xs text-gray-700 space-y-2">
            <li>✓ 30일 전 취소 시 100% 환불</li>
            <li>✓ 14일 이내 무료 플랜 변경</li>
            <li>✓ 업계 최장 환불보장 기간</li>
          </ul>
        </div>
      </div>

      {/* 희소성 강조 섹션 */}
      <div className="bg-white rounded-lg p-4 border-2 border-red-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏰</span>
            <span className="font-semibold text-gray-900">이번 주 금요일까지만</span>
          </div>

          {/* 남은 시간 표시 */}
          {timeLeft && (
            <div className="text-right">
              <p className="text-sm text-gray-600">남은 시간</p>
              <p className="font-bold text-lg text-red-600">{timeLeft}</p>
            </div>
          )}
        </div>

        {/* 수량 기반 희소성 (선택) */}
        {remainingSlots !== undefined && remainingSlots < 5 && (
          <div className="mt-3 pt-3 border-t border-red-100">
            <p className="text-sm text-red-600 font-semibold">
              ⚠️ 남은 예약: {remainingSlots}개
            </p>
            <p className="text-xs text-red-500 mt-1">자리가 빠르게 채워지고 있습니다.</p>
          </div>
        )}
      </div>

      {/* 신뢰 배지 */}
      <div className="mt-6 pt-6 border-t border-amber-100 flex items-center gap-2 text-xs text-amber-700">
        <span>✓</span>
        <span>당신의 신뢰가 우리의 최우선입니다. 안심하고 선택하세요.</span>
      </div>
    </div>
  );
}
