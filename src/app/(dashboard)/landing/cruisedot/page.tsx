'use client';

import { useState } from 'react';
import SignupForm from './components/SignupForm';
import PriceComparison from './components/PriceComparison';
import CountdownTimer from './components/CountdownTimer';
import TermPopover, { TermBatch } from './components/TermPopover';
import { loadCruisedotConfig } from '@/lib/constants/cruisedot-config';

/**
 * 크루즈닷 랜딩페이지 (Russell Brunson 6단계 퍼널 + 심리학 10렌즈)
 *
 * Phase: Hook → Story → Offer → Objection → Urgency → Close
 * Lens: L1(가격) + L6(타이밍/손실) + L10(즉시 구매)
 *
 * 9개 섹션 구성:
 * 1. Hero (Hook + Story)
 * 2. Problem (이슈 공감)
 * 3. Solution (해결책)
 * 4. Gold Member (Offer 1차)
 * 5. Objection (가격/할부/혼자)
 * 6. Social Proof (신뢰)
 * 7. Urgency (타이밍 + 손실회피)
 * 8. CTA (클로징)
 * 9. Live Broadcast (연속성)
 */
export default function CruisedotLandingPage() {
  const [activeTab, setActiveTab] = useState<'domestic' | 'japan' | 'asia'>('japan');
  const config = loadCruisedotConfig();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ═══════════════════════════════════════════════════════════════
          1️⃣ HERO SECTION (Hook + Story)
          Russell Brunson Phase 1-2: Hook (5초) + Story (감정화)
          Lens: L10 (즉시 구매 욕구 + 자유/해방감)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 via-blue-500 to-teal-500">
        <div className="max-w-6xl mx-auto">
          {/* 헤드라인: 호기심 + 감정 유발 */}
          <div className="text-center mb-12">
            <p className="text-blue-100 text-lg font-semibold mb-2 uppercase tracking-wider">
              자유로운 여행의 새로운 경험
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
              {config.sections.hero.title}
            </h1>
            <p className="text-2xl md:text-3xl text-blue-50 max-w-3xl mx-auto leading-relaxed font-light">
              혼자여도 안전하고, 함께여도 자유로운 <br />
              <span className="font-bold">크루즈 세미패키지</span>
            </p>
          </div>

          {/* 상품 3가지: 탭 선택 + 이미지 */}
          <div className="mt-16">
            {/* 탭 네비게이션 */}
            <div className="flex justify-center gap-4 mb-8">
              {[
                { id: 'domestic' as const, label: '⚓ 국내 크루즈', emoji: '🇰🇷' },
                { id: 'japan' as const, label: '✨ 프리미엄 (일본)', emoji: '🗾' },
                { id: 'asia' as const, label: '🌍 경제형 (동남아)', emoji: '🏝️' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-lg'
                      : 'bg-blue-500 text-white hover:bg-blue-400'
                  }`}
                  aria-selected={activeTab === tab.id}
                >
                  {tab.emoji} {tab.label}
                </button>
              ))}
            </div>

            {/* 상품 상세 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* 상품 1: 국내 */}
              {activeTab === 'domestic' && (
                <div className="md:col-span-3 bg-white rounded-xl p-8 shadow-2xl">
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="flex flex-col justify-center">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">
                        ⚓ {config.pricing.domestic.description}
                      </h3>
                      <p className="text-gray-600 mb-4">{config.pricing.domestic.nights}박 일정</p>
                      <p className="text-3xl font-bold text-blue-600 mb-2">
                        {config.pricing.domestic.priceRange}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-semibold">✅</span> 인솔자 동반<br/>
                        <span className="font-semibold">✅</span> 24/7 전용 매니저<br/>
                        <span className="font-semibold">✅</span> 할부 수수료 0원
                      </p>
                    </div>
                    <div className="md:col-span-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg h-64 flex items-center justify-center border-2 border-blue-300">
                      <span className="text-6xl">🚢</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 상품 2: 일본 (프리미엄) */}
              {activeTab === 'japan' && (
                <div className="md:col-span-3 bg-white rounded-xl p-8 shadow-2xl border-3 border-yellow-400">
                  <div className="bg-gradient-to-r from-yellow-100 to-orange-50 rounded-lg p-4 mb-6">
                    <p className="text-center text-sm font-bold text-yellow-700">
                      ⭐ 가장 인기 있는 상품 | {config.marketing.dailySignups}명이 선택 중
                    </p>
                  </div>
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="flex flex-col justify-center">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">
                        ✨ {config.pricing.japan.name}
                      </h3>
                      <p className="text-gray-600 mb-4">{config.pricing.japan.nights}박 일정</p>
                      <p className="text-3xl font-bold text-yellow-600 mb-2">
                        {Math.round(config.pricing.japan.totalPrice / 10000)}만원
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-semibold">✅</span> 선실 업그레이드<br/>
                        <span className="font-semibold">✅</span> 모든 식사 포함<br/>
                        <span className="font-semibold">✅</span> {config.pricing.japan.badge}
                      </p>
                    </div>
                    <div className="md:col-span-2 bg-gradient-to-br from-yellow-100 to-orange-50 rounded-lg h-64 flex items-center justify-center border-2 border-yellow-300">
                      <span className="text-6xl">🗾</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 상품 3: 동남아 (경제형) */}
              {activeTab === 'asia' && (
                <div className="md:col-span-3 bg-white rounded-xl p-8 shadow-2xl">
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="flex flex-col justify-center">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">
                        🌍 {config.pricing.southeastAsia.name}
                      </h3>
                      <p className="text-gray-600 mb-4">{config.pricing.southeastAsia.nights}박 일정</p>
                      <p className="text-3xl font-bold text-green-600 mb-2">
                        {Math.round(config.pricing.southeastAsia.totalPrice / 10000)}만원
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-semibold">✅</span> 모든 물품 포함<br/>
                        <span className="font-semibold">✅</span> {config.pricing.southeastAsia.discount}<br/>
                        <span className="font-semibold">✅</span> 가장 경제적
                      </p>
                    </div>
                    <div className="md:col-span-2 bg-gradient-to-br from-green-100 to-teal-50 rounded-lg h-64 flex items-center justify-center border-2 border-green-300">
                      <span className="text-6xl">🏝️</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2️⃣ PROBLEM SECTION (공감 + 감정)
          Russell Brunson Phase 2: Story (고객의 문제 → 감정)
          Lens: L6 (타이밍 + 손실회피) + L7 (집단사고/가족)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-gradient-to-b from-white to-orange-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-4">
            이런 고민, 하셨나요?
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">
            혼자 여행을 가고 싶은 마음, 불안한 마음 모두 이해합니다
          </p>

          {/* 5가지 문제 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 문제 1 */}
            <div className="bg-white rounded-lg border-l-4 border-red-500 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <span className="text-4xl">😰</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    혼자면 너무 불안해요
                  </h3>
                  <p className="text-gray-600">
                    처음 가는 나라, 현지 상황을 몰라서 혹시 사고가 날까봐 걱정이에요
                  </p>
                </div>
              </div>
            </div>

            {/* 문제 2 */}
            <div className="bg-white rounded-lg border-l-4 border-orange-500 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <span className="text-4xl">💸</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    가격이 너무 비싸요
                  </h3>
                  <p className="text-gray-600">
                    일반 여행사, OTA 가격과 비교하면 계속 비싸 보여요
                  </p>
                </div>
              </div>
            </div>

            {/* 문제 3 */}
            <div className="bg-white rounded-lg border-l-4 border-yellow-500 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <span className="text-4xl">🏧</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    할부가 정말 가능한가요?
                  </h3>
                  <p className="text-gray-600">
                    '월 20만원씩 할부'라고 했는데, 정말 수수료 없이 가능할까요?
                  </p>
                </div>
              </div>
            </div>

            {/* 문제 4 */}
            <div className="bg-white rounded-lg border-l-4 border-blue-500 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <span className="text-4xl">👥</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    혼자 가도 외로울까봐요
                  </h3>
                  <p className="text-gray-600">
                    단체 여행은 답답하고, 혼자 가면 너무 외로울 것 같아요
                  </p>
                </div>
              </div>
            </div>

            {/* 문제 5 */}
            <div className="bg-white rounded-lg border-l-4 border-purple-500 p-6 hover:shadow-lg transition-shadow md:col-span-2">
              <div className="flex items-start gap-4">
                <span className="text-4xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    취소/환불이 불안해요
                  </h3>
                  <p className="text-gray-600">
                    환불 가능한지, 수수료는 얼마나 깎이는지 모르겠어요
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-600 mt-12 font-semibold text-lg">
            👇 이 모든 고민을 크루즈닷이 해결해드립니다
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3️⃣ SOLUTION SECTION (해결책)
          Russell Brunson Phase 2-3: Solution (3단계)
          Lens: L3 (차별성) + L10 (신뢰 구축)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-4">
            크루즈닷의 3단계 해결책
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">
            여행을 가기 전부터, 가는 동안, 돌아온 후까지 완전히 다릅니다
          </p>

          {/* 3단계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Step 1: 출발 전 */}
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 text-4xl">
                ✈️
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                출발 전
              </h3>
              <div className="text-gray-600 space-y-3 text-left">
                <p>
                  <span className="font-bold">✅</span> 전문 <TermPopover term="인솔자" /> 소개
                </p>
                <p>
                  <span className="font-bold">✅</span> 여행 상세 가이드 (PDF)
                </p>
                <p>
                  <span className="font-bold">✅</span> 짐 준비부터 신청까지 카톡 상담
                </p>
                <p>
                  <span className="font-bold">✅</span> 여행 보험 자동 가입
                </p>
              </div>
            </div>

            {/* Step 2: 여행 중 */}
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 text-4xl">
                🌍
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                여행 중
              </h3>
              <div className="text-gray-600 space-y-3 text-left">
                <p>
                  <span className="font-bold">✅</span> 인솔자 24/7 현지 지원
                </p>
                <p>
                  <span className="font-bold">✅</span> 응급상황 한국어 전담 매니저
                </p>
                <p>
                  <span className="font-bold">✅</span> 현지 음식/문화 가이드
                </p>
                <p>
                  <span className="font-bold">✅</span> 매일 안부 카톡
                </p>
              </div>
            </div>

            {/* Step 3: 여행 후 */}
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 text-4xl">
                💬
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                여행 후
              </h3>
              <div className="text-gray-600 space-y-3 text-left">
                <p>
                  <span className="font-bold">✅</span> 여행 사진 무료 편집 (500장+)
                </p>
                <p>
                  <span className="font-bold">✅</span> 다음 여행 추천 리스트
                </p>
                <p>
                  <span className="font-bold">✅</span> 평생 할인 혜택 (10-30%)
                </p>
                <p>
                  <span className="font-bold">✅</span> VIP 커뮤니티 가입권
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4️⃣ GOLD MEMBER SECTION (Offer 1차)
          Russell Brunson Phase 3: Offer (가치 제시)
          Lens: L8 (습관 + 재구매) + L10 (즉시 구매)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-4">
            🏆 골드 회원 프로그램
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">
            처음 신청할 때부터 평생 누릴 수 있는 혜택들
          </p>

          {/* 3가지 핵심 혜택 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* 혜택 1: 건강 */}
            <div className="bg-white rounded-xl p-8 border-t-4 border-green-500 shadow-lg hover:shadow-2xl transition-shadow">
              <div className="text-4xl mb-4">💚</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                건강검진 무료
              </h3>
              <p className="text-gray-600 mb-4">
                여행 출발 전 건강검진비 완전 부담
              </p>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>✓ 기본검진 (혈액, 심전도)</li>
                <li>✓ 치과 스케일링</li>
                <li>✓ 안경 처방비</li>
              </ul>
              <p className="text-green-600 font-bold mt-6">
                월 50만원 가치 → 무료!
              </p>
            </div>

            {/* 혜택 2: 할부 */}
            <div className="bg-white rounded-xl p-8 border-t-4 border-blue-500 shadow-lg hover:shadow-2xl transition-shadow">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                월 20만원씩 할부
              </h3>
              <p className="text-gray-600 mb-4">
                신은행 신규금융 + 투명한 이자율
              </p>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>✓ 수수료 완전 0원</li>
                <li>✓ 중도변경 가능</li>
                <li>✓ 신용등급 영향 0</li>
              </ul>
              <p className="text-blue-600 font-bold mt-6">
                누구나 신청 가능
              </p>
            </div>

            {/* 혜택 3: 동반감 */}
            <div className="bg-white rounded-xl p-8 border-t-4 border-purple-500 shadow-lg hover:shadow-2xl transition-shadow">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                혼자여행 짝맞춤
              </h3>
              <p className="text-gray-600 mb-4">
                같은 여행지 가는 손님끼리 자동 매칭
              </p>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>✓ 나이/성향 맞춤</li>
                <li>✓ 강제성 없음 (선택)</li>
                <li>✓ 평생 친구 기회</li>
              </ul>
              <p className="text-purple-600 font-bold mt-6">
                재구매율 92%의 이유
              </p>
            </div>
          </div>

          {/* 추가 혜택 */}
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-8 border-2 border-yellow-400">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              + 추가 혜택 10가지
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-sm font-semibold text-gray-700">
              <div>📱 카톡 24/7</div>
              <div>📸 사진 무료 편집</div>
              <div>🎁 생일 선물</div>
              <div>📚 여행 책자</div>
              <div>🏅 VIP 라운지</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          5️⃣ OBJECTION SECTION (거장단이 강조한 이의 대응)
          Russell Brunson Phase 4: Objection (가격/할부/혼자)
          Lens: L1 (가격) + L5 (자기투영/신뢰) + L6 (손실회피)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-4">
            자주 묻는 3가지 질문
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">
            고민하시는 분들이 가장 많이 물어보는 것들을 정답해드립니다
          </p>

          {/* Q&A 아코디언 */}
          <div className="space-y-4 mb-12">
            {/* Q1: 가격 */}
            <details className="group bg-blue-50 rounded-xl overflow-hidden border-2 border-blue-300 cursor-pointer">
              <summary className="px-6 py-4 font-bold text-lg text-gray-800 flex items-center justify-between hover:bg-blue-100 transition-colors">
                <span>Q1. 왜 더 비싸요?</span>
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-6 pb-6 bg-blue-50 space-y-4">
                <p className="text-gray-700 font-semibold mb-4">
                  A. 가격을 비교할 때는 "무엇이 포함되었나"를 봐야 합니다.
                </p>
                <table className="w-full text-sm text-gray-700 border-collapse">
                  <thead>
                    <tr className="bg-blue-200">
                      <th className="border border-gray-300 p-3 text-left">항목</th>
                      <th className="border border-gray-300 p-3 text-left">일반여행사</th>
                      <th className="border border-gray-300 p-3 text-left">OTA (온라인)</th>
                      <th className="border border-gray-300 p-3 text-left text-blue-700 font-bold">크루즈닷</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-3">선사 직결 연결</td>
                      <td className="border border-gray-300 p-3">✗</td>
                      <td className="border border-gray-300 p-3">✗</td>
                      <td className="border border-gray-300 p-3 bg-blue-100 font-bold">✅</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-3">인솔자 동반</td>
                      <td className="border border-gray-300 p-3">✗</td>
                      <td className="border border-gray-300 p-3">✗</td>
                      <td className="border border-gray-300 p-3 bg-blue-100 font-bold">✅</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-3">환불 100% 보장</td>
                      <td className="border border-gray-300 p-3">✗ (20-30% 수수료)</td>
                      <td className="border border-gray-300 p-3">✗ (수수료)</td>
                      <td className="border border-gray-300 p-3 bg-blue-100 font-bold">✅</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-3">건강검진 무료</td>
                      <td className="border border-gray-300 p-3">✗</td>
                      <td className="border border-gray-300 p-3">✗</td>
                      <td className="border border-gray-300 p-3 bg-blue-100 font-bold">✅</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-3">할부 수수료</td>
                      <td className="border border-gray-300 p-3">2-5%</td>
                      <td className="border border-gray-300 p-3">3-7%</td>
                      <td className="border border-gray-300 p-3 bg-blue-100 font-bold">0%</td>
                    </tr>
                  </tbody>
                </table>
                <div className="bg-blue-100 border-l-4 border-blue-600 p-4 mt-6">
                  <p className="text-gray-800 font-semibold">
                    💡 결론: 800만원 여행 기준
                  </p>
                  <p className="text-gray-700 mt-2">
                    일반여행사: 800만원 + 환불 시 200만원 손해<br/>
                    크루즈닷: 900만원 + 환불 시 100% 보장<br/>
                    <span className="font-bold">실제로는 크루즈닷이 더 저렴합니다!</span>
                  </p>
                </div>
              </div>
            </details>

            {/* Q2: 할부 */}
            <details className="group bg-green-50 rounded-xl overflow-hidden border-2 border-green-300 cursor-pointer">
              <summary className="px-6 py-4 font-bold text-lg text-gray-800 flex items-center justify-between hover:bg-green-100 transition-colors">
                <span>Q2. 할부가 정말 가능한가요?</span>
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-6 pb-6 bg-green-50 space-y-4">
                <p className="text-gray-700 font-semibold mb-4">
                  A. 네, 신은행 신규금융 + 은행 투명관리로 완전히 안전합니다.
                </p>
                <div className="space-y-4">
                  <div className="bg-white rounded p-4 border-l-4 border-green-500">
                    <p className="font-bold text-gray-800 mb-2">✅ 신청 자격</p>
                    <p className="text-gray-700 text-sm">
                      만 20세 이상, 소득증빙 없음 (신용카드 1장만으로도 가능)
                    </p>
                  </div>
                  <div className="bg-white rounded p-4 border-l-4 border-green-500">
                    <p className="font-bold text-gray-800 mb-2">✅ 할부 방식</p>
                    <p className="text-gray-700 text-sm">
                      3개월 ~ 24개월 (자유 선택), 월 20만원부터 시작
                    </p>
                  </div>
                  <div className="bg-white rounded p-4 border-l-4 border-green-500">
                    <p className="font-bold text-gray-800 mb-2">✅ 투명성</p>
                    <p className="text-gray-700 text-sm">
                      은행 계좌로 직접 관리 → 신용등급 영향 0, 부도 걱정 0
                    </p>
                  </div>
                  <div className="bg-white rounded p-4 border-l-4 border-green-500">
                    <p className="font-bold text-gray-800 mb-2">✅ 변경 가능</p>
                    <p className="text-gray-700 text-sm">
                      할부 기간 중도 변경, 여행 날짜 변경도 유연하게 대응
                    </p>
                  </div>
                </div>
                <div className="bg-yellow-100 border-l-4 border-yellow-600 p-4 mt-6">
                  <p className="text-gray-800 font-semibold">
                    💳 월 20만원 할부 예시
                  </p>
                  <p className="text-gray-700 mt-2">
                    800만원 여행 → 월 20만원 × 40개월<br/>
                    (이자 0원, 수수료 0원)
                  </p>
                </div>
              </div>
            </details>

            {/* Q3: 혼자 */}
            <details className="group bg-purple-50 rounded-xl overflow-hidden border-2 border-purple-300 cursor-pointer">
              <summary className="px-6 py-4 font-bold text-lg text-gray-800 flex items-center justify-between hover:bg-purple-100 transition-colors">
                <span>Q3. 혼자 가도 정말 괜찮나요?</span>
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-6 pb-6 bg-purple-50 space-y-4">
                <p className="text-gray-700 font-semibold mb-4">
                  A. 네, 오히려 더 안전하고 재미있습니다. 우리 고객의 87%가 혼자 갑니다.
                </p>
                <div className="space-y-4">
                  <div className="bg-white rounded p-4 border-l-4 border-purple-500">
                    <p className="font-bold text-gray-800 mb-2">👨‍⚖️ 매니저 24/7</p>
                    <p className="text-gray-700 text-sm">
                      여행 출발부터 돌아올 때까지, 전담 매니저가 관리합니다. 언제든 카톡, 전화 가능.
                    </p>
                  </div>
                  <div className="bg-white rounded p-4 border-l-4 border-purple-500">
                    <p className="font-bold text-gray-800 mb-2">👥 친구 매칭 (선택)</p>
                    <p className="text-gray-700 text-sm">
                      같은 여행지 가는 동성 고객끼리 자동 매칭. 강제성 0, 거절 가능. 지난해 92명이 배우자 만남.
                    </p>
                  </div>
                  <div className="bg-white rounded p-4 border-l-4 border-purple-500">
                    <p className="font-bold text-gray-800 mb-2">🎓 인솔자 가이드</p>
                    <p className="text-gray-700 text-sm">
                      평균 10년 이상 경험 보유. 현지 음식, 문화, 쇼핑까지 모두 안내.
                    </p>
                  </div>
                  <div className="bg-white rounded p-4 border-l-4 border-purple-500">
                    <p className="font-bold text-gray-800 mb-2">🌐 자유도 100%</p>
                    <p className="text-gray-700 text-sm">
                      강제 투어 0, 쇼핑 0. 원하는 시간에 원하는 것을 할 수 있습니다 (인솔자 동반).
                    </p>
                  </div>
                </div>
                <div className="bg-green-100 border-l-4 border-green-600 p-4 mt-6">
                  <p className="text-gray-800 font-semibold">
                    ⭐ 지난해 고객 후기
                  </p>
                  <p className="text-gray-700 mt-2">
                    "평생 친구를 얻은 기분이에요" (김미라, 62세)<br/>
                    "혼자도 이렇게 편할 수 있네요" (이정은, 55세)<br/>
                    "인솔자 덕분에 현지인처럼 즐겼어요" (박진희, 48세)
                  </p>
                </div>
              </div>
            </details>
          </div>

          {/* 추가: 가격 비교표 */}
          <div className="mt-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-8">
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-8">
              동일 상품 가격 비교 (일본 7박 크루즈)
            </h3>
            <PriceComparison />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          6️⃣ SOCIAL PROOF SECTION (신뢰)
          Russell Brunson Phase 5: Trust (사회증명 + 권위성)
          Lens: L2 (사회증명) + L4 (권위성) + L9 (의료/신뢰)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-4">
            📊 실제 고객들의 반응
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">
            숫자가 말하는 크루즈닷의 신뢰도
          </p>

          {/* 3가지 핵심 지표 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-xl p-8 border-t-4 border-blue-500 text-center shadow-lg">
              <p className="text-6xl font-bold text-blue-600 mb-2">
                {config.marketing.customerSatisfaction}
              </p>
              <p className="text-gray-600 text-lg mb-2">/ 5.0 고객 만족도</p>
              <p className="text-sm text-gray-500">
                {config.marketing.reviewCount.toLocaleString()}명 리뷰 기준
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border-t-4 border-green-500 text-center shadow-lg">
              <p className="text-6xl font-bold text-green-600 mb-2">
                {config.marketing.repurchaseRate}%
              </p>
              <p className="text-gray-600 text-lg mb-2">재구매율</p>
              <p className="text-sm text-gray-500">
                한 번 가본 손님은 계속 옵니다
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border-t-4 border-red-500 text-center shadow-lg">
              <p className="text-6xl font-bold text-red-600 mb-2">
                {config.marketing.dailySignups}명
              </p>
              <p className="text-gray-600 text-lg mb-2">하루 신청 중</p>
              <p className="text-sm text-gray-500">
                지금 이 순간도 누군가 예약 중
              </p>
            </div>
          </div>

          {/* 자격증 + 인증 */}
          <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-8 border-2 border-green-400">
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-8">
              🏅 공식 인증 & 자격
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-semibold text-gray-700">국토교통부<br/>여행업등록</p>
              </div>
              <div>
                <p className="text-2xl mb-2">🏥</p>
                <p className="text-sm font-semibold text-gray-700">한국의료관광<br/>협회 정회원</p>
              </div>
              <div>
                <p className="text-2xl mb-2">🛡️</p>
                <p className="text-sm font-semibold text-gray-700">고객 신용보험<br/>100% 가입</p>
              </div>
              <div>
                <p className="text-2xl mb-2">⭐</p>
                <p className="text-sm font-semibold text-gray-700">3년 연속<br/>업계 1위</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          7️⃣ URGENCY SECTION (긴박감 + 손실회피)
          Russell Brunson Phase 5: Urgency (시간 제한 + 손실)
          Lens: L6 (타이밍 + 손실회피) + L3 (희소성)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-gradient-to-r from-red-500 via-orange-500 to-red-600">
        <div className="max-w-4xl mx-auto text-center">
          {/* 긴박감 텍스트 */}
          <div className="mb-8">
            <p className="text-white text-lg font-bold mb-2 animate-pulse">
              ⚠️ 이런 기회는 2-3년에 한 번!
            </p>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
              {config.sections.hero.countdownSeats}석 남았습니다
            </h2>
            <p className="text-2xl text-red-100 font-semibold">
              결정이 늦어지면 다음 달로 미루게 될 수 있습니다
            </p>
          </div>

          {/* 카운트다운 타이머 */}
          <div className="mb-8">
            <CountdownTimer targetDate={config.sections.hero.deadlineDate} />
          </div>

          {/* 손실회피 메시지 */}
          <div className="bg-white bg-opacity-20 rounded-xl p-8 backdrop-blur-sm border-2 border-white">
            <p className="text-white text-xl font-bold mb-2">
              💡 지금 신청하면
            </p>
            <p className="text-white text-lg">
              평생 할인 <span className="font-bold text-yellow-200">10-30%</span> +
              건강검진 무료 +
              할부 수수료 0원 혜택을 받을 수 있습니다
            </p>
            <p className="text-red-100 text-sm mt-4">
              (3개월 후 가격 인상 예정)
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          8️⃣ CTA FORM SECTION (클로징)
          Russell Brunson Phase 6: Close (행동 유도)
          Lens: L10 (즉시 구매) + 심리학 최강 콤보
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-gradient-to-b from-blue-600 to-blue-500">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-2 text-center">
            지금 바로 신청하세요
          </h2>
          <p className="text-blue-100 text-center mb-2 text-lg">
            매니저가 {config.contact.managerResponseTime}시간 내 연락을 드립니다
          </p>
          <p className="text-blue-50 text-center mb-8 text-sm">
            신청해도 비용이 발생하지 않습니다. 상담만 먼저 진행합니다.
          </p>

          {/* 폼 */}
          <SignupForm />

          {/* 하단 신뢰 메시지 */}
          <div className="mt-6 text-center">
            <p className="text-blue-100 text-sm">
              <span className="font-bold">🔒 개인정보 보호</span><br/>
              입력하신 정보는 암호화되어 보관되며, 동의 없이 절대 외부로 공개되지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          9️⃣ LIVE BROADCAST SECTION (연속성 + 재참여)
          Russell Brunson Phase 6: Continuity (추가 신뢰 + 관계 지속)
          Lens: L8 (습관화) + L7 (커뮤니티)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-4 text-center text-gray-800">
            📺 매주 라이브 설명회
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">
            더 자세히 알고 싶으신 분들을 위한 실시간 Q&A 방송
          </p>

          {/* 라이브 정보 카드 */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-10 text-center border-3 border-red-400 mb-8">
            <p className="text-red-600 text-xl font-bold mb-2">
              🔴 LIVE
            </p>
            <p className="text-3xl font-bold text-gray-800 mb-2">
              {config.sections.liveStream.schedule}
            </p>
            <p className="text-gray-700 mb-8 text-lg">
              {config.sections.liveStream.description}
            </p>

            {/* 버튼 */}
            <a
              href={config.contact.youtubeChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-red-600 text-white px-10 py-4 rounded-lg font-bold text-lg hover:bg-red-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              ▶️ {config.sections.liveStream.buttonText}
            </a>

            <p className="text-gray-600 text-sm mt-6">
              {config.sections.liveStream.note}
            </p>
          </div>

          {/* 라이브 참여 혜택 */}
          <div className="bg-blue-50 rounded-xl p-8 border-2 border-blue-300">
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-6">
              라이브 설명회 참여 시 특전
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 text-center">
                <p className="text-3xl mb-2">🎁</p>
                <p className="font-bold text-gray-800">추가 5% 할인</p>
                <p className="text-sm text-gray-600">라이브 참여자 한정</p>
              </div>
              <div className="bg-white rounded-lg p-6 text-center">
                <p className="text-3xl mb-2">❓</p>
                <p className="font-bold text-gray-800">실시간 Q&A</p>
                <p className="text-sm text-gray-600">모든 질문에 즉시 답변</p>
              </div>
              <div className="bg-white rounded-lg p-6 text-center">
                <p className="text-3xl mb-2">👥</p>
                <p className="font-bold text-gray-800">선배 고객 만남</p>
                <p className="text-sm text-gray-600">실제 후기 들어보기</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 text-center">
        <div className="max-w-5xl mx-auto">
          <p className="mb-4 font-bold text-white text-lg">
            🌍 크루즈닷 | 자유 여행, 인솔자 함께
          </p>
          <p className="text-sm mb-4">
            Contact: {config.contact.phone}
          </p>
          <p className="text-xs text-gray-600">
            국토교통부 여행업등록 | 한국의료관광협회 정회원 | 고객 신용보험 100% 가입
          </p>
          <p className="text-xs text-gray-600 mt-4">
            Copyright © 2026 Cruisedot. All rights reserved.<br/>
            이용약관 | 개인정보처리방침 | 환불정책
          </p>
        </div>
      </footer>
    </div>
  );
}