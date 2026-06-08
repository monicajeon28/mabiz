'use client';

import React, { useState } from 'react';
import { track } from '@/lib/landing/analytics';

export default function HeroSection() {
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const handleCTAClick = () => {
    track('hero_cta_click', { section: 'hero' });
    const element = document.getElementById('application-form');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 lg:gap-16 items-center">
          {/* Text Content */}
          <div className="space-y-6 xs:space-y-7 sm:space-y-8">
            {/* Main headline */}
            <div className="space-y-3 xs:space-y-4">
              <p className="text-blue-300 text-xs xs:text-sm font-semibold uppercase tracking-wider">
                크루즈 여행의 새로운 기준
              </p>
              <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                자유 여행이어도
                <span className="block text-blue-400">인솔자와 함께</span>
              </h1>
            </div>

            {/* Subheading */}
            <p className="text-base xs:text-lg sm:text-lg md:text-xl text-gray-300 leading-relaxed">
              혼자 떠나는 불안함은 이제 그만.
              <br />
              <strong className="text-white">베테랑 인솔자의 세심한 동반</strong>으로
              자유와 안전의 완벽한 조화를 경험하세요.
            </p>

            {/* Trust indicators */}
            <div className="pt-2 xs:pt-3 space-y-2 xs:space-y-2.5">
              <div className="flex items-start xs:items-center space-x-2 xs:space-x-3">
                <span className="text-blue-300 text-sm xs:text-base flex-shrink-0">✓</span>
                <span className="text-xs xs:text-sm sm:text-base text-gray-300">매일 142명이 신청하는 크루즈닷</span>
              </div>
              <div className="flex items-start xs:items-center space-x-2 xs:space-x-3">
                <span className="text-blue-300 text-sm xs:text-base flex-shrink-0">✓</span>
                <span className="text-xs xs:text-sm sm:text-base text-gray-300">선사 직결 → 100% 환금 보장</span>
              </div>
              <div className="flex items-start xs:items-center space-x-2 xs:space-x-3">
                <span className="text-blue-300 text-sm xs:text-base flex-shrink-0">✓</span>
                <span className="text-xs xs:text-sm sm:text-base text-gray-300">고객 만족도 78점, 재구매율 92%</span>
              </div>
            </div>

            {/* Primary CTA */}
            <div className="pt-6 xs:pt-7 flex flex-col xs:flex-row gap-2 xs:gap-3 sm:gap-4">
              <button
                onClick={handleCTAClick}
                className="px-4 xs:px-6 sm:px-8 py-3 xs:py-4 text-sm xs:text-base bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                신청만 해도 10-30% 할인
              </button>
              <button
                onClick={handleCTAClick}
                className="px-4 xs:px-6 sm:px-8 py-3 xs:py-4 text-sm xs:text-base border-2 border-white text-white hover:bg-white/10 rounded-lg font-bold transition-all"
              >
                무료 상담받기
              </button>
            </div>

            {/* Success metrics */}
            <div className="pt-4 xs:pt-6 sm:pt-8 grid grid-cols-3 gap-2 xs:gap-3 sm:gap-6 border-t border-gray-700">
              <div className="pt-3 xs:pt-4 sm:pt-6">
                <p className="text-xl xs:text-2xl sm:text-3xl font-bold text-blue-300">92%</p>
                <p className="text-xs xs:text-sm text-gray-400 mt-0.5 xs:mt-1">재구매율</p>
              </div>
              <div className="pt-3 xs:pt-4 sm:pt-6">
                <p className="text-xl xs:text-2xl sm:text-3xl font-bold text-blue-300">78점</p>
                <p className="text-xs xs:text-sm text-gray-400 mt-0.5 xs:mt-1">고객만족도</p>
              </div>
              <div className="pt-3 xs:pt-4 sm:pt-6">
                <p className="text-xl xs:text-2xl sm:text-3xl font-bold text-blue-300">5,200+</p>
                <p className="text-xs xs:text-sm text-gray-400 mt-0.5 xs:mt-1">신청자/년</p>
              </div>
            </div>
          </div>

          {/* Visual - Cruise Image/Video */}
          <div className="relative mt-6 xs:mt-7 sm:mt-8 md:mt-0">
            <div className="relative h-full min-h-56 xs:min-h-64 sm:min-h-80 md:min-h-96 rounded-2xl overflow-hidden shadow-2xl">
              {/* Placeholder for cruise ship image */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <div className="text-center">
                  <svg
                    className="w-24 h-24 mx-auto text-white/30 mb-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                  </svg>
                  <p className="text-white/60 text-lg">여행 이미지</p>
                  <p className="text-white/40 text-sm mt-2">크루즈 경험 영상</p>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute top-6 right-6 bg-red-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg animate-pulse">
                긴급: 10석 남음!
              </div>
            </div>

            {/* Decorative element */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
