export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/passport/public/submit
 * 고객이 입력한 여권 정보를 저장합니다.
 * Public API — 예약ID 기반, 인증 없음
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reservationId, travelers } = body;

    if (!reservationId || !travelers || !Array.isArray(travelers)) {
      return NextResponse.json(
        { ok: false, message: 'reservationId와 travelers 배열은 필수입니다.' },
        { status: 400 }
      );
    }

    // 예약 존재 확인
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: { travelers: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Traveler 정보 업데이트 (upsert 방식)
    const updatedTravelers = [];

    for (let index = 0; index < travelers.length; index++) {
      const travelerData = travelers[index];
      if (travelerData.isSubmitLater) {
        // 추후 제출인 경우: 이름만 업데이트하고 여권 정보는 건너뜀
        if (travelerData.id) {
          await prisma.gmTraveler.update({
            where: { id: travelerData.id },
            data: {
              korName: travelerData.korName || '',
              engSurname: travelerData.engSurname || null,
              engGivenName: travelerData.engGivenName || null,
            },
          });
        } else {
          // 새로운 Traveler 생성 (추후 제출)
          const newTraveler = await prisma.gmTraveler.create({
            data: {
              reservationId,
              korName: travelerData.korName || '',
              engSurname: travelerData.engSurname || null,
              engGivenName: travelerData.engGivenName || null,
              roomNumber: travelerData.roomNumber || 0,
            },
          });
          updatedTravelers.push(newTraveler);
        }
      } else {
        // 정상 제출인 경우: 유효성 검사
        if (!travelerData.korName || !travelerData.passportNo) {
          continue; // 필수 정보가 없으면 건너뜀
        }

        const updateData = {
          korName: travelerData.korName as string,
          engSurname: (travelerData.engSurname as string) || null,
          engGivenName: (travelerData.engGivenName as string) || null,
          passportNo: (travelerData.passportNo as string) || null,
          residentNum: (travelerData.residentNum as string) || null,
          nationality: (travelerData.nationality as string) || null,
          birthDate: (travelerData.dateOfBirth as string) || null,
          expiryDate: (travelerData.passportExpiryDate as string) || null,
          roomNumber: (travelerData.roomNumber as number) || 0,
        };

        // 대표자(첫 번째)의 연락처를 User 테이블에 업데이트
        if (index === 0 && travelerData.phone && reservation.mainUserId) {
          try {
            await prisma.gmUser.update({
              where: { id: reservation.mainUserId },
              data: { phone: travelerData.phone },
            });
          } catch (userUpdateError) {
            logger.error('[Passport Submit] User 업데이트 실패:', userUpdateError as Record<string, unknown>);
          }
        }

        if (travelerData.id) {
          // 기존 Traveler 업데이트
          const updated = await prisma.gmTraveler.update({
            where: { id: travelerData.id },
            data: updateData,
          });
          updatedTravelers.push(updated);
        } else {
          // 새로운 Traveler 생성
          const newTraveler = await prisma.gmTraveler.create({
            data: {
              reservationId,
              ...updateData,
            },
          });
          updatedTravelers.push(newTraveler);
        }
      }
    }

    // Reservation의 passportStatus 업데이트 (진행 중으로 변경)
    await prisma.gmReservation.update({
      where: { id: reservationId },
      data: {
        passportStatus: reservation.passportStatus === '도움요청' ? '도움요청' : '진행중',
      },
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 성공적으로 저장되었습니다.',
      updatedCount: updatedTravelers.length,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport Submit] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        message: String(err.message || '여권 정보 저장에 실패했습니다.'),
        error: String(err.message || ''),
        code: String(err.code || ''),
      },
      { status: 500 }
    );
  }
}
