import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q      = searchParams.get('q')?.trim() ?? '';
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit  = 20;

    // ── 1단계: buyerName 검색 — Payment에서 이름으로 orderId 미리 수집 ──
    // AffiliateSale엔 구매자 이름이 없으므로 Payment를 먼저 조회
    let extraOrderIds: string[] = [];
    if (q && q.length >= 2 && !/^\d/.test(q)) {
      // 숫자로 시작하지 않으면 이름 검색 가능성 → Payment에서 buyerName 검색
      const matchedPayments = await prisma.payment.findMany({
        where: { buyerName: { contains: q, mode: 'insensitive' } },
        select: { orderId: true },
        take: 50,
      });
      extraOrderIds = matchedPayments.map(p => p.orderId);
    }

    // ── 2단계: AffiliateSale 검색 (조직 소유 필터 + 전체 상태) ──
    const sales = await prisma.affiliateSale.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['PENDING', 'EARNED', 'PAID', 'CANCELLED'] },
        ...(q ? {
          OR: [
            { orderId:      { contains: q, mode: 'insensitive' } },
            { productName:  { contains: q, mode: 'insensitive' } },
            { customerPhone: { startsWith: q } },
            // buyerName 검색 결과 포함 (이름으로 찾은 orderId)
            ...(extraOrderIds.length > 0
              ? [{ orderId: { in: extraOrderIds } }]
              : []),
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true, orderId: true, productName: true, saleAmount: true,
        status: true, customerPhone: true, createdAt: true,
      },
    });

    const hasMore    = sales.length > limit;
    const items      = hasMore ? sales.slice(0, limit) : sales;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // ── 3단계: Payment 배치 조회 (구매자명 + 상태 + 환불자명) ──
    const orderIds = items.filter(s => s.orderId).map(s => s.orderId as string);
    const payments = orderIds.length > 0
      ? await prisma.payment.findMany({
          where: { orderId: { in: orderIds } },
          select: {
            orderId: true, buyerName: true, buyerTel: true,
            status: true, paidAt: true, cancelledAt: true, metadata: true,
          },
        })
      : [];

    const payMap = new Map(payments.map(p => [p.orderId, p]));

    const result = items.map(s => {
      const pay = s.orderId ? payMap.get(s.orderId) : undefined;
      // metadata에 환불 요청자 이름이 있으면 추출 (선택적)
      const refunderName =
        (pay?.metadata as { refunderName?: string } | null)?.refunderName ?? null;

      return {
        saleId:        s.id,
        orderId:       s.orderId,
        productName:   s.productName,
        saleAmount:    s.saleAmount,
        saleStatus:    s.status,
        customerPhone: s.customerPhone, // 이미 마스킹 저장됨
        createdAt:     s.createdAt,
        // Payment 정보
        buyerName:     pay?.buyerName ?? null,
        buyerTel:      pay?.buyerTel ? pay.buyerTel.substring(0, 4) + '****' : null,
        refunderName,  // 환불 요청자 (구매자와 다를 수 있음)
        paymentStatus: pay?.status ?? null,
        paidAt:        pay?.paidAt ?? null,
        cancelledAt:   pay?.cancelledAt ?? null,
        // 서류 발급 가능 여부
        // 구매확인증서: 결제완료(completed)만
        canIssuePurchaseCert: pay?.status === 'completed',
        // 환불증서: 결제완료(예정 환불증서) + 환불완료(cancelled) 모두 허용
        canIssueRefundCert: pay?.status === 'completed' || pay?.status === 'cancelled',
      };
    });

    logger.log('[SalesSearch] 조회', { orgId, q: q.substring(0, 10), count: result.length });
    return NextResponse.json({ ok: true, sales: result, nextCursor, hasMore });
  } catch (e) {
    logger.log('[SalesSearch] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
