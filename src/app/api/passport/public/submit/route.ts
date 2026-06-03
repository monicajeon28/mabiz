export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync } from '@/lib/rate-limit';

/**
 * POST /api/passport/public/submit
 * 고객이 입력한 여권 정보를 저장합니다.
 * Public API — 예약ID 기반, 인증 없음
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const { allowed } = await checkRateLimitAsync(`passport-submit:${ip}`, 15, 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

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
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ── 소유권 사전 검증 (트랜잭션 외부 — 읽기 전용) ────────────────
    // IDOR 방지: 트랜잭션 내부에서 write 전에 미리 확인
    const travelerOwnershipErrors: number[] = [];
    for (const travelerData of travelers) {
      if (travelerData.id && !travelerData.isSubmitLater) {
        const travelerCheck = await prisma.gmTraveler.findUnique({
          where: { id: travelerData.id },
          select: { reservationId: true },
        });
        if (!travelerCheck || travelerCheck.reservationId !== reservationId) {
          logger.warn('[Passport Submit] 잘못된 traveler ID (소유권 위반)', { travelerDataId: travelerData.id, reservationId });
          travelerOwnershipErrors.push(travelerData.id);
        }
      }
    }

    // Traveler 정보 업데이트 (여러 DB 쓰기를 트랜잭션으로 원자 처리)
    const updatedTravelers = await prisma.$transaction(async (tx) => {
      const results = [];

      for (let index = 0; index < travelers.length; index++) {
        const travelerData = travelers[index];
        if (travelerData.isSubmitLater) {
          // 추후 제출인 경우: 이름만 업데이트하고 여권 정보는 건너뜀
          if (travelerData.id) {
            await tx.gmTraveler.update({
              where: { id: travelerData.id },
              data: {
                korName: travelerData.korName || '',
                engSurname: travelerData.engSurname || null,
                engGivenName: travelerData.engGivenName || null,
              },
            });
          } else {
            // 새로운 Traveler 생성 (추후 제출)
            const newTraveler = await tx.gmTraveler.create({
              data: {
                reservationId,
                korName: travelerData.korName || '',
                engSurname: travelerData.engSurname || null,
                engGivenName: travelerData.engGivenName || null,
                roomNumber: travelerData.roomNumber || 0,
              },
            });
            results.push(newTraveler);
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
              await tx.gmUser.update({
                where: { id: reservation.mainUserId },
                data: { phone: travelerData.phone },
              });
            } catch (userUpdateError) {
              logger.error('[Passport Submit] User 업데이트 실패:', userUpdateError as Record<string, unknown>);
            }
          }

          if (travelerData.id) {
            // 소유권 검증 실패한 ID는 건너뜀 (트랜잭션 외부에서 이미 확인)
            if (travelerOwnershipErrors.includes(travelerData.id)) {
              continue;
            }
            // 기존 Traveler 업데이트
            const updated = await tx.gmTraveler.update({
              where: { id: travelerData.id },
              data: updateData,
            });
            results.push(updated);
          } else {
            // 새로운 Traveler 생성
            const newTraveler = await tx.gmTraveler.create({
              data: {
                reservationId,
                ...updateData,
              },
            });
            results.push(newTraveler);
          }
        }
      }

      // Reservation의 passportStatus 업데이트 (진행 중으로 변경)
      await tx.gmReservation.update({
        where: { id: reservationId },
        data: {
          passportStatus: reservation.passportStatus === '도움요청' ? '도움요청' : '진행중',
        },
      });

      return results;
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 성공적으로 저장되었습니다.',
      reservationId,
      updatedCount: updatedTravelers.length,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport Submit] Error:', { err });
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
