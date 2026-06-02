/**
 * ErrorFeedback 컴포넌트
 *
 * 에러 타입별 표준화된 UI 렌더링
 * - 검증 오류 (400): 인라인 에러 (빨강)
 * - 크기 초과 (413): 모달 (황색)
 * - 서버 오류 (500+): 토스트 + 자동 재시도 (주황색)
 *
 * 사용 예:
 * ```tsx
 * <ErrorFeedback
 *   error={{
 *     code: 'VALIDATION_ERROR',
 *     message: '전화번호 형식이 올바르지 않습니다',
 *     field: 'phone',
 *     suggestion: '010-XXXX-XXXX 형식으로 입력해주세요'
 *   }}
 *   onRetry={handleRetry}
 *   onDismiss={handleDismiss}
 * />
 * ```
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  X,
  RotateCw,
  HelpCircle,
  Mail,
} from 'lucide-react';

interface ErrorFeedbackError {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
  retryable?: boolean;
  attempts?: number;
  maxAttempts?: number;
  operationId?: string;
  currentSize?: number;
  maxSize?: number;
  externalService?: string;
  supportEmail?: string;
}

interface ErrorFeedbackProps {
  error: ErrorFeedbackError;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  className?: string;
  autoRetry?: {
    enabled: boolean;
    delayMs: number;
  };
}

/**
 * 에러 피드백 컴포넌트
 *
 * 특징:
 * - 에러 타입별 자동 스타일 (검증/크기/서버)
 * - 자동 재시도 토스트 (진행률 표시)
 * - 사용자 제안 메시지
 * - 작업 ID로 추적 가능
 */
export function ErrorFeedback({
  error,
  onRetry,
  onDismiss,
  className = '',
  autoRetry,
}: ErrorFeedbackProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState(0);

  // 자동 재시도
  useEffect(() => {
    if (
      autoRetry?.enabled &&
      error.retryable &&
      !isRetrying &&
      (error.attempts ?? 0) < (error.maxAttempts ?? 3)
    ) {
      const timer = setTimeout(async () => {
        setIsRetrying(true);
        try {
          await onRetry?.();
        } finally {
          setIsRetrying(false);
        }
      }, autoRetry.delayMs);

      return () => clearTimeout(timer);
    }
  }, [autoRetry, error, isRetrying, onRetry]);

  // 재시도 진행 애니메이션
  useEffect(() => {
    if (isRetrying && error.attempts && error.maxAttempts) {
      const progress = (error.attempts / error.maxAttempts) * 100;
      setRetryProgress(progress);
    }
  }, [isRetrying, error.attempts, error.maxAttempts]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  // ───────────────────────────────────────────────────────
  // 검증 오류 (400): 인라인 에러 (빨강)
  // ───────────────────────────────────────────────────────
  if (
    error.code === 'VALIDATION_ERROR' ||
    error.code === 'MISSING_REQUIRED_FIELD' ||
    error.code === 'INVALID_PHONE_FORMAT' ||
    error.code === 'INVALID_EMAIL_FORMAT' ||
    error.code === 'INVALID_AGE' ||
    error.field
  ) {
    return (
      <div
        className={`
          bg-red-50 border border-red-200 rounded-lg p-4
          flex gap-3 animate-in fade-in slide-in-from-top-2 duration-200
          ${className}
        `}
        role="alert"
      >
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-red-900">{error.message}</p>
          {error.suggestion && (
            <p className="text-sm text-red-700 mt-1">{error.suggestion}</p>
          )}
          {error.field && (
            <p className="text-xs text-red-600 mt-2">
              입력란: <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded">
                {error.field}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-red-600 hover:text-red-700 transition p-1"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────
  // 크기 초과 (413): 모달 (황색)
  // ───────────────────────────────────────────────────────
  if (error.code === 'PAYLOAD_TOO_LARGE' || error.code === 'FILE_TOO_LARGE' || error.code === 'TOO_MANY_ITEMS') {
    return (
      <div
        className={`
          bg-yellow-50 border border-yellow-200 rounded-lg p-5
          animate-in fade-in slide-in-from-top-2 duration-200
          ${className}
        `}
        role="alert"
      >
        <div className="flex gap-4">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-yellow-900">{error.message}</h3>

            {/* 크기 정보 */}
            {error.currentSize !== undefined && error.maxSize !== undefined && (
              <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-300">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">현재:</span> {error.currentSize} MB{' '}
                  <span className="mx-2">|</span>
                  <span className="font-semibold">최대:</span> {error.maxSize} MB
                </p>
                <div className="mt-2 w-full bg-yellow-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((error.currentSize / error.maxSize) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 사용자 제안 */}
            {error.suggestion && (
              <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
                <p className="text-sm font-medium text-yellow-900">👉 {error.suggestion}</p>
              </div>
            )}

            {/* 작업 ID */}
            {error.operationId && (
              <p className="text-xs text-yellow-600 mt-2">
                작업 ID: <span className="font-mono">{error.operationId}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded hover:bg-yellow-200 transition"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────
  // 서버 오류 (500+): 토스트 + 자동 재시도 (주황색)
  // ───────────────────────────────────────────────────────
  return (
    <div
      className={`
        bg-orange-50 border border-orange-200 rounded-lg p-4
        animate-in fade-in slide-in-from-top-2 duration-200
        ${className}
      `}
      role="alert"
    >
      <div className="flex gap-3">
        <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          {/* 헤더 */}
          <p className="font-semibold text-orange-900">
            🔄 {error.message}
          </p>

          {/* 외부 서비스 정보 */}
          {error.externalService && (
            <p className="text-xs text-orange-600 mt-1">
              서비스: <span className="font-medium">{error.externalService}</span>
            </p>
          )}

          {/* 작업 ID */}
          {error.operationId && (
            <p className="text-xs text-orange-600 mt-1">
              작업 ID: <span className="font-mono">{error.operationId}</span>
            </p>
          )}

          {/* 재시도 진행 상황 */}
          {isRetrying && error.attempts && error.maxAttempts && (
            <div className="mt-3">
              <p className="text-sm text-orange-700 mb-2 font-medium">
                자동으로 다시 시도 중... ({error.attempts}/{error.maxAttempts})
              </p>
              <div className="w-full bg-orange-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${retryProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 사용자 제안 */}
          {error.suggestion && !isRetrying && (
            <p className="text-sm text-orange-700 mt-2">{error.suggestion}</p>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-1 flex-shrink-0">
          {!isRetrying && error.retryable && onRetry && (
            <button
              onClick={handleRetry}
              className={`
                px-3 py-1.5 text-sm font-medium rounded transition
                flex items-center gap-1.5
                text-orange-700 bg-orange-100 hover:bg-orange-200
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              disabled={isRetrying}
              aria-label="재시도"
            >
              <RotateCw className="w-4 h-4" />
              <span>재시도</span>
            </button>
          )}

          {error.supportEmail && (
            <button
              onClick={() => {
                window.location.href = `mailto:${error.supportEmail}?subject=Error Report&body=작업 ID: ${error.operationId}`;
              }}
              className="px-3 py-1.5 text-sm font-medium rounded transition text-orange-700 hover:bg-orange-100"
              title="지원팀 문의"
              aria-label="지원팀 문의"
            >
              <Mail className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-sm font-medium rounded transition text-orange-700 hover:bg-orange-100"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 도움말 (선택사항) */}
      {error.code === 'GATEWAY_TIMEOUT' && (
        <div className="mt-3 p-3 bg-white rounded border border-orange-200 text-xs text-orange-800">
          <p className="font-medium flex items-center gap-1 mb-1">
            <HelpCircle className="w-4 h-4" />
            시간초과 이유
          </p>
          <p>요청이 너무 오래 걸렸습니다. 네트워크 상태를 확인하고 다시 시도해주세요.</p>
        </div>
      )}
    </div>
  );
}

/**
 * 에러 배너 (풀 너비, 페이지 상단)
 *
 * 사용 예:
 * ```tsx
 * <ErrorBanner error={error} onRetry={() => {...}} />
 * ```
 */
export function ErrorBanner({
  error,
  onRetry,
  onDismiss,
}: Omit<ErrorFeedbackProps, 'className'>) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-4xl mx-auto">
        <ErrorFeedback error={error} onRetry={onRetry} onDismiss={onDismiss} />
      </div>
    </div>
  );
}

/**
 * 에러 토스트 (우측 하단, 자동 닫기)
 *
 * 사용 예:
 * ```tsx
 * <ErrorToast
 *   error={error}
 *   autoClose={3000}
 *   onRetry={() => {...}}
 * />
 * ```
 */
export function ErrorToast({
  error,
  onRetry,
  onDismiss,
  autoClose = 5000,
}: ErrorFeedbackProps & { autoClose?: number }) {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (autoClose && !error.retryable) {
      const timer = setTimeout(() => setIsVisible(false), autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, error.retryable]);

  if (!isVisible) return null;

  const handleDismissWithCallback = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
      <ErrorFeedback
        error={error}
        onRetry={onRetry}
        onDismiss={handleDismissWithCallback}
      />
    </div>
  );
}
