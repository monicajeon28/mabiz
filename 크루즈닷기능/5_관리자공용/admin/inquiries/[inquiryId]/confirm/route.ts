export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { syncApisSpreadsheet } from '@/lib/google-sheets';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 관리자가 ProductInquiry를 구매 확정 처리
 * - status를 'confirmed'로 변경
 * - 사용자 찾기 또는 생성 (이름, 연락처로)
 * - 비밀번호를 3800으로 변경
 * - 상품 정보로 Trip 생성 및 온보딩 자동 생성
 * - tripCount >= 2이면 RePurchaseTrigger 생성 및 converted: true 설정
 */
async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (session && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    console.error('[Admin Auth] Error:', error);
  }

  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const inquiryId = parseInt(params.inquiryId);
    if (isNaN(inquiryId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid inquiry ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { startDate } = body; // 여행 시작일 (필수)

    if (!startDate) {
      return NextResponse.json(
        { ok: false, error: 'startDate is required' },
        { status: 400 }
      );
    }

    // ProductInquiry 조회
    const inquiry = await prisma.productInquiry.findUnique({
      where: { id: inquiryId },
      include: {
        Product: true,
        User: true,
      },
    });

    if (!inquiry) {
      return NextResponse.json(
        { ok: false, error: 'Inquiry not found' },
        { status: 404 }
      );
    }

    if (inquiry.status === 'confirmed') {
      return NextResponse.json(
        { ok: false, error: '이미 구매 확정된 문의입니다.' },
        { status: 400 }
      );
    }

    // 사용자 찾기 또는 생성 (이름, 연락처로)
    let user = inquiry.User;
    
    if (!user) {
      // 기존 사용자 찾기 (이름과 연락처로)
      user = await prisma.user.findFirst({
        where: {
          name: inquiry.name,
          phone: inquiry.phone,
          role: 'user',
        },
      });

      // 사용자가 없으면 생성
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: inquiry.name,
            phone: inquiry.phone,
            password: '3800',
            role: 'user',
            onboarded: false,
            tripCount: 0,
          },
        });
      }
    }

    // 비밀번호 이벤트 기록 (8300에서 3800으로 변경)
    if (user.password !== '3800') {
      await prisma.passwordEvent.create({
        data: {
          userId: user.id,
          from: user.password,
          to: '3800',
          reason: '구매 확정 - 크루즈 가이드 지니 활성화',
        },
      });
    }

    // 비밀번호를 3800으로 변경
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: '3800',
        onboarded: false, // 새 여행이므로 온보딩 다시
        loginCount: 0,
      },
    });

    // 여행 종료일 계산
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + inquiry.Product.days - 1);

    // 목적지 배열 생성
    const destinations: string[] = [];
    if (Array.isArray(inquiry.Product.itineraryPattern)) {
      inquiry.Product.itineraryPattern.forEach((day: any) => {
        if (day.location && day.type === 'PortVisit') {
          destinations.push(day.location);
        }
      });
    }

    // Trip 생성
    const trip = await prisma.trip.create({
      data: {
        userId: user.id,
        cruiseName: `${inquiry.Product.cruiseLine} ${inquiry.Product.shipName}`,
        companionType: null,
        destination: destinations,
        startDate: start,
        endDate: end,
        nights: inquiry.Product.nights,
        days: inquiry.Product.days,
        visitCount: destinations.length,
        status: 'Upcoming',
      },
    });

    // Itinerary 자동 생성
    if (Array.isArray(inquiry.Product.itineraryPattern)) {
      const itineraryData = inquiry.Product.itineraryPattern as any[];
      for (let i = 0; i < itineraryData.length; i++) {
        const dayData = itineraryData[i];
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + i);

        await prisma.itinerary.create({
          data: {
            tripId: trip.id,
            day: i + 1,
            date: dayDate,
            type: dayData.type || 'Cruising',
            location: dayData.location || null,
            country: dayData.country || null,
            currency: dayData.currency || null,
            language: dayData.language || null,
            arrival: dayData.arrival || null,
            departure: dayData.departure || null,
          },
        });
      }
    }

    // VisitedCountry 업데이트 (PortVisit, Embarkation, Disembarkation 모두 포함, 한국 제외)
    if (Array.isArray(inquiry.Product.itineraryPattern)) {
      const countryMap = new Map<string, { name: string; location: string }>();
      const countryNameMap: Record<string, string> = {
        'JP': '일본', 'TH': '태국', 'VN': '베트남', 'MY': '말레이시아',
        'SG': '싱가포르', 'ES': '스페인', 'FR': '프랑스', 'IT': '이탈리아',
        'GR': '그리스', 'TR': '터키', 'US': '미국', 'CN': '중국',
        'TW': '대만', 'HK': '홍콩', 'PH': '필리핀', 'ID': '인도네시아'
      };

      inquiry.Product.itineraryPattern.forEach((day: any) => {
        if (day.country && day.country !== 'KR' && day.location && 
            (day.type === 'PortVisit' || day.type === 'Embarkation' || day.type === 'Disembarkation')) {
          const countryName = countryNameMap[day.country] || day.location;
          if (!countryMap.has(day.country)) {
            countryMap.set(day.country, { name: countryName, location: day.location });
          }
        }
      });

      for (const [countryCode, countryInfo] of countryMap.entries()) {
        await prisma.visitedCountry.upsert({
          where: {
            userId_countryCode: {
              userId: user.id,
              countryCode,
            },
          },
          update: {
            visitCount: { increment: 1 },
            lastVisited: start,
          },
          create: {
            userId: user.id,
            countryCode,
            countryName: countryInfo.name,
            visitCount: 1,
            lastVisited: start,
          },
        });
      }
    }

    // tripCount 증가 및 currentTripEndDate 설정
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        tripCount: { increment: 1 },
        totalTripCount: { increment: 1 },
        currentTripEndDate: end,
        onboarded: true,
      },
    });

    // APIS 스프레드시트 자동 생성 (비동기, 실패해도 계속 진행)
    try {
      const apisResult = await syncApisSpreadsheet(trip.id);
      if (apisResult.ok) {
        console.log(`[Inquiry Confirm] APIS 스프레드시트 생성 완료: tripId=${trip.id}, spreadsheetId=${apisResult.spreadsheetId}`);
      } else {
        console.warn(`[Inquiry Confirm] APIS 스프레드시트 생성 실패: ${apisResult.error}`);
      }
    } catch (apisError) {
      // APIS 생성 실패해도 여행 확정은 성공으로 처리
      console.error(`[Inquiry Confirm] APIS 스프레드시트 생성 중 오류:`, apisError);
    }

    // 재구매 체크: tripCount >= 2이면 RePurchaseTrigger 생성 및 converted: true 설정
    if (updatedUser.tripCount >= 2) {
      // 이전 여행의 종료일 찾기
      const previousTrip = await prisma.trip.findFirst({
        where: {
          userId: user.id,
          id: { not: trip.id },
        },
        orderBy: { endDate: 'desc' },
      });

      if (previousTrip) {
        // RePurchaseTrigger 생성 및 즉시 converted: true 설정
        await prisma.rePurchaseTrigger.create({
          data: {
            userId: user.id,
            lastTripEndDate: previousTrip.endDate,
            triggerType: 're_purchase',
            messageSent: false,
            converted: true,
            convertedAt: new Date(),
          },
        });
      }
    }

    // ProductInquiry 상태를 'confirmed'로 변경
    await prisma.productInquiry.update({
      where: { id: inquiryId },
      data: {
        status: 'confirmed',
        userId: user.id, // 사용자 연결
      },
    });

    return NextResponse.json({
      ok: true,
      message: '구매 확정 처리 완료. 크루즈 가이드 지니가 활성화되었습니다.',
      trip: {
        id: trip.id,
        cruiseName: trip.cruiseName,
        startDate: trip.startDate,
        endDate: trip.endDate,
      },
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        tripCount: updatedUser.tripCount,
      },
      isRePurchase: updatedUser.tripCount >= 2,
    });
  } catch (error: any) {
    console.error('[Admin Inquiry Confirm] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '구매 확정 처리 실패' },
      { status: 500 }
    );
  }
}
