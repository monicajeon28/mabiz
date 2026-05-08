export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { processRefund } from '@/lib/affiliate/refund';
import { logger } from '@/lib/logger';
import { validateCsrfToken, getCsrfErrorResponse } from '@/lib/utils/csrfValidation';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * POST: 판매 건 환불 처리
 * - Lead 상태도 'REFUNDED'로 업데이트하여 판매원/대리점장에게 표시
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    const { saleId: saleIdStr } = await params;
    const csrfValidation = validateCsrfToken(req);
    if (!csrfValidation.valid) {
      return getCsrfErrorResponse(csrfValidation.error || '잘못된 요청입니다.');
    }
    const saleId = Number(saleIdStr);
    if (!saleId || Number.isNaN(saleId)) {
      return NextResponse.json({ ok: false, message: 'Invalid sale ID' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const body = await req.json().catch(() => ({}));
    const reason = (body?.reason || '').trim();

    if (!reason) {
      return NextResponse.json({ ok: false, message: '환불 사유는 필수입니다.' }, { status: 400 });
    }

    // processRefund 함수 사용 (Lead 상태도 자동 업데이트됨)
    const result = await processRefund(saleId, reason, sessionUser.id);

    // 관리자 액션 로그 기록
    await prisma.adminActionLog.create({
      data: {
        adminId: sessionUser.id,
        targetUserId: null,
        action: 'affiliate.sale.refunded',
        details: {
          saleId: result.sale.id,
          reason: reason,
          saleAmount: result.sale.saleAmount,
          leadId: result.sale.leadId,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sale: {
        ...result.sale,
        refundedAt: result.sale.refundedAt?.toISOString() || null,
        saleDate: result.sale.saleDate?.toISOString() || null,
        createdAt: result.sale.createdAt.toISOString(),
        updatedAt: result.sale.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    const { saleId: saleIdStr } = await params;
    if (error?.code === 'CONCURRENT_REFUND') {
      return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
    }
    // 비즈니스 에러(판매 없음/이미 환불 등)는 그대로 노출, 시스템 에러는 마스킹
    const isBusinessError = typeof error?.message === 'string' && !error?.message.includes('Prisma') && !error?.message.includes('Error:');
    logger.error(`[Refund] Sale ${saleIdStr}`, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: isBusinessError ? error.message : '환불 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
