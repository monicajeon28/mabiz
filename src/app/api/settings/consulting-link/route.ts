export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { generateUniqueShortlink } from '@/lib/landing-page-utils';

// GET: 내 상담 링크 조회
export async function GET() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx?.userId) return NextResponse.json({ ok: false }, { status: 401 });
  const orgId = resolveOrgId(ctx);

  const link = await prisma.shortLink.findFirst({
    where: { organizationId: orgId, createdBy: ctx.userId, category: 'consulting', isActive: true },
    select: { id: true, title: true, targetUrl: true, code: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ ok: true, link: link ?? null });
}

// POST: 상담 링크 저장 (upsert - 기존 것 update, 없으면 create)
export async function POST(req: Request) {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx?.userId) return NextResponse.json({ ok: false }, { status: 401 });
  const orgId = resolveOrgId(ctx);
  const { targetUrl, title } = await req.json() as { targetUrl: string; title?: string };

  if (!targetUrl?.trim()) return NextResponse.json({ ok: false, message: 'URL을 입력하세요' }, { status: 400 });

  // 기존 상담 링크 있으면 update
  const existing = await prisma.shortLink.findFirst({
    where: { organizationId: orgId, createdBy: ctx.userId, category: 'consulting' },
  });

  const link = existing
    ? await prisma.shortLink.update({
        where: { id: existing.id },
        data: { targetUrl: targetUrl.trim(), title: title?.trim() || '내 상담 링크', isActive: true },
        select: { id: true, title: true, targetUrl: true, code: true },
      })
    : await prisma.shortLink.create({
        data: {
          organizationId: orgId,
          createdBy: ctx.userId,
          code: await generateUniqueShortlink(),
          targetUrl: targetUrl.trim(),
          title: title?.trim() || '내 상담 링크',
          category: 'consulting',
          isActive: true,
        },
        select: { id: true, title: true, targetUrl: true, code: true },
      });

  return NextResponse.json({ ok: true, link });
}
