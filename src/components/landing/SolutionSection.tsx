'use client';

import React from 'react';
import { track } from '@/lib/landing/analytics';
import { useIntersectionObserver } from '@/lib/landing/useIntersectionObserver';

const solutions = [
  {
    id: 1,
    title: '사전 건강검진',
    description: '전국 140개 병원 + 세브란스 등 유명 대학병원',
    icon: '🏥',
    details: [
      '연 2회 무료 건강검진',
      '부모님 건강 상태 파악',
      '크루즈 적합성 판단',
      '필요 시 간병인 지원',
    ],
  },
  {
    id: 2,
    title: '베테랑 인솔자 동반',
    description: '선사 공식 인정, 평균 경력 15년 이상',
    icon: '👨‍💼',
    details: [
      '영어 완벽 소통',
      '선박 내 문제 즉시 대응',
      '항구 안내 및 쇼핑 가이드',
      '매일 아침 건강 체크',
    ],
  },
  {
    id: 3,
    title: '선사 직결 & 은행 관리',
    description: '로열캐리비안 공식 파트너, 투명한 자금 관리',
    icon: '🏦',
    details: [
      '100% 환금 보장',
      '한국 은행 계좌 관리',
      '외환 손실 없음',
      '변경 수수료 최소화',
    ],
  },
  {
    id: 4,
    title: '24/7 매니저 지원',
    description: '여행 전, 여행 중, 여행 후 끝까지 책임',
    icon: '📱',
    details: [
      '여행 전: 상세 안내 + 서류 준비',
      '여행 중: 긴급상황 즉시 대응',
      '여행 후: 영상 편집 + 다음 상담',
      '어떤 문제든 해결',
    ],
  },
  {
    id: 5,
    title: '사진작가 & 영상 편집',
    description: '인생샷을 위한 전문 스태프 배치',
    icon: '📷',
    details: [
      '여행 중 전문 사진작가 배치',
      '로맨틱한 저녁식사 사진',
      '인생샷 가이드 제공',
      '스태프가 직접 영상 편집 선물',
    ],
  },
  {
    id: 6,
    title: '혼자 여행자 매칭',
    description: '비슷한 사람과 연결, 매니저가 중재',
    icon: '🤝',
    details: [
      '담당 매니저가 두 사람 모두 파악',
      '성향 파악 후 최적 매칭',
      '문제 발생 시 즉시 중재',
      '혼자이지만 혼자 아닌 경험',
    ],
  },
];

export default function SolutionSection() {
  const [sectionRef, sectionVisible] = useIntersectionObserver({ threshold: 0.1 });

  const handleLearnMore = (id: number) => {
    track('solution_learn_more', { solution_id: id });
  };

  return (
    <section
      ref={sectionRef}
      className="py-20 bg-white"
      data-scroll-animation="solutions"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className={`text-center mb-16 ${sectionVisible ? 'animate-fadeInDown' : 'opacity-0'}`}>
          <p className="text-green-600 font-semibold text-sm uppercase tracking-wider">
            ✓ 우리의 솔루션
          </p>
          <h2
            className="text-4xl md:text-5xl font-bold text-gray-900 mt-4"
            style={{
              animation: sectionVisible ? 'fadeInUp 0.6s ease-out 0.1s forwards' : 'none',
            }}
          >
            그래서 우리는 이렇게 합니다
          </h2>
          <p className="text-xl text-gray-600 mt-4 max-w-3xl mx-auto">
            모든 문제를 <strong>사전에 예방</strong>하고, 발생하면 <strong>즉시 해결</strong>합니다.
            <br />
            고객 만족도 78점, 재구매율 92%의 비결입니다.
          </p>
        </div>

        {/* Solutions grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {solutions.map((solution, index) => (
            <div
              key={solution.id}
              className={`bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-8 hover:shadow-lg transition-all border border-gray-200 ${sectionVisible ? 'animate-scaleIn' : 'opacity-0'}`}
              style={{
                animation: sectionVisible ? `scaleIn 0.6s ease-out ${index * 0.1}s forwards` : 'none',
              }}
            >
              {/* Icon */}
              <div className="text-5xl mb-4">{solution.icon}</div>

              {/* Title and description */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">{solution.title}</h3>
              <p className="text-gray-600 text-sm mb-6 h-12">{solution.description}</p>

              {/* Details list */}
              <ul className="space-y-3 mb-6">
                {solution.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start space-x-3">
                    <span className="text-green-500 font-bold text-lg">✓</span>
                    <span className="text-gray-700 text-sm">{detail}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                onClick={() => handleLearnMore(solution.id)}
                className="w-full py-2 px-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                자세히 보기
              </button>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="mt-20 bg-blue-50 rounded-xl p-8 border border-blue-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            일반 여행사 vs 크루즈닷
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-blue-300">
                  <th className="text-left py-4 px-4 font-bold text-gray-900">항목</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">일반 여행사</th>
                  <th className="text-left py-4 px-4 font-bold text-green-700">크루즈닷 ✓</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-blue-200">
                  <td className="py-4 px-4 font-semibold text-gray-900">출발 전</td>
                  <td className="py-4 px-4 text-gray-600">알아서 준비</td>
                  <td className="py-4 px-4 text-green-700">인솔자 상세 안내</td>
                </tr>
                <tr className="border-b border-blue-200">
                  <td className="py-4 px-4 font-semibold text-gray-900">비행기 연착</td>
                  <td className="py-4 px-4 text-gray-600">고객이 해결</td>
                  <td className="py-4 px-4 text-green-700">인솔자가 대응</td>
                </tr>
                <tr className="border-b border-blue-200">
                  <td className="py-4 px-4 font-semibold text-gray-900">항구 도착</td>
                  <td className="py-4 px-4 text-gray-600">길 잃을 수 있음</td>
                  <td className="py-4 px-4 text-green-700">안내 제공 (140만원 가치)</td>
                </tr>
                <tr className="border-b border-blue-200">
                  <td className="py-4 px-4 font-semibold text-gray-900">선박 내 문제</td>
                  <td className="py-4 px-4 text-gray-600">영어로 직접 대응</td>
                  <td className="py-4 px-4 text-green-700">인솔자가 중재</td>
                </tr>
                <tr className="border-b border-blue-200">
                  <td className="py-4 px-4 font-semibold text-gray-900">여행 후</td>
                  <td className="py-4 px-4 text-gray-600">끝</td>
                  <td className="py-4 px-4 text-green-700">영상 편집, 다음 상담</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-gray-900">신뢰도</td>
                  <td className="py-4 px-4 text-gray-600">낮음</td>
                  <td className="py-4 px-4 text-green-700">선사 직결, 라이브방송 증명</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
