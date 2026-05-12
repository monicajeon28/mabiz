export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { backupPassportDataToUser, findUserByNameAndPhone } from '@/lib/passport-utils';

/**
 * 여권 챗봇 연동 API
 * POST /api/passport/chatbot-sync
 * 
 * 외부 챗봇에서 여권 정보를 받아서 Traveler 정보를 업데이트합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reservationId, passportData } = body;

    // 필수 필드 검증
    if (!reservationId || !passportData) {
      return NextResponse.json(
        { ok: false, message: 'reservationId와 passportData는 필수입니다.' },
        { status: 400 }
      );
    }

    // Reservation 존재 확인
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        Trip: {
          select: { id: true, userId: true },
        },
        Traveler: {
          select: { id: true, korName: true, reservationId: true },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // passportData가 배열인지 단일 객체인지 확인
    const passportDataArray = Array.isArray(passportData) ? passportData : [passportData];

    const updatedTravelers = [];

    // 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      for (const data of passportDataArray) {
        const { korName, passportNo, expiryDate, residentNum, nationality, dateOfBirth, engSurname, engGivenName, phone } = data;

        if (!korName) {
          console.warn('[Chatbot Sync] korName이 없어서 스킵합니다:', data);
          continue;
        }

        // 해당 예약의 Traveler 중에서 korName으로 매칭
        let traveler = await tx.traveler.findFirst({
          where: {
            reservationId,
            korName,
          },
        });

        // korName으로 못 찾으면, phone으로 매칭 시도
        if (!traveler && phone) {
          // Traveler는 phone 필드가 없으므로, User를 통해 매칭
          const userId = await findUserByNameAndPhone(korName, phone);
          if (userId) {
            // userId로 연결된 Reservation을 찾아서 Traveler 찾기
            const relatedReservation = await tx.reservation.findFirst({
              where: {
                mainUserId: userId,
                tripId: reservation.tripId,
              },
            });
            if (relatedReservation) {
              traveler = await tx.traveler.findFirst({
                where: {
                  reservationId: relatedReservation.id,
                  korName,
                },
              });
            }
          }
        }

        // 여전히 못 찾으면, 해당 예약의 Traveler 중 첫 번째 항목 업데이트 (fallback)
        if (!traveler && reservation.Traveler.length > 0) {
          traveler = reservation.Traveler[0];
          console.warn(`[Chatbot Sync] 정확한 Traveler를 찾지 못해 첫 번째 Traveler를 업데이트합니다: ${traveler.id}`);
        }

        if (!traveler) {
          console.warn(`[Chatbot Sync] Traveler를 찾을 수 없습니다: ${korName}`);
          continue;
        }

        // 여권 만료일 파싱
        let passportExpiryDate: Date | null = null;
        if (expiryDate) {
          if (typeof expiryDate === 'string') {
            passportExpiryDate = new Date(expiryDate);
            if (isNaN(passportExpiryDate.getTime())) {
              passportExpiryDate = null;
            }
          } else if (expiryDate instanceof Date) {
            passportExpiryDate = expiryDate;
          }
        }

        // 생년월일 파싱
        let dateOfBirthParsed: Date | null = null;
        if (dateOfBirth) {
          if (typeof dateOfBirth === 'string') {
            dateOfBirthParsed = new Date(dateOfBirth);
            if (isNaN(dateOfBirthParsed.getTime())) {
              dateOfBirthParsed = null;
            }
          } else if (dateOfBirth instanceof Date) {
            dateOfBirthParsed = dateOfBirth;
          }
        }

        // Traveler 업데이트
        const updatedTraveler = await tx.traveler.update({
          where: { id: traveler.id },
          data: {
            korName: korName || traveler.korName,
            passportNo: passportNo || traveler.passportNo || null,
            passportExpiryDate: passportExpiryDate || traveler.passportExpiryDate || null,
            residentNum: residentNum || traveler.residentNum || null,
            nationality: nationality || traveler.nationality || null,
            dateOfBirth: dateOfBirthParsed || traveler.dateOfBirth || null,
            engSurname: engSurname || traveler.engSurname || null,
            engGivenName: engGivenName || traveler.engGivenName || null,
            ocrRawData: data.ocrRawData || traveler.ocrRawData || null,
          },
        });

        updatedTravelers.push(updatedTraveler);

        // User에 여권 정보 백업
        const userId = reservation.mainUserId;
        if (userId) {
          await backupPassportDataToUser(userId, {
            korName,
            phone,
            passportNo,
            passportExpiryDate: passportExpiryDate || undefined,
            residentNum,
            nationality,
            dateOfBirth: dateOfBirthParsed || undefined,
            engSurname,
            engGivenName,
          });
        }
      }
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 성공적으로 업데이트되었습니다.',
      data: {
        reservationId,
        updatedTravelers: updatedTravelers.map((t) => ({
          id: t.id,
          korName: t.korName,
          passportNo: t.passportNo,
          passportExpiryDate: t.passportExpiryDate,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Chatbot Sync] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error.message || '여권 정보 업데이트에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
