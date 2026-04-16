import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Params) {
  const { code } = await params;

  const link = await prisma.shortLink.findUnique({
    where: { code, isActive: true },
    select: { id: true, targetUrl: true, contactId: true, autoGroupId: true, organizationId: true },
  }).catch(() => null);

  if (!link) {
    return NextResponse.redirect('https://www.cruisedot.co.kr');
  }

  // 클릭 기록 + 카운트 증가 (fire-and-forget)
  prisma.$transaction([
    prisma.shortLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    }),
    prisma.shortLinkClick.create({
      data: {
        linkId:    link.id,
        contactId: link.contactId ?? null,
        userAgent: req.headers.get('user-agent')?.substring(0, 200) ?? null,
      },
    }),
  ]).catch((e) => logger.log('[ShortLink] 클릭 기록 실패', { code, error: e instanceof Error ? e.message : String(e) }));

  // 클릭 시 그룹 자동 배정 (contactId + autoGroupId 있을 때)
  if (link.contactId && link.autoGroupId) {
    const { triggerGroupFunnel } = await import('@/lib/funnel-trigger');
    prisma.contact.update({
      where: { id: link.contactId },
      data: { groups: { connect: { id: link.autoGroupId } } },
    }).then(() =>
      triggerGroupFunnel({ contactId: link.contactId!, groupId: link.autoGroupId!, organizationId: link.organizationId, sendFirst: true })
    ).catch((e) => logger.log('[ShortLink] 그룹 배정 실패', { error: e instanceof Error ? e.message : String(e) }));
  }

  logger.log('[ShortLink] 클릭', { code, contactId: link.contactId ?? '없음' });
  return NextResponse.redirect(link.targetUrl, { status: 302 });
}
