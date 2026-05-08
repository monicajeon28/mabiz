export const dynamic = 'force-dynamic';

/**
 * 관리자 - 랜딩페이지 결제 환불 API
 * POST /api/admin/payapp-sales/[id]/refund
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cancelLandingPayment } from '@/lib/payapp';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 결제 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { partcancel, cancelprice, reason } = body;

    // 결제 레코드 조회
    const payment = await prisma.payAppPayment.findUnique({
      where: { id: paymentId },
      include: {
        LandingPage: {
          select: { title: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { ok: false, error: '결제 내역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 환불 가능한 상태 확인
    if (!['paid', 'partial_refunded'].includes(payment.status)) {
      return NextResponse.json(
        { ok: false, error: '환불할 수 없는 상태입니다. (결제완료 또는 부분환불 상태만 환불 가능)' },
        { status: 400 }
      );
    }

    // mulNo 확인
    if (!payment.mulNo) {
      return NextResponse.json(
        { ok: false, error: 'PayApp 결제요청번호가 없어 환불할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 부분 환불 금액 검증
    const isPartialRefund = partcancel === '1' || partcancel === true;
    const refundableAmount = payment.amount - (payment.refundAmount || 0);

    if (isPartialRefund) {
      if (!cancelprice || cancelprice <= 0) {
        return NextResponse.json(
          { ok: false, error: '부분 환불 금액을 입력해주세요.' },
          { status: 400 }
        );
      }
      if (cancelprice > refundableAmount) {
        return NextResponse.json(
          { ok: false, error: `환불 가능 금액(${refundableAmount.toLocaleString()}원)을 초과했습니다.` },
          { status: 400 }
        );
      }
    }

    // PayApp 환불 API 호출
    const result = await cancelLandingPayment({
      mul_no: payment.mulNo,
      partcancel: isPartialRefund ? '1' : '0',
      cancelprice: isPartialRefund ? cancelprice : undefined,
    });

    if (result.state !== '1') {
      console.error('[Admin PayApp Refund] 환불 실패:', result.errorMessage);
      return NextResponse.json(
        { ok: false, error: result.errorMessage || '환불 처리에 실패했습니다.' },
        { status: 400 }
      );
    }

    // DB 업데이트
    const actualRefundAmount = isPartialRefund ? cancelprice : payment.amount;
    const newTotalRefunded = (payment.refundAmount || 0) + actualRefundAmount;
    const isFullyRefunded = newTotalRefunded >= payment.amount;

    await prisma.payAppPayment.update({
      where: { id: paymentId },
      data: {
        status: isFullyRefunded ? 'refunded' : 'partial_refunded',
        refundedAt: new Date(),
        refundAmount: newTotalRefunded,
        refundReason: reason || (isPartialRefund ? '부분 환불' : '전체 환불'),
        metadata: {
          ...(payment.metadata as any || {}),
          refund_history: [
            ...((payment.metadata as any)?.refund_history || []),
            {
              amount: actualRefundAmount,
              reason: reason,
              refundedAt: new Date().toISOString(),
              isPartial: isPartialRefund,
            },
          ],
        },
      },
    });

    console.log('[Admin PayApp Refund] 환불 완료:', {
      paymentId,
      mulNo: payment.mulNo,
      refundAmount: actualRefundAmount,
      isPartial: isPartialRefund,
    });

    return NextResponse.json({
      ok: true,
      message: isPartialRefund
        ? `${actualRefundAmount.toLocaleString()}원 부분 환불이 완료되었습니다.`
        : '전체 환불이 완료되었습니다.',
      payment: {
        id: paymentId,
        status: isFullyRefunded ? 'refunded' : 'partial_refunded',
        refundAmount: newTotalRefunded,
        refundableAmount: payment.amount - newTotalRefunded,
      },
    });
  } catch (error: any) {
    console.error('[Admin PayApp Refund] 오류:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || '환불 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
