/**
 * POST /api/admin/apis/reservation/[id]/request-sale-confirm
 * APIS 보드에서 예약 단위 판매확인 승인요청 → 크루즈닷 전송
 *
 * 권한: OWNER / GLOBAL_ADMIN
 * 흐름:
 *  1. GmReservation.finalConfirmStatus = PENDING 확인
 *  2. affiliateSaleId 있는지 확인 (없으면 400)
 *  3. GmReservation.finalConfirmStatus = REQUESTED 업데이트
 *  4. 크루즈닷 purchase.confirm_requested 전송
 *  5. 실패 시 PENDING 롤백
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { sendSaleConfirmRequest } from '@/lib/affiliate/send-sale-confirm-request';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN', 'OWNER'],
    errorMessage: '판매확인 승인요청은 관리자만 가능합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  const ctx = await getMabizSession();
  if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const reservationId = parseInt(id, 10);
  if (!reservationId || isNaN(reservationId)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 예약 ID' }, { status: 400 });
  }

  // 크루즈닷 시크릿 사전 확인 (발신 불가면 요청 자체를 차단)
  if (!process.env.CRUISEDOT_WEBHOOK_SECRET) {
    logger.error('[request-sale-confirm] CRUISEDOT_WEBHOOK_SECRET 미설정', { reservationId });
    return NextResponse.json(
      { ok: false, error: '발신 설정이 누락되어 요청할 수 없습니다.' },
      { status: 503 }
    );
  }

  // 예약 조회 (공유 DB: Reservation → affiliateSaleId, finalConfirmStatus, affiliateCode)
  type ResRow = {
    id: number;
    affiliateSaleId: number | null;
    finalConfirmStatus: string;
    affiliateCode: string | null;
    mainUserId: number;
  };

  const rows = await prisma.$queryRaw<ResRow[]>`
    SELECT r.id, r."affiliateSaleId", r."finalConfirmStatus",
           u."affiliateCode", r."mainUserId"
    FROM "Reservation" r
    LEFT JOIN "User" u ON u.id = r."mainUserId"
    WHERE r.id = ${reservationId}
    LIMIT 1
  `;

  const reservation = rows[0] ?? null;
  if (!reservation) {
    return NextResponse.json({ ok: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (!reservation.affiliateSaleId) {
    return NextResponse.json(
      { ok: false, error: '이 예약에 연결된 판매 건이 없습니다. 어필리에이트 코드로 구매한 예약만 요청 가능합니다.' },
      { status: 400 }
    );
  }

  if (reservation.finalConfirmStatus === 'REQUESTED') {
    return NextResponse.json(
      { ok: false, error: '이미 승인요청 중입니다.' },
      { status: 409 }
    );
  }

  if (reservation.finalConfirmStatus === 'APPROVED') {
    return NextResponse.json(
      { ok: false, error: '이미 승인 완료된 건입니다.' },
      { status: 409 }
    );
  }

  const prevStatus = reservation.finalConfirmStatus;

  // 1. finalConfirmStatus → REQUESTED (원자 클레임)
  const requesterId = ctx.mallUser?.id ?? null;
  const claimed = await prisma.$executeRaw`
    UPDATE "Reservation"
    SET "finalConfirmStatus"        = 'REQUESTED',
        "finalConfirmRequestedAt"   = NOW(),
        "finalConfirmRequestedById" = ${requesterId}
    WHERE id = ${reservationId}
      AND "finalConfirmStatus" NOT IN ('REQUESTED', 'APPROVED')
  `;

  if (claimed === 0) {
    return NextResponse.json(
      { ok: false, error: '이미 처리되었거나 승인 가능 상태가 아닙니다.' },
      { status: 409 }
    );
  }

  // 2. 크루즈닷 전송
  const eventId = randomUUID();
  try {
    await sendSaleConfirmRequest({
      eventId,
      eventType: 'purchase.confirm_requested',
      saleId: reservation.affiliateSaleId,
      reservationId,
      affiliateCode: reservation.affiliateCode ?? '',
      requestedBy: ctx.mallUser?.id ?? undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (sendErr) {
    // 전송 실패 → PENDING 롤백
    await prisma.$executeRaw`
      UPDATE "Reservation"
      SET "finalConfirmStatus"        = ${prevStatus},
          "finalConfirmRequestedAt"   = NULL,
          "finalConfirmRequestedById" = NULL
      WHERE id = ${reservationId}
    `.catch((rbErr) =>
      logger.error('[request-sale-confirm] 롤백 실패', { reservationId, rbErr: String(rbErr) })
    );

    logger.error('[request-sale-confirm] 전송 실패 → 롤백', {
      reservationId,
      error: sendErr instanceof Error ? sendErr.message : String(sendErr),
    });
    return NextResponse.json(
      { ok: false, error: '크루즈닷 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502 }
    );
  }

  logger.log('[request-sale-confirm] 완료', {
    reservationId,
    saleId: reservation.affiliateSaleId,
    by: ctx.mallUser?.id,
  });

  return NextResponse.json({ ok: true, reservationId, saleId: reservation.affiliateSaleId });
}
