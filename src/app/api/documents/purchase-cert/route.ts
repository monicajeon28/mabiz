import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// POST: 구매확인증서 발급 요청
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // FREE_SALES 차단
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한 없음' }, { status: 403 });
    }

    const body = await req.json() as { orderId?: string; note?: string };
    if (!body.orderId) {
      return NextResponse.json({ ok: false, message: 'orderId 필수' }, { status: 400 });
    }

    // 1. Payment 조회 (크루즈닷 동일 DB)
    const payment = await prisma.payment.findUnique({
      where: { orderId: body.orderId },
      select: {
        orderId: true, buyerName: true, buyerTel: true, amount: true,
        status: true, pgProvider: true, paidAt: true, productName: true,
        affiliateCode: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ ok: false, message: '결제 정보 없음' }, { status: 404 });
    }

    // 2. 미결제 차단 (CLAUDE.md 조항3: 미완료 판매 수당 계산 금지)
    if (payment.status !== 'completed') {
      return NextResponse.json({ ok: false, message: '결제 완료 건만 발급 가능합니다' }, { status: 400 });
    }

    // 3. mabiz AffiliateSale 조직 소유권 검증
    const sale = await prisma.affiliateSale.findFirst({
      where: { orderId: body.orderId, organizationId: orgId },
    });
    if (!sale) {
      return NextResponse.json({ ok: false, message: '이 조직의 판매건이 아닙니다' }, { status: 403 });
    }

    // 3-1. 재발급 여부 확인 (중복 발급 허용, 안내만)
    const existingCount = await prisma.salesDocument.count({
      where: { orderId: body.orderId, documentType: 'PURCHASE_CONFIRMATION', status: 'APPROVED' },
    });

    // 4. 결제 방법 판단
    const paymentMethod = payment.pgProvider
      ? `${payment.pgProvider} (온라인 결제)`
      : '계좌이체 (국민은행 531301-04-167150 / 예금주: 배연성)';

    // 5. SalesDocument 생성 (AGENT는 PENDING_APPROVAL, OWNER/ADMIN은 APPROVED)
    const status = (ctx.role === 'OWNER' || ctx.role === 'GLOBAL_ADMIN') ? 'APPROVED' : 'PENDING_APPROVAL';

    const doc = await prisma.salesDocument.create({
      data: {
        organizationId: orgId,
        documentType:   'PURCHASE_CONFIRMATION',
        status,
        orderId:        body.orderId,
        affiliateSaleId: sale.id,
        createdBy:      ctx.userId,
        generatedData: {
          buyerName:     payment.buyerName,
          buyerTel:      payment.buyerTel.substring(0, 4) + '****', // 마스킹
          amount:        payment.amount,
          productName:   payment.productName ?? '크루즈 상품',
          paidAt:        payment.paidAt?.toISOString() ?? null,
          paymentMethod,
          issuedAt:      new Date().toISOString(),
          issuerOrgId:   orgId,
        },
      },
      select: { id: true, status: true },
    });

    // OWNER/ADMIN이면 승인 기록도 생성
    if (status === 'APPROVED') {
      await prisma.salesDocumentApproval.create({
        data: {
          documentId:     doc.id,
          organizationId: orgId,
          requestedBy:    ctx.userId,
          approvedBy:     ctx.userId,
          status:         'APPROVED',
          processedAt:    new Date(),
        },
      });
    }

    logger.log('[PurchaseCert] 발급 요청', { orgId, orderId: body.orderId, status, role: ctx.role, isReissue: existingCount > 0 });
    return NextResponse.json({ ok: true, documentId: doc.id, status, isReissue: existingCount > 0 });
  } catch (e) {
    logger.log('[PurchaseCert] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// GET: 구매확인증서 목록
export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const docs = await prisma.salesDocument.findMany({
      where: {
        organizationId: orgId,
        documentType:   'PURCHASE_CONFIRMATION',
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, status: true, orderId: true, createdAt: true,
        generatedData: true, approvedAt: true,
      },
    });

    return NextResponse.json({ ok: true, documents: docs });
  } catch (e) {
    logger.log('[PurchaseCert GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
