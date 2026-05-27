'use client';

import React, { useState, useEffect } from 'react';
import { normalizePhone } from '@/lib/phone-normalize';
import './ContactForm.css';

interface ContactFormProps {
  variant?: 'a' | 'b' | 'c';
  onComplete?: (data: FormData) => void;
  onError?: (error: string) => void;
}

export interface FormData {
  name: string;
  phone: string;
  email: string;
  ageRange: string;
  preferenceType: string;
  variant: string;
  segment: string;
  completionTimeMs: number;
}

// Segment 결정 로직
const determineSegment = (ageRange: string): string => {
  const segmentMap: Record<string, string> = {
    '20s': 'A',
    '30s': 'A',
    '40s': 'B',
    '50s': 'C',
    '60s': 'D',
    '70s+': 'E',
  };
  return segmentMap[ageRange] || 'A';
};

// 랜덤 variant 선택 (테스트 목적)
const getRandomVariant = (): 'a' | 'b' | 'c' => {
  const variants: Array<'a' | 'b' | 'c'> = ['a', 'b', 'c'];
  return variants[Math.floor(Math.random() * variants.length)];
};

export const ContactForm: React.FC<ContactFormProps> = ({
  variant: initialVariant,
  onComplete,
  onError,
}) => {
  const [variant] = useState<'a' | 'b' | 'c'>(initialVariant || getRandomVariant());
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    ageRange: '',
    preferenceType: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [startTime] = useState(Date.now());

  // 이벤트 로깅 함수
  const logEvent = (eventName: string, data?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, {
        variant,
        timestamp: new Date().toISOString(),
        ...data,
      });
    }
  };

  // Step 1: 나이 선택
  const handleStep1Next = (ageRange: string) => {
    if (!ageRange) {
      setErrors({ ageRange: '나이 범위를 선택해주세요' });
      return;
    }
    setErrors({});
    setFormData(prev => ({ ...prev, ageRange }));
    logEvent('form_step_1_complete', { ageRange });
    setCurrentStep(2);
  };

  // Step 2: 선호도 선택
  const handleStep2Next = (preferenceType: string) => {
    if (!preferenceType) {
      setErrors({ preferenceType: '선호도를 선택해주세요' });
      return;
    }
    setErrors({});
    setFormData(prev => ({ ...prev, preferenceType }));
    logEvent('form_step_2_complete', { preferenceType });
    setCurrentStep(3);
  };

  // 폰 번호 포맷팅
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let formatted = '';
    if (digits.length <= 3) {
      formatted = digits;
    } else if (digits.length <= 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
    }
    setFormData(prev => ({ ...prev, phone: formatted }));
    setErrors(prev => ({ ...prev, phone: '' }));
  };

  // Step 3: 제출
  const handleStep3Submit = async () => {
    const newErrors: Record<string, string> = {};

    // 유효성 검사
    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = '이름을 2자 이상 입력해주세요';
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length !== 10) {
      newErrors.phone = '010-XXXX-XXXX 형식으로 입력해주세요';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '유효한 이메일을 입력해주세요';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      logEvent('form_step_3_error', { errorCount: Object.keys(newErrors).length });
      onError?.(Object.values(newErrors).join(', '));
      return;
    }

    setIsSubmitting(true);
    const completionTimeMs = Date.now() - startTime;
    const segment = determineSegment(formData.ageRange);

    try {
      // FormSubmission 로깅
      await fetch('/api/webhook/contact-form-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: phoneDigits,
          email: formData.email || null,
          ageRange: formData.ageRange,
          preferenceType: formData.preferenceType,
          variant,
          segment,
          completionTimeMs,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          affiliateCode: new URLSearchParams(window.location.search).get('ref') || null,
        }),
      });

      // CRM inquiry 웹훅 호출
      await fetch('/api/webhooks/inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_INQUIRY_WEBHOOK_SECRET || 'test'}`,
        },
        body: JSON.stringify({
          phone: phoneDigits,
          name: formData.name.trim(),
          email: formData.email || null,
          affiliateCode: new URLSearchParams(window.location.search).get('ref') || null,
          inquiryType: 'cruise_inquiry',
          message: `선호도: ${formData.preferenceType} | 연령: ${formData.ageRange}`,
          submittedAt: new Date().toISOString(),
          organizationId: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
        }),
      }).catch(err => console.error('Inquiry webhook error:', err));

      logEvent('form_complete', {
        completionTimeMs,
        segment,
      });

      setSuccessMessage(
        `✅ 신청이 완료되었습니다!\n1시간 내 SMS로 당신을 위한 크루즈를 추천해드립니다.`
      );

      onComplete?.({
        ...formData,
        phone: phoneDigits,
        variant,
        segment,
        completionTimeMs,
      });

      // 성공 화면 유지 (3초 후 리셋)
      setTimeout(() => {
        setCurrentStep(1);
        setFormData({ name: '', phone: '', email: '', ageRange: '', preferenceType: '' });
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Form submission error:', error);
      logEvent('form_submit_error', { error: String(error) });
      onError?.('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const segment = determineSegment(formData.ageRange);

  // 성공 메시지 표시
  if (successMessage) {
    return (
      <div className={`contact-form contact-form-${variant} success`}>
        <div className="success-message">
          {successMessage.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`contact-form contact-form-${variant}`}>
      {/* 프로그레스 바 */}
      <div className="progress-bar">
        <div className="progress" style={{ width: `${(currentStep / 3) * 100}%` }} />
        <span className="progress-text">{currentStep} of 3</span>
      </div>

      {/* Step 1: 나이 선택 */}
      {currentStep === 1 && (
        <div className="form-step step-1">
          <h2>당신의 크루즈 찾기 🚢</h2>
          <p className="subtitle">1분 안에 완료됩니다</p>

          <fieldset className="form-group">
            <legend>당신의 나이 범위를 선택해주세요</legend>
            {['20s', '30s', '40s', '50s', '60s', '70s+'].map(age => (
              <label key={age} className="radio-label">
                <input
                  type="radio"
                  name="ageRange"
                  value={age}
                  checked={formData.ageRange === age}
                  onChange={e => handleStep1Next(e.target.value)}
                />
                <span>{age}</span>
              </label>
            ))}
          </fieldset>

          {errors.ageRange && <div className="error-message">{errors.ageRange}</div>}
        </div>
      )}

      {/* Step 2: 선호도 선택 */}
      {currentStep === 2 && (
        <div className="form-step step-2">
          <h2>2단계: 선호도 선택</h2>
          <p className="subtitle">당신의 크루즈 스타일을 알려주세요</p>

          <fieldset className="form-group">
            <legend>주로 원하시는 경험은? (1개 선택)</legend>
            {['romance', 'family', 'culture'].map(pref => {
              const labels: Record<string, string> = {
                romance: '🎭 로맨스 (커플/신혼)',
                family: '👨‍👩‍👧‍👦 가족 (자녀동반)',
                culture: '🎨 문화 (역사/미술/음악)',
              };
              return (
                <label key={pref} className="radio-label">
                  <input
                    type="radio"
                    name="preferenceType"
                    value={pref}
                    checked={formData.preferenceType === pref}
                    onChange={e => handleStep2Next(e.target.value)}
                  />
                  <span>{labels[pref]}</span>
                </label>
              );
            })}
          </fieldset>

          {/* Segment A: 신혼부부 체크박스 */}
          {segment === 'A' && formData.preferenceType === 'romance' && (
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                <span>신혼부부입니다 (신혼식 패키지 제안)</span>
              </label>
            </div>
          )}

          {/* Segment B: 자녀 인원 */}
          {segment === 'B' && (
            <div className="select-group">
              <label>
                <span>자녀 인원</span>
                <select defaultValue="">
                  <option value="">선택해주세요</option>
                  <option value="1">1명</option>
                  <option value="2">2명</option>
                  <option value="3">3명 이상</option>
                </select>
              </label>
            </div>
          )}

          {errors.preferenceType && <div className="error-message">{errors.preferenceType}</div>}

          <div className="button-group">
            <button type="button" className="btn-back" onClick={goBack}>
              ← 이전
            </button>
            <button type="button" className="btn-next" onClick={() => handleStep2Next(formData.preferenceType)}>
              다음 →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 연락처 */}
      {currentStep === 3 && (
        <div className="form-step step-3">
          <h2>3단계: 신청 완료</h2>
          <p className="subtitle">
            1시간 내 당신을 위한 크루즈를<br />추천해드리겠습니다
          </p>

          <form
            onSubmit={e => {
              e.preventDefault();
              handleStep3Submit();
            }}
          >
            {/* 이름 */}
            <div className="form-field">
              <label htmlFor="name">
                이름 <span className="required">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={e => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  setErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="예: 홍길동"
                maxLength={20}
                required
              />
              {errors.name && <div className="error-message">{errors.name}</div>}
            </div>

            {/* 폰 */}
            <div className="form-field">
              <label htmlFor="phone">
                휴대폰 <span className="required">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="010-XXXX-XXXX"
                maxLength={13}
                required
              />
              <p className="help-text">전화로 추천사항을 드립니다</p>
              {errors.phone && <div className="error-message">{errors.phone}</div>}
            </div>

            {/* 이메일 */}
            <div className="form-field">
              <label htmlFor="email">이메일 <span className="optional">(선택)</span></label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => {
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                  setErrors(prev => ({ ...prev, email: '' }));
                }}
                placeholder="user@example.com"
              />
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                <span>이메일 뉴스레터 구독</span>
              </label>
              {errors.email && <div className="error-message">{errors.email}</div>}
            </div>

            {/* CTA 버튼 */}
            <div className="button-group submit">
              <button
                type="button"
                className="btn-secondary"
                onClick={goBack}
                disabled={isSubmitting}
              >
                이전
              </button>

              <CTAButton
                variant={variant}
                segment={segment}
                onClick={handleStep3Submit}
                disabled={isSubmitting}
              />
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/**
 * CTA 버튼 컴포넌트
 */
interface CTAButtonProps {
  variant: 'a' | 'b' | 'c';
  segment?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const CTAButton: React.FC<CTAButtonProps> = ({
  variant,
  segment,
  onClick,
  disabled,
}) => {
  const getButtonText = (): string => {
    if (variant === 'a') return '신청하기';
    if (variant === 'b') return '내 크루즈 찾기 (2분 소요)';
    if (variant === 'c') return '지금 50% 할인 받기 (72시간만)';
    return '신청하기';
  };

  const className = `btn-cta btn-cta-${variant} ${disabled ? 'disabled' : ''}`;

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="button-text">{getButtonText()}</span>
      {variant === 'b' && <span className="arrow">→</span>}
    </button>
  );
};
