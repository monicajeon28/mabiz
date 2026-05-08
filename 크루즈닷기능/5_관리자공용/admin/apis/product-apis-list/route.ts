export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 상품별 APIS 목록 조회 (고객 그룹 관리용)
 * GET /api/admin/apis/product-apis-list
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json(
        { ok: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // AffiliateProduct가 등록된 상품만 조회
    // 어필리에이트 수당이 설정된 상품만 APIS 확인 가능
    const now = new Date();

    // 먼저 유효한 AffiliateProduct 조회
    const activeAffiliateProducts = await prisma.affiliateProduct.findMany({
      where: {
        AND: [
          { status: 'active' },
          { isPublished: true },
          { effectiveFrom: { lte: now } },
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: now } },
            ],
          },
        ],
      },
      select: {
        productCode: true,
      },
    });

    const affiliateProductCodes = activeAffiliateProducts.map(ap => ap.productCode);

    // AffiliateProduct가 등록된 상품이 없으면 빈 배열 반환
    if (affiliateProductCodes.length === 0) {
      logger.log('[Product APIS List API] No active affiliate products found');
      return NextResponse.json({
        ok: true,
        apisData: [],
      });
    }

    // Trip과 연결된 상품만 조회 (실제 구매 고객이 있는 상품)
    // Trip 기준으로 조회하여 Reservation이 있는 상품만 표시
    const trips = await prisma.trip.findMany({
      where: {
        productCode: {
          in: affiliateProductCodes,
        },
      },
      include: {
        Reservation: {
          select: {
            id: true,
            totalPeople: true,
            pnrStatus: true,
            User: {
              select: {
                id: true,
                name: true,
              },
            },
            Traveler: {
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        departureDate: 'asc',
      },
    });

    // trips의 productCode로 CruiseProduct 조회
    const tripProductCodes = [...new Set(trips.map(t => t.productCode).filter(Boolean))] as string[];
    const cruiseProducts = await prisma.cruiseProduct.findMany({
      where: {
        productCode: { in: tripProductCodes },
      },
      select: {
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        startDate: true,
        endDate: true,
        saleStatus: true,
      },
    });

    // productCode로 빠르게 찾기 위한 맵 생성
    type CruiseProductInfo = typeof cruiseProducts[number];
    const productMap = new Map<string, CruiseProductInfo>(
      cruiseProducts.map(p => [p.productCode, p])
    );

    // 각 Trip별로 APIS 데이터 구성
    const apisData: any[] = [];

    for (const trip of trips) {
      const product = productMap.get(trip.productCode || '');
      if (!product) continue;

      // 실제 구매 고객 수 (예약 건수)
      const reservationCount = trip.Reservation.length;
      // 총 여행자 수 (모든 예약의 Traveler 합계)
      const travelerCount = trip.Reservation.reduce(
        (sum, res) => sum + res.Traveler.length,
        0
      );
      // PNR 완료 건수
      const pnrCompletedCount = trip.Reservation.filter(
        (res) => res.pnrStatus === 'completed'
      ).length;

      apisData.push({
        productCode: product.productCode,
        cruiseLine: product.cruiseLine,
        shipName: product.shipName,
        packageName: product.packageName,
        // 실제 구매 고객 수 (예약 건수)
        customerCount: reservationCount,
        // 총 여행자 수
        travelerCount: travelerCount,
        // PNR 완료 건수
        pnrCompletedCount: pnrCompletedCount,
        saleStatus: product.saleStatus,
        startDate: product.startDate?.toISOString() || null,
        endDate: product.endDate?.toISOString() || null,
        folderUrl: trip.googleFolderId
          ? `https://drive.google.com/drive/folders/${trip.googleFolderId}`
          : null,
        spreadsheetUrl: trip.spreadsheetId
          ? `https://docs.google.com/spreadsheets/d/${trip.spreadsheetId}`
          : null,
        tripId: trip.id,
      });
    }

    // 구매 고객이 없는 AffiliateProduct도 표시 (Trip이 없는 경우)
    const tripsProductCodes = trips.map(t => t.productCode).filter(Boolean) as string[];
    const productsWithoutTrip = await prisma.cruiseProduct.findMany({
      where: {
        productCode: {
          in: affiliateProductCodes.filter(code => !tripsProductCodes.includes(code)),
        },
        saleStatus: {
          in: ['판매중', '판매정지'],
        },
      },
    });

    for (const product of productsWithoutTrip) {
      apisData.push({
        productCode: product.productCode,
        cruiseLine: product.cruiseLine,
        shipName: product.shipName,
        packageName: product.packageName,
        customerCount: 0,
        travelerCount: 0,
        pnrCompletedCount: 0,
        saleStatus: product.saleStatus,
        startDate: product.startDate?.toISOString() || null,
        endDate: product.endDate?.toISOString() || null,
        folderUrl: null,
        spreadsheetUrl: null,
        tripId: null,
      });
    }

    // 출발일 기준으로 정렬
    apisData.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    return NextResponse.json({
      ok: true,
      apisData,
    });
  } catch (error: any) {
    logger.error('[Product APIS List API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'APIS 목록 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
