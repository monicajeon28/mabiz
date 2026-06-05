import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/** GET /api/settings/product-links
 *  퍼널문자 [상품링크] 삽입용 — 조직의 단축링크(ShortLink) 목록 반환
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    // Option B: 관리자는 모든 링크, 일반사용자는 자신의 링크만
    const links = await prisma.shortLink.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(ctx.role !== 'GLOBAL_ADMIN' ? { createdBy: ctx.userId } : {}),
      },
      select: { id: true, title: true, targetUrl: true, code: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return NextResponse.json({ ok: true, links });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false, links: [] }, { status: 401 });
    logger.error('[GET /api/settings/product-links]', { msg });
    return NextResponse.json({ ok: true, links: [] });
  }
}
