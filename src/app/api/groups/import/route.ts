import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type StageInput = {
  name: string;
  order: number;
  triggerType: string;
  triggerOffset: number;
  channel: string;
  messageContent?: string | null;
  linkUrl?: string | null;
};

type ImportBody = {
  groupName?: string;
  funnelName?: string;
  funnelType?: string;
  stages?: StageInput[];
};

export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const body  = await req.json() as ImportBody;

    if (!body.stages || body.stages.length === 0) {
      return NextResponse.json({ ok: false, message: '스테이지 데이터 필수' }, { status: 400 });
    }

    if (body.stages.length > 50) {
      return NextResponse.json(
        { ok: false, message: '스테이지는 최대 50개까지 가능합니다' },
        { status: 400 }
      );
    }

    const sanitizedStages = body.stages.map((s) => ({
      ...s,
      name:           (s.name ?? '').substring(0, 100),
      messageContent: s.messageContent ? s.messageContent.substring(0, 1000) : undefined,
      linkUrl:        s.linkUrl ? s.linkUrl.substring(0, 500) : undefined,
    }));

    const funnel = await prisma.funnel.create({
      data: {
        organizationId: orgId,
        name:       body.funnelName ?? '가져온 퍼널',
        funnelType: body.funnelType ?? 'GENERAL',
        isActive:   false,
        stages: {
          create: sanitizedStages.map((s) => ({
            name:           s.name,
            order:          s.order,
            triggerType:    s.triggerType,
            triggerOffset:  s.triggerOffset,
            channel:        s.channel ?? 'SMS',
            messageContent: s.messageContent ?? undefined,
            linkUrl:        s.linkUrl ?? undefined,
          })),
        },
      },
      select: { id: true },
    });

    const group = await prisma.contactGroup.create({
      data: {
        organizationId: orgId,
        name:     body.groupName ?? '가져온 그룹',
        funnelId: funnel.id,
      },
      select: { id: true, name: true },
    });

    logger.log('[GroupImport] 가져오기 완료', { orgId, groupId: group.id });
    return NextResponse.json({ ok: true, group });
  } catch (e) {
    logger.log('[GroupImport] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
