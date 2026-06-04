/**
 * Affiliate Document Generator
 * - generateComparisonQuote(): 비교견적서 SalesDocument 생성
 * - generateRefundCertificate(): 환불증서 SalesDocument 생성
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';

// ─── 공통 타입 ────────────────────────────────────────────────

export interface GenerateDocumentResult {
  ok: boolean;
  documentId?: string;
  status?: string;
  error?: string;
}

// ─── 비교견적서 ───────────────────────────────────────────────

export interface ComparisonQuoteParams {
  organizationId: string;
  createdBy: string;
  contactId?: string;
  productName: string;
  cruiseLine?: string;
  nights?: number;
  price: number;
  competitorPrices?: Array<{ name: string; price: number }>;
  departureDate?: string;
}

/**
 * 비교견적서(COMPARISON_QUOTE) SalesDocument 생성
 * - 즉시 APPROVED 상태로 발급
 * - 연결된 Contact에 이메일 발송 (fire-and-forget)
 */
export async function generateComparisonQuote(
  params: ComparisonQuoteParams
): Promise<GenerateDocumentResult> {
  const {
    organizationId,
    createdBy,
    contactId,
    productName,
    cruiseLine,
    nights,
    price,
    competitorPrices = [],
    departureDate,
  } = params;

  try {
    // Contact 이메일 조회 (contactId 있을 때)
    let contactEmail: string | null = null;
    let contactName: string | null = null;
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, organizationId },
        select: { email: true, name: true },
      });
      contactEmail = contact?.email ?? null;
      contactName = contact?.name ?? null;
    }

    const doc = await prisma.salesDocument.create({
      data: {
        organizationId,
        documentType: 'COMPARISON_QUOTE',
        status: 'APPROVED',
        contactId: contactId ?? null,
        createdBy,
        generatedData: {
          productName,
          cruiseLine: cruiseLine ?? '',
          nights: nights ?? 0,
          price,
          competitorPrices,
          departureDate: departureDate ?? null,
          issuedAt: new Date().toISOString(),
          issuerOrgId: organizationId,
        },
      },
      select: { id: true, status: true },
    });

    // 이메일 발송 (contactEmail 있을 때만, fire-and-forget)
    if (contactEmail) {
      const savingsTop = competitorPrices.reduce(
        (max, c) => Math.max(max, c.price - price),
        0
      );
      sendFunnelEmail({
        organizationId,
        to: contactEmail,
        subject: `[비교견적서] ${productName} 맞춤 견적서가 발송되었습니다`,
        html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">맞춤 비교 견적서</h2>
${contactName ? `<p>${contactName}님, 요청하신 크루즈 상품 비교 견적서를 발송합니다.</p>` : ''}
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${productName}</td></tr>
  ${cruiseLine ? `<tr><td style="padding:10px 14px;color:#666">크루즈라인</td><td style="padding:10px 14px">${cruiseLine}</td></tr>` : ''}
  ${nights ? `<tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">일수</td><td style="padding:10px 14px">${nights}박</td></tr>` : ''}
  <tr><td style="padding:10px 14px;color:#666">당사 가격</td><td style="padding:10px 14px;font-weight:700;color:#2b6cb0">${price.toLocaleString()}원</td></tr>
  ${savingsTop > 0 ? `<tr style="background:#f0fff4"><td style="padding:10px 14px;color:#666">최대 절감액</td><td style="padding:10px 14px;font-weight:700;color:#276749">타사 대비 최대 ${savingsTop.toLocaleString()}원 저렴</td></tr>` : ''}
  ${departureDate ? `<tr><td style="padding:10px 14px;color:#666">출발일</td><td style="padding:10px 14px">${departureDate}</td></tr>` : ''}
</table>
<p style="color:#666;font-size:14px">더 자세한 상담은 담당 에이전트에게 문의해 주세요.</p>
</div>`,
        channel: 'MANUAL',
      }).catch(() => {});
    }

    logger.log('[DocumentGenerator] 비교견적서 발급', {
      organizationId,
      contactId,
      docId: doc.id,
      emailSent: !!contactEmail,
    });

    return { ok: true, documentId: doc.id, status: doc.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[DocumentGenerator] 비교견적서 발급 오류', { error: message, organizationId });
    return { ok: false, error: message };
  }
}

// ─── 환불증서 ─────────────────────────────────────────────────

export interface RefundCertificateParams {
  organizationId: string;
  createdBy: string;
  creatorRole: string;
  orderId: string;
  note?: string;
  cancellationRequestedAt?: string;
  refunderName?: string;
}

/**
 * 환불증서(REFUND_CERTIFICATE) SalesDocument 생성
 * - OWNER/GLOBAL_ADMIN: APPROVED 즉시 발급
 * - AGENT: PENDING_APPROVAL 상태로 발급
 * - 환불 계산: 상품별 정책 우선, 없으면 관광진흥법 시행령 기준
 */
export async function generateRefundCertificate(
  params: RefundCertificateParams
): Promise<GenerateDocumentResult & { refundCalc?: Record<string, unknown> }> {
  const {
    organizationId,
    createdBy,
    creatorRole,
    orderId,
    note,
    cancellationRequestedAt,
    refunderName,
  } = params;

  try {
    // Payment 조회
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        buyerName: true,
        buyerTel: true,
        buyerEmail: true,
        amount: true,
        status: true,
        pgProvider: true,
        paidAt: true,
        cancelledAt: true,
        productName: true,
        affiliateCode: true,
        metadata: true,
      },
    });

    if (!payment) {
      return { ok: false, error: '결제 정보 없음' };
    }

    if (!['completed', 'cancelled'].includes(payment.status)) {
      return { ok: false, error: '결제 완료 또는 환불 완료 건만 발급 가능합니다' };
    }

    // 조직 소유권 검증
    const sale = await prisma.affiliateSale.findFirst({
      where: { orderId, organizationId },
    });
    if (!sale) {
      return { ok: false, error: '이 조직의 판매건이 아닙니다' };
    }

    // 환불 날짜 결정
    const isCancelled = payment.status === 'cancelled';
    const cancelDate = isCancelled
      ? cancellationRequestedAt
        ? new Date(cancellationRequestedAt)
        : new Date(payment.cancelledAt!)
      : new Date();

    // 출발일 + 상품별 환불 정책 조회
    let departureDate: Date | null = null;
    let productRefundPolicy: import('@/lib/refund-calculator').RefundPolicyJson | null = null;
    try {
      const productCode =
        (payment.metadata as { productCode?: string })?.productCode ?? '';
      if (productCode) {
        const trip = await prisma.$queryRaw<{ departureDate: Date }[]>`
          SELECT "departureDate" FROM "Trip" WHERE "productCode" = ${productCode} LIMIT 1`;
        if (trip[0]?.departureDate) departureDate = trip[0].departureDate;

        const product = await prisma.cruiseProduct.findUnique({
          where: { productCode },
          select: { refundPolicy: true },
        });
        if (product?.refundPolicy) {
          productRefundPolicy =
            product.refundPolicy as import('@/lib/refund-calculator').RefundPolicyJson;
        }
      }
    } catch {
      /* 조회 실패 시 법정 기준 fallback */
    }

    // 환불 금액 계산
    let refundCalc = {
      refundAmount: payment.amount,
      penaltyRate: 0,
      penaltyAmount: 0,
      daysBeforeDep: -1,
      basis: productRefundPolicy
        ? '상품별 환불정책'
        : '법정기준(관광진흥법 시행령)',
    };

    if (departureDate) {
      try {
        const { calcRefundAmount } = await import('@/lib/refund-calculator');
        refundCalc = calcRefundAmount(
          payment.amount,
          departureDate,
          productRefundPolicy,
          cancelDate
        );
      } catch {
        /* 계산 실패 시 전액 환불로 fallback */
      }
    }

    const paymentMethod = payment.pgProvider
      ? `${payment.pgProvider} (원결제수단 동일 환불)`
      : '계좌이체 환불 (담당자 확인 필요)';

    const status =
      creatorRole === 'GLOBAL_ADMIN' ? 'APPROVED' : 'PENDING_APPROVAL';

    const doc = await prisma.salesDocument.create({
      data: {
        organizationId,
        documentType: 'REFUND_CERTIFICATE',
        status,
        orderId,
        affiliateSaleId: sale.id,
        createdBy,
        generatedData: {
          buyerName: payment.buyerName,
          buyerTel: payment.buyerTel,
          buyerEmail: payment.buyerEmail ?? null,
          amount: payment.amount,
          productName: payment.productName ?? '크루즈 상품',
          paidAt: payment.paidAt?.toISOString() ?? null,
          cancelledAt: payment.cancelledAt?.toISOString() ?? null,
          cancellationRequestedAt: cancelDate.toISOString(),
          isRefundPending: !isCancelled,
          departureDate: departureDate?.toISOString() ?? null,
          refundAmount: refundCalc.refundAmount,
          penaltyRate: refundCalc.penaltyRate,
          penaltyAmount: refundCalc.penaltyAmount,
          daysBeforeDep: refundCalc.daysBeforeDep,
          refundBasis: refundCalc.basis,
          paymentMethod,
          companyAccount: '국민은행 531301-04-167150 (배연성/크루즈닷)',
          issuedAt: new Date().toISOString(),
          note: note ?? null,
          refunderName: refunderName ?? null,
        },
      },
      select: { id: true, status: true },
    });

    if (status === 'APPROVED') {
      await prisma.salesDocumentApproval.create({
        data: {
          documentId: doc.id,
          organizationId,
          requestedBy: createdBy,
          approvedBy: createdBy,
          status: 'APPROVED',
          processedAt: new Date(),
        },
      });

      // 이메일 발송 (fire-and-forget)
      if (payment.buyerEmail) {
        sendFunnelEmail({
          organizationId,
          to: payment.buyerEmail,
          subject: `[환불확인증] ${payment.productName ?? '크루즈 상품'} 환불 확인증이 발급되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">환불 확인증 발급 안내</h2>
<p>${payment.buyerName}님, 아래 내용으로 환불 확인증이 발급되었습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${payment.productName ?? '크루즈 상품'}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">결제금액</td><td style="padding:10px 14px">${payment.amount.toLocaleString()}원</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">환불금액</td><td style="padding:10px 14px;font-weight:600;color:#e53e3e">${refundCalc.refundAmount.toLocaleString()}원</td></tr>
  ${refundCalc.penaltyRate > 0 ? `<tr><td style="padding:10px 14px;color:#666">위약금</td><td style="padding:10px 14px">${refundCalc.penaltyRate}% (${refundCalc.penaltyAmount.toLocaleString()}원)</td></tr>` : ''}
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">환불 기준</td><td style="padding:10px 14px;font-size:13px">${refundCalc.basis}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${doc.id}</td></tr>
</table>
<p style="color:#666;font-size:14px">환불 처리는 3~5 영업일 소요됩니다. 문의사항이 있으시면 담당 에이전트에게 연락해 주세요.</p>
</div>`,
          channel: 'MANUAL',
        }).catch(() => {});
      }
    }

    logger.log('[DocumentGenerator] 환불증서 발급', {
      organizationId,
      orderId,
      status,
      refundAmount: refundCalc.refundAmount,
    });

    return {
      ok: true,
      documentId: doc.id,
      status: doc.status,
      refundCalc: refundCalc as Record<string, unknown>,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[DocumentGenerator] 환불증서 발급 오류', { error: message, organizationId, orderId });
    return { ok: false, error: message };
  }
}
