'use client';

import React, { useState } from 'react';
import { track } from '@/lib/landing/analytics';

const offers = [
  {
    id: 1,
    name: '국내 플랜',
    price: '월 33,000원',
    duration: '12개월',
    destination: '부산 출도착',
    cruise: '일본 크루즈 1박',
    features: [
      '식사 포함',
      '인솔자 동반',
      '한국-일본 왕복',
      '건강검진 연 2회',
      '매니저 24/7 지원',
      '선사 직결 환금보장',
    ],
    totalValue: '39만원',
    badge: '인기',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 2,
    name: '동남아 플랜',
    price: '월 66,000원',
    duration: '12개월',
    destination: '동남아',
    cruise: '2박 크루즈',
    features: [
      '식사 포함',
      '베테랑 인솔자 동반',
      '스태프 동반',
      '사진작가 배치',
      '영상 편집 선물',
      '건강검진 연 2회',
    ],
    totalValue: '79만원',
    badge: '추천',
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 3,
    name: '프리미엄 플랜',
    price: '월 157,500원',
    duration: '12개월',
    destination: '일본 크루즈',
    cruise: '3박 프리미엄',
    features: [
      '모든 식사 + 음료 포함',
      '프리미엄 객실 업그레이드',
      '베테랑 인솔자 VIP 대응',
      '전용 가이드 배치',
      '프리미엄 선물 패키지',
      '다음 여행 특가 30%',
    ],
    totalValue: '189만원',
    badge: 'VIP',
    color: 'from-yellow-500 to-orange-600',
  },
];

export default function OfferSection() {
  const [selectedOffer, setSelectedOffer] = useState(1);

  const handleSelectOffer = (id: number) => {
    setSelectedOffer(id);
    track('offer_selected', { offer_id: id });
  };

  const handleLearnMore = (id: number) => {
    track('offer_learn_more', { offer_id: id });
  };

  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-10 xs:mb-12 sm:mb-14 md:mb-16 lg:mb-20">
          <p className="text-blue-600 font-semibold text-xs uppercase tracking-wider">
            💳 상품 구성
          </p>
          <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mt-2 xs:mt-3 sm:mt-4">
            월 33K부터 시작하는 인생 크루즈
          </h2>
          <p className="text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 mt-2 xs:mt-3 sm:mt-4 max-w-3xl mx-auto">
            모든 플랜에 포함:
            <br />
            <strong>건강검진 연 2회 + 인솔자 동반 + 매니저 24/7 + 100% 환금보장</strong>
          </p>
        </div>

        {/* Offers grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6 md:gap-8 mb-10 xs:mb-12 sm:mb-14 md:mb-16 lg:mb-20">
          {offers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => handleSelectOffer(offer.id)}
              className={`relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer transform hover:scale-105 ${
                selectedOffer === offer.id ? 'ring-4 ring-blue-500' : ''
              }`}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${offer.color}`} />

              {/* Badge */}
              <div className="absolute top-4 right-4 bg-white text-gray-900 px-4 py-1 rounded-full font-bold text-sm">
                {offer.badge}
              </div>

              {/* Content */}
              <div className="relative z-10 p-5 xs:p-6 sm:p-7 md:p-8 text-white h-full flex flex-col">
                {/* Title */}
                <h3 className="text-lg xs:text-xl sm:text-2xl font-bold mb-1">{offer.name}</h3>
                <p className="text-xs text-white/80 mb-3 xs:mb-4 sm:mb-6">{offer.destination}</p>

                {/* Price */}
                <div className="mb-5 xs:mb-6 sm:mb-8 border-t border-white/30 pt-3 xs:pt-4 sm:pt-6">
                  <p className="text-xs text-white/80">매월</p>
                  <p className="text-2xl xs:text-3xl sm:text-4xl font-bold">{offer.price}</p>
                  <p className="text-xs text-white/80 mt-0.5 xs:mt-1">{offer.duration} 기준</p>
                  <p className="text-sm xs:text-base sm:text-lg font-bold text-yellow-300 mt-2 xs:mt-3 sm:mt-4">총 {offer.totalValue}</p>
                </div>

                {/* Features */}
                <div className="space-y-1.5 xs:space-y-2 sm:space-y-3 mb-5 xs:mb-6 sm:mb-8 flex-1">
                  {offer.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start space-x-1.5 xs:space-x-2 sm:space-x-3">
                      <span className="text-yellow-300 flex-shrink-0 text-sm xs:text-base">✓</span>
                      <span className="text-xs sm:text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleLearnMore(offer.id)}
                  className="w-full py-2 xs:py-2.5 sm:py-3 px-4 text-xs xs:text-sm sm:text-base bg-white text-gray-900 rounded-lg font-bold hover:bg-gray-100 transition-all"
                >
                  이 플랜 선택
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison and guarantee section */}
        <div className="bg-blue-50 rounded-2xl p-5 xs:p-6 sm:p-8 md:p-10 lg:p-12 border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xs:gap-8 sm:gap-10 md:gap-12 lg:gap-16 items-start">
            {/* Left - Guarantee */}
            <div>
              <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 mb-4 xs:mb-5 sm:mb-6">모든 플랜에 포함된 보장</h3>
              <div className="space-y-2 xs:space-y-3 sm:space-y-4">
                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="text-xl xs:text-2xl sm:text-3xl text-green-500 flex-shrink-0">✓</div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">100% 환금 보장</p>
                    <p className="text-gray-600 text-xs">선사 직결이므로 외국 OTA 사이트처럼 환불 불가 걱정 없음</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="text-xl xs:text-2xl sm:text-3xl text-green-500 flex-shrink-0">✓</div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">추가 비용 0원</p>
                    <p className="text-gray-600 text-xs">광고, 수수료, 환율 손실 전부 없음</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="text-xl xs:text-2xl sm:text-3xl text-green-500 flex-shrink-0">✓</div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">신청만 해도 10-30% 할인</p>
                    <p className="text-gray-600 text-xs">평생 할인 적용 (매니저가 안내)</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="text-xl xs:text-2xl sm:text-3xl text-green-500 flex-shrink-0">✓</div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">중도 해지 수수료 없음</p>
                    <p className="text-gray-600 text-xs">언제든 중단 가능, 위약금 0원</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Benefits */}
            <div className="mt-6 md:mt-0">
              <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 mb-4 xs:mb-5 sm:mb-6">신청 고객의 변화</h3>
              <div className="space-y-3 xs:space-y-4 sm:space-y-6">
                <div>
                  <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-0.5 xs:gap-2 mb-1.5 xs:mb-2">
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">여행 만족도</p>
                    <p className="text-blue-600 font-bold text-xs xs:text-sm sm:text-base">45% → 92%</p>
                  </div>
                  <div className="w-full bg-gray-300 h-1.5 xs:h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: '92%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-0.5 xs:gap-2 mb-1.5 xs:mb-2">
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">건강 안심</p>
                    <p className="text-blue-600 font-bold text-xs xs:text-sm sm:text-base">30% → 95%</p>
                  </div>
                  <div className="w-full bg-gray-300 h-1.5 xs:h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: '95%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-0.5 xs:gap-2 mb-1.5 xs:mb-2">
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">재구매 의향</p>
                    <p className="text-blue-600 font-bold text-xs xs:text-sm sm:text-base">25% → 92%</p>
                  </div>
                  <div className="w-full bg-gray-300 h-1.5 xs:h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: '92%' }} />
                  </div>
                </div>

                <div className="mt-4 xs:mt-5 sm:mt-8 p-2.5 xs:p-3 sm:p-4 bg-white rounded-lg border-2 border-blue-300">
                  <p className="text-xs text-gray-600">
                    <strong className="text-gray-900">평균 효과:</strong> 신청자 92%가 3개월 내 재신청
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
