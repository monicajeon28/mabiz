// Vercel Cron: 0 16 * * * (매일 01:00 KST = UTC 16:00)
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const groups = await prisma.contactGroup.findMany({
      where: {
        autoMoveEnabled: true,
        autoMoveDays: { not: null },
        autoMoveTargetGroupId: { not: null },
      },
      select: { id: true, organizationId: true, autoMoveDays: true, autoMoveTargetGroupId: true },
    });

    let totalMoved = 0;

    for (const group of groups) {
      const days = group.autoMoveDays ?? 0;
      const msPerDay = 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - days * msPerDay);

      const members = await prisma.contactGroupMember.findMany({
        where: { groupId: group.id, addedAt: { lte: cutoff } },
        select: { id: true, contactId: true },
        take: 100,
      });

      if (members.length === 0) continue;

      const targetId = group.autoMoveTargetGroupId!;

      await prisma.$transaction(async (tx) => {
        await Promise.allSettled(
          members.map((m) =>
            tx.contactGroupMember.upsert({
              where: { groupId_contactId: { groupId: targetId, contactId: m.contactId } },
              create: { groupId: targetId, contactId: m.contactId },
              update: {},
            })
          )
        );
        await tx.contactGroupMember.deleteMany({
          where: { id: { in: members.map((m) => m.id) } },
        });
        // memberCount 동기
        await tx.contactGroup.update({ where: { id: group.id }, data: { memberCount: { decrement: members.length } } });
        await tx.contactGroup.update({ where: { id: targetId }, data: { memberCount: { increment: members.length } } });
      });

      totalMoved += members.length;
      logger.log('[group-auto-move] batch', { groupId: group.id, targetId, count: members.length });
    }

    return NextResponse.json({ ok: true, groups: groups.length, moved: totalMoved });
  } catch (err) {
    logger.error('[POST /api/cron/group-auto-move]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
