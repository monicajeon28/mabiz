import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { cancelPayment } from '@/lib/payapp';

/**
 * POST /api/payapp/refund
 * 페이앱 결제 취소/환불 (전체 + 부분)
 * B2B 전용 — PayAppPayment 테이블만 사용
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const body = await req.json();

    const { paymentId, reason, partcancel = false, cancelprice } = body as {
      paymentId: string;
      reason: string;
      partcancel?: boolean;
      cancelprice?: number;
    };

    if (!paymentId || !reason) {
      return NextResponse.json({ ok: false, message: 'paymentId, reason 필수' }, { status: 400 });
    }

    const payment = await prisma.payAppPayment.findFirst({
      where: { id: paymentId, organizationId: orgId },
    });

    if (!payment) {
      return NextResponse.json({ ok: false, message: '결제 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!['paid', 'partial_refunded'].includes(payment.status)) {
      return NextResponse.json({ ok: false, message: `환불 불가 상태입니다: ${payment.status}` }, { status: 400 });
    }

    if (!payment.mulNo) {
      return NextResponse.json({ ok: false, message: 'PayApp 결제번호(mulNo)가 없어 환불할 수 없습니다.' }, { status: 400 });
    }

    if (partcancel && (!cancelprice || cancelprice <= 0)) {
      return NextResponse.json({ ok: false, message: '부분환불 시 금액을 입력해주세요.' }, { status: 400 });
    }

    // PayApp API 호출
    const result = await cancelPayment({
      mulNo: payment.mulNo,
      cancelmemo: reason,
      partcancel,
      cancelprice: partcancel ? cancelprice : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
    }

    // DB 업데이트
    const refundAmount = partcancel ? (cancelprice ?? 0) : payment.amount;
    const newTotalRefunded = (payment.refundAmount ?? 0) + refundAmount;
    const isFullyRefunded = newTotalRefunded >= payment.amount;

    // 부분환불 이력
    const existingMeta = (payment.metadata ?? {}) as Record<string, unknown>;
    const existingHistory = (existingMeta.refund_history ?? []) as Record<string, unknown>[];
    const refundEntry: Record<string, unknown> = {
      amount: refundAmount,
      reason,
      date: new Date().toISOString(),
      type: partcancel ? 'partial' : 'full',
    };

    const updatedMetadata: Record<string, unknown> = {
      ...existingMeta,
      refund_history: [...existingHistory, refundEntry],
    };

    await prisma.payAppPayment.update({
      where: { id: paymentId },
      data: {
        status: isFullyRefunded ? 'refunded' : 'partial_refunded',
        refundedAt: new Date(),
        refundAmount: newTotalRefunded,
        refundReason: reason,
        metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
      },
    });

    logger.log('[PayApp/Refund] 환불 처리 완료', {
      paymentId,
      type: partcancel ? '부분환불' : '전체환불',
      refundAmount,
      newTotalRefunded,
    });

    return NextResponse.json({ ok: true, refundAmount, totalRefunded: newTotalRefunded });
  } catch (err) {
    logger.error('[PayApp/Refund] 환불 처리 실패', { err });
    return NextResponse.json({ ok: false, message: '환불 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
