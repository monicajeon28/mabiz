export const dynamic = 'force-dynamic';

// PATCH /api/partner/reservations/[reservationId]/verify-status
// 대리점장/판매원이 예약의 여권·PNR 상태를 COMPLETED로 수동 확인 처리

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { validateCsrfToken, getCsrfErrorResponse } from '@/lib/utils/csrfValidation';
import { z } from 'zod';

const bodySchema = z.object({
  passportStatus: z.enum(['COMPLETED']).optional(),
  pnrStatus: z.enum(['COMPLETED']).optional(),
}).refine((d) => d.passportStatus || d.pnrStatus, {
  message: 'passportStatus 또는 pnrStatus 중 하나 이상 필요',
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    // CSRF 검증
    const csrfValidation = validateCsrfToken(req);
    if (!csrfValidation.valid) {
      return getCsrfErrorResponse(csrfValidation.error || '잘못된 요청입니다.');
    }

    const { reservationId: reservationIdStr } = await params;
    const { profile } = await requirePartnerContext();
    const reservationId = parseInt(reservationIdStr);
    if (isNaN(reservationId)) {
      return NextResponse.json({ ok: false, error: '올바르지 않은 예약 ID' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    // 예약이 내 판매(또는 팀원 판매)에 속하는지 확인 (IDOR 방지)
    const [teamRelations, reservation] = await Promise.all([
      profile.type === 'BRANCH_MANAGER'
        ? prisma.affiliateRelation.findMany({
            where: { managerId: profile.id, status: 'ACTIVE' },
            select: { agentId: true },
          })
        : Promise.resolve([]),
      prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          passportStatus: true,
          pnrStatus: true,
          AffiliateSale: {
            select: {
              managerId: true,
              agentId: true,
            },
          },
        },
      }),
    ]);

    const teamAgentIds = teamRelations
      .map((r) => r.agentId)
      .filter((id): id is number => id !== null);

    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약을 찾을 수 없습니다' }, { status: 404 });
    }

    const sale = reservation.AffiliateSale;
    if (!sale) {
      // 어필리에이트 판매와 연결되지 않은 예약 — 파트너 접근 불가
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    const isOwnSale =
      sale.managerId === profile.id ||
      sale.agentId === profile.id ||
      (profile.type === 'BRANCH_MANAGER' &&
        sale.agentId !== null &&
        sale.agentId !== undefined &&
        teamAgentIds.includes(sale.agentId));

    if (!isOwnSale) {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    const { passportStatus, pnrStatus } = parsed.data;
    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        ...(passportStatus ? { passportStatus } : {}),
        ...(pnrStatus ? { pnrStatus } : {}),
        updatedAt: new Date(),
      },
      select: { id: true, passportStatus: true, pnrStatus: true },
    });

    return NextResponse.json({ ok: true, reservation: updated });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
