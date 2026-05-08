/**
 * 고객 관리 커스텀 훅
 * - 필터링, 페이지네이션, 선택 상태 관리, 메트릭 계산
 */

import { useCallback, useRef, useMemo } from 'react';
import type { Customer, CustomerFilter } from './customers-api';
import {
  filterCustomers,
  sortCustomers,
  searchCustomers,
  paginateCustomers,
  calculateMetrics,
} from './customers-service';

/**
 * 고객 관리 Context 상태 인터페이스
 */
export interface CustomersContextType {
  customers: Customer[];
  selectedIds: number[];
  filter: CustomerFilter;
  page: number;
  pageSize: number;
  isLoading: boolean;
  totalCount: number;
}

/**
 * 필터링된 고객 목록 (검색, 상태 필터, 정렬)
 * @param customers 전체 고객 목록
 * @param filter 필터 옵션
 * @returns 필터링 및 정렬된 고객 목록
 *
 * 처리 순서 (중요: 이 순서를 지켜야 함):
 * 1. 검색어로 필터링 (name/phone/email) — 데이터셋 100→10으로 축소
 * 2. 상태로 필터링 — 10→5로 추가 축소
 * 3. 지정된 필드로 정렬 — 작은 세트(5개)만 정렬 = 빠름
 *
 * 만약 순서를 바꾸면 (예: 정렬 먼저) → 전체 100개 정렬 후 검색 = 낭비
 * 따라서 "데이터셋 축소 → 정렬" 순서가 필수
 * P3-4: 처리 순서 및 이유 명확화
 */
export function useCustomersFilter(
  customers: Customer[],
  filter: CustomerFilter
): Customer[] {
  const filtered = useMemo(() => {
    let result = customers;

    if (filter.search) {
      result = searchCustomers(result, filter.search);
    }

    if (filter.status) {
      result = filterCustomers(result, { status: filter.status });
    }

    result = sortCustomers(
      result,
      filter.sortBy || 'createdAt',
      filter.sortOrder || 'desc'
    );

    return result;
  }, [customers, filter]);

  return filtered;
}

/**
 * 페이지네이션된 고객 목록
 * @param customers 필터링된 고객 목록
 * @param page 현재 페이지 (1부터 시작)
 * @param pageSize 페이지 크기
 * @returns 해당 페이지의 고객 목록
 */
export function useCustomersPagination(
  customers: Customer[],
  page: number,
  pageSize: number
): Customer[] {
  const paginated = useMemo(() => {
    return paginateCustomers(customers, page, pageSize);
  }, [customers, page, pageSize]);

  return paginated;
}

/**
 * 고객 선택 상태 관리
 * @param initialIds 초기 선택 ID 배열
 * @returns 선택 상태 및 조작 함수
 *
 * 내부 상태는 useRef Set으로 관리 (re-render 미트리거)
 * 선택/취소/전체선택/전체취소 함수 제공
 * 각 함수는 현재 선택 ID 배열을 반환
 *
 * @note 이 함수는 Context 상태 변경과 함께 호출되어야 함
 * (Context dispatch 없이는 UI 업데이트 안 됨)
 */
/**
 * 고객 메트릭 계산 (총액, 거래수, 평균)
 * @param customers 고객 목록
 * @returns 집계 통계
 */
export function useCustomersMetrics(
  customers: Customer[]
): ReturnType<typeof calculateMetrics> {
  return useMemo(() => calculateMetrics(customers), [customers]);
}
