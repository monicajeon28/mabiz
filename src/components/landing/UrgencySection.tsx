'use client';

import React, { useState, useEffect } from 'react';
import { track } from '@/lib/landing/analytics';
import { useIntersectionObserver } from '@/lib/landing/useIntersectionObserver';

interface CountdownState {
  hours: number;
  minutes: number;
  seconds: number;
}

export default function UrgencySection() {
  const [countdown, setCountdown] = useState<CountdownState>({
    hours: 23,
    minutes: 45,
    seconds: 30,
  });

  const [seatsLeft, setSeatsLeft] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        let { hours, minutes, seconds } = prev;

        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        }

        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleClickUrgency = () => {
    track('urgency_section_click', { seats_left: seatsLeft });
  };

  const formatTime = (value: number) => String(value).padStart(2, '0');
  const [sectionRef, sectionVisible] = useIntersectionObserver({ threshold: 0.15 });

  return (
    <section
      ref={sectionRef}
      className="py-20 bg-gradient-to-r from-red-500 via-red-600 to-orange-500 text-white relative overflow-hidden"
      data-scroll-animation="urgency"
    >
      {/* Animated background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute animate-pulse top-10 right-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute animate-pulse bottom-10 left-10 w-32 h-32 bg-white/10 rounded-full animation-delay-2000" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Main headline */}
        <div className={`space-y-6 mb-12 ${sectionVisible ? 'animate-fadeInDown' : 'opacity-0'}`}>
          <div className="inline-block px-6 py-3 bg-white/20 rounded-full backdrop-blur-sm">
            <p className="text-lg font-bold animate-pulse">⚡ 긴급 공지</p>
          </div>

          <h2
            className="text-4xl md:text-5xl font-bold leading-tight"
            style={{
              animation: sectionVisible ? 'fadeInUp 0.6s ease-out 0.1s forwards' : 'none',
            }}
          >
            지금 신청하면
            <br />
            <span className="text-yellow-200">10-30% 평생 할인</span>
          </h2>

          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            매달 142명이 신청하는 크루즈닷.
            <br />
            <strong className="text-yellow-200">하지만 매달 10석만 남습니다.</strong>
          </p>
        </div>

        {/* Stats boxes */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Daily applications */}
          <div
            className={`bg-white/20 backdrop-blur-sm rounded-xl p-8 border border-white/30 ${sectionVisible ? 'animate-slideInUp' : 'opacity-0'}`}
            style={{
              animation: sectionVisible ? 'slideInUp 0.7s ease-out 0.1s forwards' : 'none',
            }}
          >
            <p className="text-sm font-semibold text-white/80 uppercase mb-2">매일 신청</p>
            <p className="text-4xl font-bold">142명</p>
            <p className="text-sm text-white/70 mt-2">크루즈닷 대기자</p>
          </div>

          {/* Seats remaining */}
          <div
            className={`bg-white/20 backdrop-blur-sm rounded-xl p-8 border border-white/30 ring-2 ring-yellow-300 ${sectionVisible ? 'animate-slideInUp' : 'opacity-0'}`}
            style={{
              animation: sectionVisible ? 'slideInUp 0.7s ease-out 0.15s forwards' : 'none',
            }}
          >
            <p className="text-sm font-semibold text-yellow-200 uppercase mb-2">남은 자리</p>
            <p className="text-5xl font-bold text-yellow-200 animate-pulse">{seatsLeft}석</p>
            <p className="text-sm text-white/70 mt-2">다 차면 3개월 대기</p>
          </div>

          {/* Discount validity */}
          <div
            className={`bg-white/20 backdrop-blur-sm rounded-xl p-8 border border-white/30 ${sectionVisible ? 'animate-slideInUp' : 'opacity-0'}`}
            style={{
              animation: sectionVisible ? 'slideInUp 0.7s ease-out 0.2s forwards' : 'none',
            }}
          >
            <p className="text-sm font-semibold text-white/80 uppercase mb-2">할인 유효</p>
            <p className="text-4xl font-bold">평생</p>
            <p className="text-sm text-white/70 mt-2">재신청도 할인 적용</p>
          </div>
        </div>

        {/* Countdown timer */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-white/20 mb-12">
          <p className="text-white/80 text-sm font-semibold uppercase mb-4">오늘 자리 마감까지</p>

          <div className="flex justify-center gap-4 mb-6">
            {/* Hours */}
            <div className="text-center">
              <div className="bg-white/20 rounded-lg p-6 w-20 h-20 flex items-center justify-center">
                <span className="text-4xl font-bold">{formatTime(countdown.hours)}</span>
              </div>
              <p className="text-sm text-white/70 mt-2">시</p>
            </div>

            <div className="text-4xl font-bold self-center">:</div>

            {/* Minutes */}
            <div className="text-center">
              <div className="bg-white/20 rounded-lg p-6 w-20 h-20 flex items-center justify-center">
                <span className="text-4xl font-bold">{formatTime(countdown.minutes)}</span>
              </div>
              <p className="text-sm text-white/70 mt-2">분</p>
            </div>

            <div className="text-4xl font-bold self-center">:</div>

            {/* Seconds */}
            <div className="text-center">
              <div className="bg-white/20 rounded-lg p-6 w-20 h-20 flex items-center justify-center">
                <span className="text-4xl font-bold">{formatTime(countdown.seconds)}</span>
              </div>
              <p className="text-sm text-white/70 mt-2">초</p>
            </div>
          </div>

          <p className="text-white/80">마감 후 신청자는 3개월 대기 + 할인 미적용</p>
        </div>

        {/* Scarcity messaging */}
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-8 border border-white/30 mb-12">
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-lg font-semibold">지금 신청 vs 3개월 후 신청</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div className="bg-green-500/30 rounded-lg p-4 border border-green-400">
                <p className="font-bold text-yellow-200 text-lg mb-2">✓ 지금 신청</p>
                <ul className="text-sm space-y-2 text-white">
                  <li>• 10-30% 평생 할인</li>
                  <li>• 즉시 매니저 배정</li>
                  <li>• 다음주 상담 가능</li>
                  <li>• 3개월 내 여행</li>
                </ul>
              </div>
              <div className="bg-red-500/30 rounded-lg p-4 border border-red-400">
                <p className="font-bold text-white text-lg mb-2">✗ 3개월 후 신청</p>
                <ul className="text-sm space-y-2 text-white/80">
                  <li>• 할인 없음</li>
                  <li>• 3개월 대기</li>
                  <li>• 매니저 선택 불가</li>
                  <li>• 인기 크루즈 예약 불가</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* CTA button */}
        <button
          onClick={handleClickUrgency}
          className="w-full md:w-auto px-12 h-12 bg-white text-red-600 rounded-xl font-bold text-xl hover:bg-gray-100 transition-all transform hover:scale-105 active:scale-95 shadow-2xl mb-6 flex items-center justify-center"
        >
          지금 신청하기 (10-30% 할인)
        </button>

        {/* Trust footer */}
        <div className="text-white/80 text-sm space-y-2">
          <p>✓ 신청 후 무료 상담 | ✓ 24시간 이내 매니저 연락 | ✓ 중도해지 수수료 0원</p>
          <p>신청만 해도 10-30% 할인이 적용됩니다</p>
        </div>
      </div>
    </section>
  );
}
