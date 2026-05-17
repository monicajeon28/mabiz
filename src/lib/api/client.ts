/**
 * API 클라이언트 헬퍼
 * 표준화된 API 호출을 위한 유틸리티 함수들
 */

import type { ApiResponse } from './response';

/**
 * API 클라이언트 요청 옵션
 */
interface ClientRequestOptions extends RequestInit {
  /** 추가 헤더 */
  headers?: Record<string, string>;
  /** 쿼리 파라미터 */
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * 쿼리 파라미터를 URL에 추가합니다
 * @param url 기본 URL
 * @param query 쿼리 파라미터 객체
 * @returns 쿼리가 추가된 URL
 */
function buildUrl(url: string, query?: Record<string, any>): string {
  if (!query || Object.keys(query).length === 0) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

/**
 * 기본 요청 옵션 생성
 * @param options 사용자 옵션
 * @returns fetch 요청 옵션
 */
function buildFetchOptions(
  options: ClientRequestOptions
): RequestInit {
  const { headers, query, ...restOptions } = options;

  return {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
}

/**
 * API 클라이언트
 * 모든 API 호출을 표준화합니다.
 *
 * @example
 * ```typescript
 * // GET 요청
 * const result = await apiClient.get('/api/users', {
 *   query: { page: 1, limit: 10 }
 * });
 *
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 *
 * // POST 요청
 * const createResult = await apiClient.post('/api/users', {
 *   body: { name: 'John', email: 'john@example.com' }
 * });
 * ```
 */
export const apiClient = {
  /**
   * GET 요청
   * @param url API 엔드포인트
   * @param options 요청 옵션
   * @returns API 응답
   */
  async get<T>(
    url: string,
    options?: ClientRequestOptions
  ): Promise<ApiResponse<T>> {
    const fullUrl = buildUrl(url, options?.query);
    const fetchOptions = buildFetchOptions({
      ...options,
      method: 'GET',
    });

    const response = await fetch(fullUrl, fetchOptions);
    return response.json();
  },

  /**
   * POST 요청
   * @param url API 엔드포인트
   * @param data 요청 본문
   * @param options 추가 옵션
   * @returns API 응답
   */
  async post<T>(
    url: string,
    data?: unknown,
    options?: ClientRequestOptions
  ): Promise<ApiResponse<T>> {
    const fullUrl = buildUrl(url, options?.query);
    const fetchOptions = buildFetchOptions({
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });

    const response = await fetch(fullUrl, fetchOptions);
    return response.json();
  },

  /**
   * PATCH 요청
   * @param url API 엔드포인트
   * @param data 요청 본문
   * @param options 추가 옵션
   * @returns API 응답
   */
  async patch<T>(
    url: string,
    data?: unknown,
    options?: ClientRequestOptions
  ): Promise<ApiResponse<T>> {
    const fullUrl = buildUrl(url, options?.query);
    const fetchOptions = buildFetchOptions({
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });

    const response = await fetch(fullUrl, fetchOptions);
    return response.json();
  },

  /**
   * DELETE 요청
   * @param url API 엔드포인트
   * @param options 요청 옵션
   * @returns API 응답
   */
  async delete<T>(
    url: string,
    options?: ClientRequestOptions
  ): Promise<ApiResponse<T>> {
    const fullUrl = buildUrl(url, options?.query);
    const fetchOptions = buildFetchOptions({
      ...options,
      method: 'DELETE',
    });

    const response = await fetch(fullUrl, fetchOptions);
    return response.json();
  },

  /**
   * PUT 요청
   * @param url API 엔드포인트
   * @param data 요청 본문
   * @param options 추가 옵션
   * @returns API 응답
   */
  async put<T>(
    url: string,
    data?: unknown,
    options?: ClientRequestOptions
  ): Promise<ApiResponse<T>> {
    const fullUrl = buildUrl(url, options?.query);
    const fetchOptions = buildFetchOptions({
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });

    const response = await fetch(fullUrl, fetchOptions);
    return response.json();
  },
};
