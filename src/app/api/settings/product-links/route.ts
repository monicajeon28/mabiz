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

    // 1. 내 상담 링크 (category='consulting') 먼저 조회 (관리자도 자신의 것 우선)
    const consultingLink = await prisma.shortLink.findFirst({
      where: { organizationId: orgId, createdBy: ctx.userId, category: 'consulting', isActive: true },
      select: { id: true, title: true, targetUrl: true, code: true, category: true },
      orderBy: { createdAt: 'desc' },
    });

    // 2. 일반 링크 조회 (consulting 제외, 관리자는 전체 / 일반사용자는 자신의 것만)
    const generalLinks = await prisma.shortLink.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        category: { not: 'consulting' },
        ...(ctx.role !== 'GLOBAL_ADMIN' ? { createdBy: ctx.userId } : {}),
      },
      select: { id: true, title: true, targetUrl: true, code: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // 3. 상담 링크를 맨 앞에 붙여서 반환
    const links = [
      ...(consultingLink ? [{ ...consultingLink, isConsulting: true }] : []),
      ...generalLinks.map(l => ({ ...l, isConsulting: false })),
    ];

    return NextResponse.json({ ok: true, links });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false, links: [] }, { status: 401 });
    logger.error('[GET /api/settings/product-links]', { msg });
    return NextResponse.json({ ok: false, error: '서버 오류', links: [] }, { status: 500 });
  }
}
