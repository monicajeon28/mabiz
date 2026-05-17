import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// serializeGroup 헬퍼 함수
const serializeGroup = (group: any) => {
  if (!group) throw new Error('Group object is null or undefined');
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    color: group.color,
    funnelId: group.funnelId,
    funnelName: group.funnel?.name ?? null,
    _count: { members: group._count?.members ?? 0 },
  };
};

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (!orgId) {
      logger.error('[GroupClone] 조직 정보 없음', { userId: ctx?.userId });
      return NextResponse.json({ ok: false, message: '조직 정보 없음. 관리자에게 문의하세요.' }, { status: 403 });
    }
    const { id } = await params;

    // 현재 사용자 ID 조회
    const userId = ctx.userId || ctx.memberId;
    if (!userId) {
      return NextResponse.json({ ok: false, message: '인증 필요' }, { status: 401 });
    }

    // 원본 그룹 조회 (소유권 검증) + 멤버 포함
    const original = await prisma.contactGroup.findFirst({
      where: { id, organizationId: orgId },
      include: { members: { select: { contactId: true } } },
    });
    if (!original) return NextResponse.json({ ok: false }, { status: 404 });

    // 연결된 퍼널 조회
    let newFunnelId: string | null = null;
    if (original.funnelId) {
      const originalFunnel = await prisma.funnel.findFirst({
        where: { id: original.funnelId, organizationId: orgId },
        include: {
          stages: {
            select: {
              name: true,
              order: true,
              triggerType: true,
              triggerOffset: true,
              channel: true,
              messageContent: true,
              linkUrl: true,
            },
            orderBy: { order: 'asc' },
          },
        },
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

    // 그룹, 멤버, 토큰을 트랜잭션으로 보호 (CONS-003: 원자적 처리)
    const result = await prisma.$transaction(
      async (tx) => {
        // 그룹 복제 (ownerId 포함)
        const newGroup = await tx.contactGroup.create({
          data: {
            organizationId: orgId,
            name:     `[복제] ${original.name}`,
            funnelId: newFunnelId,
            ownerId:  userId,
          },
          include: {
            _count: { select: { members: true } },
            funnel: { select: { name: true } },
          },
        });

        // 멤버 배치 복사 (기존 멤버 전체)
        let memberCount = 0;
        if (original.members.length > 0) {
          await tx.contactGroupMember.createMany({
            data: original.members.map((m) => ({
              groupId:  newGroup.id,
              contactId: m.contactId,
            })),
            skipDuplicates: true, // 중복 방지
          });
          memberCount = original.members.length;
        }

        // GroupToken 생성 (7일 유효)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const token = await tx.groupToken.create({
          data: {
            groupId:  newGroup.id,
            expiresAt,
          },
          select: { id: true },
        });

        return { newGroup, memberCount, token };
      },
      {
        maxWait: 5000,  // 5초 대기
        timeout: 30000, // 30초 제한시간
      }
    );

    logger.log('[GroupClone] 복제 완료', {
      originalId: id,
      newGroupId: result.newGroup.id,
      memberCount: result.memberCount,
      tokenId: result.token.id,
      ownerId: userId,
    });
    return NextResponse.json({
      ok: true,
      group: serializeGroup(result.newGroup),
      memberCount: result.memberCount,
      token: result.token.id,
    });
  } catch (e) {
    logger.log('[GroupClone] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
