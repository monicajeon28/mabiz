export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 상품별 구매 고객 목록 조회
 * GET /api/admin/apis/product-customers?productCode=XXX
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

    const { searchParams } = new URL(req.url);
    const productCode = searchParams.get('productCode');

    if (!productCode) {
      return NextResponse.json(
        { ok: false, message: 'productCode는 필수입니다.' },
        { status: 400 }
      );
    }

    // 해당 상품의 Trip 조회
    const trip = await prisma.trip.findUnique({
      where: { productCode },
      select: { id: true },
    });

    if (!trip) {
      return NextResponse.json({
        ok: true,
        customers: [],
        total: 0,
        message: '해당 상품의 Trip이 없습니다.',
      });
    }

    // 상품별 구매 고객 조회 (Reservation 기준 - 실제 결제 완료된 고객)
    const reservations = await prisma.reservation.findMany({
      where: {
        tripId: trip.id,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        Trip: {
          select: {
            id: true,
            departureDate: true,
            productCode: true,
            shipName: true,
          },
        },
        Traveler: {
          select: {
            id: true,
            korName: true,
            engSurname: true,
            engGivenName: true,
            passportNo: true,
            passportImage: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // productCode로 CruiseProduct 조회 (상품 정보 가져오기)
    const cruiseProduct = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: {
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        startDate: true,
        endDate: true,
      },
    });

    const customers = reservations.map((reservation) => ({
      userId: reservation.User.id,
      name: reservation.User.name,
      phone: reservation.User.phone,
      email: reservation.User.email,
      reservationId: reservation.id,
      tripId: reservation.tripId,
      productCode: productCode,
      cruiseLine: cruiseProduct?.cruiseLine,
      shipName: cruiseProduct?.shipName || reservation.Trip?.shipName,
      packageName: cruiseProduct?.packageName,
      startDate: cruiseProduct?.startDate,
      endDate: cruiseProduct?.endDate,
      // 예약 정보
      totalPeople: reservation.totalPeople,
      cabinType: reservation.cabinType,
      pnrStatus: reservation.pnrStatus,
      createdAt: reservation.createdAt,
      // 여행자 수
      travelerCount: reservation.Traveler.length,
      // 여권 입력 완료 여부
      passportCompleted: reservation.Traveler.every(t => t.passportNo),
      // 여행자 목록 요약
      travelers: reservation.Traveler.map(t => ({
        id: t.id,
        korName: t.korName,
        engName: `${t.engSurname} ${t.engGivenName}`.trim(),
        hasPassport: !!t.passportNo,
        passportImage: t.passportImage,
      })),
    }));

    return NextResponse.json({
      ok: true,
      customers,
      total: customers.length,
    });
  } catch (error: any) {
    logger.error('[Product Customers API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: '고객 목록 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
