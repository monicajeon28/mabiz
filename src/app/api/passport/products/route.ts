export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

interface ProductData {
  id: number;
  cruiseName: string | null;
  shipName: string;
  productCode: string;
  departureDate: Date;
  destinationStr: string;
  tripCount: number;
}

/**
 * GET /api/passport/products
 * 판매 중인 상품 목록 (최대 500개)
 *
 * 권한: ADMIN | MANAGER
 * 응답 시간: < 1초
 *
 * @query search - 상품명/선박명 검색 (선택)
 * @query limit - 페이지당 개수 (기본값: 50, 최대: 200)
 * @query offset - 오프셋 (기본값: 0)
 * @query sortBy - 정렬: "departureDate" (기본) | "tripCount" | "cruiseName"
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
    const search = (searchParams.get('search')?.trim() ?? '').substring(0, 100);
    const limit = Math.min(
      parseInt(searchParams.get('limit') ?? '50', 10) || 50,
      200
    );
    const offset = Math.max(
      parseInt(searchParams.get('offset') ?? '0', 10) || 0,
      0
    );
    const sortBy = ['departureDate', 'tripCount', 'cruiseName'].includes(
      searchParams.get('sortBy') ?? ''
    )
      ? (searchParams.get('sortBy') as 'departureDate' | 'tripCount' | 'cruiseName')
      : 'departureDate';

    // 1️⃣ 상품 조회 (GmTrip 기반)
    const whereClause = {
      status: { not: 'Cancelled' as const },
      ...(search
        ? {
            OR: [
              { cruiseName: { contains: search, mode: 'insensitive' as const } },
              { shipName: { contains: search, mode: 'insensitive' as const } },
              { productCode: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // tripCount 정렬이면 offset+limit 범위보다 더 많이 조회 후 메모리에서 정렬
    const multiplier = sortBy === 'tripCount' ? 2 : 1;

    const trips = await prisma.gmTrip.findMany({
      where: whereClause,
      select: {
        id: true,
        cruiseName: true,
        shipName: true,
        productCode: true,
        departureDate: true,
        destination: true,
        reservations: { select: { id: true } },
      },
      orderBy:
        sortBy === 'departureDate'
          ? { departureDate: 'asc' }
          : { cruiseName: 'asc' },
      take: limit * multiplier,
      skip: sortBy === 'tripCount' ? 0 : offset, // tripCount 정렬 시 먼저 많이 조회
    });

    // tripCount 정렬은 메모리에서 처리
    if (sortBy === 'tripCount') {
      trips.sort((a, b) => b.reservations.length - a.reservations.length);
    }

    // 최종 페이지네이션
    const finalTrips = trips.slice(offset, offset + limit);

    // 2️⃣ 응답 포맷팅
    const products: ProductData[] = finalTrips.map((trip) => ({
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
      tripCount: trip.reservations.length,
    }));

    // 3️⃣ 총 개수 조회 (선택, 성능상 필요 시에만)
    const total = await prisma.gmTrip.count({
      where: {
        AND: [
          { status: { not: 'Cancelled' } },
          search
            ? {
                OR: [
                  { cruiseName: { contains: search, mode: 'insensitive' } },
                  { shipName: { contains: search, mode: 'insensitive' } },
                  { productCode: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
    });

    logger.log('[Passport API] GET /api/passport/products', {
      manager: manager.id,
      count: products.length,
      total,
      search: search ? 'yes' : 'no',
      offset,
    });

    return NextResponse.json({
      ok: true,
      products,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    logger.error('[Passport API] GET /api/passport/products 실패', { error });
    return NextResponse.json(
      { ok: false, error: '상품 조회 실패' },
      { status: 500 }
    );
  }
}
