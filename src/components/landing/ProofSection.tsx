'use client';

import React, { useState } from 'react';
import { track } from '@/lib/landing/analytics';
import { useIntersectionObserver } from '@/lib/landing/useIntersectionObserver';

const testimonials = [
  {
    id: 1,
    name: '김은희 (68세, 서울)',
    role: '효도 여행객',
    rating: 5,
    text: '부모님 건강이 안 좋아서 걱정했는데, 사전 건강검진도 받아드리고, 크루즈 중 의료팀과 미리 협의해서 아주 안심이 되었어요. 매니저가 매일 아침 건강을 체크해주니까 정말 믿을 수 있었어요.',
    highlight: '건강검진 + 의료팀 협의',
  },
  {
    id: 2,
    name: '박준호 & 이수진 (35세 신혼)',
    role: '신혼 부부',
    rating: 5,
    text: '신혼여행을 제대로 하고 싶었는데, 크루즈닷에서 사진작가도 배치해주고, 영상까지 편집해서 선물해주니까 정말 특별했어요. 인생샷도 많이 남겼고, 재구매는 확정입니다!',
    highlight: '사진작가 + 영상 편집',
  },
  {
    id: 3,
    name: '이재훈 (52세, 대구)',
    role: '가격민감 고객',
    rating: 4,
    text: '원래 싼 거 찾다가 후회하는 경우가 많았는데, 크루즈닷이 선사 직결이고 환금도 100% 보장되니까 오히려 더 저렴해요. 추가 비용도 없고. 다음 달에 또 예약할 생각입니다.',
    highlight: '100% 환금 보장 + 추가비용 무료',
  },
  {
    id: 4,
    name: '한정희 (60세, 부산)',
    role: '혼자 여행자',
    rating: 5,
    text: '혼자 가는 게 너무 불안했는데, 비슷한 분과 매칭해주시고 매니저가 계속 함께 해주니까 외로움이 없었어요. 새로운 친구도 사귀고, 이제는 혼자라는 생각이 안 들어요.',
    highlight: '혼자이지만 혼자 아닌 경험',
  },
  {
    id: 5,
    name: '조명숙 (55세, 인천)',
    role: '영어 불안 고객',
    rating: 5,
    text: '영어를 못 해서 크루즈를 포기하고 있었는데, 인솔자가 영어로 모든 걸 처리해주니까 안심이 돼요. 선박 의료진과도 미리 얘기해주고. 정말 든든합니다.',
    highlight: '인솔자 영어 대응',
  },
  {
    id: 6,
    name: '강민수 (50세, 서울)',
    role: '재구매 고객',
    rating: 5,
    text: '벌써 3번 다녀왔어요. 처음엔 신뢰가 없었지만, 매번 인솔자와 매니저가 정말 성실하게 대응해주니까 이제는 크루즈닷 아니면 안 가요. 친구들도 많이 추천했어요.',
    highlight: '재구매율 92% 달성',
  },
];

const stats = [
  { label: '고객 만족도', value: '78점', color: 'bg-blue-500' },
  { label: '재구매율', value: '92%', color: 'bg-green-500' },
  { label: '월 신청자', value: '~142명', color: 'bg-purple-500' },
  { label: '운영 기간', value: '5년+', color: 'bg-orange-500' },
];

export default function ProofSection() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [sectionRef, sectionVisible] = useIntersectionObserver({ threshold: 0.1 });

  const handleTestimonialClick = (id: number) => {
    setActiveTestimonial(id);
    track('testimonial_view', { testimonial_id: id });
  };

  return (
    <section
      ref={sectionRef}
      className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white"
      data-scroll-animation="proof"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className={`text-center mb-16 ${sectionVisible ? 'animate-fadeInDown' : 'opacity-0'}`}>
          <p className="text-blue-300 font-semibold text-sm uppercase tracking-wider">
            📊 검증된 성과
          </p>
          <h2
            className="text-4xl md:text-5xl font-bold mt-4"
            style={{
              animation: sectionVisible ? 'fadeInUp 0.6s ease-out 0.1s forwards' : 'none',
            }}
          >
            실제 고객들의 목소리
          </h2>
          <p className="text-xl text-gray-300 mt-4">
            크루즈닷을 선택한 고객들은 어떻게 변했을까요?
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20 ${sectionVisible ? 'animate-slideInUp' : 'opacity-0'}`}
              style={{
                animation: sectionVisible ? `slideInUp 0.7s ease-out ${idx * 0.08}s forwards` : 'none',
              }}
            >
              <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">
                {stat.label}
              </p>
              <p className="text-4xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Featured testimonial */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 hover:border-white/40 transition-all">
            {(() => {
              const testimonial = testimonials[activeTestimonial];
              return (
                <>
                  {/* Stars */}
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-yellow-400 text-xl">
                        ★
                      </span>
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-lg text-gray-100 mb-6 italic leading-relaxed">
                    "{testimonial.text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{testimonial.name}</p>
                      <p className="text-sm text-gray-400">{testimonial.role}</p>
                    </div>
                    <div className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      {testimonial.highlight}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Testimonial selector */}
          <div className="space-y-3">
            {testimonials.map((testimonial) => (
              <button
                key={testimonial.id}
                onClick={() => handleTestimonialClick(testimonial.id)}
                className={`w-full text-left px-4 h-12 rounded-lg transition-all transform hover:scale-105 flex items-center text-sm ${
                  activeTestimonial === testimonial.id
                    ? 'bg-blue-500 border-2 border-white shadow-lg'
                    : 'bg-white/10 border-2 border-white/20 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="font-bold text-white text-sm">{testimonial.name}</p>
                    <p className="text-xs text-gray-300">{testimonial.role}</p>
                  </div>
                  <div className="flex space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-yellow-300 text-sm">
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-20 grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-5xl mb-3">✓</div>
            <p className="text-lg font-semibold text-white">선사 공식 인정</p>
            <p className="text-gray-400 text-sm mt-2">로열캐리비안 정식 파트너</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-lg font-semibold text-white">5년 운영 신뢰</p>
            <p className="text-gray-400 text-sm mt-2">5,000+ 고객 거래 경험</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-3">🎬</div>
            <p className="text-lg font-semibold text-white">라이브방송 투명성</p>
            <p className="text-gray-400 text-sm mt-2">매주 화요일 라이브 증명</p>
          </div>
        </div>
      </div>
    </section>
  );
}
