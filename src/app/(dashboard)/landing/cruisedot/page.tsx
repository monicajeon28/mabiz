'use client';

import { useState } from 'react';
import SignupForm from './components/SignupForm';
import PriceComparison from './components/PriceComparison';
import CountdownTimer from './components/CountdownTimer';
import { loadCruisedotConfig } from '@/lib/constants/cruisedot-config';

/**
 * 크루즈닷 랜딩페이지 (9개 섹션)
 * 모든 하드코딩된 값은 @/lib/constants/cruisedot-config.ts에서 관리됩니다.
 * 수정 시 해당 파일을 변경하면 자동 반영됩니다.
 */
export default function CruisedotLandingPage() {
  const [formOpen, setFormOpen] = useState(false);
  const config = loadCruisedotConfig();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* 1️⃣ HERO SECTION */}
      <section className="py-16 px-4 text-center bg-gradient-to-r from-blue-600 to-blue-400">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          {config.sections.hero.title}
        </h1>
        <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto">
          {config.sections.hero.subtitle}
        </p>

        {/* 상품 3가지 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          <div className="bg-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow">
            <div className="bg-gradient-to-b from-blue-200 to-blue-100 h-48 rounded mb-3 flex items-center justify-center">
              <span className="text-gray-600 text-lg font-semibold">⚓ 국내 크루즈</span>
            </div>
            <h3 className="text-lg font-bold">{config.pricing.domestic.description}</h3>
            <p className="text-sm text-gray-600 mt-1">{config.pricing.domestic.nights}박 {config.pricing.domestic.priceRange}</p>
            <p className="text-xs text-gray-500 mt-2">인솔자 동반 + 24/7 지원</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow border-2 border-yellow-400">
            <div className="bg-gradient-to-b from-yellow-200 to-yellow-100 h-48 rounded mb-3 flex items-center justify-center">
              <span className="text-gray-600 text-lg font-semibold">✨ 프리미엄</span>
            </div>
            <h3 className="text-lg font-bold">{config.pricing.japan.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{(config.pricing.japan.totalPrice / 1000000).toFixed(1)}만원 / {config.pricing.japan.nights}박</p>
            <p className="text-xs text-gray-500 mt-2">선실 업그레이드 + 식사 포함</p>
            <p className="text-xs text-yellow-600 font-bold mt-2">⭐ {config.pricing.japan.badge}</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow">
            <div className="bg-gradient-to-b from-green-200 to-green-100 h-48 rounded mb-3 flex items-center justify-center">
              <span className="text-gray-600 text-lg font-semibold">🌍 경제형</span>
            </div>
            <h3 className="text-lg font-bold">{config.pricing.southeastAsia.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{(config.pricing.southeastAsia.totalPrice / 1000000).toFixed(1)}만원 / {config.pricing.southeastAsia.nights}박</p>
            <p className="text-xs text-gray-500 mt-2">모든 물품 포함 + {config.pricing.southeastAsia.discount}</p>
          </div>
        </div>
      </section>

      {/* 7️⃣ URGENCY SECTION */}
      <section className="py-16 px-4 bg-gradient-to-r from-red-50 to-red-100">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-pulse mb-4">
            <p className="text-3xl font-bold text-red-600">
              🚨 {config.sections.hero.countdownSeats}석 남았습니다
            </p>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            {config.sections.hero.urgencyText}
          </h2>
          <p className="text-lg text-gray-700 mb-8">더 늦기 전에 결정하세요</p>
          <CountdownTimer remainingSeats={config.sections.hero.countdownSeats} />
        </div>
      </section>

      {/* 8️⃣ CTA FORM SECTION */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-blue-500">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">
            {config.sections.cta.mainTitle}
          </h2>
          <p className="text-blue-100 text-center mb-8 text-lg">
            매니저가 {config.contact.managerResponseTime}시간 내 연락 드릴 예정입니다
          </p>
          <SignupForm />
        </div>
      </section>

      {/* 9️⃣ CONTINUITY SECTION (Live Broadcast) */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            {config.sections.liveStream.title}
          </h2>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-8 text-center border-2 border-red-400">
            <p className="text-3xl font-bold text-red-600 mb-2">
              {config.sections.liveStream.schedule}
            </p>
            <p className="text-gray-700 mb-6 text-lg">
              {config.sections.liveStream.description}
            </p>
            <a
              href={config.contact.youtubeChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-red-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-red-700 transition-colors shadow-lg"
            >
              {config.sections.liveStream.buttonText}
            </a>
            <p className="text-sm text-gray-600 mt-6">
              {config.sections.liveStream.note}
            </p>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF SECTION */}
      <section className="py-12 px-4 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">📊 실제 고객들의 반응</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg p-8">
              <p className="text-5xl font-bold text-blue-600">{config.marketing.customerSatisfaction}/5</p>
              <p className="text-gray-700 mt-2 font-semibold">고객 만족도</p>
              <p className="text-sm text-gray-600 mt-1">{config.marketing.reviewCount.toLocaleString()}명 리뷰</p>
            </div>
            <div className="bg-white rounded-lg p-8">
              <p className="text-5xl font-bold text-green-600">{config.marketing.repurchaseRate}%</p>
              <p className="text-gray-700 mt-2 font-semibold">재구매율</p>
            </div>
            <div className="bg-white rounded-lg p-8">
              <p className="text-5xl font-bold text-red-600">{config.marketing.dailySignups}명</p>
              <p className="text-gray-700 mt-2 font-semibold">하루 신청</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4 text-center text-sm">
        <p className="mb-2">크루즈닷 | 안전한 크루즈 여행의 새로운 기준</p>
        <p className="text-xs text-gray-500">Copyright © 2026 Cruisedot. All rights reserved.</p>
      </footer>
    </div>
  );
}