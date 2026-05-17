'use client';

import React, { ReactNode } from 'react';

/**
 * ErrorBoundary 컴포넌트의 Props
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
}

/**
 * ErrorBoundary 컴포넌트의 State
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary 컴포넌트
 * React 컴포넌트 트리의 에러를 캐치하고 사용자 친화적인 UI를 표시합니다.
 *
 * @example
 * ```typescript
 * function App() {
 *   return (
 *     <ErrorBoundary
 *       fallback={(error) => (
 *         <div>
 *           <h1>오류 발생</h1>
 *           <p>{error.message}</p>
 *         </div>
 *       )}
 *       onError={(error, errorInfo) => {
 *         console.error('Error caught:', error, errorInfo);
 *       }}
 *     >
 *       <MyComponent />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // 사용자 정의 에러 핸들러 호출
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // resetKeys가 변경되면 에러 상태 초기화
    if (
      this.state.hasError &&
      prevProps.resetKeys &&
      this.props.resetKeys &&
      prevProps.resetKeys.some(
        (key, index) => key !== this.props.resetKeys?.[index]
      )
    ) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // 사용자 정의 fallback 렌더링
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return (this.props.fallback as any)(this.state.error);
        }
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg shadow-sm">
          <div className="flex items-start gap-4">
            {/* 에러 아이콘 */}
            <div className="flex-shrink-0 mt-0.5">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* 에러 메시지 */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-800 mb-1">
                오류 발생
              </h2>
              <p className="text-sm text-red-700 mb-4">
                {this.state.error?.message ||
                  '페이지를 로드할 수 없습니다. 새로고침을 시도해주세요.'}
              </p>

              {/* 액션 버튼들 */}
              <div className="flex gap-2">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                >
                  다시 시도
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded hover:bg-red-200 transition-colors"
                >
                  홈으로 돌아가기
                </button>
              </div>

              {/* 개발 환경에서 상세 에러 표시 */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 p-3 bg-red-100 rounded text-xs text-red-800 font-mono">
                  <summary className="cursor-pointer font-bold">
                    상세 정보
                  </summary>
                  <pre className="mt-2 overflow-auto max-h-40">
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * ErrorBoundary를 사용하기 위한 HOC
 * @param Component 래핑할 컴포넌트
 * @param errorFallback 에러 UI
 * @returns ErrorBoundary로 래핑된 컴포넌트
 *
 * @example
 * ```typescript
 * const ProtectedComponent = withErrorBoundary(MyComponent, (error) => (
 *   <div>Error: {error.message}</div>
 * ));
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: ErrorBoundaryProps['fallback'],
  errorHandler?: ErrorBoundaryProps['onError']
) {
  const Wrapped = (props: P) => (
    <ErrorBoundary fallback={errorFallback} onError={errorHandler}>
      <Component {...props} />
    </ErrorBoundary>
  );

  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return Wrapped;
}
