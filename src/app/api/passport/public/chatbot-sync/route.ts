export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 여권 챗봇 연동 API
 * POST /api/passport/public/chatbot-sync
 *
 * 내부 챗봇 서버에서 여권 정보를 받아서 Traveler 정보를 업데이트합니다.
 * CHATBOT_SECRET 헤더로 내부 서버 인증 (Bearer 토큰)
 */
export async function POST(req: NextRequest) {
  try {
    // 내부 서버 인증 (timingSafeEqual로 타이밍 공격 방지)
    const secret = process.env.CHATBOT_SECRET;
    const auth = req.headers.get('authorization') ?? '';
    if (!secret) {
      logger.error('[ChatbotSync] CHATBOT_SECRET 환경변수 미설정');
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }
    const expected = `Bearer ${secret}`;
    let authValid = false;
    try {
      authValid = auth.length === expected.length &&
        timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
    } catch { authValid = false; }
    if (!authValid) {
      logger.warn('[ChatbotSync] 인증 실패', { ip: req.headers.get('x-forwarded-for') });
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

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
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: {
        trip: {
          select: { id: true, userId: true },
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

    const updatedTravelers: Array<{
      id: number;
      korName: string | null;
      passportNo: string | null;
      expiryDate: string | null;
    }> = [];

    // 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      for (const data of passportDataArray) {
        const { korName, passportNo, expiryDate, residentNum, nationality, dateOfBirth, engSurname, engGivenName, phone } = data;

        if (!korName) {
          logger.warn('[Chatbot Sync] korName이 없어서 스킵합니다:', data);
          continue;
        }

        // 해당 예약의 Traveler 중에서 korName으로 매칭
        let traveler = await tx.gmTraveler.findFirst({
          where: {
            reservationId,
            korName,
          },
        });

        // korName으로 못 찾으면, phone으로 매칭 시도
        if (!traveler && phone) {
          // GmUser를 통해 매칭
          const matchedUser = await tx.gmUser.findFirst({
            where: { name: korName, phone },
            select: { id: true },
          });
          if (matchedUser) {
            const relatedReservation = await tx.gmReservation.findFirst({
              where: {
                mainUserId: matchedUser.id,
                tripId: reservation.tripId,
              },
            });
            if (relatedReservation) {
              traveler = await tx.gmTraveler.findFirst({
                where: {
                  reservationId: relatedReservation.id,
                  korName,
                },
              });
            }
          }
        }

        if (!traveler) {
          logger.warn(`[Chatbot Sync] Traveler를 찾을 수 없습니다: ${korName}`);
          continue;
        }

        // Traveler 업데이트 (GmTraveler 필드명에 맞춤: birthDate, expiryDate = string)
        const updatedTraveler = await tx.gmTraveler.update({
          where: { id: traveler.id },
          data: {
            korName: korName || traveler.korName,
            passportNo: passportNo || traveler.passportNo || null,
            expiryDate: expiryDate || traveler.expiryDate || null,
            residentNum: residentNum || traveler.residentNum || null,
            nationality: nationality || traveler.nationality || null,
            birthDate: dateOfBirth || traveler.birthDate || null,
            engSurname: engSurname || traveler.engSurname || null,
            engGivenName: engGivenName || traveler.engGivenName || null,
          },
        });

        updatedTravelers.push({
          id: updatedTraveler.id,
          korName: updatedTraveler.korName,
          passportNo: updatedTraveler.passportNo,
          expiryDate: updatedTraveler.expiryDate,
        });

        // User에 여권 정보 백업 (phone 업데이트)
        const userId = reservation.mainUserId;
        if (userId && phone) {
          try {
            await tx.gmUser.update({
              where: { id: userId },
              data: { phone },
            });
          } catch (backupErr) {
            logger.error('[Chatbot Sync] User 백업 실패:', backupErr as Record<string, unknown>);
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 성공적으로 업데이트되었습니다.',
      data: {
        reservationId,
        updatedTravelers,
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Chatbot Sync] Error:', { err });
    return NextResponse.json(
      {
        ok: false,
        message: String(err.message || '여권 정보 업데이트에 실패했습니다.'),
      },
      { status: 500 }
    );
  }
}
