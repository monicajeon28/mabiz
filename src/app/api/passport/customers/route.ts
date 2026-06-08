export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

interface CustomerRecord {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  passportStatus: 'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED';
  isSubmitted: boolean;
  submittedAt: Date | null;
  tokenExpiresAt: Date | null;
}

interface TripData {
  id: number;
  cruiseName: string | null;
  shipName: string;
  productCode: string;
  departureDate: Date;
  destinationStr: string;
}

/**
 * GET /api/passport/customers
 * 상품별 고객 목록 + 여권 상태
 *
 * 권한: ADMIN | MANAGER
 * 응답 시간: < 2초 (고객 1000명)
 *
 * @query tripId - 상품 ID (필수)
 * @query filter - 필터: "all" (기본) | "missing" | "pending" | "submitted" | "approved"
 * @query search - 고객명/연락처 검색 (선택)
 * @query limit - 페이지당 개수 (기본값: 50, 최대: 200)
 * @query offset - 오프셋 (기본값: 0)
 */
export async function GET(req: NextRequest) {
  try {
    // 권한 검증
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 입력 검증
    const { searchParams } = new URL(req.url);
    const tripId = parseInt(searchParams.get('tripId') ?? '', 10);
    if (!tripId) {
      return NextResponse.json(
        { ok: false, error: 'tripId 필수' },
        { status: 400 }
      );
    }

    const filterParam = searchParams.get('filter') ?? 'all';
    const validFilters = ['all', 'missing', 'pending', 'submitted', 'approved'];
    const filter = validFilters.includes(filterParam)
      ? filterParam
      : 'all';

    const search = (searchParams.get('search')?.trim() ?? '').substring(0, 100);
    const limit = Math.min(
      parseInt(searchParams.get('limit') ?? '50', 10) || 50,
      200
    );
    const offset = Math.max(
      parseInt(searchParams.get('offset') ?? '0', 10) || 0,
      0
    );

    // 1️⃣ 상품 정보 조회
    const trip = await prisma.gmTrip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        cruiseName: true,
        shipName: true,
        productCode: true,
        departureDate: true,
        destination: true,
        reservations: {
          select: {
            id: true,
            mainUser: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2️⃣ 여권 상태 조회 (LEFT JOIN 최적화)
    const passportStatuses = await prisma.gmPassportSubmission.findMany({
      where: {
        tripId,
      },
      select: {
        userId: true,
        isSubmitted: true,
        submittedAt: true,
        tokenExpiresAt: true,
      },
    });

    // userId → passport 상태 매핑
    const passportMap = new Map<
      number,
      { isSubmitted: boolean; submittedAt: Date | null; tokenExpiresAt: Date | null }
    >();
    passportStatuses.forEach((ps) => {
      passportMap.set(ps.userId, {
        isSubmitted: ps.isSubmitted,
        submittedAt: ps.submittedAt,
        tokenExpiresAt: ps.tokenExpiresAt,
      });
    });

    // 3️⃣ 고객 목록 구성
    let customers: CustomerRecord[] = trip.reservations.map((res) => {
      const passport = passportMap.get(res.mainUser.id) || {
        isSubmitted: false,
        submittedAt: null,
        tokenExpiresAt: null,
      };

      // 여권 상태 결정 로직
      let passportStatus: 'MISSING' | 'PENDING' | 'SUBMITTED' | 'APPROVED' =
        'MISSING';
      if (passport.isSubmitted) {
        passportStatus = 'SUBMITTED';
      } else if (passport.tokenExpiresAt && passport.tokenExpiresAt > new Date()) {
        passportStatus = 'PENDING';
      }

      return {
        id: res.mainUser.id,
        name: res.mainUser.name,
        phone: res.mainUser.phone,
        email: res.mainUser.email,
        passportStatus,
        isSubmitted: passport.isSubmitted,
        submittedAt: passport.submittedAt,
        tokenExpiresAt: passport.tokenExpiresAt,
      };
    });

    // 4️⃣ 필터링 적용
    if (filter !== 'all') {
      customers = customers.filter((c) => c.passportStatus === filter.toUpperCase());
    }

    // 5️⃣ 검색 필터링
    if (search) {
      customers = customers.filter(
        (c) =>
          (c.name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (c.phone?.includes(search) ?? false) ||
          (c.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
      );
    }

    // 6️⃣ 정렬 및 페이지네이션
    const total = customers.length;
    const paginated = customers.slice(offset, offset + limit);

    // 7️⃣ 전화번호 마스킹
    const maskedCustomers = paginated.map((c) => ({
      ...c,
      phone: maskPhoneNumber(c.phone, manager.role ?? 'AGENT'),
    }));

    logger.log('[Passport API] GET /api/passport/customers', {
      manager: manager.id,
      tripId,
      filter,
      customerCount: maskedCustomers.length,
      total,
      search: search ? 'yes' : 'no',
    });

    const tripData: TripData = {
      id: trip.id,
      cruiseName: trip.cruiseName,
      shipName: trip.shipName,
      productCode: trip.productCode,
      departureDate: trip.departureDate,
      destinationStr: trip.destination
        ? typeof trip.destination === 'object'
          ? Object.values(trip.destination).join(', ')
          : String(trip.destination)
        : 'N/A',
    };

    return NextResponse.json({
      ok: true,
      trip: tripData,
      customers: maskedCustomers,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    logger.error('[Passport API] GET /api/passport/customers 실패', { error });
    return NextResponse.json(
      { ok: false, error: '고객 조회 실패' },
      { status: 500 }
    );
  }
}

/**
 * 전화번호 마스킹 함수
 * - GLOBAL_ADMIN, OWNER: 전체 공개
 * - 기타: 010-****-5678 형식으로 마스킹
 */
function maskPhoneNumber(phone: string | null, role: string | null): string | null {
  if (!phone) return null;

  // 관리자 권한: 전체 번호 공개
  if (['GLOBAL_ADMIN', 'OWNER'].includes(role ?? '')) return phone;

  // 숫자만 추출
  const digits = phone.replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    // 휴대전화: 010-****-5678
    return digits.slice(0, 3) + '-****-' + digits.slice(7);
  }

  if (digits.length === 10) {
    // 지역번호 (02-1234-5678): 02-****-5678
    return digits.slice(0, 2) + '-****-' + digits.slice(6);
  }

  // 기타: 부분 마스킹
  return digits.slice(0, 3) + '-****-****';
}
