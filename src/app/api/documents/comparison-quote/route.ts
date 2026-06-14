import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId, resolveOrgId, resolveOrgIdOrNull } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json() as {
      contactId?: string;
      affiliateSaleId?: string;
      customerName?: string;
      productName: string;
      cruiseLine?: string;
      nights?: number;
      price: number;
      competitorPrices?: Array<{ name: string; price: number }>;
      departureDate?: string;
    };

    if (!body.customerName || !body.productName || !body.price) {
      return NextResponse.json({ ok: false, message: 'customerName, productName, price 필수' }, { status: 400 });
    }

    // Contact 이메일 조회 (contactId 있을 때)
    let contactEmail: string | null = null;
    let contactName: string | null = null;
    if (body.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, organizationId: orgId },
        select: { email: true, name: true },
      });
      contactEmail = contact?.email ?? null;
      contactName  = contact?.name ?? null;
    }

    // 즉시 발급 (AGENT도 APPROVED)
    const doc = await prisma.salesDocument.create({
      data: {
        organizationId: orgId,
        documentType:   'COMPARISON_QUOTE',
        status:         'APPROVED',
        contactId:      body.contactId ?? null,
        affiliateSaleId: body.affiliateSaleId ?? null,
        createdBy:      ctx.userId,
        generatedData: {
          customerName:      body.customerName,
          productName:       body.productName,
          cruiseLine:        body.cruiseLine ?? '',
          nights:            body.nights ?? 0,
          price:             body.price,
          competitorPrices:  body.competitorPrices ?? [],
          departureDate:     body.departureDate ?? null,
          issuedAt:          new Date().toISOString(),
          issuerOrgId:       orgId,
        },
      },
      select: { id: true },
    });

    // 이메일 발송 (contactEmail 있을 때만, fire-and-forget)
    if (contactEmail) {
      const savingsTop = (body.competitorPrices ?? []).reduce((max, c) => Math.max(max, c.price - body.price), 0);
      sendFunnelEmail({
        organizationId: orgId,
        to:      contactEmail,
        subject: `[비교견적서] ${body.productName} 맞춤 견적서가 발송되었습니다`,
        html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">맞춤 비교 견적서</h2>
${contactName ? `<p>${contactName}님, 요청하신 크루즈 상품 비교 견적서를 발송합니다.</p>` : ''}
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">상품명</td><td style="padding:10px 14px;font-weight:600">${body.productName}</td></tr>
  ${body.cruiseLine ? `<tr><td style="padding:10px 14px;color:#666">크루즈라인</td><td style="padding:10px 14px">${body.cruiseLine}</td></tr>` : ''}
  ${body.nights ? `<tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">일수</td><td style="padding:10px 14px">${body.nights}박</td></tr>` : ''}
  <tr><td style="padding:10px 14px;color:#666">당사 가격</td><td style="padding:10px 14px;font-weight:700;color:#2b6cb0">${body.price.toLocaleString()}원</td></tr>
  ${savingsTop > 0 ? `<tr style="background:#f0fff4"><td style="padding:10px 14px;color:#666">최대 절감액</td><td style="padding:10px 14px;font-weight:700;color:#276749">타사 대비 최대 ${savingsTop.toLocaleString()}원 저렴</td></tr>` : ''}
  ${body.departureDate ? `<tr><td style="padding:10px 14px;color:#666">출발일</td><td style="padding:10px 14px">${body.departureDate}</td></tr>` : ''}
</table>
<p style="color:#666;font-size:14px">더 자세한 상담은 담당 에이전트에게 문의해 주세요.</p>
</div>`,
        channel: 'MANUAL',
      }).catch(() => {});
    }

    logger.log('[ComparisonQuote] 발급', { orgId, contactId: body.contactId, docId: doc.id, emailSent: !!contactEmail });
    return NextResponse.json({ ok: true, documentId: doc.id });
  } catch (e) {
    logger.log('[ComparisonQuote] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const docs = await prisma.salesDocument.findMany({
      where: { organizationId: orgId, documentType: 'COMPARISON_QUOTE' },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, status: true, contactId: true, createdAt: true, generatedData: true },
    });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e) {
    logger.log('[ComparisonQuote GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
