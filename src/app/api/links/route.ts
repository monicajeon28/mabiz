import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

function generateCode(): string {
  return randomBytes(4).toString('hex').substring(0, 6);
}

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const links = await prisma.shortLink.findMany({
      where:   { organizationId: orgId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select:  { id: true, code: true, title: true, targetUrl: true, category: true, clickCount: true, createdAt: true, contactId: true, autoGroupId: true },
    });
    return NextResponse.json({ ok: true, links });
  } catch (e) {
    logger.log('[Links GET] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const body  = await req.json() as { targetUrl: string; title?: string; category?: string; contactId?: string; autoGroupId?: string };

    if (!body.targetUrl) return NextResponse.json({ ok: false, message: 'targetUrl 필수' }, { status: 400 });

    // URL 유효성 + SSRF 방어
    try {
      const parsed = new URL(body.targetUrl);
      if (parsed.protocol !== 'https:') {
        return NextResponse.json({ ok: false, message: 'https URL만 허용됩니다' }, { status: 400 });
      }
      const h = parsed.hostname;
      const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|localhost$)/i.test(h);
      if (isPrivate) {
        return NextResponse.json({ ok: false, message: '내부 네트워크 URL은 허용되지 않습니다' }, { status: 400 });
      }
    } catch { return NextResponse.json({ ok: false, message: '유효하지 않은 URL' }, { status: 400 }); }

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.shortLink.findUnique({ where: { code } });
      if (!exists) break;
      code = generateCode();
      attempts++;
    }

    const link = await prisma.shortLink.create({
      data: { organizationId: orgId, code, ...body },
      select: { id: true, code: true, targetUrl: true, title: true },
    });

    logger.log('[Links POST] 생성', { code, orgId });
    return NextResponse.json({ ok: true, link, shortUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/l/${link.code}` });
  } catch (e) {
    logger.log('[Links POST] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
