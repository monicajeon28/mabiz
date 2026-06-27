import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';
import { BANK_TRANSFER_LABEL } from '@/lib/company-info';
import { refundPolicyToLines, normalizeRefundPolicy, type RefundPolicyJson } from '@/lib/refund-calculator';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// POST: 구매확인증서 발급 요청
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    // FREE_SALES 체크를 requireOrgId 전에 해야 500 대신 403 반환
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한 없음' }, { status: 403 });
    }
    const orgId = requireOrgId(ctx);

    const body = await req.json() as {
      orderId?: string;
      note?: string;
      direct?: Record<string, unknown>;
    };

    // ── 직접입력 발급(주문번호 없음) — 수동 데이터로 SalesDocument 저장 ──────────
    // 직접입력은 시스템에 Payment/주문이 없는 수동·오프라인 케이스용. 과거엔 클라이언트
    // state로 PNG만 만들고 저장 안 해 승인큐·감사·이메일·보관이 전무했음(법무 누락).
    if (!body.orderId && body.direct) {
      const d = body.direct as {
        buyerName?: string | null; buyerTel?: string | null; buyerEmail?: string | null;
        productName?: string | null; amount?: number | null;
      };
      if (!d.buyerName || !d.productName || d.amount == null) {
        return NextResponse.json({ ok: false, message: '직접 입력: 고객명·상품명·금액 필수' }, { status: 400 });
      }
      const status = (ctx.role === 'OWNER' || ctx.role === 'GLOBAL_ADMIN') ? 'APPROVED' : 'PENDING_APPROVAL';
      const generatedData = { ...body.direct, issuedAt: new Date().toISOString(), issuerOrgId: orgId, source: 'direct' };

      const doc = await prisma.$transaction(async (tx) => {
        const newDoc = await tx.salesDocument.create({
          data: {
            organizationId: orgId,
            documentType:   'PURCHASE_CONFIRMATION',
            status,
            orderId:        null,
            affiliateSaleId: null,
            createdBy:      ctx.userId,
            generatedData,
          },
          select: { id: true, status: true },
        });
        if (status === 'APPROVED') {
          await tx.salesDocumentApproval.create({
            data: {
              documentId:     newDoc.id,
              organizationId: orgId,
              requestedBy:    ctx.userId,
              approvedBy:     ctx.userId,
              status:         'APPROVED',
              processedAt:    new Date(),
            },
          });
        }
        return newDoc;
      });

      if (d.buyerEmail) {
        sendFunnelEmail({
          organizationId: orgId,
          to:      d.buyerEmail,
          subject: `[구매확인증] ${d.productName} 구매 확인증이 발급되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매 확인증 발급 안내</h2>
<p>${escHtml(d.buyerName ?? '')}님, 아래 내용으로 구매 확인증이 발급되었습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${escHtml(d.productName ?? '')}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">결제금액</td><td style="padding:10px 14px;font-weight:600">${Number(d.amount).toLocaleString()}원</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${escHtml(doc.id)}</td></tr>
</table>
<p style="color:#666;font-size:14px">문의사항이 있으시면 담당 에이전트에게 연락해 주세요.</p>
</div>`,
          channel: 'MANUAL',
        }).catch((e: unknown) => logger.error('[PurchaseCert] 직접발급 이메일 실패', { e }));
      }

      logger.log('[PurchaseCert] 직접입력 발급', { orgId, status, role: ctx.role });
      return NextResponse.json({ ok: true, documentId: doc.id, status, isReissue: false, generatedData });
    }

    if (!body.orderId) {
      return NextResponse.json({ ok: false, message: 'orderId 필수' }, { status: 400 });
    }

    // 1. Payment 조회 (크루즈닷 동일 DB)
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

    // 4. 결제 방법 판단
    const paymentMethod = payment.pgProvider
      ? `${payment.pgProvider} (온라인 결제)`
      : BANK_TRANSFER_LABEL;

    // 5. SalesDocument 생성 (AGENT는 PENDING_APPROVAL, OWNER/ADMIN은 APPROVED)
    const status = (ctx.role === 'OWNER' || ctx.role === 'GLOBAL_ADMIN') ? 'APPROVED' : 'PENDING_APPROVAL';

    // 발급 시점 상품별 환불정책 스냅샷 (재조회/새로고침/PNG 재생성 시에도 그 상품의 규정 보존)
    // refund-cert/route.ts 패턴 재사용 — metadata.productCode 로 CruiseProduct.refundPolicy 조회.
    let refundPolicy: RefundPolicyJson | null = null;
    let refundPolicyLines: { label: string; value: string }[] = [];
    try {
      const productCode = (payment.metadata as { productCode?: string })?.productCode ?? '';
      if (productCode) {
        const product = await prisma.cruiseProduct.findUnique({
          where: { productCode },
          select: { refundPolicy: true },
        });
        refundPolicy = normalizeRefundPolicy(product?.refundPolicy);
        refundPolicyLines = refundPolicyToLines(refundPolicy);
      }
    } catch (productErr) {
      logger.log('[PurchaseCert] 상품 환불정책 조회 실패 — 폴백(법정요약)', { error: productErr instanceof Error ? productErr.message : String(productErr) });
    }

    // 미리보기/PNG 렌더용 데이터 (응답에 그대로 반환)
    const generatedData = {
      buyerName:     payment.buyerName,
      buyerTel:      payment.buyerTel,
      buyerEmail:    payment.buyerEmail ?? null,
      amount:        payment.amount,
      productName:   payment.productName ?? '크루즈 상품',
      paidAt:        payment.paidAt?.toISOString() ?? null,
      paymentMethod,
      // 상품별 환불정책 스냅샷 (없으면 null/빈배열 → 클라이언트가 법정요약으로 폴백)
      refundPolicy,
      refundPolicyLines,
      issuedAt:      new Date().toISOString(),
      issuerOrgId:   orgId,
    };

    // 원자적 생성: SalesDocument + 승인 기록을 단일 트랜잭션으로 처리
    const { doc, isReissue } = await prisma.$transaction(async (tx) => {
      const prevCount = await tx.salesDocument.count({
        where: { orderId: body.orderId, documentType: 'PURCHASE_CONFIRMATION', status: 'APPROVED' },
      });

      const newDoc = await tx.salesDocument.create({
        data: {
          organizationId: orgId,
          documentType:   'PURCHASE_CONFIRMATION',
          status,
          orderId:        body.orderId,
          affiliateSaleId: sale.id,
          createdBy:      ctx.userId,
          generatedData,
        },
        select: { id: true, status: true },
      });

      if (status === 'APPROVED') {
        await tx.salesDocumentApproval.create({
          data: {
            documentId:     newDoc.id,
            organizationId: orgId,
            requestedBy:    ctx.userId,
            approvedBy:     ctx.userId,
            status:         'APPROVED',
            processedAt:    new Date(),
          },
        });
      }

      return { doc: newDoc, isReissue: prevCount > 0 };
    });

    // 이메일 발송 (fire-and-forget) — 발급 시 항상 발송.
    // AGENT 발급분(PENDING_APPROVAL)은 승인 UI가 별도로 없어 메일이 영영 안 나가던 문제 해소.
    {
      const recipientEmail = payment.buyerEmail;
      if (recipientEmail) {
        sendFunnelEmail({
          organizationId: orgId,
          to:      recipientEmail,
          subject: `[구매확인증] ${payment.productName ?? '크루즈 상품'} 구매 확인증이 발급되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매 확인증 발급 안내</h2>
<p>${escHtml(payment.buyerName ?? '')}님, 아래 내용으로 구매 확인증이 발급되었습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${escHtml(payment.productName ?? '크루즈 상품')}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">결제금액</td><td style="padding:10px 14px;font-weight:600">${payment.amount.toLocaleString()}원</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">결제일시</td><td style="padding:10px 14px">${payment.paidAt ? escHtml(new Date(payment.paidAt).toLocaleString('ko-KR')) : '-'}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${escHtml(doc.id)}</td></tr>
</table>
<p style="color:#666;font-size:14px">문의사항이 있으시면 담당 에이전트에게 연락해 주세요.</p>
</div>`,
          channel: 'MANUAL',
        }).catch((e: unknown) => logger.error('[PurchaseCert] 이메일 발송 실패', { e }));
      }
    }

    logger.log('[PurchaseCert] 발급 요청', { orgId, orderId: body.orderId, status, role: ctx.role, isReissue });
    return NextResponse.json({ ok: true, documentId: doc.id, status, isReissue, generatedData });
  } catch (e) {
    logger.log('[PurchaseCert] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// GET: 구매확인증서 목록
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });
    const orgId = requireOrgId(ctx);

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
