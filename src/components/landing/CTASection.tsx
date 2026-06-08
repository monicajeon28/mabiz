'use client';

import React, { useState } from 'react';
import { track } from '@/lib/landing/analytics';
import { useIntersectionObserver } from '@/lib/landing/useIntersectionObserver';

type FieldError = {
  [key in 'name' | 'phone' | 'email' | 'interest' | 'message']?: string;
};

type FieldStatus = 'idle' | 'focus' | 'error' | 'success' | 'disabled';

export default function CTASection() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    interest: '',
    message: '',
  });

  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({
    name: 'idle',
    phone: 'idle',
    email: 'idle',
    interest: 'idle',
    message: 'idle',
  });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Field-level validation logic
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return '이름을 입력해주세요';
        if (value.trim().length < 2) return '이름은 최소 2글자 이상이어야 합니다';
        return '';
      case 'phone':
        if (!value.trim()) return '휴대폰 번호를 입력해주세요';
        if (!/^\d{3}-\d{3,4}-\d{4}$/.test(value)) {
          return '올바른 형식으로 입력해주세요 (010-1234-5678)';
        }
        return '';
      case 'email':
        if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return '올바른 이메일 형식으로 입력해주세요';
        }
        return '';
      case 'interest':
        if (!value.trim()) return '관심 상품을 선택해주세요';
        return '';
      default:
        return '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Real-time validation
    const error = validateField(name, value);
    setFieldErrors((prev) => ({
      ...prev,
      [name]: error,
    }));

    // Update field status
    if (error) {
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'error',
      }));
    } else if (value.trim()) {
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'success',
      }));
    } else {
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'idle',
      }));
    }

    // Clear submit error when user starts typing
    if (submitStatus === 'error') {
      setErrorMessage('');
      setSubmitStatus('idle');
    }
  };

  const handleFocus = (e: React.FocusEvent<any>) => {
    const { name } = e.target;
    if (fieldErrors[name as keyof FieldError]) {
      // Maintain error state
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'error',
      }));
    } else {
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'focus',
      }));
    }
  };

  const handleBlur = (e: React.FocusEvent<any>) => {
    const { name, value } = e.target;
    const error = validateField(name, value);

    if (error) {
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'error',
      }));
    } else if (value.trim()) {
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'success',
      }));
    } else {
      setFieldStatus((prev) => ({
        ...prev,
        [name]: 'idle',
      }));
    }
  };

  // Get dynamic CSS classes based on field status
  const getFieldClasses = (fieldName: string, baseClasses: string = ''): string => {
    const status = fieldStatus[fieldName];
    const baseInput =
      'w-full px-3 xs:px-4 py-2 xs:py-3 border rounded-lg text-sm xs:text-base outline-none transition-all duration-200';

    const stateClasses: Record<FieldStatus, string> = {
      idle: 'border-gray-300 text-gray-900 placeholder-gray-400 bg-white',
      focus: 'border-blue-500 text-gray-900 ring-2 ring-blue-500 ring-opacity-50 bg-white',
      error: 'border-red-500 text-gray-900 ring-2 ring-red-500 ring-opacity-50 bg-red-50 placeholder-red-300',
      success: 'border-green-500 text-gray-900 ring-2 ring-green-500 ring-opacity-50 bg-green-50',
      disabled: 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed',
    };

    return `${baseInput} ${stateClasses[status]} ${baseClasses}`;
  };

  // Render field-level error or success message
  const renderFieldMessage = (fieldName: keyof FieldError) => {
    const error = fieldErrors[fieldName];
    const status = fieldStatus[fieldName];
    const hasValue = Boolean(formData[fieldName]);

    if (error) {
      return (
        <div className="flex items-start mt-1.5 xs:mt-2">
          <span className="text-red-500 mr-1.5 flex-shrink-0 text-sm">⚠️</span>
          <p className="text-red-600 text-xs font-medium">{error}</p>
        </div>
      );
    }

    if (status === 'success' && hasValue) {
      return (
        <div className="flex items-start mt-1.5 xs:mt-2">
          <span className="text-green-600 mr-1.5 flex-shrink-0 text-sm">✓</span>
          <p className="text-green-700 text-xs font-medium">완료됨</p>
        </div>
      );
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('loading');
    setErrorMessage('');

    // Validate all fields before submission
    const errors: FieldError = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof typeof formData]);
      if (error) errors[key as keyof FieldError] = error;
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      Object.keys(errors).forEach((key) => {
        setFieldStatus((prev) => ({
          ...prev,
          [key]: 'error',
        }));
      });
      setSubmitStatus('idle');
      return;
    }

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

      // Set all fields to success state
      Object.keys(formData).forEach((key) => {
        setFieldStatus((prev) => ({
          ...prev,
          [key]: 'success',
        }));
      });

      setSubmitStatus('success');

      // Reset form after 5 seconds
      setTimeout(() => {
        setFormData({
          name: '',
          phone: '',
          email: '',
          interest: '',
          message: '',
        });
        setFieldStatus({
          name: 'idle',
          phone: 'idle',
          email: 'idle',
          interest: 'idle',
          message: 'idle',
        });
        setFieldErrors({});
        setSubmitStatus('idle');
      }, 5000);
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

  const [sectionRef, sectionVisible] = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      ref={sectionRef}
      className="py-12 sm:py-16 md:py-20 lg:py-24 bg-white"
      id="application-form"
      data-scroll-animation="cta"
    >
      <div className="max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className={`text-center mb-8 xs:mb-10 sm:mb-12 md:mb-14 lg:mb-16 ${sectionVisible ? 'animate-fadeInDown' : 'opacity-0'}`}>
          <h2
            className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900"
            style={{
              animation: sectionVisible ? 'fadeInUp 0.6s ease-out 0.1s forwards' : 'none',
            }}
          >
            지금 신청하세요
          </h2>
          <p className="text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 mt-2 xs:mt-3 sm:mt-4">
            무료 상담 신청 → 24시간 내 매니저 연락
            <br />
            <strong className="text-blue-600">신청만 해도 10-30% 평생 할인</strong>
          </p>
        </div>

        {/* Two column layout */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-6 xs:gap-8 sm:gap-10 md:gap-12 lg:gap-16 items-start ${sectionVisible ? 'animate-fadeInLeft' : 'opacity-0'}`}
        >
          {/* Left - Benefits */}
          <div
            className="space-y-6 xs:space-y-7 sm:space-y-8"
            style={{
              animation: sectionVisible ? 'fadeInLeft 0.6s ease-out 0.15s forwards' : 'none',
            }}
          >
            <div>
              <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 mb-4 xs:mb-5 sm:mb-6">신청 후 다음 단계</h3>
              <div className="space-y-2 xs:space-y-3 sm:space-y-4">
                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 xs:h-9 w-8 xs:w-9 sm:h-10 sm:w-10 rounded-full bg-blue-600 text-white font-bold text-xs xs:text-sm sm:text-base">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">신청 폼 작성</p>
                    <p className="text-gray-600 text-xs">이름, 연락처, 관심상품 선택</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 xs:h-9 w-8 xs:w-9 sm:h-10 sm:w-10 rounded-full bg-blue-600 text-white font-bold text-xs xs:text-sm sm:text-base">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">24시간 내 매니저 연락</p>
                    <p className="text-gray-600 text-xs">전화, 카톡, 이메일 중 선택</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 xs:h-9 w-8 xs:w-9 sm:h-10 sm:w-10 rounded-full bg-blue-600 text-white font-bold text-xs xs:text-sm sm:text-base">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">무료 상담</p>
                    <p className="text-gray-600 text-xs">건강상태, 선호도, 예산 논의</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 xs:h-9 w-8 xs:w-9 sm:h-10 sm:w-10 rounded-full bg-blue-600 text-white font-bold text-xs xs:text-sm sm:text-base">
                    4
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">예약 완료</p>
                    <p className="text-gray-600 text-xs">10-30% 할인 적용된 가격으로</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 xs:space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 xs:h-9 w-8 xs:w-9 sm:h-10 sm:w-10 rounded-full bg-green-600 text-white font-bold text-xs xs:text-sm sm:text-base">
                    5
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base">여행 준비 & 동반</p>
                    <p className="text-gray-600 text-xs">인솔자와 함께 안전하게</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="bg-blue-50 rounded-xl p-4 xs:p-5 sm:p-6 border border-blue-200">
              <p className="font-bold text-gray-900 text-xs xs:text-sm sm:text-base mb-3 xs:mb-4">100% 안심 보장</p>
              <ul className="space-y-1 xs:space-y-1.5 sm:space-y-2 text-xs text-gray-600">
                <li>✓ 개인정보 100% 보호 (암호화)</li>
                <li>✓ 무료 상담 (비용 청구 없음)</li>
                <li>✓ 중도해지 수수료 0원</li>
                <li>✓ 환불 안 될 시 100% 환금</li>
              </ul>
            </div>
          </div>

          {/* Right - Form */}
          <div
            className={`bg-white rounded-2xl shadow-xl p-6 xs:p-7 sm:p-8 border border-gray-200 ${sectionVisible ? 'animate-fadeInRight' : 'opacity-0'}`}
            style={{
              animation: sectionVisible ? 'fadeInRight 0.6s ease-out 0.15s forwards' : 'none',
            }}
          >
            {submitStatus === 'success' ? (
              <div className="flex flex-col items-center justify-center py-8 xs:py-10 sm:py-12 text-center">
                <div className="text-4xl xs:text-5xl sm:text-6xl mb-2 xs:mb-3 sm:mb-4">✓</div>
                <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 mb-1 xs:mb-2">신청이 완료되었습니다!</h3>
                <p className="text-xs xs:text-sm sm:text-base text-gray-600 mb-4 xs:mb-5 sm:mb-6">
                  24시간 내에 매니저가 연락 드리겠습니다.
                  <br />
                  감사합니다.
                </p>
                <div className="text-xs xs:text-sm text-blue-600 font-semibold">신청만 해도 10-30% 할인 적용!</div>
              </div>
            ) : submitStatus === 'error' ? (
              <div className="flex flex-col items-center justify-center py-8 xs:py-10 sm:py-12">
                <div className="text-4xl xs:text-5xl sm:text-6xl mb-2 xs:mb-3 sm:mb-4">⚠️</div>
                <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 mb-2 xs:mb-3 sm:mb-4">신청에 실패했습니다</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 xs:p-4 mb-4 xs:mb-5 sm:mb-6 w-full">
                  <p className="text-red-700 text-center font-semibold text-xs xs:text-sm">{errorMessage}</p>
                </div>
                <p className="text-xs xs:text-sm text-gray-600 text-center mb-4 xs:mb-5 sm:mb-6">
                  잠시 후 다시 시도해주세요.
                  <br />
                  문제가 계속되면 전화로 문의하세요.
                </p>
                <button
                  onClick={handleRetry}
                  className="px-6 xs:px-7 sm:px-8 py-2 xs:py-3 text-sm xs:text-base bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all mb-3"
                >
                  다시 시도하기
                </button>
                <p className="text-xs text-gray-500">입력하신 정보는 유지되고 있습니다.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 xs:space-y-5 sm:space-y-6">
                <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900">무료 상담 신청</h3>

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-xs xs:text-sm font-semibold text-gray-900 mb-1.5 xs:mb-2">
                    이름 *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    required
                    className={getFieldClasses('name')}
                    placeholder="홍길동"
                    aria-invalid={!!fieldErrors.name}
                    aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                  />
                  {renderFieldMessage('name')}
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-xs xs:text-sm font-semibold text-gray-900 mb-1.5 xs:mb-2">
                    휴대폰 번호 *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    required
                    className={getFieldClasses('phone')}
                    placeholder="010-1234-5678"
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                  />
                  {renderFieldMessage('phone')}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-xs xs:text-sm font-semibold text-gray-900 mb-1.5 xs:mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className={getFieldClasses('email')}
                    placeholder="example@email.com"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  />
                  {renderFieldMessage('email')}
                </div>

                {/* Interest */}
                <div>
                  <label htmlFor="interest" className="block text-xs xs:text-sm font-semibold text-gray-900 mb-1.5 xs:mb-2">
                    관심 상품 *
                  </label>
                  <select
                    id="interest"
                    name="interest"
                    value={formData.interest}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    required
                    className={getFieldClasses('interest', 'bg-white')}
                    aria-invalid={!!fieldErrors.interest}
                    aria-describedby={fieldErrors.interest ? 'interest-error' : undefined}
                  >
                    <option value="">선택해주세요</option>
                    <option value="korea">국내 플랜 (월 33,000원)</option>
                    <option value="southeast-asia">동남아 플랜 (월 66,000원)</option>
                    <option value="premium">프리미엄 플랜 (월 157,500원)</option>
                    <option value="consulting">무료 상담만</option>
                  </select>
                  {renderFieldMessage('interest')}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-xs xs:text-sm font-semibold text-gray-900 mb-1.5 xs:mb-2">
                    추가 메시지
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    rows={3}
                    className={getFieldClasses('message', 'resize-none')}
                    placeholder="건강상태, 여행 경험, 특별 요청사항 등을 적어주세요"
                    aria-describedby={fieldErrors.message ? 'message-error' : undefined}
                  />
                  {renderFieldMessage('message')}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitStatus === 'loading'}
                  className={`w-full py-3 xs:py-4 px-4 xs:px-6 rounded-lg font-bold text-white text-sm xs:text-base transition-all transform hover:scale-105 active:scale-95 ${
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
        <div className="mt-10 xs:mt-12 sm:mt-14 md:mt-16 text-center bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-5 xs:p-6 sm:p-8 border-2 border-blue-200">
          <p className="text-xs xs:text-sm text-gray-600 mb-2 xs:mb-3 sm:mb-4">신청이 어려운가요?</p>
          <p className="text-base xs:text-lg sm:text-2xl font-bold text-gray-900 mb-4 xs:mb-5 sm:mb-6">
            전화로 바로 상담받으세요
          </p>
          <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 sm:gap-4 justify-center">
            <a
              href="tel:02-1234-5678"
              className="px-4 xs:px-6 sm:px-8 py-2 xs:py-3 sm:py-4 bg-blue-600 text-white rounded-lg font-bold text-xs xs:text-sm sm:text-base hover:bg-blue-700 transition-all"
            >
              📞 전화로 상담하기
            </a>
            <a
              href="http://pf.kakao.com/_"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 xs:px-6 sm:px-8 py-2 xs:py-3 sm:py-4 bg-yellow-400 text-gray-900 rounded-lg font-bold text-xs xs:text-sm sm:text-base hover:bg-yellow-500 transition-all"
            >
              💬 카톡 상담하기
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
