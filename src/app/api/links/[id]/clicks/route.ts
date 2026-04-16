import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    const link = await prisma.shortLink.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, clickCount: true },
    });
    if (!link) return NextResponse.json({ ok: false }, { status: 404 });

    const clicks = await prisma.shortLinkClick.findMany({
      where:   { linkId: id },
      orderBy: { clickedAt: 'desc' },
      take:    20,
      select:  { id: true, contactId: true, clickedAt: true },
    });

    return NextResponse.json({ ok: true, clickCount: link.clickCount, clicks });
  } catch (e) {
    logger.log('[LinkClicks] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
