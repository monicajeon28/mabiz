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

    const group = await prisma.contactGroup.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!group) return NextResponse.json({ ok: false }, { status: 404 });

    // 연결된 퍼널 조회
    let funnelExport: {
      funnelName: string;
      funnelType: string;
      stages: Array<{
        name: string;
        order: number;
        triggerType: string;
        triggerOffset: number;
        channel: string;
        messageContent: string | null;
        linkUrl: string | null;
      }>;
    } | null = null;

    if (group.funnelId) {
      const funnel = await prisma.funnel.findFirst({
        where: { id: group.funnelId, organizationId: orgId },
        include: { stages: { orderBy: { order: 'asc' } } },
      });

      if (funnel) {
        funnelExport = {
          funnelName: funnel.name,
          funnelType: funnel.funnelType,
          stages: funnel.stages.map((s) => ({
            name:           s.name,
            order:          s.order,
            triggerType:    s.triggerType,
            triggerOffset:  s.triggerOffset,
            channel:        s.channel,
            messageContent: s.messageContent,
            linkUrl:        s.linkUrl,
          })),
        };
      }
    }

    // 조직 정보 제거 후 내보내기
    const exportData = {
      groupName:  group.name,
      funnelName: funnelExport?.funnelName,
      funnelType: funnelExport?.funnelType ?? 'GENERAL',
      stages:     funnelExport?.stages ?? [],
    };

    logger.log('[GroupExport] 내보내기', { groupId: id, orgId });
    return NextResponse.json({ ok: true, data: exportData });
  } catch (e) {
    logger.log('[GroupExport] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
