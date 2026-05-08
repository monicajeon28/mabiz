export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/adjustments/[adjustmentId]/approve/route.ts
// 수당 조정 개별 승인/거부 API

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
    logger.error('[Approve Adjustment] Auth error:', error);
    return null;
  }
}

/**
 * POST /api/admin/affiliate/adjustments/[adjustmentId]/approve
 * 수당 조정 건을 승인 또는 거부합니다.
 * 요청: { action: 'APPROVED' | 'REJECTED', reason?: string }
 * - APPROVED: CommissionLedger 금액을 조정 금액만큼 가감
 * - REJECTED: 상태만 변경 (원장 금액 변경 없음)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ adjustmentId: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const { adjustmentId: adjustmentIdStr } = await params;
    const adjustmentId = parseInt(adjustmentIdStr);
    if (isNaN(adjustmentId)) {
      return NextResponse.json(
        { ok: false, error: '올바른 조정 ID가 아닙니다' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action, reason } = body ?? {};

    if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'action은 APPROVED 또는 REJECTED이어야 합니다' },
        { status: 400 }
      );
    }

    // 조정 내역 조회
    const adjustment = await prisma.commissionAdjustment.findUnique({
      where: { id: adjustmentId },
      include: { CommissionLedger: true },
    });

    if (!adjustment) {
      return NextResponse.json(
        { ok: false, error: '조정 내역을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (adjustment.status !== 'PENDING') {
      return NextResponse.json(
        { ok: false, error: '대기 중인 조정 내역만 처리할 수 있습니다' },
        { status: 400 }
      );
    }

    // 승인 시 금액 검증
    if (action === 'APPROVED' && adjustment.CommissionLedger) {
      const MAX_ADJUSTMENT = 10_000_000;
      if (Math.abs(adjustment.amount) > MAX_ADJUSTMENT) {
        return NextResponse.json(
          {
            ok: false,
            error: `조정 금액이 허용 범위(최대 ${MAX_ADJUSTMENT.toLocaleString()}원)를 초과합니다`,
          },
          { status: 400 }
        );
      }

      const finalAmount = adjustment.CommissionLedger.amount + adjustment.amount;
      if (finalAmount < 0) {
        return NextResponse.json(
          { ok: false, error: '조정 후 금액이 음수가 됩니다. 조정 금액을 확인해주세요' },
          { status: 400 }
        );
      }
    }

    // 트랜잭션으로 원자적 처리
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.commissionAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: action,
          approvedById: admin.id,
          decidedAt: new Date(),
        },
        include: { CommissionLedger: true },
      });

      // 승인된 경우 원장 금액 업데이트
      if (action === 'APPROVED' && result.CommissionLedger) {
        const newAmount = result.CommissionLedger.amount + result.amount;
        await tx.commissionLedger.update({
          where: { id: result.ledgerId },
          data: { amount: Math.round(newAmount) },
        });

        logger.log('[Approve Adjustment] 원장 금액 업데이트', {
          adjustmentId,
          ledgerId: result.ledgerId,
          originalAmount: result.CommissionLedger.amount,
          adjustmentAmount: result.amount,
          finalAmount: newAmount,
          approvedBy: admin.id,
        });
      }

      return result;
    });

    return NextResponse.json({
      ok: true,
      message: action === 'APPROVED' ? '조정이 승인되었습니다' : '조정이 거부되었습니다',
      adjustment: {
        id: updated.id,
        status: updated.status,
        decidedAt: updated.decidedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logger.error('[Approve Adjustment] Error:', error);
    return NextResponse.json(
      { ok: false, error: '조정 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
