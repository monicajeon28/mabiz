export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 특정 고객의 APIS 상세 정보 조회
 * GET /api/admin/apis/customer-detail?userId=XXX&productCode=XXX
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const productCode = searchParams.get('productCode');

    if (!userId || !productCode) {
      return NextResponse.json(
        { ok: false, message: 'userId와 productCode는 필수입니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 해당 상품의 UserTrip 조회
    const userTrip = await prisma.userTrip.findFirst({
      where: {
        userId: parseInt(userId),
        CruiseProduct: {
          productCode: productCode,
        },
      },
      include: {
        CruiseProduct: {
          select: {
            productCode: true,
            cruiseLine: true,
            shipName: true,
            packageName: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    // Reservation 및 Traveler 정보 조회
    let reservation = null;
    let travelers = [];

    if (userTrip) {
      const trip = await prisma.trip.findUnique({
        where: { productCode: productCode },
        select: { id: true },
      });

      if (trip) {
        reservation = await prisma.reservation.findFirst({
          where: {
            tripId: trip.id,
            mainUserId: parseInt(userId),
          },
          include: {
            Traveler: {
              orderBy: { roomNumber: 'asc' },
            },
          },
        });

        if (reservation) {
          travelers = reservation.Traveler;
        }
      }
    }

    // PassportSubmission 정보 조회
    const passportSubmission = await prisma.passportSubmission.findFirst({
      where: {
        userId: parseInt(userId),
        UserTrip: userTrip ? {
          some: {
            CruiseProduct: {
              productCode: productCode,
            },
          },
        } : undefined,
      },
      include: {
        PassportSubmissionGuest: {
          orderBy: { groupNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      customer: {
        userId: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        productCode: productCode,
        cruiseLine: userTrip?.CruiseProduct?.cruiseLine,
        shipName: userTrip?.CruiseProduct?.shipName,
        packageName: userTrip?.CruiseProduct?.packageName,
        startDate: userTrip?.startDate,
        endDate: userTrip?.endDate,
        reservation: reservation ? {
          id: reservation.id,
          totalPeople: reservation.totalPeople,
          cabinType: reservation.cabinType,
          roomNumber: reservation.cabinType,
        } : null,
        travelers: travelers.map((t) => ({
          id: t.id,
          roomNumber: t.roomNumber,
          korName: t.korName,
          engSurname: t.engSurname,
          engGivenName: t.engGivenName,
          residentNum: t.residentNum,
          passportNo: t.passportNo,
          birthDate: t.birthDate,
          issueDate: t.issueDate,
          expiryDate: t.expiryDate,
          nationality: t.nationality,
          gender: t.gender,
        })),
        passportGuests: passportSubmission?.PassportSubmissionGuest.map((g) => ({
          id: g.id,
          groupNumber: g.groupNumber,
          name: g.name,
          phone: g.phone,
          passportNumber: g.passportNumber,
          nationality: g.nationality,
          dateOfBirth: g.dateOfBirth,
          passportExpiryDate: g.passportExpiryDate,
        })) || [],
        passportSubmissionId: passportSubmission?.id || null,
        passportDriveFolderUrl: passportSubmission?.driveFolderUrl || null,
        passportSubmittedAt: passportSubmission?.submittedAt?.toISOString() || null,
        passportIsSubmitted: passportSubmission?.isSubmitted || false,
      },
    });
  } catch (error: any) {
    console.error('[Customer Detail API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error.message || '고객 상세 정보 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
