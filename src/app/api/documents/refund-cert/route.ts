import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, message: 'OWNER 이상만 환불증서 신청 가능' }, { status: 403 });
    }

    const body = await req.json() as {
      orderId?: string;
      note?: string;
      cancellationRequestedAt?: string;
      refunderName?: string; // 환불 요청자 이름 (구매자와 다를 수 있음)
    };
    if (!body.orderId) return NextResponse.json({ ok: false, message: 'orderId 필수' }, { status: 400 });

    // Payment 조회 — 취소 완료 확인
    const payment = await prisma.payment.findUnique({
      where: { orderId: body.orderId },
      select: {
        orderId: true, buyerName: true, buyerTel: true, amount: true,
        status: true, pgProvider: true, paidAt: true, cancelledAt: true,
        productName: true, affiliateCode: true, metadata: true,
      },
    });

    if (!payment) return NextResponse.json({ ok: false, message: '결제 정보 없음' }, { status: 404 });

    // 결제 완료 또는 취소 완료 상태 검증 (완화: completed 건도 환불 예정 증서 발급 허용)
    if (!['completed', 'cancelled'].includes(payment.status)) {
      return NextResponse.json({
        ok: false,
        message: '결제 완료 또는 환불 완료 건만 발급 가능합니다',
      }, { status: 400 });
    }

    // mabiz 조직 소유권 검증
    const sale = await prisma.affiliateSale.findFirst({
      where: { orderId: body.orderId, organizationId: orgId },
    });
    if (!sale) return NextResponse.json({ ok: false, message: '이 조직의 판매건이 아닙니다' }, { status: 403 });

    // 환불 계산 — cancelled이면 cancelledAt 기준, completed이면 오늘 날짜 기준 예상 환불액
    const isCancelled = payment.status === 'cancelled';
    const cancelDate = isCancelled
      ? (body.cancellationRequestedAt ? new Date(body.cancellationRequestedAt) : new Date(payment.cancelledAt!))
      : new Date(); // 아직 미취소면 오늘 기준 예상 환불액

    // Trip 데이터로 출발일 조회 시도 (같은 DB)
    let departureDate: Date | null = null;
    try {
      const productCode = (payment.metadata as { productCode?: string })?.productCode ?? '';
      const trip = await prisma.$queryRaw<{ departureDate: Date }[]>`
        SELECT "departureDate" FROM "Trip" WHERE "productCode" = ${productCode} LIMIT 1`;
      if (trip[0]?.departureDate) departureDate = trip[0].departureDate;
    } catch { /* Trip 없으면 패스 */ }

    // 환불 계산
    let refundCalc = {
      refundAmount: payment.amount,
      penaltyRate: 0,
      penaltyAmount: 0,
      daysBeforeDep: -1,
      basis: '법정기준(관광진흥법 시행령)',
    };

    if (departureDate) {
      try {
        const { calcRefundAmount } = await import('@/lib/refund-calculator');
        refundCalc = calcRefundAmount(payment.amount, departureDate, null, cancelDate);
      } catch { /* 계산 실패 시 전액 환불로 fallback */ }
    }

    const paymentMethod = payment.pgProvider
      ? `${payment.pgProvider} (원결제수단 동일 환불)`
      : '계좌이체 환불 (담당자 확인 필요)';

    const status = ctx.role === 'GLOBAL_ADMIN' ? 'APPROVED' : 'PENDING_APPROVAL';

    const doc = await prisma.salesDocument.create({
      data: {
        organizationId: orgId,
        documentType:   'REFUND_CERTIFICATE',
        status,
        orderId:        body.orderId,
        affiliateSaleId: sale.id,
        createdBy:      ctx.userId,
        generatedData: {
          buyerName:                payment.buyerName,
          buyerTel:                 payment.buyerTel.substring(0, 4) + '****',
          amount:                   payment.amount,
          productName:              payment.productName ?? '크루즈 상품',
          paidAt:                   payment.paidAt?.toISOString() ?? null,
          cancelledAt:              payment.cancelledAt?.toISOString() ?? null,
          cancellationRequestedAt:  cancelDate.toISOString(),
          isRefundPending:          !isCancelled, // completed 건 = 환불 예정 증서
          departureDate:            departureDate?.toISOString() ?? null,
          refundAmount:             refundCalc.refundAmount,
          penaltyRate:              refundCalc.penaltyRate,
          penaltyAmount:            refundCalc.penaltyAmount,
          daysBeforeDep:            refundCalc.daysBeforeDep,
          refundBasis:              refundCalc.basis,
          paymentMethod,
          companyAccount:           '국민은행 531301-04-167150 (배연성/크루즈닷)',
          issuedAt:                 new Date().toISOString(),
          note:                     body.note ?? null,
          refunderName:             body.refunderName ?? null, // 환불 요청자 (구매자 ≠ 환불자인 경우)
        },
      },
      select: { id: true, status: true },
    });

    if (status === 'APPROVED') {
      await prisma.salesDocumentApproval.create({
        data: {
          documentId: doc.id, organizationId: orgId,
          requestedBy: ctx.userId, approvedBy: ctx.userId,
          status: 'APPROVED', processedAt: new Date(),
        },
      });
    }

    logger.log('[RefundCert] 발급', { orgId, orderId: body.orderId, status, refundAmount: refundCalc.refundAmount });
    return NextResponse.json({ ok: true, documentId: doc.id, status, refundCalc });
  } catch (e) {
    logger.log('[RefundCert] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const docs = await prisma.salesDocument.findMany({
      where: { organizationId: orgId, documentType: 'REFUND_CERTIFICATE', ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, status: true, orderId: true, createdAt: true, generatedData: true, approvedAt: true },
    });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e) {
    logger.log('[RefundCert GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
