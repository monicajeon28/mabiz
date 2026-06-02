// Vercel Cron: 0 16 * * * (매일 01:00 KST = UTC 16:00)
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  // FIX #3: CRON_SECRET 미설정 시 fail-closed (undefined bypass 방지)
  if (!process.env.CRON_SECRET) {
    logger.error('[group-auto-move] CRON_SECRET 환경변수 미설정');
    return NextResponse.json({ ok: false, error: 'MISCONFIGURED' }, { status: 500 });
  }
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

    // FIX #9: 그룹별 병렬 처리 (sequential → parallel)
    const results = await Promise.allSettled(groups.map(async (group) => {
      const targetId = group.autoMoveTargetGroupId!;

      // FIX #2 (defense-in-depth): cron에서도 cross-org 대상 차단
      const target = await prisma.contactGroup.findFirst({
        where: { id: targetId, organizationId: group.organizationId },
        select: { id: true },
      });
      if (!target) {
        logger.error('[group-auto-move] cross-org 이동 차단', {
          groupId: group.id, targetId, orgId: group.organizationId,
        });
        return 0;
      }

      const days = group.autoMoveDays ?? 0;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      let processedInGroup = 0;

      // FIX #6: cursor 루프로 100건 이상도 전부 처리 (이전 배치 삭제 후 재조회)
      while (true) {
        const members = await prisma.contactGroupMember.findMany({
          where: { groupId: group.id, addedAt: { lte: cutoff } },
          select: { id: true, contactId: true },
          take: 100,
          orderBy: { id: 'asc' },
        });

        if (members.length === 0) break;

        // FIX #1: Promise.all (allSettled → all) — 실패 시 트랜잭션 롤백
        // FIX #8: 실제 신규 이동 건수만 memberCount 반영
        await prisma.$transaction(async (tx) => {
          // 대상 그룹에 이미 있는 멤버 파악 (중복 제외한 실 이동 수 계산)
          const alreadyInTarget = await tx.contactGroupMember.findMany({
            where: { groupId: targetId, contactId: { in: members.map(m => m.contactId) } },
            select: { contactId: true },
          });
          const alreadySet = new Set(alreadyInTarget.map(e => e.contactId));
          const newMoveCount = members.filter(m => !alreadySet.has(m.contactId)).length;

          // createMany + skipDuplicates: 원자적 삽입, 실패 시 전체 롤백
          await tx.contactGroupMember.createMany({
            data: members.map(m => ({ groupId: targetId, contactId: m.contactId })),
            skipDuplicates: true,
          });

          await tx.contactGroupMember.deleteMany({
            where: { id: { in: members.map(m => m.id) } },
          });

          // memberCount: 실 이동 수만 반영
          await tx.contactGroup.update({
            where: { id: group.id },
            data: { memberCount: { decrement: members.length } },
          });
          if (newMoveCount > 0) {
            await tx.contactGroup.update({
              where: { id: targetId },
              data: { memberCount: { increment: newMoveCount } },
            });
          }
        });

        processedInGroup += members.length;
        logger.log('[group-auto-move] batch', {
          groupId: group.id, targetId, count: members.length,
        });

        if (members.length < 100) break; // 마지막 배치
      }

      return processedInGroup;
    }));

    const totalMoved = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.value, 0);

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) logger.error('[group-auto-move] 일부 그룹 처리 실패', { failed });

    return NextResponse.json({ ok: true, groups: groups.length, moved: totalMoved, failed });
  } catch (err) {
    logger.error('[POST /api/cron/group-auto-move]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
