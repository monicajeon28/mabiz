'use client';

import React, { useState } from 'react';
import { track } from '@/lib/landing/analytics';

export default function CTASection() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    interest: '',
    message: '',
  });

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error message when user starts typing
    if (submitStatus === 'error') {
      setErrorMessage('');
      setSubmitStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('loading');
    setErrorMessage('');

    track('application_form_submit', {
      interest: formData.interest,
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch('/api/landing/contact-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('서버 오류');

      setSubmitStatus('success');
      setFormData({
        name: '',
        phone: '',
        email: '',
        interest: '',
        message: '',
      });

      // Reset after 5 seconds
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '신청 중 오류가 발생했습니다. 다시 시도해주세요.'
      );
    }
  };

  const handleRetry = () => {
    setSubmitStatus('idle');
    setErrorMessage('');
  };

  return (
    <section className="py-20 bg-white" id="application-form">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
            지금 신청하세요
          </h2>
          <p className="text-xl text-gray-600 mt-4">
            무료 상담 신청 → 24시간 내 매니저 연락
            <br />
            <strong className="text-blue-600">신청만 해도 10-30% 평생 할인</strong>
          </p>
        </div>

        {/* Two column layout */}
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left - Benefits */}
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">신청 후 다음 단계</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">신청 폼 작성</p>
                    <p className="text-gray-600 text-sm">이름, 연락처, 관심상품 선택</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">24시간 내 매니저 연락</p>
                    <p className="text-gray-600 text-sm">전화, 카톡, 이메일 중 선택</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">무료 상담</p>
                    <p className="text-gray-600 text-sm">건강상태, 선호도, 예산 논의</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">예약 완료</p>
                    <p className="text-gray-600 text-sm">10-30% 할인 적용된 가격으로</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-green-600 text-white font-bold">
                    5
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">여행 준비 & 동반</p>
                    <p className="text-gray-600 text-sm">인솔자와 함께 안전하게</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <p className="font-bold text-gray-900 mb-4">100% 안심 보장</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ 개인정보 100% 보호 (암호화)</li>
                <li>✓ 무료 상담 (비용 청구 없음)</li>
                <li>✓ 중도해지 수수료 0원</li>
                <li>✓ 환불 안 될 시 100% 환금</li>
              </ul>
            </div>
          </div>

          {/* Right - Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
            {submitStatus === 'success' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-6xl mb-4">✓</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">신청이 완료되었습니다!</h3>
                <p className="text-gray-600 mb-6">
                  24시간 내에 매니저가 연락 드리겠습니다.
                  <br />
                  감사합니다.
                </p>
                <div className="text-sm text-blue-600 font-semibold">신청만 해도 10-30% 할인 적용!</div>
              </div>
            ) : submitStatus === 'error' ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">신청에 실패했습니다</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 w-full">
                  <p className="text-red-700 text-center font-semibold">{errorMessage}</p>
                </div>
                <p className="text-gray-600 text-center mb-6">
                  잠시 후 다시 시도해주세요.
                  <br />
                  문제가 계속되면 전화로 문의하세요.
                </p>
                <button
                  onClick={handleRetry}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all mb-4"
                >
                  다시 시도하기
                </button>
                <p className="text-xs text-gray-500">입력하신 정보는 유지되고 있습니다.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-2xl font-bold text-gray-900">무료 상담 신청</h3>

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
                    이름 *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="홍길동"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 mb-2">
                    휴대폰 번호 *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="010-1234-5678"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="example@email.com"
                  />
                </div>

                {/* Interest */}
                <div>
                  <label htmlFor="interest" className="block text-sm font-semibold text-gray-900 mb-2">
                    관심 상품 *
                  </label>
                  <select
                    id="interest"
                    name="interest"
                    value={formData.interest}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="">선택해주세요</option>
                    <option value="korea">국내 플랜 (월 33,000원)</option>
                    <option value="southeast-asia">동남아 플랜 (월 66,000원)</option>
                    <option value="premium">프리미엄 플랜 (월 157,500원)</option>
                    <option value="consulting">무료 상담만</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-gray-900 mb-2">
                    추가 메시지
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                    placeholder="건강상태, 여행 경험, 특별 요청사항 등을 적어주세요"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitStatus === 'loading'}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-white text-lg transition-all transform hover:scale-105 active:scale-95 ${
                    submitStatus === 'loading'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                  }`}
                >
                  {submitStatus === 'loading' ? '신청 중...' : '무료 상담 신청'}
                </button>

                {/* Terms */}
                <p className="text-xs text-gray-500 text-center">
                  신청함으로써 개인정보 수집 및 이용에 동의합니다.
                  <br />
                  마케팅 이메일은 언제든 거부할 수 있습니다.
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-8 border-2 border-blue-200">
          <p className="text-gray-600 mb-4">신청이 어려운가요?</p>
          <p className="text-2xl font-bold text-gray-900 mb-6">
            전화로 바로 상담받으세요
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:02-1234-5678"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
            >
              📞 전화로 상담하기
            </a>
            <a
              href="http://pf.kakao.com/_"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-yellow-400 text-gray-900 rounded-lg font-bold hover:bg-yellow-500 transition-all"
            >
              💬 카톡 상담하기
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
