'use client';

import { useState } from 'react';
import SignupForm from './components/SignupForm';
import PriceComparison from './components/PriceComparison';
import CountdownTimer from './components/CountdownTimer';

/**
 * 크루즈닷 랜딩페이지 (9개 섹션)
 *
 * Russell Brunson 6단계 퍼널 + Grant Cardone 심리학 + 신뢰성 설계
 * 1️⃣ Hero: Hook + Problem Awareness
 * 2️⃣ Problem: Agitate (실제 사례)
 * 3️⃣ Solution: Solutions
 * 4️⃣ Objections: Q&A
 * 5️⃣ Offer: Gold Member Program
 * 6️⃣ Social Proof: Statistics
 * 7️⃣ Urgency: Countdown
 * 8️⃣ Call-to-Action: Signup Form
 * 9️⃣ Continuity: Live Broadcast
 */

export default function CruisedotLandingPage() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* 1️⃣ HERO SECTION */}
      <section className="py-16 px-4 text-center bg-gradient-to-r from-blue-600 to-blue-400">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          자유 여행, 인솔자와 함께
        </h1>
        <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto">
          혼자가 아닌 안전한 크루즈 여행의 새로운 기준
        </p>

        {/* 상품 3가지 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          <div className="bg-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow">
            <div
              className="bg-gradient-to-b from-blue-200 to-blue-100 h-48 rounded mb-3 flex items-center justify-center"
              role="img"
              aria-label="부산 출도착 국내 크루즈 여행 상품 이미지"
            >
              <span className="text-gray-600 text-lg font-semibold">⚓ 국내 크루즈</span>
            </div>
            <h3 className="text-lg font-bold">부산 출도착</h3>
            <p className="text-sm text-gray-600 mt-1">1박 20-30만원</p>
            <p className="text-xs text-gray-500 mt-2">인솔자 동반 + 24/7 지원</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow border-2 border-yellow-400">
            <div
              className="bg-gradient-to-b from-yellow-200 to-yellow-100 h-48 rounded mb-3 flex items-center justify-center"
              role="img"
              aria-label="일본 크루즈 프리미엄 여행 상품 이미지 (가장 인기)"
            >
              <span className="text-gray-600 text-lg font-semibold">✨ 프리미엄</span>
            </div>
            <h3 className="text-lg font-bold">일본 크루즈</h3>
            <p className="text-sm text-gray-600 mt-1">159만원 / 3박</p>
            <p className="text-xs text-gray-500 mt-2">선실 업그레이드 + 식사 포함</p>
            <p className="text-xs text-yellow-600 font-bold mt-2">⭐ 가장 인기</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow">
            <div
              className="bg-gradient-to-b from-green-200 to-green-100 h-48 rounded mb-3 flex items-center justify-center"
              role="img"
              aria-label="동남아 크루즈 경제형 여행 상품 이미지"
            >
              <span className="text-gray-600 text-lg font-semibold">🌍 경제형</span>
            </div>
            <h3 className="text-lg font-bold">동남아 크루즈</h3>
            <p className="text-sm text-gray-600 mt-1">130만원 / 2박</p>
            <p className="text-xs text-gray-500 mt-2">모든 물품 포함 + 신청금 0원</p>
          </div>
        </div>
      </section>

      {/* 2️⃣ PROBLEM SECTION (Grant Cardone: Agitate) */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center" id="problem-section">
            💔 이런 경험, 하셨나요?
          </h2>

          <div className="space-y-6">
            {/* 문제 1: 정보 부족 */}
            <div className="border-l-4 border-orange-500 pl-6 py-4 bg-orange-50 rounded-r-lg">
              <h3 className="text-xl font-bold text-orange-700 mb-2">
                🚨 싼 크루즈로 정보 없이 떠났을 때
              </h3>
              <p className="text-gray-700 leading-relaxed text-base">
                "부모님까지 모시고 갔는데 최악이었어요. 시간 버리고 돈 버린 경험. 가족끼리 시간 내기도 힘든데 너무 준비가 안 돼있어서 크루즈는 안 가고 싶네요."
              </p>
              <p className="text-xs text-gray-500 mt-2">— 크루즈닷 고객</p>
            </div>

            {/* 문제 2: 환불 실패 */}
            <div className="border-l-4 border-red-500 pl-6 py-4 bg-red-50 rounded-r-lg">
              <h3 className="text-xl font-bold text-red-700 mb-2">
                🚨 외국 사이트 환불 실패
              </h3>
              <p className="text-gray-700 leading-relaxed text-base">
                "외국 사이트 결제해서 취소했는데 위약금을 못 받더라고요. 진짜 힘들었어요. 예약은 외국 플랫폼으로는 절대 안 해야겠다는 생각."
              </p>
              <p className="text-xs text-gray-500 mt-2">— 크루즈닷 고객</p>
            </div>

            {/* 문제 3: 개인 판매자 사기 */}
            <div className="border-l-4 border-red-500 pl-6 py-4 bg-red-50 rounded-r-lg">
              <h3 className="text-xl font-bold text-red-700 mb-2">
                🚨 개인 판매자 사기
              </h3>
              <p className="text-gray-700 leading-relaxed text-base">
                "반값에 간다고 해서 지인들도 다 가입시켰는데 크루즈여행을 가지도 못했어요."
              </p>
              <p className="text-xs text-gray-500 mt-2">— 크루즈닷 고객</p>
            </div>

            {/* 문제 4: 현장 혼란 */}
            <div className="border-l-4 border-red-500 pl-6 py-4 bg-red-50 rounded-r-lg">
              <h3 className="text-xl font-bold text-red-700 mb-2">
                🚨 크루즈항 혼란
              </h3>
              <p className="text-gray-700 leading-relaxed text-base">
                "짐을 다른 크루즈에 넣음 / 객실 문제 / 비행기 연착 / 길 잃음 등의 문제 경험. 혼자 떠난다는 것은 정말 위험했습니다."
              </p>
              <p className="text-xs text-gray-500 mt-2">— 크루즈닷 고객</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3️⃣ SOLUTION SECTION */}
      <section className="py-12 px-4 bg-blue-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            ✅ 크루즈닷의 해결책
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 출발 전 */}
            <div className="bg-white rounded-lg p-6 shadow-md border-t-4 border-blue-500">
              <h3 className="text-xl font-bold mb-3 text-blue-600">📋 출발 전</h3>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li>✅ 크루즈항 도착 방법 자세히 안내</li>
                <li>✅ 항공편 연착 대응 계획 수립</li>
                <li>✅ 객실 선호도 사전 취합</li>
                <li>✅ 건강상태 사전 확인</li>
                <li>✅ 여행 일정표 상세 설명</li>
              </ul>
            </div>

            {/* 여행 중 */}
            <div className="bg-white rounded-lg p-6 shadow-md border-t-4 border-green-500">
              <h3 className="text-xl font-bold mb-3 text-green-600">🌍 여행 중</h3>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li>✅ 카톡 실시간 안내 (24/7)</li>
                <li>✅ 문제 발생 시 즉시 대응</li>
                <li>✅ 식사/액티비티 추천</li>
                <li>✅ 짐 관리 지원</li>
                <li>✅ 전문 사진사 배치</li>
              </ul>
            </div>

            {/* 여행 후 */}
            <div className="bg-white rounded-lg p-6 shadow-md border-t-4 border-purple-500">
              <h3 className="text-xl font-bold mb-3 text-purple-600">🎬 여행 후</h3>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li>✅ 사진 에디팅 무료 제공</li>
                <li>✅ 영상 편집본 선물</li>
                <li>✅ 다음 여행 상담</li>
                <li>✅ 평생 10-30% 할인</li>
                <li>✅ 가족/친구 추천 보상</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4️⃣ OBJECTION SECTION (Russell Brunson: Objections) */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            ❓ 자주 하는 질문
          </h2>

          <div className="space-y-4">
            {/* Q1: 가격 */}
            <details className="border rounded-lg p-6 bg-gray-50 cursor-pointer group hover:bg-blue-50 transition-colors">
              <summary
                className="font-bold text-lg flex justify-between items-center focus:ring-2 focus:ring-blue-600 focus:outline-none rounded px-2 py-1"
                aria-expanded="false"
              >
                Q1: 왜 더 비싼가요?
                <span className="text-2xl group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 text-gray-700 leading-relaxed space-y-3">
                <p>
                  A: <strong>선사와 직결되어</strong> 있어서 다릅니다.
                </p>
                <div className="bg-white p-4 rounded border-l-4 border-green-500 space-y-2">
                  <p>💚 <strong>문제 해결 권한</strong> → 빠른 대응</p>
                  <p>💚 <strong>환불 100% 보장</strong> → 안전</p>
                  <p>💚 <strong>추가 비용 0원</strong> → 투명</p>
                </div>
                <p className="text-sm text-gray-600">
                  * 싼 크루즈는 문제 발생 시 책임자가 없습니다. 우리는 있습니다.
                </p>
              </div>
            </details>

            {/* Q2: 할부 */}
            <details className="border rounded-lg p-6 bg-gray-50 cursor-pointer group hover:bg-blue-50 transition-colors">
              <summary
                className="font-bold text-lg flex justify-between items-center focus:ring-2 focus:ring-blue-600 focus:outline-none rounded px-2 py-1"
                aria-expanded="false"
              >
                Q2: 진짜 월 할부 가능한가요?
                <span className="text-2xl group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 text-gray-700 leading-relaxed space-y-3">
                <p>
                  A: 네, <strong>신은행 신규금융</strong>으로 가능합니다.
                </p>
                <div className="bg-white p-4 rounded border-l-4 border-green-500 space-y-3">
                  <p>💳 <strong>국내 크루즈</strong> → 월 33,000원</p>
                  <p>💳 <strong>프리미엄</strong> → 월 66,000원</p>
                  <p>💳 <strong>은행 계좌 관리</strong> → 투명성 100%</p>
                </div>
                <p className="text-sm text-gray-600">
                  * 신청금 0원, 첫 결제는 여행 후
                </p>
              </div>
            </details>

            {/* Q3: 혼자 가도 */}
            <details className="border rounded-lg p-6 bg-gray-50 cursor-pointer group hover:bg-blue-50 transition-colors">
              <summary
                className="font-bold text-lg flex justify-between items-center focus:ring-2 focus:ring-blue-600 focus:outline-none rounded px-2 py-1"
                aria-expanded="false"
              >
                Q3: 혼자 가도 괜찮을까요?
                <span className="text-2xl group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 text-gray-700 leading-relaxed space-y-3">
                <p>
                  A: 혼자이지만 <strong>혼자가 아닙니다</strong>.
                </p>
                <div className="bg-white p-4 rounded border-l-4 border-green-500 space-y-2">
                  <p>👥 매니저 24/7 연락 가능</p>
                  <p>👥 비슷한 성향 사람과 매칭</p>
                  <p>👥 문제 발생 시 매니저 중재</p>
                </div>
                <p className="text-sm text-gray-600">
                  * 평생 연락할 수 있는 "크루즈 친구"가 생깁니다.
                </p>
              </div>
            </details>

            {/* Q4: 환불 */}
            <details className="border rounded-lg p-6 bg-gray-50 cursor-pointer group hover:bg-blue-50 transition-colors">
              <summary
                className="font-bold text-lg flex justify-between items-center focus:ring-2 focus:ring-blue-600 focus:outline-none rounded px-2 py-1"
                aria-expanded="false"
              >
                Q4: 취소하면 돈을 돌려받을 수 있나요?
                <span className="text-2xl group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 text-gray-700 leading-relaxed space-y-3">
                <p>
                  A: <strong>네, 100% 보장</strong>합니다.
                </p>
                <div className="bg-white p-4 rounded border-l-4 border-green-500 space-y-2">
                  <p>✅ 신청금 0원 (환불할 것도 없음)</p>
                  <p>✅ 여행 후 결제 시작</p>
                  <p>✅ 도중 취소 시 할부금 중단 + 선사 환불 청구</p>
                </div>
              </div>
            </details>
          </div>

          {/* 가격 비교표 */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-6 text-center">
              💰 가격 및 서비스 비교
            </h3>
            <PriceComparison />
          </div>
        </div>
      </section>

      {/* 5️⃣ OFFER SECTION (Gold Member Program) */}
      <section className="py-12 px-4 bg-gradient-to-r from-yellow-50 to-amber-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-2 text-center">
            👑 골드 회원 프로그램
          </h2>
          <p className="text-center text-gray-600 mb-8">
            크루즈여행을 사랑하는 당신을 위한 특별 멤버십
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 건강 + 여행 */}
            <div className="bg-white rounded-lg p-6 shadow-md border-t-4 border-red-500 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-3 text-red-600">💊 건강 + 여행</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✅</span>
                  <span>건강검진 연 2회</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✅</span>
                  <span>전국 140개 병원</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✅</span>
                  <span>간병인 서비스</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">✅</span>
                  <span>선박 의료팀 협의</span>
                </li>
              </ul>
              <p className="text-xs text-gray-600 mt-4 italic">
                노년층도 안심하고 즐길 수 있습니다
              </p>
            </div>

            {/* 할부 */}
            <div className="bg-white rounded-lg p-6 shadow-md border-t-4 border-green-500 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-3 text-green-600">💰 인생 크루즈 할부</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span>월 33,000원 (국내)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span>월 66,000원 (프리미엄)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span>은행 계좌 관리</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span>특가 크루즈 1-3회/년</span>
                </li>
              </ul>
              <p className="text-xs text-gray-600 mt-4 italic">
                부담 없이 매년 여행을 즐기세요
              </p>
            </div>

            {/* 매칭 */}
            <div className="bg-white rounded-lg p-6 shadow-md border-t-4 border-blue-500 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-3 text-blue-600">👥 혼자 여행자 매칭</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✅</span>
                  <span>매니저 기반 매칭</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✅</span>
                  <span>성향 파악 후 연결</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✅</span>
                  <span>문제 발생 시 중재</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✅</span>
                  <span>평생 연락 가능</span>
                </li>
              </ul>
              <p className="text-xs text-gray-600 mt-4 italic">
                크루즈 "친구"를 만나세요
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6️⃣ SOCIAL PROOF SECTION */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">
            📊 실제 고객들의 반응
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-8 hover:shadow-lg transition-shadow">
              <p className="text-5xl font-bold text-blue-600">4.8/5</p>
              <p className="text-gray-700 mt-2 font-semibold">고객 만족도</p>
              <p className="text-sm text-gray-600 mt-1">3,847명 리뷰 기준</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-8 hover:shadow-lg transition-shadow">
              <p className="text-5xl font-bold text-green-600">92%</p>
              <p className="text-gray-700 mt-2 font-semibold">재구매율</p>
              <p className="text-sm text-gray-600 mt-1">올해 신입 고객 대비</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-8 hover:shadow-lg transition-shadow">
              <p className="text-5xl font-bold text-red-600">142명</p>
              <p className="text-gray-700 mt-2 font-semibold">하루 신청</p>
              <p className="text-sm text-gray-600 mt-1">이달 평균</p>
            </div>
          </div>

          {/* 고객 후기 카드 */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-700 mb-6">
              💬 고객 후기
            </h3>

            <div className="bg-gray-50 rounded-lg p-6 text-left border-l-4 border-yellow-400">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⭐⭐⭐⭐⭐</span>
              </div>
              <p className="text-gray-700 mb-2">
                "처음엔 불안했는데, 매니저님이 정말 잘 챙겨주셨어요. 여행이 이렇게 편할 수 있다는 걸 처음 알았습니다."
              </p>
              <p className="text-sm text-gray-600">
                김○○님 (60세, 서울) · 3박 프리미엄 완료
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-left border-l-4 border-yellow-400">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⭐⭐⭐⭐⭐</span>
              </div>
              <p className="text-gray-700 mb-2">
                "부모님이 정말 좋아하셨어요. 이렇게 편한 여행은 처음입니다. 다음 달에 또 신청하려고요!"
              </p>
              <p className="text-sm text-gray-600">
                이○○님 (55세, 부산) · 가족 동반
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7️⃣ URGENCY SECTION (Countdown) */}
      <section className="py-16 px-4 bg-gradient-to-r from-red-50 to-red-100">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-pulse mb-4">
            <p className="text-3xl font-bold text-red-600">
              🚨 10석 남았습니다
            </p>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            지금 신청하면 평생 10-30% 할인
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            더 늦기 전에 결정하세요
          </p>

          <CountdownTimer remainingSeats={10} />

          <div className="mt-8 bg-white rounded-lg p-6 inline-block">
            <p className="text-sm text-gray-600 mb-2">
              마감까지 남은 시간
            </p>
            <p className="text-3xl font-bold text-red-600">
              3일 2시간 47분
            </p>
          </div>
        </div>
      </section>

      {/* 8️⃣ CTA FORM SECTION */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-blue-500">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">
            지금 신청하세요
          </h2>
          <p className="text-blue-100 text-center mb-8 text-lg">
            매니저가 2시간 내 연락 드릴 예정입니다
          </p>

          <SignupForm />
        </div>
      </section>

      {/* 9️⃣ CONTINUITY SECTION (Live Broadcast) */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            📺 매주 라이브 방송
          </h2>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-8 text-center border-2 border-red-400">
            <p className="text-3xl font-bold text-red-600 mb-2">
              매주 화요일 오후 7시
            </p>
            <p className="text-gray-700 mb-6 text-lg">
              인솔자가 직접 설명하는 크루즈 여행 정보 + Q&A
            </p>

            <a
              href="https://youtube.com/@cruisedot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-red-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-red-700 transition-colors shadow-lg"
              aria-label="새 탭에서 크루즈닷 유튜브 라이브 채널 열기"
            >
              🎥 유튜브 라이브 보기
            </a>

            <p className="text-sm text-gray-600 mt-6">
              * 유튜브 채널을 구독하고 알림을 켜면 방송 시작 시 알림을 받을 수 있습니다
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4 text-center text-sm">
        <p className="mb-2">
          크루즈닷 | 안전한 크루즈 여행의 새로운 기준
        </p>
        <p className="text-xs text-gray-500">
          Copyright © 2026 Cruisedot. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
