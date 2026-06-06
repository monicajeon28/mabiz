export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/documents/pending
 * 승인 대기(PENDING_APPROVAL) 서류 목록 — OWNER/GLOBAL_ADMIN 전용.
 * AGENT가 발급한 구매확인증/환불증이 승인 대기로 쌓이는데 이를 처리할 화면이 없던 문제(DOC-2) 해소.
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '승인 권한이 없습니다.', items: [] }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);

    const docs = await prisma.salesDocument.findMany({
      where: { organizationId: orgId, status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        documentType: true,
        generatedData: true,
        orderId: true,
        createdAt: true,
      },
    });

    const items = docs.map((d) => {
      const g = (d.generatedData ?? {}) as Record<string, unknown>;
      return {
        id: d.id,
        documentType: d.documentType,
        buyerName: (g.buyerName as string) ?? '',
        productName: (g.productName as string) ?? '',
        amount: typeof g.amount === 'number' ? g.amount : null,
        orderId: d.orderId,
        createdAt: d.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false, items: [] }, { status: 401 });
    logger.error('[GET /api/documents/pending]', { msg });
    return NextResponse.json({ ok: false, items: [] }, { status: 500 });
  }
}
