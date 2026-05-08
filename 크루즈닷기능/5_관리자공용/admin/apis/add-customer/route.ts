export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 새 고객 APIS 정보 추가 (추가신청)
 * POST /api/admin/apis/add-customer
 */
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const { cookies } = await import('next/headers');
    const SESSION_COOKIE = 'cg.sid.v2';
    const sid = cookies().get(SESSION_COOKIE)?.value;

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

    const body = await req.json();
    const { productCode, customerData, travelers } = body;

    if (!productCode || !customerData) {
      return NextResponse.json(
        { ok: false, message: 'productCode와 customerData는 필수입니다.' },
        { status: 400 }
      );
    }

    // 사용자 생성 또는 조회
    let user;
    if (customerData.userId) {
      user = await prisma.user.findUnique({
        where: { id: customerData.userId },
      });
    }

    if (!user) {
      // 새 사용자 생성
      if (!customerData.name || !customerData.phone) {
        return NextResponse.json(
          { ok: false, message: '이름과 연락처는 필수입니다.' },
          { status: 400 }
        );
      }

      user = await prisma.user.create({
        data: {
          name: customerData.name,
          phone: customerData.phone,
          email: customerData.email || null,
          password: 'temp-password', // 임시 비밀번호
        },
      });
    }

    // Trip 조회
    const trip = await prisma.trip.findUnique({
      where: { productCode: productCode },
      select: { id: true },
    });

    if (!trip) {
      return NextResponse.json(
        { ok: false, message: '해당 여행을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Reservation 생성 또는 조회
    let reservation = await prisma.reservation.findFirst({
      where: {
        tripId: trip.id,
        mainUserId: user.id,
      },
    });

    if (!reservation) {
      reservation = await prisma.reservation.create({
        data: {
          tripId: trip.id,
          mainUserId: user.id,
          totalPeople: travelers?.length || 1,
          cabinType: customerData.cabinType || null,
        },
      });
    }

    // Traveler 생성
    if (travelers && Array.isArray(travelers) && travelers.length > 0) {
      for (const traveler of travelers) {
        await prisma.traveler.create({
          data: {
            reservationId: reservation.id,
            roomNumber: traveler.roomNumber || 1,
            korName: traveler.korName || null,
            engSurname: traveler.engSurname || null,
            engGivenName: traveler.engGivenName || null,
            residentNum: traveler.residentNum || null,
            passportNo: traveler.passportNo || null,
            birthDate: traveler.birthDate || null,
            issueDate: traveler.issueDate || null,
            expiryDate: traveler.expiryDate || null,
            nationality: traveler.nationality || null,
            gender: traveler.gender || null,
            userId: user.id,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'APIS 정보가 추가되었습니다.',
      userId: user.id,
    });
  } catch (error: any) {
    console.error('[Add Customer API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'APIS 정보 추가 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
