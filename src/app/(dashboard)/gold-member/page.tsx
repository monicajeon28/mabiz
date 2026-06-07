"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Heart, Users, Calendar, Shield, ArrowRight, Star, CheckCircle,
  Loader2
} from "lucide-react";

const TESTIMONIALS = [
  {
    name: "김영희",
    age: 58,
    text: "건강검진부터 여행까지 모든 걱정이 사라졌어요. 전담 매니저분이 계속 챙겨주셔서 안심이 됩니다.",
    rating: 5,
  },
  {
    name: "이순신",
    age: 62,
    text: "월 33,000원으로 가족과 함께 여행을 가고, 건강도 챙길 수 있다니 정말 좋은 상품입니다.",
    rating: 5,
  },
  {
    name: "박민영",
    age: 55,
    text: "혼자 여행 가는 게 불안했는데, 비슷한 나이대 사람들과 만나서 정말 좋은 추억을 만들었습니다.",
    rating: 5,
  },
];

const STEPS = [
  {
    number: "1",
    title: "4단계 신청",
    desc: "기본정보 → 플랜 선택 → 결제방법 → 약관 동의 (5분 소요)",
  },
  {
    number: "2",
    title: "확인 이메일",
    desc: "계약서와 영수증을 이메일로 받으세요.",
  },
  {
    number: "3",
    title: "건강검진 예약",
    desc: "140개 병원 중 원하는 곳에서 건강검진을 받으세요.",
  },
  {
    number: "4",
    title: "여행 상담",
    desc: "전담 매니저가 맞춤형 여행을 제안합니다.",
  },
];

export default function GoldMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    try {
      // 신청 페이지로 이동
      router.push("/gold-member/signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-b from-blue-600 to-blue-700 text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            건강한 크루즈 여행의 시작
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 mb-8">
            40-60대 가족을 위한 전담 매니저, 건강검진, 맞춤형 여행이 모두 포함된 플랜
          </p>

          {/* 손실회피 심리학 요소 */}
          <div className="mb-8 p-4 sm:p-6 bg-blue-500 rounded-lg border-2 border-blue-300">
            <p className="text-base sm:text-lg font-semibold">
              ⚠️ 나이 들기 전에 건강하게 여행을 떠나세요.
            </p>
            <p className="text-sm sm:text-base text-blue-100 mt-2">
              평균 건강검진 비용 150만 원을 포함해 월 33,000원부터 시작합니다.
            </p>
          </div>

          <button
            onClick={handleSignup}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>처리 중...</span>
              </>
            ) : (
              <>
                <span>지금 신청하기</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </section>

      {/* 플랜 비교 */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-12">
            두 가지 플랜 중 선택하세요
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 플랜 A */}
            <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200 hover:border-blue-400 transition-colors">
              <h3 className="text-2xl font-bold text-blue-600 mb-4">기본 플랜</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                월 33,000원
              </div>
              <p className="text-gray-600 mb-6">12개월 (총 396,000원)</p>

              <ul className="space-y-3 mb-8">
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>연 2회 건강검진 (140개 병원)</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>월 여행보험 + 건강보험</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>주 1회 라이브방송</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>전담 매니저 배정</span>
                </li>
              </ul>

              <button
                onClick={handleSignup}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                기본 플랜 신청
              </button>
            </div>

            {/* 플랜 B */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-8 border-2 border-blue-400 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                인기 플랜
              </div>

              <h3 className="text-2xl font-bold text-blue-600 mb-4">프리미엄 플랜</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                월 66,000원
              </div>
              <p className="text-gray-600 mb-6">12개월 (총 792,000원)</p>

              <ul className="space-y-3 mb-8">
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>연 4회 건강검진 (140개 병원)</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>월 여행보험 + 건강보험 + 스파</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>주 3회 라이브방송 + 1:1 상담</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>VIP 전담 매니저 + 지원팀</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span className="font-bold text-blue-600">크루즈 50% 할인권</span>
                </li>
              </ul>

              <button
                onClick={handleSignup}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
              >
                프리미엄 플랜 신청
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 신청 프로세스 */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-12">
            쉬운 신청 과정
          </h2>

          <div className="grid gap-6 md:grid-cols-4">
            {STEPS.map((step, idx) => (
              <div key={idx} className="relative">
                {/* 연결선 */}
                {idx < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] right-[-50%] h-1 bg-blue-600" />
                )}

                <div className="bg-white rounded-lg p-6 text-center border-2 border-blue-200 hover:border-blue-400 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 고객 후기 */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-12">
            실제 고객 후기
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600"
              >
                <div className="flex gap-1 mb-3">
                  {Array(testimonial.rating)
                    .fill(0)
                    .map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                </div>
                <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
                <p className="font-bold text-gray-900">
                  {testimonial.name} ({testimonial.age}세)
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 혜택 요약 */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-12">
            골드회원 혜택
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Heart,
                title: "건강검진",
                desc: "연 2-4회 무료 건강검진",
              },
              {
                icon: Calendar,
                title: "여행 상담",
                desc: "전담 매니저의 맞춤형 제안",
              },
              {
                icon: Users,
                title: "혼자 여행자 매칭",
                desc: "비슷한 나이대 사람들과 만나기",
              },
              {
                icon: Shield,
                title: "여행보험",
                desc: "월별 여행보험 + 건강보험",
              },
            ].map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={idx}
                  className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-400 transition-colors"
                >
                  <Icon className="w-8 h-8 text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            지금 가입하세요
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            건강한 나이, 건강한 여행을 위해 지금 시작하세요.
          </p>

          <button
            onClick={handleSignup}
            disabled={loading}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>처리 중...</span>
              </>
            ) : (
              <>
                <span>신청하기</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <p className="text-sm text-blue-100 mt-6">
            문의사항이 있으신가요?{" "}
            <a href="mailto:support@mabizcruise.com" className="underline hover:text-white">
              고객 지원팀에 문의
            </a>
            해 주세요.
          </p>
        </div>
      </section>
    </div>
  );
}
