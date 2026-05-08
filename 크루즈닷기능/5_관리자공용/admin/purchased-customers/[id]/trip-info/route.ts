export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * GET /api/admin/purchased-customers/[id]/trip-info
 * 구매 고객의 Reservation과 Trip 정보 조회
 */
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User?.role === 'admin';
  } catch (error) {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // 구매 고객 확인 (customerStatus가 'purchase_confirmed')
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        customerStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 최신 Reservation 조회
    const reservation = await prisma.reservation.findFirst({
      where: { mainUserId: userId },
      include: {
        Trip: {
          include: {
            CruiseProduct: {
              select: {
                id: true,
                productCode: true,
                cruiseLine: true,
                shipName: true,
                packageName: true,
                nights: true,
                days: true,
                itineraryPattern: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!reservation || !reservation.Trip) {
      return NextResponse.json({
        ok: true,
        hasReservation: false,
        message: '예약 정보가 없습니다.',
      });
    }

    const trip = reservation.Trip;
    const product = trip.CruiseProduct;

    if (!product) {
      return NextResponse.json({
        ok: true,
        hasReservation: true,
        hasProduct: false,
        message: '상품 정보가 없습니다.',
      });
    }

    // 목적지 추출
    let destination = '';
    if (product.itineraryPattern && Array.isArray(product.itineraryPattern)) {
      const countries = new Set<string>();
      const countryNameMap: Record<string, string> = {
        'JP': '일본', 'TH': '태국', 'VN': '베트남', 'MY': '말레이시아',
        'SG': '싱가포르', 'ES': '스페인', 'FR': '프랑스', 'IT': '이탈리아',
        'GR': '그리스', 'TR': '터키', 'US': '미국', 'CN': '중국',
        'TW': '대만', 'HK': '홍콩', 'PH': '필리핀', 'ID': '인도네시아'
      };

      product.itineraryPattern.forEach((day: any) => {
        if (day.country && day.country !== 'KR') {
          const countryName = countryNameMap[day.country] || day.location || day.country;
          countries.add(countryName);
        }
      });

      destination = Array.from(countries).join(', ');
    }

    // 크루즈명 생성
    let cruiseName = '';
    if (product.cruiseLine && product.shipName) {
      const shipName = product.shipName.startsWith(product.cruiseLine)
        ? product.shipName.replace(product.cruiseLine, '').trim()
        : product.shipName;
      cruiseName = `${product.cruiseLine} ${shipName}`.trim();
    } else {
      cruiseName = product.cruiseLine || product.shipName || product.packageName;
    }

    // 날짜 정보
    const startDate = trip.startDate ? trip.startDate.toISOString().split('T')[0] : (product.startDate ? new Date(product.startDate).toISOString().split('T')[0] : '');
    const endDate = trip.endDate ? trip.endDate.toISOString().split('T')[0] : (product.endDate ? new Date(product.endDate).toISOString().split('T')[0] : '');

    return NextResponse.json({
      ok: true,
      hasReservation: true,
      hasProduct: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
      product: {
        id: product.id,
        productCode: product.productCode,
        cruiseLine: product.cruiseLine,
        shipName: product.shipName,
        packageName: product.packageName,
        nights: product.nights,
        days: product.days,
        itineraryPattern: product.itineraryPattern,
      },
      trip: {
        id: trip.id,
        cruiseName: cruiseName,
        startDate: startDate,
        endDate: endDate,
        companionType: trip.companionType,
        destination: destination,
      },
    });
  } catch (error: any) {
    console.error('[Purchase Customer Trip Info] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
