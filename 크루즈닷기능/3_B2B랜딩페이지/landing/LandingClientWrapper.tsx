'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { logger } from '@/lib/logger';

interface FieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  inputType: 'text' | 'tel' | 'email' | 'date' | 'select' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  required: boolean;
}

interface AdditionalQuestion {
  id: string | number;
  name: string;
  required: boolean;
}

interface ProductPurchaseConfig {
  enabled?: boolean;
  paymentProvider?: string;
  productName?: string;
  sellingPrice?: number | null;
  useQuantity?: boolean;
  purchaseQuantity?: number | null;
  paymentType?: string;
  paymentGroupId?: number | null;
  dbGroupId?: number | null;
}

interface LandingClientWrapperProps {
  slug: string;
  landingPageId: number;
  showFormSection: boolean;
  buttonLabel: string;
  fields: FieldConfig[];
  additionalQuestions: AdditionalQuestion[];
  showProductSection: boolean;
  productPurchase: ProductPurchaseConfig | null;
}

/**
 * LandingClientWrapper - 클라이언트 컴포넌트
 * 역할:
 * 1. URL에서 'aff_code' 파라미터 읽기
 * 2. affiliate-info API 호출로 managerId/agentId 검증
 * 3. 폼 제출 시 affiliateCode 자동 주입
 * 4. 제품 구매 및 고객 정보 수집 폼 렌더링
 */
export function LandingClientWrapper(props: LandingClientWrapperProps) {
  const {
    slug,
    landingPageId,
    showFormSection,
    buttonLabel,
    fields,
    additionalQuestions,
    showProductSection,
    productPurchase,
  } = props;

  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [csrfToken, setCsrfToken] = useState<string>('');

  // 1단계: URL에서 aff_code 읽기 및 affiliate-info API 호출
  useEffect(() => {
    const affCode = searchParams?.get('aff_code');

    if (!affCode) {
      return;
    }

    // affiliate-info API 호출로 유효성 검증
    const validateAffiliateCode = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/public/landing-pages/affiliate-info?code=${encodeURIComponent(affCode)}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.message || '제휴 링크 검증 실패');
          return;
        }

        const data = await response.json();
        if (data.ok && data.affiliate) {
          // affiliate-info API에서 성공 응답 → affiliateCode 저장
          setAffiliateCode(affCode);
        } else {
          setError('제휴 정보를 찾을 수 없습니다.');
        }
      } catch (err) {
        logger.error('Affiliate code validation error', { errorType: 'affiliate_validation_error' });
        setError('제휴 링크 검증 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    validateAffiliateCode();
  }, [searchParams]);

  // 2단계: CSRF 토큰 가져오기
  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrf-token='))
      ?.split('=')[1];

    if (token) {
      setCsrfToken(token);
    }
  }, []);

  // 폼 필드 변경 핸들러
  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.currentTarget;
    if (type === 'checkbox') {
      const checked = (e.currentTarget as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked ? 'true' : 'false',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 폼 제출 핸들러
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      setError(null);

      // 폼 데이터 구성 (affiliateCode 자동 포함)
      const submitData: Record<string, string | boolean> = {
        ...formData,
        csrfToken,
      };

      // affiliateCode가 있으면 자동으로 추가
      if (affiliateCode) {
        submitData.affiliateCode = affiliateCode;
      }

      // POST /api/public/landing-pages/[slug]/register 호출
      const response = await fetch(`/api/public/landing-pages/${slug}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(submitData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setError(responseData.error || '등록 중 오류가 발생했습니다.');
        return;
      }

      // 성공 → completionUrl로 리다이렉트
      if (responseData.completionUrl) {
        window.location.href = responseData.completionUrl;
      } else {
        // completionUrl이 없으면 홈으로 이동
        window.location.href = '/';
      }
    } catch (err) {
      logger.error('Form submission error', { errorType: 'form_submission_error' });
      setError('등록 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 제휴 코드 검증 오류 메시지 */}
      {error && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#991b1b',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* 상품 구매 섹션 (showProductSection이 true일 때만) */}
      {showProductSection && productPurchase && (
        <section className="lp-card">
          <div className="lp-section-label">상품</div>
          <h2 className="lp-section-title">{productPurchase.productName || '골드회원권'}</h2>

          {/* 가격 표시 */}
          {productPurchase.sellingPrice !== undefined && (
            <div className="lp-product-card">
              <div className="lp-product-price">
                {productPurchase.sellingPrice.toLocaleString('ko-KR')}원
              </div>
            </div>
          )}

          {/* 추가 정보 (필요시) */}
          {(productPurchase.paymentProvider || productPurchase.paymentType) && (
            <dl className="lp-product-meta">
              {productPurchase.paymentProvider && (
                <>
                  <dt>결제 수단</dt>
                  <dd>{productPurchase.paymentProvider}</dd>
                </>
              )}
              {productPurchase.paymentType && (
                <>
                  <dt>결제 유형</dt>
                  <dd>{productPurchase.paymentType}</dd>
                </>
              )}
            </dl>
          )}
        </section>
      )}

      {/* 등록 폼 섹션 (showFormSection이 true일 때만) */}
      {showFormSection && (
        <section className="lp-card">
          <div className="lp-section-label">고객 정보</div>
          <h2 className="lp-section-title">정보 입력</h2>

          <form ref={formRef} onSubmit={handleFormSubmit} className="lp-form-grid">
            {/* 기본 필드들 */}
            {fields.map((field) => (
              <div key={field.key} className={`lp-form-field ${field.inputType === 'checkbox' ? 'lp-form-field--checkbox' : ''}`}>
                <label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="lp-required">*</span>}
                </label>

                {field.inputType === 'checkbox' ? (
                  <input
                    id={field.key}
                    type="checkbox"
                    name={field.key}
                    checked={formData[field.key] === 'true'}
                    onChange={handleFieldChange}
                    required={field.required}
                  />
                ) : field.inputType === 'select' && field.options ? (
                  <select
                    id={field.key}
                    name={field.key}
                    value={formData[field.key] || ''}
                    onChange={handleFieldChange}
                    required={field.required}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.key}
                    type={field.inputType}
                    name={field.key}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={handleFieldChange}
                    required={field.required}
                    autoComplete="off"
                  />
                )}
              </div>
            ))}

            {/* 추가 질문들 */}
            {additionalQuestions.map((question) => (
              <div key={question.id} className="lp-form-field">
                <label htmlFor={`question-${question.id}`}>
                  {question.name}
                  {question.required && <span className="lp-required">*</span>}
                </label>
                <input
                  id={`question-${question.id}`}
                  type="text"
                  name={`question-${question.id}`}
                  value={formData[`question-${question.id}`] || ''}
                  onChange={handleFieldChange}
                  required={question.required}
                  autoComplete="off"
                />
              </div>
            ))}

            {/* 숨겨진 필드 (affiliateCode는 API로 처리, csrfToken도 헤더로 전송) */}
            {/* 제출 버튼 */}
            <button
              type="submit"
              className="lp-primary-button"
              disabled={isLoading}
              style={{
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? '처리 중...' : buttonLabel}
            </button>

            {/* 도움말 텍스트 */}
            {affiliateCode && (
              <p className="lp-helper-text">
                제휴 링크로 등록됩니다.
              </p>
            )}
          </form>
        </section>
      )}

      {/* 폼과 상품이 모두 비활성화된 경우 */}
      {!showFormSection && !showProductSection && (
        <section className="lp-card">
          <p style={{ color: '#666', textAlign: 'center' }}>
            표시할 콘텐츠가 없습니다.
          </p>
        </section>
      )}
    </>
  );
}
