'use client';

import React from 'react';
import { track } from '@/lib/landing/analytics';
import { useIntersectionObserver } from '@/lib/landing/useIntersectionObserver';

const problems = [
  {
    id: 1,
    icon: '🧳',
    title: '짐 분실 및 관리 실패',
    description: '짐을 다른 크루즈에 넣거나, 잃어버리고도 보상받지 못함',
    solution: '크루즈닷: 짐 관리 사전 지시 + 선박과 미리 협의',
    pain: '손실 비용 50-500만원',
  },
  {
    id: 2,
    icon: '🚪',
    title: '객실 문제 & 응급상황',
    description: '객실이 열리지 않거나, 건강 문제 발생 시 영어로 직접 대응',
    solution: '크루즈닷: 선박 의료진과 미리 협의 + 24/7 매니저',
    pain: '여행 중단 또는 생명 위험',
  },
  {
    id: 3,
    icon: '✈️',
    title: '항공편 연착으로 크루즈 불가',
    description: '비행기 연착 → 크루즈는 기다리지 않음 → 탑승 불가',
    solution: '크루즈닷: 항공편 연착 시나리오 사전 계획 + 대체편 예약',
    pain: '여행 일정 전체 날림',
  },
  {
    id: 4,
    icon: '🗺️',
    title: '항구 도착 후 길 잃음',
    description: '낯선 항구, 영어 불가, 지도도 없음 → 패닉',
    solution: '크루즈닷: 크루즈항 맵 + 안내 + 인솔자 동반 (140만원 가치)',
    pain: '쇼핑/관광 기회 상실',
  },
  {
    id: 5,
    icon: '💰',
    title: '환불 불가 & 추가 비용',
    description: '외국 OTA 사이트 예약 → 환불 안 됨 + 환율 손실',
    solution: '크루즈닷: 선사 직결 + 한국 은행 계좌 + 100% 환금 보장',
    pain: '추가 손실 100-300만원',
  },
  {
    id: 6,
    icon: '😞',
    title: '혼자 여행자의 외로움',
    description: '혼자 가면 함께할 사람이 없음 + 뭔가 일어나면?',
    solution: '크루즈닷: 비슷한 사람과 매칭 + 매니저 중재',
    pain: '여행 만족도 50% 이하 저하',
  },
];

export default function ProblemSection() {
  const [sectionRef, sectionVisible] = useIntersectionObserver({ threshold: 0.1 });

  const handleExpand = (id: number) => {
    track('problem_card_expand', { problem_id: id });
  };

  return (
    <section
      ref={sectionRef}
      className="py-20 bg-gray-50"
      data-scroll-animation="problems"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className={`text-center mb-16 ${sectionVisible ? 'animate-fadeInDown' : 'opacity-0'}`}>
          <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider">
            🎯 고객 실제 문제
          </p>
          <h2
            className="text-4xl md:text-5xl font-bold text-gray-900 mt-4"
            style={{
              animation: sectionVisible ? 'fadeInUp 0.6s ease-out 0.1s forwards' : 'none',
            }}
          >
            이런 경험 있으신가요?
          </h2>
          <p className="text-xl text-gray-600 mt-4 max-w-2xl mx-auto">
            크루즈 여행에서 흔히 발생하는 문제들.
            <br />
            저희는 이미 <strong>1,000번 이상 해결했습니다</strong>.
          </p>
        </div>

        {/* Problems grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {problems.map((problem, index) => (
            <div
              key={problem.id}
              onClick={() => handleExpand(problem.id)}
              className={`bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all cursor-pointer border-l-4 border-red-500 ${sectionVisible ? 'animate-slideInUp' : 'opacity-0'}`}
              style={{
                animation: sectionVisible ? `slideInUp 0.7s ease-out ${0.1 + index * 0.05}s forwards` : 'none',
              }}
            >
              {/* Icon and title */}
              <div className="flex items-start space-x-4 mb-4">
                <span className="text-4xl">{problem.icon}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{problem.title}</h3>
                </div>
              </div>

              {/* Problem description */}
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">{problem.description}</p>

              {/* Pain point badge */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 font-semibold text-sm">손실: {problem.pain}</p>
              </div>

              {/* Solution */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm font-medium">
                  <strong>✓ 해결책:</strong> {problem.solution}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-600 text-lg mb-6">
            이 모든 문제를 <strong className="text-blue-600">인솔자 동반</strong>으로 해결합니다
          </p>
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-6 py-3 rounded-full font-semibold">
            <span>→</span>
            <span>아래 솔루션을 확인하세요</span>
          </div>
        </div>
      </div>
    </section>
  );
}
