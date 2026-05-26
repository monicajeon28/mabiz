export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

type JoinRequest = {
  tier?: 'basic' | 'premium' | 'vip';
};

// POST /api/groups/[id]/join - 그룹 가입 (L10 렌즈: 즉시구매 클로징)
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: groupId } = await params;

    const body = (await req.json()) as JoinRequest;
    const tier = body.tier || 'premium'; // 기본값: premium (L10 렌즈: 추천 옵션)

    // IDOR 보안: organizationId 체크
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true, funnelId: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 사용자 정보 확인
    const currentUser = ctx.userId;
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 이미 가입했는지 확인
    const existingMember = await prisma.contactGroupMember.findFirst({
      where: {
        groupId,
        contactId: currentUser,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { ok: false, message: '이미 가입된 그룹입니다.' },
        { status: 400 }
      );
    }

    // 그룹에 멤버 추가 (L10 렌즈: 즉시 액션 처리)
    const member = await prisma.contactGroupMember.create({
      data: {
        groupId,
        contactId: currentUser,
        // addedAt는 자동으로 현재 시간 저장
      },
    });

    // 퍼널이 연결되어 있으면 자동 시작
    if (group.funnelId) {
      try {
        // 퍼널 시작 로직 (필요한 경우 구현)
        logger.log('[GroupJoin] Funnel auto-start', {
          groupId,
          funnelId: group.funnelId,
          contactId: currentUser,
        });
      } catch (funnelErr) {
        logger.error('[GroupJoin] Funnel auto-start failed', { funnelErr });
        // 퍼널 시작 실패해도 가입은 성공
      }
    }

    // 성공 로깅 (L10 렌즈: 즉시 구매 추적)
    logger.log('[GroupJoin] Success', {
      groupId,
      contactId: currentUser,
      tier,
      groupName: group.name,
    });

    return NextResponse.json({
      ok: true,
      message: `${tier} 플랜으로 가입되었습니다. 커뮤니티에 즉시 접근하세요!`,
      member: {
        id: member.id,
        groupId: member.groupId,
        tier, // 프론트엔드에서 사용할 플랜 정보
      },
    });
  } catch (err) {
    logger.error('[POST /api/groups/[id]/join]', { err });
    return NextResponse.json({ ok: false, message: 'SERVER_ERROR' }, { status: 500 });
  }
}
