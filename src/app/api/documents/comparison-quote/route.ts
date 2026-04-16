import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json() as {
      contactId?: string;
      productName: string;
      cruiseLine?: string;
      nights?: number;
      price: number;
      competitorPrices?: Array<{ name: string; price: number }>;
      departureDate?: string;
    };

    if (!body.productName || !body.price) {
      return NextResponse.json({ ok: false, message: 'productName, price 필수' }, { status: 400 });
    }

    // 즉시 발급 (AGENT도 APPROVED)
    const doc = await prisma.salesDocument.create({
      data: {
        organizationId: orgId,
        documentType:   'COMPARISON_QUOTE',
        status:         'APPROVED',
        contactId:      body.contactId ?? null,
        createdBy:      ctx.userId,
        generatedData: {
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

    logger.log('[ComparisonQuote] 발급', { orgId, contactId: body.contactId, docId: doc.id });
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
