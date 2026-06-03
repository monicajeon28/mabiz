/**
 * POST /api/statements/[id]/confirm
 * AffiliatePayslip 상태 업데이트 (GLOBAL_ADMIN / OWNER 전용)
 *
 * 경로 파라미터:
 * - id: AffiliatePayslip.id (Int)
 *
 * 요청 바디:
 * - action: "approve" | "send"
 *   - "approve": PENDING → APPROVED
 *   - "send":    APPROVED → SENT (paidAt 자동 설정)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

type ConfirmAction = 'approve' | 'send';

interface ConfirmBody {
  action: ConfirmAction;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { role, organizationId } = session;

    // GLOBAL_ADMIN만 승인/지급 처리 가능
    if (role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '본사 관리자만 정산을 승인할 수 있습니다.' },
        { status: 403 }
      );
    }

    const { id: idParam } = params;
    const payslipId = parseInt(idParam, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const body: ConfirmBody = await req.json();
    const { action } = body;

    if (action !== 'approve' && action !== 'send') {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'action은 "approve" 또는 "send"여야 합니다.' },
        { status: 400 }
      );
    }

    // GLOBAL_ADMIN 전용 — 역할 체크(line 41)가 IDOR 방어 역할
    const payslip = await prisma.affiliatePayslip.findFirst({
      where: { id: payslipId },
    });

    if (!payslip) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '정산 내역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 상태 전환 검증
    if (action === 'approve') {
      if (payslip.status !== 'PENDING') {
        return NextResponse.json(
          {
            ok: false,
            error: 'INVALID_STATUS',
            message: `PENDING 상태에서만 승인할 수 있습니다. 현재 상태: ${payslip.status}`,
          },
          { status: 409 }
        );
      }
    } else if (action === 'send') {
      if (payslip.status !== 'APPROVED') {
        return NextResponse.json(
          {
            ok: false,
            error: 'INVALID_STATUS',
            message: `APPROVED 상태에서만 지급 처리할 수 있습니다. 현재 상태: ${payslip.status}`,
          },
          { status: 409 }
        );
      }
    }

    // 상태 업데이트
    const updateData =
      action === 'approve'
        ? { status: 'APPROVED' }
        : { status: 'SENT', paidAt: new Date() };

    const updated = await prisma.affiliatePayslip.update({
      where: { id: payslipId },
      data: updateData,
    });

    logger.info('[POST /api/statements/[id]/confirm]', {
      payslipId,
      action,
      role,
      organizationId,
      newStatus: updated.status,
    });

    return NextResponse.json({
      ok: true,
      payslip: {
        id: updated.id,
        agentId: updated.agentId,
        yearMonth: updated.yearMonth,
        baseCommission: Number(updated.baseCommission),
        bonus: updated.bonus ? Number(updated.bonus) : null,
        deduction: updated.deduction ? Number(updated.deduction) : null,
        netAmount: Number(updated.netAmount),
        status: updated.status,
        paidAt: updated.paidAt ? updated.paidAt.toISOString() : null,
        note: updated.note ?? null,
        agentDisplayName: updated.agentDisplayName ?? null,
        agentMallUserId: updated.agentMallUserId ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });

  } catch (err) {
    logger.error('[POST /api/statements/[id]/confirm]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
