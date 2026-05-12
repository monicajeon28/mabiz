export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { backupPassportDataToUser } from '@/lib/passport-utils';
import { syncApisInBackground } from '@/lib/google-sheets';

/**
 * POST /api/passport/submit
 * 고객이 입력한 여권 정보를 저장합니다.
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
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { Traveler: true },
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
          await prisma.traveler.update({
            where: { id: travelerData.id },
            data: {
              korName: travelerData.korName || '',
              engSurname: travelerData.engSurname || null,
              engGivenName: travelerData.engGivenName || null,
              // 여권 정보는 업데이트하지 않음
            },
          });
        } else {
          // 새로운 Traveler 생성 (추후 제출)
          const newTraveler = await prisma.traveler.create({
            data: {
              reservationId,
              korName: travelerData.korName || '',
              engSurname: travelerData.engSurname || null,
              engGivenName: travelerData.engGivenName || null,
              roomNumber: travelerData.roomNumber || null,
              // 여권 정보는 null로 유지
            },
          });
          updatedTravelers.push(newTraveler);
        }
      } else {
        // 정상 제출인 경우: 유효성 검사
        if (!travelerData.korName || !travelerData.passportNo) {
          continue; // 필수 정보가 없으면 건너뜀
        }

        const updateData: any = {
          korName: travelerData.korName,
          engSurname: travelerData.engSurname || null,
          engGivenName: travelerData.engGivenName || null,
          passportNo: travelerData.passportNo,
          residentNum: travelerData.residentNum || null,
          nationality: travelerData.nationality || null,
          birthDate: travelerData.dateOfBirth || null,  // dateOfBirth → birthDate
          expiryDate: travelerData.passportExpiryDate || null,  // passportExpiryDate → expiryDate
          roomNumber: travelerData.roomNumber || null,
          // phone은 Traveler 모델에 없으므로 ocrRawData에 저장하거나 별도 처리
          // 대표자(첫 번째) 연락처는 User 테이블에 저장
        };

        // 대표자(첫 번째)의 연락처를 User 테이블에 업데이트
        if (index === 0 && travelerData.phone && reservation.mainUserId) {
          try {
            await prisma.user.update({
              where: { id: reservation.mainUserId },
              data: { phone: travelerData.phone },
            });
          } catch (userUpdateError) {
            console.error('[Passport Submit] User 업데이트 실패:', userUpdateError);
            // User 업데이트 실패는 무시하고 계속 진행
          }
        }

        if (travelerData.id) {
          // 기존 Traveler 업데이트
          const updated = await prisma.traveler.update({
            where: { id: travelerData.id },
            data: updateData,
          });
          updatedTravelers.push(updated);

          // User에 백업 (에러 발생 시 무시)
          if (updated.userId) {
            try {
              await backupPassportDataToUser(updated.userId, {
                korName: updated.korName || '',
                passportNo: updated.passportNo || undefined,
                nationality: updated.nationality || undefined,
                engSurname: updated.engSurname || undefined,
                engGivenName: updated.engGivenName || undefined,
              });
            } catch (backupError) {
              console.error('[Passport Submit] 백업 실패:', backupError);
              // 백업 실패는 무시하고 계속 진행
            }
          }
        } else {
          // 새로운 Traveler 생성
          const newTraveler = await prisma.traveler.create({
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
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        passportStatus: reservation.passportStatus === '도움요청' ? '도움요청' : '진행중',
      },
    });

    // APIS 스프레드시트 즉시 동기화 (재시도 로직 포함, 비동기)
    if (reservation.tripId) {
      syncApisInBackground(reservation.tripId);
    }

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 성공적으로 저장되었습니다.',
      updatedCount: updatedTravelers.length,
    });
  } catch (error: any) {
    console.error('[Passport Submit] Error:', error);
    console.error('[Passport Submit] Error Stack:', error.stack);
    console.error('[Passport Submit] Error Code:', error.code);
    return NextResponse.json(
      {
        ok: false,
        message: error.message || '여권 정보 저장에 실패했습니다.',
        error: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}
