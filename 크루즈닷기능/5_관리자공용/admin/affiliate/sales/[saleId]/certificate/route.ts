export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/certificate/route.ts
// 환불완료증서 HTML 생성 API

import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateRefundCertificate } from '@/lib/affiliate/document-generator';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    const { isAdmin, error } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: error || 'Unauthorized' }, { status: 401 });
    }

    const { saleId: saleIdStr } = await params;
    const saleId = Number(saleIdStr);
    if (!Number.isFinite(saleId) || saleId <= 0) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 saleId입니다.' }, { status: 400 });
    }

    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        productCode: true,
        saleAmount: true,
        refundedAt: true,
        refundReason: true,
        cancellationReason: true,
        externalOrderCode: true,
        leadId: true,
        status: true,
        manager: { select: { displayName: true, type: true } },
        agent: { select: { displayName: true, type: true } },
        AffiliateProduct: { select: { title: true } },
      },
    });

    if (!sale || sale.status !== 'REFUNDED') {
      return NextResponse.json(
        { ok: false, message: '환불 완료된 판매 건만 서류를 생성할 수 있습니다.' },
        { status: 400 }
      );
    }

    let customerName = '고객';
    let customerPhone = '';
    if (sale.leadId) {
      const lead = await prisma.affiliateLead.findUnique({
        where: { id: sale.leadId },
        select: { customerName: true, customerPhone: true },
      });
      customerName = lead?.customerName || '고객';
      customerPhone = lead?.customerPhone || '';
    }

    const responsiblePerson = sale.manager || sale.agent;
    const responsibleRole = sale.manager ? '대리점장' : '판매원';

    const cert = await generateRefundCertificate({
      customerName,
      customerPhone,
      productCode: sale.productCode || '',
      productName: sale.AffiliateProduct?.title,
      originalSaleAmount: sale.saleAmount,
      refundAmount: sale.saleAmount,
      refundDate: (sale.refundedAt || new Date()).toISOString(),
      refundReason: sale.refundReason ?? sale.cancellationReason ?? '환불 처리',
      orderCode: sale.externalOrderCode || String(saleId),
      responsibleName: responsiblePerson?.displayName || '담당자',
      responsibleRole,
      saleId,
    });

    logger.debug('[certificate] 환불완료증서 생성', { saleId });

    return new Response(cert.email, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: unknown) {
    logger.error('[certificate] 환불완료증서 생성 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
