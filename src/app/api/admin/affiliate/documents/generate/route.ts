export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/documents/generate/route.ts
// 서류 생성 API (타사 비교 견적서, 구매확인서, 환불완료증서)

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─── 문서 타입 ────────────────────────────────────────────────────────────────
type DocumentType =
  | 'COMPARISON_QUOTE'
  | 'PURCHASE_CONFIRMATION'
  | 'REFUND_CERTIFICATE';

// ─── 권한 체크 ────────────────────────────────────────────────────────────────
async function checkDocumentAccess(
  session: Awaited<ReturnType<typeof getMabizSession>>,
  saleId?: string,
): Promise<{ authorized: boolean; error?: string }> {
  if (!session) return { authorized: false, error: '로그인이 필요합니다' };

  // GLOBAL_ADMIN은 모든 문서 생성 가능
  if (session.role === 'GLOBAL_ADMIN') {
    return { authorized: true };
  }

  // OWNER / AGENT / FREE_SALES: 자기 조직의 판매만 접근 가능
  if (!session.organizationId) {
    return { authorized: false, error: '조직 정보를 찾을 수 없습니다' };
  }

  if (saleId) {
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: { organizationId: true, affiliateUserId: true },
    });

    if (!sale) {
      return { authorized: false, error: '판매 정보를 찾을 수 없습니다' };
    }

    if (sale.organizationId !== session.organizationId) {
      return { authorized: false, error: '이 판매에 대한 문서 생성 권한이 없습니다' };
    }

    // AGENT / FREE_SALES: 본인 어필리에이트 판매만 접근 가능
    if (session.role === 'AGENT' || session.role === 'FREE_SALES') {
      const mallUserId = session.mallUser?.id;
      if (!mallUserId || sale.affiliateUserId !== String(mallUserId)) {
        return { authorized: false, error: '이 판매에 대한 문서 생성 권한이 없습니다' };
      }
    }
  }

  return { authorized: true };
}

// ─── 타사 비교 견적서 템플릿 ───────────────────────────────────────────────────
function buildComparisonQuoteTemplates(params: {
  customerName: string;
  customerPhone?: string;
  productName?: string;
  ourPrice: number;
  competitorPrices: Array<{ company: string; price: number }>;
  headcount?: number;
  cabinType?: string;
  responsibleName: string;
  responsibleRole: string;
}): { smsText: string; emailText: string } {
  const {
    customerName,
    customerPhone,
    productName,
    ourPrice,
    competitorPrices,
    headcount,
    cabinType,
    responsibleName,
    responsibleRole,
  } = params;

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const minCompetitorPrice =
    competitorPrices.length > 0
      ? Math.min(...competitorPrices.map((c) => c.price))
      : null;
  const savings =
    minCompetitorPrice !== null ? minCompetitorPrice - ourPrice : null;

  const smsText =
    `[크루즈닷] ${customerName}님, 타사 비교 견적서를 안내드립니다.\n` +
    `상품: ${productName ?? '크루즈 패키지'}\n` +
    `당사 가격: ${ourPrice.toLocaleString()}원` +
    (headcount ? ` (${headcount}인 기준)` : '') +
    (savings && savings > 0
      ? `\n타사 대비 ${savings.toLocaleString()}원 절약!\n`
      : '\n') +
    `담당: ${responsibleName} ${responsibleRole}`;

  const emailText =
    `안녕하세요, ${customerName}님.\n\n` +
    `${responsibleRole} ${responsibleName}입니다.\n\n` +
    `요청하신 타사 비교 견적서를 아래와 같이 안내드립니다.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `상품명: ${productName ?? '크루즈 패키지'}\n` +
    (cabinType ? `객실 타입: ${cabinType}\n` : '') +
    (headcount ? `인원: ${headcount}명\n` : '') +
    `\n[당사 견적]\n` +
    `가격: ${ourPrice.toLocaleString()}원\n\n` +
    (competitorPrices.length > 0
      ? `[타사 비교]\n` +
        competitorPrices
          .map((c) => `- ${c.company}: ${c.price.toLocaleString()}원`)
          .join('\n') +
        '\n\n'
      : '') +
    (savings && savings > 0
      ? `✅ 당사 이용 시 타사 최저가 대비 ${savings.toLocaleString()}원 절약!\n\n`
      : '') +
    `작성일: ${today}\n` +
    `담당자: ${responsibleName} (${responsibleRole})\n\n` +
    `문의: ${customerPhone ?? '담당자에게 문의해주세요'}`;

  return { smsText, emailText };
}

// ─── 구매확인서 텍스트 생성 ───────────────────────────────────────────────────
function buildPurchaseConfirmationText(params: {
  productName: string;
  orderId?: string | null;
  saleId: string;
  saleAmount: number;
  paidAt?: Date | null;
}): string {
  const { productName, orderId, saleId, saleAmount, paidAt } = params;

  const paidAtStr = paidAt
    ? paidAt.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  return (
    `[크루즈닷] 구매 확인서\n\n` +
    `상품명: ${productName}\n` +
    (orderId ? `주문번호: ${orderId}\n` : `판매ID: ${saleId}\n`) +
    `결제금액: ${saleAmount.toLocaleString()}원\n` +
    `결제일: ${paidAtStr}\n\n` +
    `본 서류는 구매 확인용입니다.`
  );
}

// ─── 환불완료증서 템플릿 ───────────────────────────────────────────────────────
function buildRefundCertificateTemplates(params: {
  customerName: string;
  customerPhone?: string;
  productName: string;
  orderId?: string | null;
  saleId: string;
  saleAmount: number;
  refundedAmount: number;
  refundedAt: Date;
  cancelReason?: string | null;
  responsibleName: string;
}): { smsText: string; emailText: string } {
  const {
    customerName,
    customerPhone,
    productName,
    orderId,
    saleId,
    saleAmount,
    refundedAmount,
    refundedAt,
    cancelReason,
    responsibleName,
  } = params;

  const refundDateStr = refundedAt.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const smsText =
    `[크루즈닷] ${customerName}님, 환불이 완료되었습니다.\n` +
    `상품: ${productName}\n` +
    `환불금액: ${refundedAmount.toLocaleString()}원\n` +
    `처리일: ${refundDateStr}\n` +
    `담당: ${responsibleName}`;

  const emailText =
    `안녕하세요, ${customerName}님.\n\n` +
    `환불 처리가 완료되었음을 안내드립니다.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `상품명: ${productName}\n` +
    (orderId ? `주문번호: ${orderId}\n` : `판매ID: ${saleId}\n`) +
    `결제금액: ${saleAmount.toLocaleString()}원\n` +
    `환불금액: ${refundedAmount.toLocaleString()}원\n` +
    `환불처리일: ${refundDateStr}\n` +
    (cancelReason ? `사유: ${cancelReason}\n` : '') +
    `\n담당자: ${responsibleName}\n` +
    `연락처: ${customerPhone ?? '담당자에게 문의해주세요'}\n\n` +
    `환불 처리 완료 후 3-5영업일 내 입금 예정입니다.\n` +
    `감사합니다.`;

  return { smsText, emailText };
}

// ─── POST: 서류 생성 ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다' },
        { status: 401 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const { documentType, saleId, ...documentData } = body;

    if (
      typeof documentType !== 'string' ||
      !['COMPARISON_QUOTE', 'PURCHASE_CONFIRMATION', 'REFUND_CERTIFICATE'].includes(documentType)
    ) {
      return NextResponse.json(
        { ok: false, error: '올바른 문서 타입을 지정해주세요 (COMPARISON_QUOTE | PURCHASE_CONFIRMATION | REFUND_CERTIFICATE)' },
        { status: 400 },
      );
    }

    const typedDocumentType = documentType as DocumentType;
    const typedSaleId = typeof saleId === 'string' ? saleId : undefined;

    // 권한 체크
    const access = await checkDocumentAccess(session, typedSaleId);
    if (!access.authorized) {
      return NextResponse.json(
        { ok: false, error: access.error ?? '문서 생성 권한이 없습니다' },
        { status: 403 },
      );
    }

    // ──────────────────────────────────────────────────────────
    // 문서 타입별 처리
    // ──────────────────────────────────────────────────────────
    switch (typedDocumentType) {
      // ── 타사 비교 견적서 ─────────────────────────────────────
      case 'COMPARISON_QUOTE': {
        const customerName = documentData.customerName as string | undefined;
        const ourPrice = documentData.ourPrice as number | undefined;

        if (!customerName || !ourPrice) {
          return NextResponse.json(
            { ok: false, error: '필수 정보(customerName, ourPrice)가 누락되었습니다' },
            { status: 400 },
          );
        }

        const competitorPrices =
          (documentData.competitorPrices as Array<{ company: string; price: number }>) ?? [];

        const templates = buildComparisonQuoteTemplates({
          customerName,
          customerPhone: documentData.customerPhone as string | undefined,
          productName: documentData.productName as string | undefined,
          ourPrice,
          competitorPrices,
          headcount: documentData.headcount as number | undefined,
          cabinType: documentData.cabinType as string | undefined,
          responsibleName: (documentData.responsibleName as string | undefined) ?? '담당자',
          responsibleRole: (documentData.responsibleRole as string | undefined) ?? '대리점장',
        });

        // 감사 기록 — SalesDocument 저장
        if (session.organizationId) {
          void prisma.salesDocument
            .create({
              data: {
                organizationId: session.organizationId,
                documentType: 'COMPARISON_QUOTE',
                status: 'DRAFT',
                affiliateSaleId: typedSaleId ?? null,
                generatedData: {
                  customerName,
                  productName: documentData.productName ?? null,
                  ourPrice,
                  competitorPrices,
                  templates,
                  generatedAt: new Date().toISOString(),
                },
                createdBy: session.userId,
              },
            })
            .catch((err: unknown) => {
              logger.error('[Document Generation] SalesDocument save error', { error: err instanceof Error ? err.message : String(err) });
            });
        }

        return NextResponse.json({
          ok: true,
          documentType: 'COMPARISON_QUOTE',
          templates,
          message: '타사 비교 견적서가 생성되었습니다',
        });
      }

      // ── 구매확인서 ───────────────────────────────────────────
      case 'PURCHASE_CONFIRMATION': {
        if (!typedSaleId) {
          return NextResponse.json(
            { ok: false, error: '판매 ID(saleId)가 필요합니다' },
            { status: 400 },
          );
        }

        const sale = await prisma.affiliateSale.findUnique({
          where: { id: typedSaleId },
          select: {
            id: true,
            organizationId: true,
            productName: true,
            saleAmount: true,
            status: true,
            customerPhone: true,
            orderId: true,
            paidAt: true,
          },
        });

        if (!sale) {
          return NextResponse.json(
            { ok: false, error: '판매 정보를 찾을 수 없습니다' },
            { status: 404 },
          );
        }

        const confirmationText = buildPurchaseConfirmationText({
          productName: sale.productName,
          orderId: sale.orderId,
          saleId: sale.id,
          saleAmount: sale.saleAmount,
          paidAt: sale.paidAt,
        });

        // 감사 기록
        if (session.organizationId) {
          void prisma.salesDocument
            .create({
              data: {
                organizationId: session.organizationId,
                documentType: 'PURCHASE_CONFIRMATION',
                status: 'DRAFT',
                affiliateSaleId: typedSaleId,
                orderId: sale.orderId ?? null,
                generatedData: {
                  saleId: typedSaleId,
                  productName: sale.productName,
                  saleAmount: sale.saleAmount,
                  paidAt: sale.paidAt?.toISOString() ?? null,
                  confirmationText,
                  generatedAt: new Date().toISOString(),
                },
                createdBy: session.userId,
              },
            })
            .catch((err: unknown) => {
              logger.error('[Document Generation] SalesDocument save error', { error: err instanceof Error ? err.message : String(err) });
            });
        }

        return NextResponse.json({
          ok: true,
          documentType: 'PURCHASE_CONFIRMATION',
          confirmationText,
          message: '구매확인서가 생성되었습니다',
        });
      }

      // ── 환불완료증서 ─────────────────────────────────────────
      case 'REFUND_CERTIFICATE': {
        if (!typedSaleId) {
          return NextResponse.json(
            { ok: false, error: '판매 ID(saleId)가 필요합니다' },
            { status: 400 },
          );
        }

        const sale = await prisma.affiliateSale.findUnique({
          where: { id: typedSaleId },
          select: {
            id: true,
            organizationId: true,
            productName: true,
            saleAmount: true,
            refundedAmount: true,
            status: true,
            customerPhone: true,
            orderId: true,
            refundedAt: true,
            cancelReason: true,
          },
        });

        if (!sale) {
          return NextResponse.json(
            { ok: false, error: '판매 정보를 찾을 수 없습니다' },
            { status: 404 },
          );
        }

        if (sale.status !== 'REFUNDED') {
          return NextResponse.json(
            { ok: false, error: '환불 처리되지 않은 판매입니다' },
            { status: 400 },
          );
        }

        const responsibleName =
          session.member?.displayName ?? session.mallUser?.name ?? '담당자';

        const templates = buildRefundCertificateTemplates({
          customerName: (documentData.customerName as string | undefined) ?? '고객님',
          customerPhone: sale.customerPhone ?? undefined,
          productName: sale.productName,
          orderId: sale.orderId,
          saleId: sale.id,
          saleAmount: sale.saleAmount,
          refundedAmount: sale.refundedAmount > 0 ? sale.refundedAmount : sale.saleAmount,
          refundedAt: sale.refundedAt ?? new Date(),
          cancelReason: sale.cancelReason,
          responsibleName,
        });

        // 감사 기록
        if (session.organizationId) {
          void prisma.salesDocument
            .create({
              data: {
                organizationId: session.organizationId,
                documentType: 'REFUND_CERTIFICATE',
                status: 'DRAFT',
                affiliateSaleId: typedSaleId,
                orderId: sale.orderId ?? null,
                generatedData: {
                  saleId: typedSaleId,
                  productName: sale.productName,
                  saleAmount: sale.saleAmount,
                  refundedAmount: sale.refundedAmount,
                  refundedAt: sale.refundedAt?.toISOString() ?? null,
                  cancelReason: sale.cancelReason ?? null,
                  templates,
                  generatedAt: new Date().toISOString(),
                },
                createdBy: session.userId,
              },
            })
            .catch((err: unknown) => {
              logger.error('[Document Generation] SalesDocument save error', { error: err instanceof Error ? err.message : String(err) });
            });
        }

        return NextResponse.json({
          ok: true,
          documentType: 'REFUND_CERTIFICATE',
          templates,
          message: '환불완료증서가 생성되었습니다',
        });
      }
    }
  } catch (error: unknown) {
    logger.error('[Document Generation] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '문서 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
