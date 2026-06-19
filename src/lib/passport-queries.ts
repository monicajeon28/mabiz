/**
 * Passport Query Optimization Library
 * ===================================
 *
 * 성능 최적화 전략:
 * 1. SELECT 필드 제한 (불필요한 필드 제외)
 * 2. 필요시 조인 분리 (JOIN 폭발 방지)
 * 3. 인덱스 활용 (tripId, reservationId, travelerId)
 * 4. Pagination 적용 (offset/limit)
 * 5. 캐싱 고려 (Redis TTL 30분)
 *
 * 기대 성능:
 * - SELECT 500명: < 500ms (쿼리) + 200ms (계산) = < 700ms
 * - 필터링 (미제출자): < 100ms 추가
 * - 마스킹: < 50ms
 * 전체: < 2초 ✅
 */

import prisma from './prisma';
import { logger } from './logger';

// ============================================================
// Type Definitions
// ============================================================

export interface PassportProductData {
  id: number;
  cruiseName: string | null;
  shipName: string;
  productCode: string;
  departureDate: Date;
  destination: string;
  tripCount: number;
}

export interface PassportCustomerData {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  passportStatus: 'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED';
  isSubmitted: boolean;
  submittedAt: Date | null;
  tokenExpiresAt: Date | null;
}

export interface PassportStatusMap {
  [userId: number]: {
    isSubmitted: boolean;
    submittedAt: Date | null;
    tokenExpiresAt: Date | null;
  };
}

// ============================================================
// 1️⃣ Product Queries (최적화)
// ============================================================

/**
 * 판매 중인 상품 목록 조회 (최대 500개)
 *
 * 성능: < 100ms (인덱스 사용)
 * 인덱스: idx_trip_status_departure
 */
export async function getProductsByTripId(
  tripId: number,
  options?: { limit?: number; offset?: number }
) {
  const start = Date.now();

  try {
    const product = await prisma.gmTrip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        cruiseName: true,
        shipName: true,
        productCode: true,
        departureDate: true,
        destination: true,
        // 예약 수 계산 (조인 폭발 방지)
        _count: {
          select: { reservations: true },
        },
      },
    });

    if (!product) {
      return null;
    }

    const elapsed = Date.now() - start;
    logger.debug(`getProductsByTripId: ${elapsed}ms`);

    return {
      id: product.id,
      cruiseName: product.cruiseName,
      shipName: product.shipName,
      productCode: product.productCode,
      departureDate: product.departureDate,
      destination: JSON.stringify(product.destination || {}),
      tripCount: product._count.reservations,
    };
  } catch (error) {
    logger.error('getProductsByTripId error:', error);
    throw error;
  }
}

// ============================================================
// 2️⃣ Customer Queries (최적화)
// ============================================================

/**
 * 상품별 고객 목록 조회 (pagination + 필터링)
 *
 * 성능: < 500ms (쿼리) + 200ms (계산) = < 700ms
 *
 * 최적화 포인트:
 * - 필드 제한 (SELECT: id, name, phone, email만)
 * - 조인 분리 (Passport 별도 쿼리)
 * - Pagination (offset + limit)
 * - 인덱스: (tripId) on Reservation
 *
 * @param tripId - 상품 ID
 * @param filter - "all" | "missing" | "pending" | "submitted" | "approved"
 * @param search - 고객명/연락처 검색
 * @param limit - 페이지당 개수 (기본: 50, 최대: 200)
 * @param offset - 오프셋 (기본: 0)
 */
export async function getCustomersByTripId(
  tripId: number,
  filter: string = 'all',
  search: string = '',
  limit: number = 50,
  offset: number = 0
) {
  const start = Date.now();

  try {
    // 입력 검증
    limit = Math.min(Math.max(limit, 1), 200);
    offset = Math.max(offset, 0);

    // Step 1️⃣: 예약 조회 (Reservation 테이블 - tripId 인덱스 사용)
    const reservations = await prisma.gmReservation.findMany({
      where: {
        tripId: tripId,
      },
      select: {
        id: true,
        mainUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const queryElapsed1 = Date.now() - start;
    logger.debug(`Step 1 (Reservation): ${queryElapsed1}ms, rows: ${reservations.length}`);

    if (reservations.length === 0) {
      return [];
    }

    // Step 2️⃣: 여권 상태 조회 (별도 쿼리 - 조인 폭발 방지)
    const userIds = reservations.map((r) => r.mainUser.id);
    const passportStatuses = await prisma.gmPassportSubmission.findMany({
      where: {
        tripId: tripId,
        userId: { in: userIds },
      },
      select: {
        userId: true,
        isSubmitted: true,
        submittedAt: true,
        tokenExpiresAt: true,
      },
    });

    const queryElapsed2 = Date.now() - start;
    logger.debug(`Step 2 (Passport): ${queryElapsed2 - queryElapsed1}ms, rows: ${passportStatuses.length}`);

    // Step 3️⃣: 메모리에서 상태 매핑 (< 50ms for 500 rows)
    const passportMap = buildPassportMap(passportStatuses);
    const customers = reservations.map((res) =>
      buildCustomerRecord(res, passportMap)
    );

    // Step 4️⃣: 필터링 (메모리)
    const filtered = applyFilter(customers, filter);

    // Step 5️⃣: 검색 필터링 (메모리)
    const searched = applySearch(filtered, search);

    const totalElapsed = Date.now() - start;
    logger.info(
      `getCustomersByTripId: ${totalElapsed}ms (query: ${queryElapsed2}ms, memory: ${totalElapsed - queryElapsed2}ms), rows: ${searched.length}`
    );

    return searched;
  } catch (error) {
    logger.error('getCustomersByTripId error:', error);
    throw error;
  }
}

/**
 * 특정 고객 상세 조회
 *
 * 성능: < 100ms
 * 인덱스: PRIMARY KEY (id) on User
 */
export async function getCustomerDetail(
  tripId: number,
  userId: number
) {
  const start = Date.now();

  try {
    // 예약 정보
    const reservation = await prisma.gmReservation.findFirst({
      where: {
        tripId: tripId,
        mainUserId: userId,
      },
      select: {
        id: true,
        totalPeople: true,
        paymentDate: true,
        paymentAmount: true,
        mainUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!reservation) {
      return null;
    }

    // 여권 상태
    const passport = await prisma.gmPassportSubmission.findFirst({
      where: {
        tripId: tripId,
        userId: userId,
      },
      select: {
        isSubmitted: true,
        submittedAt: true,
        tokenExpiresAt: true,
      },
    });

    const elapsed = Date.now() - start;
    logger.debug(`getCustomerDetail: ${elapsed}ms`);

    return {
      ...reservation.mainUser,
      totalPeople: reservation.totalPeople,
      paymentDate: reservation.paymentDate,
      paymentAmount: reservation.paymentAmount,
      passport: passport || {
        isSubmitted: false,
        submittedAt: null,
        tokenExpiresAt: null,
      },
    };
  } catch (error) {
    logger.error('getCustomerDetail error:', error);
    throw error;
  }
}

/**
 * 여권 미제출자 조회 (with 여권 요청 발송 추적)
 *
 * 성능: < 300ms
 * 인덱스: idx_PassportSubmission_isSubmitted + idx_Reservation_tripId
 */
export async function getUnsubmittedCustomers(
  tripId: number,
  limit: number = 50,
  offset: number = 0
) {
  const start = Date.now();

  try {
    // Step 1: 여권 미제출 사용자 조회
    const unsubmitted = await prisma.gmPassportSubmission.findMany({
      where: {
        tripId: tripId,
        isSubmitted: false,
      },
      select: {
        userId: true,
        tokenExpiresAt: true,
      },
      take: limit,
      skip: offset,
    });

    const userIds = unsubmitted.map((p) => p.userId);

    if (userIds.length === 0) {
      return [];
    }

    // Step 2: 사용자 정보 조회
    const users = await prisma.gmUser.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    const elapsed = Date.now() - start;
    logger.debug(`getUnsubmittedCustomers: ${elapsed}ms, rows: ${users.length}`);

    // 매핑
    const passportMap = new Map(
      unsubmitted.map((p) => [p.userId, { tokenExpiresAt: p.tokenExpiresAt }])
    );

    return users.map((user) => ({
      ...user,
      tokenExpiresAt: passportMap.get(user.id)?.tokenExpiresAt || null,
    }));
  } catch (error) {
    logger.error('getUnsubmittedCustomers error:', error);
    throw error;
  }
}

/**
 * 여권 제출 현황 통계
 *
 * 성능: < 200ms
 * 사용 인덱스: idx_gmPassportSubmission_tripId_isSubmitted
 */
export async function getPassportStats(tripId: number) {
  const start = Date.now();

  try {
    const stats = await prisma.gmPassportSubmission.groupBy({
      by: ['isSubmitted'],
      where: { tripId },
      _count: true,
    });

    const result = {
      total: 0,
      submitted: 0,
      pending: 0,
      missing: 0,
    };

    stats.forEach((stat) => {
      if (stat.isSubmitted) {
        result.submitted = stat._count;
      } else {
        result.pending = stat._count;
      }
      result.total += stat._count;
    });

    // Missing = 여권 기록 없는 탑승객
    const allReservations = await prisma.gmReservation.count({
      where: { tripId },
    });
    result.missing = allReservations - result.total;

    const elapsed = Date.now() - start;
    logger.debug(`getPassportStats: ${elapsed}ms`);

    return result;
  } catch (error) {
    logger.error('getPassportStats error:', error);
    throw error;
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 여권 상태 맵 생성
 *
 * @param statuses - 여권 상태 배열
 * @returns userId → { isSubmitted, submittedAt, tokenExpiresAt } 맵
 */
function buildPassportMap(
  statuses: Array<{
    userId: number;
    isSubmitted: boolean;
    submittedAt: Date | null;
    tokenExpiresAt: Date | null;
  }>
): PassportStatusMap {
  const map: PassportStatusMap = {};
  statuses.forEach((status) => {
    map[status.userId] = {
      isSubmitted: status.isSubmitted,
      submittedAt: status.submittedAt,
      tokenExpiresAt: status.tokenExpiresAt,
    };
  });
  return map;
}

/**
 * 고객 레코드 생성
 *
 * @param reservation - 예약 정보
 * @param passportMap - 여권 상태 맵
 * @returns 고객 레코드
 */
function buildCustomerRecord(
  reservation: {
    id: number;
    mainUser: {
      id: number;
      name: string | null;
      phone: string | null;
      email: string | null;
    };
  },
  passportMap: PassportStatusMap
): PassportCustomerData {
  const passport = passportMap[reservation.mainUser.id] || {
    isSubmitted: false,
    submittedAt: null,
    tokenExpiresAt: null,
  };

  // 여권 상태 결정 로직
  let passportStatus: 'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED' =
    'MISSING';

  if (passport.isSubmitted) {
    passportStatus = 'SUBMITTED';
  } else if (
    passport.tokenExpiresAt &&
    passport.tokenExpiresAt > new Date()
  ) {
    passportStatus = 'PENDING';
  }

  return {
    id: reservation.mainUser.id,
    name: reservation.mainUser.name,
    phone: reservation.mainUser.phone,
    email: reservation.mainUser.email,
    passportStatus,
    isSubmitted: passport.isSubmitted,
    submittedAt: passport.submittedAt,
    tokenExpiresAt: passport.tokenExpiresAt,
  };
}

/**
 * 필터 적용 (메모리)
 *
 * @param customers - 고객 배열
 * @param filter - "all" | "missing" | "pending" | "submitted" | "approved"
 * @returns 필터된 고객 배열
 */
function applyFilter(
  customers: PassportCustomerData[],
  filter: string
): PassportCustomerData[] {
  switch (filter) {
    case 'missing':
      return customers.filter((c) => c.passportStatus === 'MISSING');
    case 'pending':
      return customers.filter((c) => c.passportStatus === 'PENDING');
    case 'submitted':
      return customers.filter((c) => c.passportStatus === 'SUBMITTED');
    case 'approved':
      return customers.filter((c) => c.passportStatus === 'APPROVED');
    default:
      return customers;
  }
}

/**
 * 검색 필터링 (메모리 - 기본 LIKE 검색)
 *
 * @param customers - 고객 배열
 * @param search - 검색어 (고객명/연락처)
 * @returns 검색된 고객 배열
 */
function applySearch(
  customers: PassportCustomerData[],
  search: string
): PassportCustomerData[] {
  if (!search || search.length === 0) {
    return customers;
  }

  const query = search.toLowerCase();
  return customers.filter(
    (c) =>
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.phone && c.phone.includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
  );
}

/**
 * 전화번호 마스킹
 * 예: 010-1234-5678 → 010-****-5678
 *
 * @param phone - 전화번호
 * @returns 마스킹된 전화번호
 */
export function maskPhoneNumber(phone: string | null): string | null {
  if (!phone) return null;
  // 010-1234-5678 형태 가정
  const match = phone.match(/(\d{3})-?(\d{4})-?(\d{4})/);
  if (!match) return phone; // 형식 맞지 않으면 그냥 반환
  return `${match[1]}-****-${match[3]}`;
}

/**
 * 성능 벤치마크 함수
 *
 * 테스트 데이터:
 * - Trip: 1개
 * - Reservation: 100개
 * - Traveler: 500명
 *
 * 기대 시간:
 * - getProducts: < 100ms
 * - getCustomers: < 700ms
 * - getPassportStats: < 200ms
 * - 전체: < 2초
 */
export async function benchmarkQueries(tripId: number) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('=== Passport Query Benchmark ===\n');

  const results = {
    getProductsByTripId: 0,
    getCustomersByTripId: 0,
    getPassportStats: 0,
    total: 0,
  };

  // 1. Products 조회
  const t1 = Date.now();
  const products = await getProductsByTripId(tripId);
  results.getProductsByTripId = Date.now() - t1;
  console.log(`1. getProductsByTripId: ${results.getProductsByTripId}ms`);
  console.log(`   Product: ${products?.cruiseName} (${products?.tripCount} 명)\n`);

  // 2. Customers 조회 (500명)
  const t2 = Date.now();
  const customers = await getCustomersByTripId(tripId, 'all', '', 500, 0);
  results.getCustomersByTripId = Date.now() - t2;
  console.log(`2. getCustomersByTripId: ${results.getCustomersByTripId}ms`);
  console.log(`   Customers: ${customers.length} 명`);
  console.log(`   상태: ${customers.filter((c) => c.isSubmitted).length}명 제출\n`);

  // 3. 여권 통계
  const t3 = Date.now();
  const stats = await getPassportStats(tripId);
  results.getPassportStats = Date.now() - t3;
  console.log(`3. getPassportStats: ${results.getPassportStats}ms`);
  console.log(`   Total: ${stats.total}, Submitted: ${stats.submitted}, Missing: ${stats.missing}\n`);

  // 4. 전체 시간
  results.total = results.getProductsByTripId + results.getCustomersByTripId + results.getPassportStats;
  console.log(`=== TOTAL TIME: ${results.total}ms ===`);
  console.log(`Status: ${results.total < 2000 ? '✅ PASS' : '❌ FAIL'} (목표: < 2초)\n`);

  return results;
}
