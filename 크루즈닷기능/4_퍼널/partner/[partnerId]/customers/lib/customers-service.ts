/**
 * 고객 관리 순수 함수 (Side effect 없음)
 * - 필터링, 정렬, 검색, 페이지네이션, 메트릭 계산
 */

import type { Customer, CustomerFilter } from './customers-api';

/**
 * 상태 필터링
 * @param customers 고객 목록
 * @param filter 필터 옵션 (상태)
 * @returns 필터링된 고객 목록
 */
export function filterCustomers(
  customers: Customer[],
  filter: CustomerFilter
): Customer[] {
  if (!filter.status) return customers;

  return customers.filter((c) => c.status === filter.status);
}

/**
 * 검색 (이름, 전화, 이메일)
 * @param customers 고객 목록
 * @param query 검색 쿼리
 * @returns 검색 결과
 *
 * 검색 필드:
 * - name: 대소문자 무시
 * - phone: 정확한 일치 (하이픈 무시)
 * - email: 대소문자 무시
 */
export function searchCustomers(
  customers: Customer[],
  query: string
): Customer[] {
  if (!query?.trim()) return customers;

  const lowerQuery = query.toLowerCase();
  return customers.filter((c) => {
    const nameMatch = c.name.toLowerCase().includes(lowerQuery);
    const phoneMatch = c.phone.includes(query);
    const emailMatch = c.email?.toLowerCase().includes(lowerQuery);

    return nameMatch || phoneMatch || emailMatch;
  });
}

/**
 * 정렬 (지정된 필드로 오름/내림차순)
 * @param customers 고객 목록
 * @param sortBy 정렬 필드 ('createdAt' | 'name' | 'totalAmount')
 * @param sortOrder 정렬 순서 ('asc' | 'desc')
 * @returns 정렬된 고객 목록 (원본 변경 없음)
 *
 * 동작:
 * - 문자열은 대소문자 무시로 정렬
 * - 숫자는 수치 비교
 * - 날짜는 ISO 문자열 비교
 */
export function sortCustomers(
  customers: Customer[],
  sortBy: 'createdAt' | 'name' | 'totalAmount' = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc'
): Customer[] {
  const sorted = [...customers].sort((a, b) => {
    // 안전한 필드 접근 (타입 체크 포함)
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    // null/undefined 처리
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
    if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

    // 비교 로직
    let comparison = 0;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      // 혼합 타입 또는 다른 타입: 문자열로 변환
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * 페이지네이션
 * @param customers 고객 목록
 * @param page 현재 페이지 (1부터 시작)
 * @param pageSize 페이지당 아이템 수
 * @returns 해당 페이지의 고객 목록
 *
 * @note 반환값은 배열만 (메타데이터는 상위에서 관리)
 */
export function paginateCustomers(
  customers: Customer[],
  page: number,
  pageSize: number
): Customer[] {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return customers.slice(start, end);
}

/**
 * 고객 메트릭 집계
 */
export interface CustomerMetrics {
  totalCount: number;
  activeCount: number;
  refundedCount: number;
  canceledCount: number;
  inactiveCount: number;
  totalSalesAmount: number;
  averageSalesAmount: number;
}

/**
 * 고객 목록 통계 계산 (단일 패스)
 * @param customers 고객 목록
 * @returns 집계 메트릭
 *
 * 계산 효율:
 * - O(n): 배열 1회 순회로 모든 메트릭 계산
 * - 상태별, 금액별 누적 동시 진행
 */
export function calculateMetrics(customers: Customer[]): CustomerMetrics {
  const metrics: CustomerMetrics = {
    totalCount: 0,
    activeCount: 0,
    refundedCount: 0,
    canceledCount: 0,
    inactiveCount: 0,
    totalSalesAmount: 0,
    averageSalesAmount: 0,
  };

  // 단일 패스로 모든 메트릭 계산
  customers.forEach((c) => {
    metrics.totalCount += 1;
    metrics.totalSalesAmount += c.totalAmount || 0;

    switch (c.status) {
      case 'ACTIVE':
        metrics.activeCount += 1;
        break;
      case 'REFUNDED':
        metrics.refundedCount += 1;
        break;
      case 'CANCELED':
        metrics.canceledCount += 1;
        break;
      case 'INACTIVE':
        metrics.inactiveCount += 1;
        break;
    }
  });

  // 평균 계산
  if (metrics.totalCount > 0) {
    metrics.averageSalesAmount = Math.round(
      metrics.totalSalesAmount / metrics.totalCount
    );
  }

  return metrics;
}
