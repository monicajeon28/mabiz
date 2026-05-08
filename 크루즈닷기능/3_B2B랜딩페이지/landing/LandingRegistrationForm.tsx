'use client';

import React, { FormEvent, useState } from 'react';

interface LandingRegistrationFieldOption {
  value: string;
  label: string;
}

export interface LandingRegistrationField {
  key: string;
  label: string;
  placeholder?: string;
  inputType: 'text' | 'tel' | 'email' | 'date' | 'select' | 'checkbox';
  options?: LandingRegistrationFieldOption[];
  required: boolean;
}

export interface LandingAdditionalQuestion {
  id: string | number;
  name: string;
  required?: boolean;
}

// 고객 정보 (결제 버튼과 공유)
export interface CustomerInfo {
  name: string;
  phone: string;
}

interface LandingRegistrationFormProps {
  slug: string;
  buttonLabel: string;
  fields: LandingRegistrationField[];
  additionalQuestions?: LandingAdditionalQuestion[];
  // 고객 정보 변경 시 호출 (결제 버튼과 연동용)
  onCustomerInfoChange?: (info: Partial<CustomerInfo>) => void;
  // 결제 모드 관련 props
  isPaymentMode?: boolean;
  isPaymentProcessing?: boolean;
  onPaymentRequest?: (customerName: string, customerPhone: string) => Promise<void>;
}

const PHONE_REGEX = /^01([0|1|6|7|8|9]?)-?([0-9]{3,4})-?([0-9]{4})$/;

export function LandingRegistrationForm({
  slug,
  buttonLabel,
  fields,
  additionalQuestions = [],
  onCustomerInfoChange,
  isPaymentMode = false,
  isPaymentProcessing = false,
  onPaymentRequest,
}: LandingRegistrationFormProps) {
  const getInitialFormState = () => {
    const initialState: Record<string, string> = {};

    fields.forEach((field) => {
      initialState[field.key] = '';
      if (field.inputType === 'checkbox' && field.key === 'marketingConsent') {
        initialState[field.key] = 'on';
      }
    });

    additionalQuestions.forEach((question) => {
      initialState[question.name] = '';
    });

    return initialState;
  };

  const [formData, setFormData] = useState<Record<string, string>>(getInitialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData(getInitialFormState());
  };

  const handleChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    // 이름 또는 연락처가 변경되면 결제 버튼에 전달
    if (onCustomerInfoChange && (fieldName === 'name' || fieldName === 'phone')) {
      onCustomerInfoChange({ [fieldName]: value });
    }
  };

  const validateRequiredFields = () => {
    for (const field of fields) {
      if (!field.required) {
        continue;
      }
      const value = formData[field.key];
      if (field.inputType === 'checkbox') {
        if (value !== 'on') {
          return `${field.label}은(는) 필수입니다.`;
        }
      } else if (!value || value.trim() === '') {
        return `${field.label}은(는) 필수입니다.`;
      }
    }

    for (const question of additionalQuestions) {
      if (!question.required) {
        continue;
      }
      const value = formData[question.name];
      if (!value || value.trim() === '') {
        return `${question.name}은(는) 필수입니다.`;
      }
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const requiredError = validateRequiredFields();
      if (requiredError) {
        setError(requiredError);
        return;
      }

      if (formData.phone && !PHONE_REGEX.test(formData.phone)) {
        setError('잘못된 휴대폰 번호입니다. 숫자, - 를 포함한 숫자만 입력하세요.');
        return;
      }

      // 결제 모드일 때는 onPaymentRequest 호출
      if (isPaymentMode && onPaymentRequest) {
        const customerName = formData.name?.trim() || '';
        const customerPhone = formData.phone?.replace(/[^0-9]/g, '') || '';

        if (!customerName || !customerPhone || customerPhone.length < 10) {
          setError('결제를 위해 이름과 연락처를 정확히 입력해주세요.');
          return;
        }

        await onPaymentRequest(customerName, customerPhone);
        // 결제 페이지로 리다이렉트되므로 이후 코드는 실행되지 않음
        return;
      }

      // 일반 신청 모드
      const response = await fetch(`/api/public/landing-pages/${slug}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || '등록에 실패했습니다.');
      }

      if (data.completionUrl) {
        window.location.href = data.completionUrl;
        return;
      }

      alert('등록이 완료되었습니다! 담당자가 곧 연락드리겠습니다.');
      resetForm();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : '등록 중 오류가 발생했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!fields.length) {
    return null;
  }

  return (
    <form className="lp-form-grid" onSubmit={handleSubmit} noValidate data-landing-slug={slug}>
      {fields.map((field) => {
        const inputId = `lp-field-${field.key}`;
        const value = formData[field.key] ?? '';

        if (field.inputType === 'select' && field.options?.length) {
          return (
            <div className="lp-form-field" key={field.key}>
              <label htmlFor={inputId}>
                {field.label}
                {field.required && <span className="lp-required">*</span>}
              </label>
              <select
                id={inputId}
                name={field.key}
                required={field.required}
                value={value}
                onChange={(event) => handleChange(field.key, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.inputType === 'checkbox') {
          return (
            <div className="lp-form-field lp-form-field--checkbox" key={field.key}>
              <label htmlFor={inputId}>
                <input
                  id={inputId}
                  name={field.key}
                  type="checkbox"
                  checked={formData[field.key] === 'on'}
                  required={field.required}
                  onChange={(event) => handleChange(field.key, event.target.checked ? 'on' : '')}
                />
                <span>
                  {field.label}
                  {field.required && <span className="lp-required">*</span>}
                </span>
              </label>
            </div>
          );
        }

        return (
          <div className="lp-form-field" key={field.key}>
            <label htmlFor={inputId}>
              {field.label}
              {field.required && <span className="lp-required">*</span>}
            </label>
            <input
              id={inputId}
              name={field.key}
              type={field.inputType}
              placeholder={field.placeholder}
              required={field.required}
              value={value}
              onChange={(event) => handleChange(field.key, event.target.value)}
            />
          </div>
        );
      })}

      {additionalQuestions.map((question, index) => {
        const fieldId = `lp-additional-${question.id ?? index}`;
        const value = formData[question.name] ?? '';

        return (
          <div className="lp-form-field" key={fieldId}>
            <label htmlFor={fieldId}>
              {question.name}
              {question.required && <span className="lp-required">*</span>}
            </label>
            <input
              id={fieldId}
              name={question.name}
              type="text"
              placeholder={`${question.name}을(를) 입력하세요`}
              required={Boolean(question.required)}
              value={value}
              onChange={(event) => handleChange(question.name, event.target.value)}
            />
          </div>
        );
      })}

      {error && (
        <div className="lp-error-message" style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="lp-primary-button"
        disabled={isSubmitting || isPaymentProcessing}
      >
        {isSubmitting || isPaymentProcessing ? '처리 중...' : buttonLabel}
      </button>
      <p className="lp-helper-text">
        {isPaymentMode
          ? '결제하기 버튼을 누르면 결제 페이지로 이동합니다.'
          : '제출 버튼을 누르면 상담 요청이 접수되며, 작업자가 순차적으로 연락을 드립니다.'}
      </p>
    </form>
  );
}

