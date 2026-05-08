export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeItineraryPattern, extractDestinationsFromItineraryPattern, extractVisitedCountriesFromItineraryPattern } from '@/lib/utils/itineraryPattern';
import { syncApisSpreadsheet } from '@/lib/google-sheets';

/**
 * POST /api/admin/assign-trip
 * 관리자가 사용자에게 여행 배정
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const { userId, productId, startDate } = await req.json();

    // 필수 필드 검증
    if (!userId || !productId || !startDate) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 상품 조회
    const product = await prisma.cruiseProduct.findUnique({
      where: { id: parseInt(productId) },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    // 사용자 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        role: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { ok: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // 종료일 계산
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + product.days - 1);

    // 목적지 배열 생성
    const itineraryPattern = normalizeItineraryPattern(product.itineraryPattern);
    const destinations = extractDestinationsFromItineraryPattern(product.itineraryPattern);
    const visitedCountries = extractVisitedCountriesFromItineraryPattern(product.itineraryPattern);

    // Trip 생성
    const trip = await prisma.trip.create({
      data: {
        userId: targetUser.id,
        productId: product.id,
        cruiseName: `${product.cruiseLine} ${product.shipName}`,
        packageName: product.packageName,
        nights: product.nights,
        days: product.days,
        startDate: start,
        endDate: end,
        destinations,
        status: start > new Date() ? 'Upcoming' : 'InProgress',
        reservationCode: product.productCode,
      },
    });

    // Itinerary 생성
    if (itineraryPattern.length > 0) {
      const itineraries = itineraryPattern.map((pattern: any) => {
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + pattern.day - 1);

        return {
          tripId: trip.id,
          day: pattern.day,
          date: dayDate,
          type: pattern.type,
          location: pattern.location || null,
          country: pattern.country || null,
          currency: pattern.currency || null,
          language: pattern.language || null,
          arrival: pattern.arrival || null,
          departure: pattern.departure || null,
        };
      });

      await prisma.itinerary.createMany({
        data: itineraries,
      });
    }

    // VisitedCountry 업데이트
    for (const [countryCode, countryInfo] of visitedCountries) {
      await prisma.visitedCountry.upsert({
        where: {
          userId_countryCode: {
            userId: targetUser.id,
            countryCode,
          },
        },
        update: {
          visitCount: { increment: 1 },
          lastVisited: start,
        },
        create: {
          userId: targetUser.id,
          countryCode,
          countryName: countryInfo.name,
          visitCount: 1,
          lastVisited: start,
        },
      });
    }

    // User.totalTripCount 증가 및 onboarded 설정
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        totalTripCount: { increment: 1 },
        onboarded: true,
      },
    });

    // APIS 스프레드시트 자동 생성 (비동기, 실패해도 계속 진행)
    try {
      const apisResult = await syncApisSpreadsheet(trip.id);
      if (apisResult.ok) {
        console.log(`[Assign Trip] APIS 스프레드시트 생성 완료: tripId=${trip.id}, spreadsheetId=${apisResult.spreadsheetId}`);
      } else {
        console.warn(`[Assign Trip] APIS 스프레드시트 생성 실패: ${apisResult.error}`);
      }
    } catch (apisError) {
      // APIS 생성 실패해도 여행 배정은 성공으로 처리
      console.error(`[Assign Trip] APIS 스프레드시트 생성 중 오류:`, apisError);
    }

    // 연동된 크루즈몰 사용자 상태 자동 활성화
    try {
      // 크루즈가이드 사용자이고 연동된 크루즈몰 사용자가 있는 경우
      if (targetUser.role === 'user') {
        const genieUser = await prisma.user.findUnique({
          where: { id: targetUser.id },
          select: {
            id: true,
            role: true,
            mallUserId: true,
          },
        });

        if (genieUser && genieUser.mallUserId) {
          const mallUserIdNum = parseInt(genieUser.mallUserId);
          let linkedMallUserId = null;

          if (!isNaN(mallUserIdNum)) {
            linkedMallUserId = mallUserIdNum;
          } else {
            // phone으로 찾기
            const mallUser = await prisma.user.findFirst({
              where: {
                phone: genieUser.mallUserId,
                role: 'community',
              },
              select: { id: true },
            });
            if (mallUser) {
              linkedMallUserId = mallUser.id;
            }
          }

          if (linkedMallUserId) {
            // 연동된 크루즈몰 사용자 상태 활성화
            await prisma.user.update({
              where: { id: linkedMallUserId },
              data: {
                isLocked: false,
                lockedAt: null,
                lockedReason: null,
                isHibernated: false,
                hibernatedAt: null,
                customerStatus: 'active',
                lastActiveAt: new Date(),
              },
            });
            console.log(`[Assign Trip] 연동된 크루즈몰 사용자 (ID: ${linkedMallUserId}) 상태 활성화 완료`);
          }
        }
      }
    } catch (error) {
      console.error('[Assign Trip] 연동된 크루즈몰 사용자 상태 활성화 실패:', error);
      // 에러가 발생해도 여행 배정은 계속 진행
    }

    return NextResponse.json({
      ok: true,
      message: '여행이 배정되었습니다.',
      trip: {
        id: trip.id,
        cruiseName: trip.cruiseName,
        startDate: trip.startDate,
        endDate: trip.endDate,
      }
    });

  } catch (error: any) {
    console.error('POST /api/admin/assign-trip error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
