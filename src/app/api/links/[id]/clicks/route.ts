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
      select: { id: true, clickCount: true, autoGroupId: true },
    });
    if (!link) return NextResponse.json({ ok: false }, { status: 404 });

    const clicks = await prisma.shortLinkClick.findMany({
      where:   { linkId: id },
      orderBy: { clickedAt: 'desc' },
      take:    20,
      select:  { id: true, contactId: true, clickedAt: true },
    });

    // autoGroupId가 있으면 그룹 전체 고객의 클릭 현황 반환
    let groupName: string | null = null;
    let groupStatus: { id: string; name: string; phone: string; clicked: boolean; clickedAt: Date | null }[] = [];

    if (link.autoGroupId) {
      const group = await prisma.contactGroup.findUnique({
        where: { id: link.autoGroupId },
        select: {
          name: true,
          members: {
            select: {
              contact: { select: { id: true, name: true, phone: true } }
            }
          }
        }
      });

      const clickedContactIds = new Set(clicks.map(c => c.contactId).filter(Boolean));

      groupStatus = group?.members.map(m => ({
        id: m.contact.id,
        name: m.contact.name ?? '이름없음',
        phone: m.contact.phone ?? '',
        clicked: clickedContactIds.has(m.contact.id),
        clickedAt: clicks.find(cl => cl.contactId === m.contact.id)?.clickedAt ?? null,
      })) ?? [];

      groupName = group?.name ?? null;
    }

    return NextResponse.json({ ok: true, clickCount: link.clickCount, clicks, groupName, groupStatus });
  } catch (e) {
    logger.log('[LinkClicks] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
