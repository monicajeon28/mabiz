import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // 원본 그룹 조회 (소유권 검증)
    const original = await prisma.contactGroup.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!original) return NextResponse.json({ ok: false }, { status: 404 });

    // 연결된 퍼널 조회
    let newFunnelId: string | null = null;
    if (original.funnelId) {
      const originalFunnel = await prisma.funnel.findFirst({
        where: { id: original.funnelId, organizationId: orgId },
        include: { stages: { orderBy: { order: 'asc' } } },
      });

      if (originalFunnel) {
        const newFunnel = await prisma.funnel.create({
          data: {
            organizationId: orgId,
            name:       `[복제] ${originalFunnel.name}`,
            description: originalFunnel.description ?? undefined,
            funnelType: originalFunnel.funnelType,
            isActive:   false, // 복제본은 비활성으로 생성
            stages: {
              create: originalFunnel.stages.map((s) => ({
                name:           s.name,
                order:          s.order,
                triggerType:    s.triggerType,
                triggerOffset:  s.triggerOffset,
                channel:        s.channel,
                messageContent: s.messageContent ?? undefined,
                linkUrl:        s.linkUrl ?? undefined,
              })),
            },
          },
          select: { id: true },
        });
        newFunnelId = newFunnel.id;
      }
    }

    // 그룹 복제
    const newGroup = await prisma.contactGroup.create({
      data: {
        organizationId: orgId,
        name:     `[복제] ${original.name}`,
        funnelId: newFunnelId,
      },
      select: { id: true, name: true },
    });

    logger.log('[GroupClone] 복제 완료', { originalId: id, newGroupId: newGroup.id });
    return NextResponse.json({ ok: true, group: newGroup });
  } catch (e) {
    logger.log('[GroupClone] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
