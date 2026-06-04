/**
 * Affiliate Purchase Confirmation
 * - sendPurchaseConfirmation(saleId): AffiliateSale ID 기반 구매확인증 발급 + 이메일 발송
 *
 * 기존 서비스 활용:
 *   - src/lib/email.ts sendFunnelEmail()
 *   - src/lib/prisma.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';

export interface PurchaseConfirmationResult {
  ok: boolean;
  documentId?: string;
  emailSent?: boolean;
  error?: string;
  skippedReason?: string;
}

/**
 * AffiliateSale ID로 구매확인증(PURCHASE_CONFIRMATION) 발급 + 이메일 발송
 *
 * 동작:
 * 1. AffiliateSale → orderId 조회
 * 2. Payment 조회 (결제 완료 확인)
 * 3. SalesDocument(PURCHASE_CONFIRMATION) 생성 (APPROVED 상태)
 * 4. 구매자 이메일 발송 (buyerEmail 있을 때)
 *
 * 중복 발급: 동일 orderId에 APPROVED 문서가 이미 있으면 기존 documentId 반환
 */
export async function sendPurchaseConfirmation(
  saleId: string
): Promise<PurchaseConfirmationResult> {
  try {
    // 1. AffiliateSale 조회
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        organizationId: true,
        orderId: true,
        affiliateCode: true,
        affiliateUserId: true,
        productName: true,
        saleAmount: true,
      },
    });

    if (!sale) {
      return { ok: false, error: `AffiliateSale not found: ${saleId}` };
    }

    if (!sale.orderId) {
      return {
        ok: false,
        skippedReason: `orderId 없음 — saleId: ${saleId}`,
        error: 'orderId 없음',
      };
    }

    // 2. 중복 발급 확인
    const existing = await prisma.salesDocument.findFirst({
      where: {
        orderId: sale.orderId,
        documentType: 'PURCHASE_CONFIRMATION',
        status: 'APPROVED',
      },
      select: { id: true },
    });

    if (existing) {
      logger.log('[PurchaseConfirmation] 이미 발급됨 — 기존 문서 반환', {
        saleId,
        orderId: sale.orderId,
        documentId: existing.id,
      });
      return { ok: true, documentId: existing.id, emailSent: false };
    }

    // 3. Payment 조회
    const payment = await prisma.payment.findUnique({
      where: { orderId: sale.orderId },
      select: {
        orderId: true,
        buyerName: true,
        buyerTel: true,
        buyerEmail: true,
        amount: true,
        status: true,
        pgProvider: true,
        paidAt: true,
        productName: true,
      },
    });

    // Payment 없으면 AffiliateSale 기반 데이터로 fallback 발급
    const buyerName = payment?.buyerName ?? null;
    const buyerTel = payment?.buyerTel ?? null;
    const buyerEmail = payment?.buyerEmail ?? null;
    const amount = payment?.amount ?? sale.saleAmount;
    const productName = payment?.productName ?? sale.productName;
    const paidAt = payment?.paidAt?.toISOString() ?? null;

    // 미결제 건 차단 (payment 있을 때만 상태 검증)
    if (payment && payment.status !== 'completed') {
      return {
        ok: false,
        skippedReason: `결제 미완료 — status: ${payment.status}`,
        error: '결제 완료 건만 발급 가능합니다',
      };
    }

    const paymentMethod = payment?.pgProvider
      ? `${payment.pgProvider} (온라인 결제)`
      : '계좌이체 (국민은행 531301-04-167150 / 예금주: 배연성)';

    // 4. SalesDocument 생성 (APPROVED)
    const doc = await prisma.salesDocument.create({
      data: {
        organizationId: sale.organizationId,
        documentType: 'PURCHASE_CONFIRMATION',
        status: 'APPROVED',
        orderId: sale.orderId,
        affiliateSaleId: sale.id,
        createdBy: 'SYSTEM',
        generatedData: {
          buyerName,
          buyerTel,
          buyerEmail,
          amount,
          productName: productName ?? '크루즈 상품',
          paidAt,
          paymentMethod,
          issuedAt: new Date().toISOString(),
          issuerOrgId: sale.organizationId,
          source: 'auto-sendPurchaseConfirmation',
        },
      },
      select: { id: true },
    });

    // 승인 기록
    await prisma.salesDocumentApproval.create({
      data: {
        documentId: doc.id,
        organizationId: sale.organizationId,
        requestedBy: 'SYSTEM',
        approvedBy: 'SYSTEM',
        status: 'APPROVED',
        processedAt: new Date(),
      },
    });

    // 5. 이메일 발송 (buyerEmail 있을 때)
    let emailSent = false;
    if (buyerEmail) {
      try {
        const result = await sendFunnelEmail({
          organizationId: sale.organizationId,
          to: buyerEmail,
          subject: `[구매확인증] ${productName ?? '크루즈 상품'} 구매가 확인되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매 확인증 발급 안내</h2>
${buyerName ? `<p>${buyerName}님, 아래 내용으로 구매 확인증이 발급되었습니다.</p>` : '<p>구매 확인증이 발급되었습니다.</p>'}
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${productName ?? '크루즈 상품'}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">결제금액</td><td style="padding:10px 14px;font-weight:700;color:#2b6cb0">${amount.toLocaleString()}원</td></tr>
  ${paidAt ? `<tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">결제일시</td><td style="padding:10px 14px">${new Date(paidAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>` : ''}
  <tr><td style="padding:10px 14px;color:#666">결제수단</td><td style="padding:10px 14px">${paymentMethod}</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${doc.id}</td></tr>
</table>
<p style="color:#666;font-size:14px">구매해 주셔서 감사합니다. 문의사항이 있으시면 담당 에이전트에게 연락해 주세요.</p>
</div>`,
          channel: 'AUTO_PURCHASE_CONFIRMATION',
        });
        emailSent = result.result_code === 1;
      } catch (emailErr) {
        logger.error('[PurchaseConfirmation] 이메일 발송 실패', {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          saleId,
          docId: doc.id,
        });
        // 이메일 실패해도 문서 발급은 성공 처리
      }
    }

    logger.log('[PurchaseConfirmation] 발급 완료', {
      saleId,
      orderId: sale.orderId,
      documentId: doc.id,
      emailSent,
    });

    return { ok: true, documentId: doc.id, emailSent };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[PurchaseConfirmation] 오류', { error: message, saleId });
    return { ok: false, error: message };
  }
}
