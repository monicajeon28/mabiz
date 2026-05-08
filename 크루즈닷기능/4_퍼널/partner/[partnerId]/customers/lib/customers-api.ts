/**
 * 고객 관리 API 레이어
 * - AbortController로 중복 요청 취소
 * - 타입 안전성 강화
 * - 에러 로깅 & 재시도 처리
 */

import { logger } from '@/lib/logger';
import { csrfFetch } from '@/lib/csrf-client';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  status: 'ACTIVE' | 'REFUNDED' | 'CANCELED' | 'INACTIVE';
  createdAt: string;
  saleCount: number;
  totalAmount: number;
  lastSaleAt?: string;
  leadScore?: number;
}

export interface CustomerFilter {
  search?: string;
  status?: 'ACTIVE' | 'REFUNDED' | 'CANCELED' | 'INACTIVE';
  sortBy?: 'createdAt' | 'name' | 'totalAmount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * API 응답 타입 (서버에서 실제 반환하는 형태 명확화)
 */
interface FetchResult<T> {
  ok?: boolean;
  data?: T[];
  customers?: T[]; // 레거시 호환
  total?: number;
  count?: number;
  error?: string;
}

const abortControllerMap = new Map<string, AbortController>();
const TIMEOUT_MS = 30000; // 30초 타임아웃

// P2-6: 호환성 정규화 헬퍼
// P3-3: 함수명 명확화 (List 응답만 처리)
function normalizeFetchListResponse<T>(data: FetchResult<T>): {
  data: T[];
  total: number;
} {
  const items = (data.customers || data.data || []).filter(
    (c) => c && typeof c === 'object'
  );
  const total = Math.max(0, data.total || data.count || 0);
  return { data: items, total };
}

// P2-10: 부분실패 호환성 처리
// P3-3: 함수명 명확화 (Delete 응답만 처리)
function normalizeBulkDeleteResponse(result: any): {
  ok: boolean;
  deleted: { ids: number[]; count: number };
  count?: number;
} {
  if (Array.isArray(result.deleted)) {
    return {
      ok: result.ok,
      deleted: {
        ids: result.deleted,
        count: result.deleted.length
      },
      count: result.deleted.length
    };
  }
  return result;
}

// P2-7: 고유 key 생성 (partnerId 포함으로 race condition 방지)
function getAbortKey(action: string, partnerId?: string, id?: number): string {
  const parts = [action];
  if (partnerId) parts.push(partnerId);
  if (id) parts.push(String(id));
  return parts.join(':');
}

/**
 * API 요청 에러 클래스
 * - HTTP 상태 코드 포함
 * - 원인 에러 체인 가능
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public status?: number,
    public cause?: Error
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/**
 * 자동 취소 기능이 있는 Fetch
 * @template T 응답 데이터 타입
 * @param key 요청 키 (중복 요청 취소용)
 * @param url 요청 URL
 * @param options Fetch 옵션
 * @returns 응답 데이터 또는 null (요청 취소 시)
 * @throws FetchError (HTTP 에러 또는 기타 에러)
 *
 * 동작:
 * - 같은 key의 이전 요청 자동 취소
 * - 30초 타임아웃
 * - AbortError는 null 반환 (의도된 취소)
 * - 기타 에러는 throw
 */
async function fetchWithAbort<T>(
  key: string,
  url: string,
  options?: RequestInit
): Promise<T | null> {
  const prevController = abortControllerMap.get(key);
  if (prevController) {
    logger.debug('[fetchWithAbort] Canceling previous request', { key });
    prevController.abort();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  abortControllerMap.set(key, controller);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new FetchError(
        `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
        response.status
      );
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.debug('[fetchWithAbort] Request aborted', { key });
      return null;
    }

    if (error instanceof FetchError) {
      logger.warn('[fetchWithAbort] Fetch error', {
        key,
        status: error.status,
        message: error.message,
      });
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[fetchWithAbort] Unexpected error', {
      key,
      message: err.message,
    });
    throw err;
  } finally {
    clearTimeout(timeoutId);
    abortControllerMap.delete(key);
  }
}

/**
 * 고객 목록 조회 (필터링 및 페이지네이션)
 * @param partnerId 파트너 ID
 * @param filter 필터 옵션 (검색, 상태, 정렬)
 * @param pagination 페이지네이션 옵션 (기본값: page=1, pageSize=20)
 * @returns { customers, total } 또는 null (요청 취소 시)
 * @throws FetchError (HTTP 에러 또는 검증 실패)
 *
 * 입력 검증:
 * - partnerId 필수
 * - pageSize는 1-100 범위로 자동 조정
 * - page는 1 이상 필수
 */
export async function listCustomers(
  partnerId: string,
  filter: CustomerFilter = {},
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 20 }
): Promise<{ customers: Customer[]; total: number } | null> {
  // Input 검증
  if (!partnerId?.trim()) {
    throw new FetchError('partnerId is required');
  }

  if (pagination.page < 1 || pagination.pageSize < 1) {
    throw new FetchError('Invalid pagination parameters');
  }

  const params = new URLSearchParams({
    page: String(Math.max(1, pagination.page)),
    pageSize: String(Math.min(100, Math.max(1, pagination.pageSize))), // 1-100 범위
    search: filter.search?.trim() || '',
    status: filter.status || '',
    sortBy: filter.sortBy || 'createdAt',
    sortOrder: filter.sortOrder || 'desc',
  });

  const url = `/api/partner/${encodeURIComponent(partnerId)}/customers?${params.toString()}`;
  const key = getAbortKey('fetch-customers', partnerId);

  try {
    const data = await fetchWithAbort<FetchResult<Customer>>(
      key,
      url
    );

    // 요청이 취소된 경우
    if (!data) return null;

    // P2-6: 응답 정규화
    const { data: customers, total } = normalizeFetchListResponse(data);

    return { customers, total };
  } catch (error) {
    if (error instanceof FetchError) {
      throw error;
    }
    throw new FetchError('Failed to fetch customers', undefined, error as Error);
  }
}

/**
 * 고객 개별 조회
 * @param partnerId 파트너 ID
 * @param customerId 고객 ID
 * @returns 고객 정보 또는 null (요청 취소 시)
 * @throws FetchError (HTTP 에러)
 */
export async function fetchCustomerDetail(
  partnerId: string,
  customerId: number
): Promise<Customer | null> {
  // P2-7: partnerId 포함 고유 key
  const key = getAbortKey('fetch-customer-detail', partnerId, customerId);
  const data = await fetchWithAbort<Customer>(
    key,
    `/api/partner/${encodeURIComponent(partnerId)}/customers/${customerId}`
  );

  return data;
}

/**
 * 고객 개별 삭제
 * @param partnerId 파트너 ID
 * @param customerId 고객 ID
 * @returns { ok, message } 삭제 결과
 * @throws FetchError (HTTP 에러 또는 검증 실패)
 */
export async function deleteCustomer(
  partnerId: string,
  customerId: number
): Promise<{ ok: boolean; message?: string }> {
  if (!partnerId?.trim() || customerId < 1) {
    throw new FetchError('Invalid partnerId or customerId');
  }

  try {
    const response = await csrfFetch(
      `/api/partner/${encodeURIComponent(partnerId)}/customers/${customerId}`,
      {
        method: 'DELETE',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      throw new FetchError(`Delete failed with status ${response.status}`, response.status);
    }

    return response.json();
  } catch (error) {
    if (error instanceof FetchError) throw error;
    throw new FetchError('Delete failed', undefined, error as Error);
  }
}

/**
 * 고객 다중 삭제 (최대 100개)
 * @param partnerId 파트너 ID
 * @param customerIds 삭제할 고객 ID 배열 (최대 100개)
 * @returns { ok, deleted, message } 삭제 결과 (deleted: 실제 삭제된 ID)
 * @throws FetchError (배열 검증 실패, 100개 초과, HTTP 에러)
 *
 * 검증:
 * - 배열 필수, 최소 1개 필요
 * - 최대 100개 초과 금지
 * - 중복 제거 및 유효한 ID만 필터링
 */
export async function bulkDeleteCustomers(
  partnerId: string,
  customerIds: number[]
): Promise<{ ok: boolean; deleted: { ids: number[]; count: number }; count?: number }> {
  if (!partnerId?.trim()) {
    throw new FetchError('partnerId is required');
  }

  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    throw new FetchError('customerIds must be a non-empty array');
  }

  if (customerIds.length > 100) {
    throw new FetchError('Cannot delete more than 100 customers at once');
  }

  // 중복 제거 & 검증
  const uniqueIds = Array.from(new Set(customerIds.filter((id) => id > 0)));

  // P2-7: partnerId 포함 고유 key
  const key = getAbortKey('bulk-delete-customers', partnerId);

  try {
    const response = await csrfFetch(
      `/api/partner/${encodeURIComponent(partnerId)}/customers/bulk-delete`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: uniqueIds }),  // P2-8: leadIds → customerIds
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      throw new FetchError(
        `Bulk delete failed with status ${response.status}`,
        response.status
      );
    }

    const result = await response.json();

    // P2-10: 호환성 정규화 (구 형식 → 신 형식)
    const normalized = normalizeBulkDeleteResponse(result);

    return normalized;
  } catch (error) {
    if (error instanceof FetchError) throw error;
    throw new FetchError('Bulk delete failed', undefined, error as Error);
  }
}

/**
 * 고객 정보 수정
 * @param partnerId 파트너 ID
 * @param customerId 고객 ID
 * @param updates 수정할 필드 (부분 수정 가능)
 * @returns 수정된 고객 정보
 * @throws FetchError (HTTP 에러 또는 검증 실패)
 */
export async function updateCustomer(
  partnerId: string,
  customerId: number,
  updates: Partial<Customer>
): Promise<Customer> {
  // Input 검증
  if (!partnerId?.trim()) {
    throw new FetchError('partnerId is required');
  }

  if (customerId < 1) {
    throw new FetchError('Valid customerId is required');
  }

  if (!updates || typeof updates !== 'object') {
    throw new FetchError('updates must be a non-empty object');
  }

  const hasValidUpdate = Object.values(updates).some((v) => v !== undefined);
  if (!hasValidUpdate) {
    throw new FetchError('At least one field must be provided for update');
  }

  try {
    const response = await csrfFetch(
      `/api/partner/${encodeURIComponent(partnerId)}/customers/${customerId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new FetchError(
        `Update failed with status ${response.status}: ${errorText.substring(0, 100)}`,
        response.status
      );
    }

    const data = await response.json();

    // 응답 검증
    if (!data || typeof data !== 'object') {
      throw new FetchError('Invalid response from server');
    }

    return data as Customer;
  } catch (error) {
    if (error instanceof FetchError) {
      logger.warn('[updateCustomer] Fetch error', {
        customerId,
        status: error.status,
        message: error.message,
      });
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[updateCustomer] Unexpected error', {
      customerId,
      message: err.message,
    });
    throw new FetchError('Update failed', undefined, err);
  }
}
