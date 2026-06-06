export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ERROR_MESSAGES } from '@/lib/pnr-errors';
import { getMabizSession } from '@/lib/auth';
import { validateAllTravelers } from '@/lib/pnr-validators';
import type { TravelerInput, PnrSubmitBody } from '@/lib/types/pnr';

export async function POST(req: NextRequest) {
  try {
    // Step 1: 요청 본문 검증 (phone = 비로그인 고객 본인확인용)
    const body: PnrSubmitBody & { phone?: string } = await req.json();
    const { reservationId, travelers } = body;

    if (!reservationId || !travelers || !Array.isArray(travelers) || travelers.length === 0) {
      return NextResponse.json(
        { ok: false, message: '예약 ID와 여행자 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 서버 측 필수 필드 검증 - validateAllTravelers 사용
    const validationError = validateAllTravelers(travelers);
    if (validationError) {
      return NextResponse.json(
        { ok: false, message: validationError.message },
        { status: 400 }
      );
    }

    // Step 2: 예약 조회 (소유권/본인확인용 mainUser.phone 포함)
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: {
        trip: true,
        mainUser: { select: { phone: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Step 3: 인증 — 세션(직원) 또는 본인확인(phone, 비로그인 고객).
    //   GET /api/pnr/customer/[reservationId]가 비로그인 phone 접근을 허용하므로 submit도 동일 모델.
    const session = await getMabizSession();
    if (session) {
      // 직원 경로: 기존 RBAC + 조직 소유권 검증 (IDOR 방지)
      if (session.role === 'OWNER' || session.role === 'AGENT') {
        if (!session.organizationId) {
          return NextResponse.json({ ok: false, message: '조직 정보가 없습니다.' }, { status: 403 });
        }
        const contact = await prisma.contact.findFirst({
          where: { organizationId: session.organizationId, userId: reservation.mainUserId },
        });
        if (!contact) {
          logger.warn('[PNR Submit] Unauthorized access attempt', {
            sessionId: session.userId, role: session.role, reservationId, organizationId: session.organizationId,
          });
          return NextResponse.json({ ok: false, message: '이 예약에 접근할 권한이 없습니다.' }, { status: 403 });
        }
      } else if (session.role !== 'GLOBAL_ADMIN') {
        return NextResponse.json({ ok: false, message: '이 작업을 수행할 권한이 없습니다.' }, { status: 403 });
      }
    } else {
      // 비로그인 고객 경로: body.phone === 예약 대표자 전화 (숫자만 비교)
      const digits = (p: string | null | undefined) => (p || '').replace(/[^0-9]/g, '');
      const inputPhone = digits(body.phone);
      const ownerPhone = digits(reservation.mainUser?.phone);
      if (!inputPhone || !ownerPhone || inputPhone !== ownerPhone) {
        return NextResponse.json({ ok: false, message: '본인확인에 실패했습니다. 전화번호를 확인해 주세요.' }, { status: 401 });
      }
    }

    const existingTravelerRows = await prisma.gmTraveler.findMany({
      where: { reservationId },
      select: { id: true },
    });

    // 기존 Traveler ID 목록
    const existingTravelerIds = existingTravelerRows.map((t) => t.id);
    const submittedTravelerIds = travelers.filter((t) => t.id).map((t) => t.id!);

    // 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      // 1. 기존 Traveler 업데이트 또는 새 Traveler 생성
      for (const traveler of travelers) {
        if (traveler.id && existingTravelerIds.includes(traveler.id)) {
          // 기존 Traveler 업데이트
          await tx.gmTraveler.update({
            where: { id: traveler.id },
            data: {
              korName: traveler.korName,
              residentNum: traveler.residentNum || null,
              phone: traveler.phone || null,
              roomNumber: traveler.roomNumber,
            },
          });
        } else {
          // 새 Traveler 생성
          await tx.gmTraveler.create({
            data: {
              reservationId: reservationId,
              korName: traveler.korName,
              residentNum: traveler.residentNum || null,
              phone: traveler.phone || null,
              roomNumber: traveler.roomNumber,
            },
          });
        }
      }

      // 2. 제출에서 제외된 기존 Traveler 삭제 (선택적)
      const travelersToDelete = existingTravelerIds.filter(
        (id) => !submittedTravelerIds.includes(id)
      );

      if (travelersToDelete.length > 0) {
        await tx.gmTraveler.deleteMany({
          where: {
            id: { in: travelersToDelete },
            reservationId: reservationId,
          },
        });
      }

      // 3. Reservation 업데이트
      await tx.gmReservation.update({
        where: { id: reservationId },
        data: {
          pnrStatus: 'COMPLETED',
          totalPeople: travelers.length,
          updatedAt: new Date(),
        },
      });

      // 4. APIS 큐에 자동 추가 (PNR 완료 후 자동으로 APIS 동기화)
      await tx.gmApisSyncQueue.create({
        data: {
          targetType: 'Reservation',
          targetId: reservationId,
          status: 'PENDING',
        },
      });
    });

    // Step 5: 감사 로그 생성 — AuditLog 모델 미존재, skip

    // 업데이트된 예약 정보 반환
    const updatedReservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
    });
    const updatedTravelersList = await prisma.gmTraveler.findMany({
      where: { reservationId },
      orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
    });

    return NextResponse.json({
      ok: true,
      message: 'PNR 정보가 성공적으로 저장되었습니다.',
      reservation: updatedReservation ? { ...updatedReservation, travelers: updatedTravelersList } : null,
    });
  } catch (error) {
    logger.error('[PNR Submit] Unexpected error:', { error });
    return NextResponse.json(
      { ok: false, message: ERROR_MESSAGES.SUBMISSION_FAILED },
      { status: 500 }
    );
  }
}
