'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/lib/api/use-toast';
import type { ApiResponse } from './response';

/**
 * useApiCall Hook 옵션
 */
interface UseApiCallOptions {
  /** HTTP 메서드 (기본값: 'GET') */
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** 요청 본문 데이터 */
  body?: Record<string, any>;
  /** 성공 콜백 */
  onSuccess?: (data: any) => void;
  /** 실패 콜백 */
  onError?: (error: string) => void;
  /** 에러 토스트 표시 여부 (기본값: true) */
  showErrorToast?: boolean;
  /** 성공 토스트 표시 여부 (기본값: false) */
  showSuccessToast?: boolean;
  /** 성공 메시지 (showSuccessToast가 true일 때만 사용) */
  successMessage?: string;
  /** 재시도 횟수 (기본값: 3) */
  retryCount?: number;
  /** 추가 HTTP 헤더 */
  headers?: Record<string, string>;
}

/**
 * API 호출 상태
 */
interface ApiCallState {
  isLoading: boolean;
  error: string | null;
}

/**
 * useApiCall Hook
 * 재시도 로직, 에러 처리, Toast 알림을 포함한 API 호출 유틸리티
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { call, isLoading, error } = useApiCall();
 *
 *   const handleLoad = async () => {
 *     const result = await call('/api/dashboard', {
 *       method: 'GET',
 *       onSuccess: (data) => console.log('Success:', data),
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleLoad} disabled={isLoading}>
 *       {isLoading ? '로딩 중...' : '데이터 로드'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useApiCall() {
  const { toast } = useToast();
  const [state, setState] = useState<ApiCallState>({
    isLoading: false,
    error: null,
  });

  const call = useCallback(
    async <T,>(
      url: string,
      options: UseApiCallOptions = {}
    ): Promise<ApiResponse<T>> => {
      const {
        method = 'GET',
        body,
        onSuccess,
        onError,
        showErrorToast = true,
        showSuccessToast = false,
        successMessage = '성공',
        retryCount = 3,
        headers = {},
      } = options;

      setState({ isLoading: true, error: null });

      let lastError: Error | null = null;

      // 재시도 루프 (exponential backoff)
      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          // HTTP 에러 확인
          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorData: any = null;

            try {
              if (contentType?.includes('application/json')) {
                errorData = await response.json();
              } else {
                errorData = await response.text();
              }
            } catch {
              // 응답 파싱 실패
            }

            const errorMessage =
              typeof errorData === 'object' && errorData?.error
                ? errorData.error
                : `HTTP ${response.status}`;

            throw new Error(errorMessage);
          }

          // 응답 파싱
          const data: ApiResponse<T> = await response.json();

          // API 에러 확인
          if (!data.ok) {
            throw new Error(data.error || '알 수 없는 오류');
          }

          // 성공
          onSuccess?.(data.data);

          if (showSuccessToast) {
            toast({
              title: '성공',
              description: successMessage,
              variant: 'success',
            });
          }

          setState({ isLoading: false, error: null });
          return data;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // 마지막 시도가 아니면 대기 후 재시도
          if (attempt < retryCount - 1) {
            // Exponential backoff: 100ms, 300ms, 900ms, ...
            const delay = Math.pow(2, attempt) * 100;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // 최종 에러 처리
      const errorMsg = lastError?.message || '요청 실패';
      onError?.(errorMsg);

      if (showErrorToast) {
        toast({
          title: '오류',
          description: errorMsg,
          variant: 'destructive',
        });
      }

      setState({ isLoading: false, error: errorMsg });

      return { ok: false, error: errorMsg };
    },
    [toast]
  );

  return {
    call,
    isLoading: state.isLoading,
    error: state.error,
  };
}
