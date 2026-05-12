export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// 관리자 권한 확인
async function checkAdminAuth() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true },
  });

  if (!user || user.role !== 'admin') {
    return null;
  }

  return sessionUser;
}

// POST: 수동 여권 등록 (조건 없이 등록 가능)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Next.js 13+ App Router 호환: params가 Promise일 수 있음
    const resolvedParams = await Promise.resolve(params);
    const userId = parseInt(resolvedParams.userId);
    if (isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { korName, engGivenName, engSurname, passportNo, birthDate, expiryDate, reservationId } = body;

    // 여권번호만 필수, 나머지는 선택사항 (조건 없이 등록 가능)
    if (!passportNo || passportNo.trim() === '') {
      return NextResponse.json(
        { ok: false, error: '여권번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    let targetReservationId: number;

    // Reservation이 지정되어 있으면 해당 Reservation 사용
    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { id: true, tripId: true },
      });

      if (!reservation) {
        return NextResponse.json(
          { ok: false, error: 'Reservation not found' },
          { status: 404 }
        );
      }

      targetReservationId = reservation.id;
    } else {
      // Reservation이 없으면 사용자의 가장 최근 Reservation에 추가
      const latestReservation = await prisma.reservation.findFirst({
        where: { mainUserId: userId },
        orderBy: { id: 'desc' },
        select: { id: true },
      });

      if (!latestReservation) {
        // Reservation이 없으면 최근 Trip을 찾아서 Reservation 생성
        // 사용자의 최근 Reservation과 연결된 Trip 찾기
        const tripWithReservation = await prisma.trip.findFirst({
          where: {
            Reservation: {
              some: {
                mainUserId: userId,
              },
            },
          },
          orderBy: { id: 'desc' },
          select: { id: true },
        });

        let targetTripId: number;

        if (tripWithReservation) {
          targetTripId = tripWithReservation.id;
        } else {
          // 사용자의 Reservation이 전혀 없으면, 시스템의 최근 Trip 사용
          // (실제 운영 환경에서는 이런 경우가 드물지만, 조건 없이 등록 가능하도록 처리)
          const anyTrip = await prisma.trip.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true },
          });

          if (!anyTrip) {
            // Trip이 없으면 임시 Trip 생성 (여행 없이도 여권 등록 가능하도록)
            // APIS에 필요한 입력값을 미리 업데이트하기 위한 임시 Trip
            const tempProductCode = `TEMP-PASSPORT-${userId}-${Date.now()}`;
            const newTrip = await prisma.trip.create({
              data: {
                productCode: tempProductCode,
                shipName: '임시 여행 (수동 여권 등록)',
                departureDate: new Date(),
                status: 'Upcoming',
              },
            });
            targetTripId = newTrip.id;
          } else {
            targetTripId = anyTrip.id;
          }
        }

        // Trip이 있으면 해당 Trip에 Reservation 생성
        const newReservation = await prisma.reservation.create({
          data: {
            tripId: targetTripId,
            mainUserId: userId,
            totalPeople: 1,
            passportStatus: 'PENDING',
          },
        });
        targetReservationId = newReservation.id;
      } else {
        targetReservationId = latestReservation.id;
      }
    }

    // 기존 Traveler 중 같은 여권번호가 있는지 확인 (중복 방지)
    const existingTraveler = await prisma.traveler.findFirst({
      where: {
        reservationId: targetReservationId,
        passportNo: passportNo.trim(),
      },
    });

    if (existingTraveler) {
      // 기존 여권 정보 업데이트
      await prisma.traveler.update({
        where: { id: existingTraveler.id },
        data: {
          korName: korName?.trim() || null,
          engGivenName: engGivenName?.trim() || null,
          engSurname: engSurname?.trim() || null,
          passportNo: passportNo.trim(),
          birthDate: birthDate ? (typeof birthDate === 'string' ? birthDate : new Date(birthDate).toISOString().split('T')[0]) : null,
          expiryDate: expiryDate ? (typeof expiryDate === 'string' ? expiryDate : new Date(expiryDate).toISOString().split('T')[0]) : null,
        },
      });

      return NextResponse.json({
        ok: true,
        message: '여권 정보가 업데이트되었습니다.',
      });
    }

    // 기존 Traveler 수 확인하여 roomNumber 결정
    const travelerCount = await prisma.traveler.count({
      where: { reservationId: targetReservationId },
    });

    // Traveler 생성 (조건 없이 모든 필드 선택사항)
    // birthDate와 expiryDate는 String 타입이므로 문자열로 저장
    await prisma.traveler.create({
      data: {
        reservationId: targetReservationId,
        roomNumber: travelerCount + 1,
        korName: korName?.trim() || null,
        engGivenName: engGivenName?.trim() || null,
        engSurname: engSurname?.trim() || null,
        passportNo: passportNo.trim(),
        birthDate: birthDate ? (typeof birthDate === 'string' ? birthDate : new Date(birthDate).toISOString().split('T')[0]) : null,
        expiryDate: expiryDate ? (typeof expiryDate === 'string' ? expiryDate : new Date(expiryDate).toISOString().split('T')[0]) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 등록되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Passport Registration] Error:', error);
    console.error('[Admin Passport Registration] Error stack:', error.stack);
    console.error('[Admin Passport Registration] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    
    return NextResponse.json(
      {
        ok: false,
        error: '여권 등록에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        errorCode: error.code,
        errorName: error.name,
      },
      { status: 500 }
    );
  }
}

// PUT: 여권 정보 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Next.js 13+ App Router 호환: params가 Promise일 수 있음
    const resolvedParams = await Promise.resolve(params);
    const userId = parseInt(resolvedParams.userId);
    if (isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { travelerId, korName, engGivenName, engSurname, passportNo, birthDate, expiryDate } = body;

    // Traveler ID 필수
    if (!travelerId) {
      return NextResponse.json(
        { ok: false, error: 'Traveler ID는 필수입니다.' },
        { status: 400 }
      );
    }

    // 여권번호 필수
    if (!passportNo || passportNo.trim() === '') {
      return NextResponse.json(
        { ok: false, error: '여권번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // Traveler 확인
    const traveler = await prisma.traveler.findUnique({
      where: { id: travelerId },
      select: { id: true, reservationId: true },
    });

    if (!traveler) {
      return NextResponse.json(
        { ok: false, error: 'Traveler not found' },
        { status: 404 }
      );
    }

    // Reservation 확인 (사용자 소유 확인)
    const reservation = await prisma.reservation.findUnique({
      where: { id: traveler.reservationId },
      select: { id: true, mainUserId: true },
    });

    if (!reservation || reservation.mainUserId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: This traveler does not belong to the user' },
        { status: 403 }
      );
    }

    // 여권 정보 업데이트
    await prisma.traveler.update({
      where: { id: travelerId },
      data: {
        korName: korName?.trim() || null,
        engGivenName: engGivenName?.trim() || null,
        engSurname: engSurname?.trim() || null,
        passportNo: passportNo.trim(),
        birthDate: birthDate ? (typeof birthDate === 'string' ? birthDate : new Date(birthDate).toISOString().split('T')[0]) : null,
        expiryDate: expiryDate ? (typeof expiryDate === 'string' ? expiryDate : new Date(expiryDate).toISOString().split('T')[0]) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 수정되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Passport Update] Error:', error);
    console.error('[Admin Passport Update] Error stack:', error.stack);
    console.error('[Admin Passport Update] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    
    return NextResponse.json(
      {
        ok: false,
        error: '여권 정보 수정에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        errorCode: error.code,
        errorName: error.name,
      },
      { status: 500 }
    );
  }
}
