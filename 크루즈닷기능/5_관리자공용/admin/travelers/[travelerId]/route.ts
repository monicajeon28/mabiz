export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { syncApisInBackground } from '@/lib/google-sheets';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { travelerId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: Number(session.userId) },
      select: { role: true },
    });

    if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const travelerId = parseInt(params.travelerId);
    if (isNaN(travelerId)) {
      return NextResponse.json({ ok: false, error: 'Invalid traveler ID' }, { status: 400 });
    }

    const body = await req.json();
    const {
      korName,
      engSurname,
      engGivenName,
      passportNo,
      nationality,
      birthDate,
      issueDate,    // 여권생성일
      expiryDate,
      gender,
      residentNum,  // 주민번호
      roomNumber,   // 객실 번호
      notes,        // 비고
    } = body;

    // 여행자 존재 여부 확인
    const existingTraveler = await prisma.traveler.findUnique({
      where: { id: travelerId },
    });

    if (!existingTraveler) {
      return NextResponse.json({ ok: false, error: 'Traveler not found' }, { status: 404 });
    }

    // 업데이트 데이터 구성
    const updateData: any = {};
    if (korName !== undefined) updateData.korName = korName || null;
    if (engSurname !== undefined) updateData.engSurname = engSurname?.toUpperCase() || null;
    if (engGivenName !== undefined) updateData.engGivenName = engGivenName?.toUpperCase() || null;
    if (passportNo !== undefined) updateData.passportNo = passportNo?.toUpperCase() || null;
    if (nationality !== undefined) updateData.nationality = nationality?.toUpperCase() || null;
    if (birthDate !== undefined) updateData.birthDate = birthDate || null;
    if (issueDate !== undefined) updateData.issueDate = issueDate || null;    // 여권생성일
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (residentNum !== undefined) updateData.residentNum = residentNum || null;  // 주민번호
    if (roomNumber !== undefined) updateData.roomNumber = roomNumber || null;    // 객실 번호
    if (notes !== undefined) updateData.notes = notes || null;                    // 비고

    // 여행자 정보 업데이트
    const updatedTraveler = await prisma.traveler.update({
      where: { id: travelerId },
      data: updateData,
      include: {
        Reservation: {
          select: {
            Trip: {
              select: { id: true }
            }
          }
        }
      }
    });

    // APIS 스프레드시트 자동 동기화 (재시도 로직 포함)
    const tripId = updatedTraveler.Reservation?.Trip?.id;
    if (tripId) {
      syncApisInBackground(tripId);
    }

    return NextResponse.json({
      ok: true,
      traveler: {
        id: updatedTraveler.id,
        korName: updatedTraveler.korName,
        engSurname: updatedTraveler.engSurname,
        engGivenName: updatedTraveler.engGivenName,
        passportNo: updatedTraveler.passportNo,
        nationality: updatedTraveler.nationality,
        birthDate: updatedTraveler.birthDate,
        issueDate: updatedTraveler.issueDate,
        expiryDate: updatedTraveler.expiryDate,
        gender: updatedTraveler.gender,
        residentNum: updatedTraveler.residentNum,
        notes: updatedTraveler.notes,
      },
    });
  } catch (error: any) {
    console.error('[Admin Travelers Update] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update traveler' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { travelerId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: Number(session.userId) },
      select: { role: true },
    });

    if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const travelerId = parseInt(params.travelerId);
    if (isNaN(travelerId)) {
      return NextResponse.json({ ok: false, error: 'Invalid traveler ID' }, { status: 400 });
    }

    const traveler = await prisma.traveler.findUnique({
      where: { id: travelerId },
      include: {
        Reservation: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!traveler) {
      return NextResponse.json({ ok: false, error: 'Traveler not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      traveler: {
        id: traveler.id,
        korName: traveler.korName,
        engSurname: traveler.engSurname,
        engGivenName: traveler.engGivenName,
        passportNo: traveler.passportNo,
        nationality: traveler.nationality,
        birthDate: traveler.birthDate,
        expiryDate: traveler.expiryDate,
        gender: traveler.gender,
        roomNumber: traveler.roomNumber,
        passportImage: traveler.passportImage,
        reservationId: traveler.reservationId,
      },
    });
  } catch (error: any) {
    console.error('[Admin Travelers Get] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch traveler' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { travelerId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: Number(session.userId) },
      select: { role: true },
    });

    if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const travelerId = parseInt(params.travelerId);
    if (isNaN(travelerId)) {
      return NextResponse.json({ ok: false, error: 'Invalid traveler ID' }, { status: 400 });
    }

    // 여행자 존재 여부 확인 및 tripId 가져오기
    const existingTraveler = await prisma.traveler.findUnique({
      where: { id: travelerId },
      include: {
        Reservation: {
          select: {
            id: true,
            Trip: { select: { id: true } }
          }
        }
      }
    });

    if (!existingTraveler) {
      return NextResponse.json({ ok: false, error: 'Traveler not found' }, { status: 404 });
    }

    const reservationId = existingTraveler.reservationId;
    const tripId = existingTraveler.Reservation?.Trip?.id;

    // 여행자 삭제
    await prisma.traveler.delete({
      where: { id: travelerId },
    });

    // 예약의 총 인원 수 업데이트
    if (reservationId) {
      const travelerCount = await prisma.traveler.count({
        where: { reservationId },
      });

      await prisma.reservation.update({
        where: { id: reservationId },
        data: { totalPeople: travelerCount },
      });
    }

    // APIS 스프레드시트 자동 동기화 (재시도 로직 포함)
    if (tripId) {
      syncApisInBackground(tripId);
    }

    return NextResponse.json({
      ok: true,
      message: 'Traveler deleted successfully',
    });
  } catch (error: any) {
    console.error('[Admin Travelers Delete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete traveler' },
      { status: 500 }
    );
  }
}
