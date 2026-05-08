export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/confirm/route.ts
// 판매 최종 확정(CONFIRM) API — 승인(approve)과 별도로 선사 서류 수령 후 최종 확정 처리

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: { select: { id: true, role: true, name: true } } },
    });
    if (!session?.User || session.User.role !== 'admin') return null;
    return session.User;
  } catch (error) {
    logger.error('[Confirm Sale] Auth error:', error);
    return null;
  }
}

/**
 * POST /api/admin/affiliate/sales/[saleId]/confirm
 * 판매 최종 확정 처리
 * 요청: { confirmedAmount?: number, notes?: string }
 * - APPROVED 상태의 판매를 CONFIRMED로 전환
 * - 선사 서류 수령 후 최종 확정 단계
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const { saleId: saleIdStr } = await params;
    const saleId = parseInt(saleIdStr);
    if (isNaN(saleId)) {
      return NextResponse.json(
        { ok: false, error: '올바른 판매 ID가 아닙니다' },
        { status: 400 }
      );
    }

    let notes: string | undefined;
    let confirmedAmount: number | undefined;
    try {
      const body = await req.json();
      notes = typeof body?.notes === 'string' ? body.notes.trim() : undefined;
      confirmedAmount = typeof body?.confirmedAmount === 'number' ? body.confirmedAmount : undefined;
    } catch {
      // 바디 없이도 허용
    }

    // 판매 정보 확인
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: { id: true, status: true, saleAmount: true },
    });

    if (!sale) {
      return NextResponse.json(
        { ok: false, error: '판매를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 확정 가능 상태 검증 (APPROVED 또는 PENDING_APPROVAL 상태만 허용)
    const allowedStatuses = ['APPROVED', 'PENDING_APPROVAL'];
    if (!allowedStatuses.includes(sale.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: `현재 상태(${sale.status})에서는 확정할 수 없습니다. APPROVED 또는 PENDING_APPROVAL 상태만 확정 가능합니다`,
        },
        { status: 400 }
      );
    }

    // 확정 금액 검증
    if (confirmedAmount !== undefined && confirmedAmount < 0) {
      return NextResponse.json(
        { ok: false, error: '확정 금액은 0 이상이어야 합니다' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 원자적 처리
    const updatedSale = await prisma.$transaction(async (tx) => {
      const currentMeta = (
        await tx.affiliateSale.findUnique({
          where: { id: saleId },
          select: { metadata: true },
        })
      )?.metadata as Record<string, unknown> | null;

      return tx.affiliateSale.update({
        where: { id: saleId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          approvedById: admin.id,
          approvedAt: new Date(),
          ...(confirmedAmount !== undefined ? { saleAmount: confirmedAmount } : {}),
          metadata: {
            ...(currentMeta ?? {}),
            confirmedByAdminId: admin.id,
            confirmedNotes: notes ?? null,
            confirmedAt: new Date().toISOString(),
          },
        },
        select: {
          id: true,
          status: true,
          saleAmount: true,
          confirmedAt: true,
        },
      });
    });

    logger.log('[Confirm Sale] 판매 최종 확정 완료', {
      adminId: admin.id,
      saleId,
      previousStatus: sale.status,
    });

    return NextResponse.json({
      ok: true,
      message: '판매가 최종 확정되었습니다',
      sale: {
        id: updatedSale.id,
        status: updatedSale.status,
        saleAmount: updatedSale.saleAmount,
        confirmedAt: updatedSale.confirmedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logger.error('[Confirm Sale] Error:', error);
    return NextResponse.json(
      { ok: false, error: '판매 확정 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
