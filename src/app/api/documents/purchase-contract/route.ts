import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';

// POST: 구매계약서 발급
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한 없음' }, { status: 403 });
    }

    const body = await req.json() as {
      orderId: string;
      specialTerms?: string;  // 특약사항
      signedAt?: string;      // 계약 서명일 (없으면 오늘)
    };

    if (!body.orderId) {
      return NextResponse.json({ ok: false, message: 'orderId 필수' }, { status: 400 });
    }

    // 결제 정보 조회
    const payment = await prisma.payment.findUnique({
      where: { orderId: body.orderId },
      select: {
        orderId: true, buyerName: true, buyerTel: true, buyerEmail: true,
        amount: true, status: true, pgProvider: true, paidAt: true,
        productName: true, affiliateCode: true, metadata: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ ok: false, message: '결제 정보 없음' }, { status: 404 });
    }

    if (payment.status !== 'completed') {
      return NextResponse.json({ ok: false, message: '결제 완료 건만 계약서 발급 가능합니다' }, { status: 400 });
    }

    // 조직 소유권 검증
    const sale = await prisma.affiliateSale.findFirst({
      where: { orderId: body.orderId, organizationId: orgId },
      select: { id: true, saleAmount: true, affiliateCode: true },
    });
    if (!sale) {
      return NextResponse.json({ ok: false, message: '이 조직의 판매건이 아닙니다' }, { status: 403 });
    }

    // 출발일 조회 시도
    let departureDate: string | null = null;
    let nights: number | null = null;
    try {
      const productCode = (payment.metadata as { productCode?: string })?.productCode ?? '';
      if (productCode) {
        const trip = await prisma.$queryRaw<{ departureDate: Date; nights: number | null }[]>`
          SELECT "departureDate", "nights" FROM "Trip"
          WHERE "productCode" = ${productCode} LIMIT 1`;
        if (trip[0]?.departureDate) {
          departureDate = trip[0].departureDate.toISOString().split('T')[0] ?? null;
          nights = trip[0].nights ?? null;
        }
      }
    } catch { /* Trip 없으면 패스 */ }

    const paymentMethod = payment.pgProvider
      ? `${payment.pgProvider} (온라인 결제)`
      : '계좌이체 (국민은행 531301-04-167150 / 예금주: 배연성)';

    const signedAt = body.signedAt ?? new Date().toISOString().split('T')[0];

    // AGENT → PENDING_APPROVAL, OWNER/ADMIN → APPROVED
    const status = (ctx.role === 'GLOBAL_ADMIN' || ctx.role === 'OWNER') ? 'APPROVED' : 'PENDING_APPROVAL';

    const doc = await prisma.salesDocument.create({
      data: {
        organizationId: orgId,
        documentType:   'PURCHASE_CONTRACT',
        status,
        orderId:        body.orderId,
        affiliateSaleId: sale.id,
        createdBy:      ctx.userId,
        generatedData: {
          // 계약 당사자
          buyerName:      payment.buyerName,
          buyerTel:       payment.buyerTel,
          buyerEmail:     payment.buyerEmail ?? null,
          // 상품 정보
          productName:    payment.productName ?? '크루즈 상품',
          departureDate,
          nights,
          // 계약 금액
          amount:         payment.amount,
          paymentMethod,
          paidAt:         payment.paidAt?.toISOString() ?? null,
          // 계약 정보
          affiliateCode:  sale.affiliateCode ?? null,
          signedAt,
          specialTerms:   body.specialTerms ?? null,
          // 취소/환불 규정 (법정 기준 요약)
          cancellationPolicy: [
            '출발 30일 이전: 위약금 없음',
            '출발 20일 이전: 여행 요금의 10%',
            '출발 10일 이전: 여행 요금의 15%',
            '출발 8일 이전: 여행 요금의 20%',
            '출발 1일 이전: 여행 요금의 30%',
            '출발 당일: 여행 요금의 50%',
          ],
          companyName:   '크루즈닷',
          companyReg:    '대표: 배연성',
          issuedAt:      new Date().toISOString(),
        },
      },
      select: { id: true, status: true },
    });

    // APPROVED면 승인 로그 + 이메일
    if (status === 'APPROVED') {
      await prisma.salesDocumentApproval.create({
        data: {
          documentId: doc.id, organizationId: orgId,
          requestedBy: ctx.userId, approvedBy: ctx.userId,
          status: 'APPROVED', processedAt: new Date(),
        },
      });

      if (payment.buyerEmail) {
        sendFunnelEmail({
          organizationId: orgId,
          to:      payment.buyerEmail,
          subject: `[구매계약서] ${payment.productName ?? '크루즈 상품'} 구매 계약서가 발급되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매 계약서 발급 안내</h2>
<p>${payment.buyerName}님, 아래 내용으로 구매 계약서가 발급되었습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${payment.productName ?? '크루즈 상품'}</td></tr>
  ${departureDate ? `<tr><td style="padding:10px 14px;color:#666">출발일</td><td style="padding:10px 14px">${departureDate}</td></tr>` : ''}
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">계약금액</td><td style="padding:10px 14px;font-weight:700;color:#2b6cb0">${payment.amount.toLocaleString()}원</td></tr>
  <tr><td style="padding:10px 14px;color:#666">결제방법</td><td style="padding:10px 14px">${paymentMethod}</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">계약일</td><td style="padding:10px 14px">${signedAt}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${doc.id}</td></tr>
</table>
${body.specialTerms ? `<p style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0"><strong>특약사항:</strong> ${body.specialTerms}</p>` : ''}
<p style="color:#666;font-size:14px">문의사항은 담당 에이전트에게 연락해 주세요.</p>
</div>`,
          channel: 'MANUAL',
        }).catch(() => {});
      }
    }

    logger.log('[PurchaseContract] 발급', { orgId, orderId: body.orderId, status, docId: doc.id });
    return NextResponse.json({ ok: true, documentId: doc.id, status });
  } catch (e) {
    logger.log('[PurchaseContract] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const docs = await prisma.salesDocument.findMany({
      where: { organizationId: orgId, documentType: 'PURCHASE_CONTRACT' },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, status: true, orderId: true, createdAt: true, generatedData: true, approvedAt: true },
    });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e) {
    logger.log('[PurchaseContract GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
