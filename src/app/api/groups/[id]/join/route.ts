export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

type JoinRequest = {
  contactId: string;
  tier?: 'basic' | 'premium' | 'vip';
};

// POST /api/groups/[id]/join - 그룹 가입 (L10 렌즈: 즉시구매 클로징)
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id: groupId } = await params;

    const body = (await req.json()) as JoinRequest;
    const { contactId, tier = 'premium' } = body; // 기본값: premium (L10 렌즈: 추천 옵션)

    if (!contactId) {
      return NextResponse.json(
        { ok: false, message: 'contactId 필수' },
        { status: 400 }
      );
    }

    // IDOR 보안: organizationId 체크
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true, funnelId: true, funnelSmsId: true, funnelSmsIds: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Contact 별도 조회 (ctx.userId는 User ID이지 Contact ID가 아님)
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: '연락처를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 가입했는지 확인
    const existingMember = await prisma.contactGroupMember.findFirst({
      where: {
        groupId,
        contactId: contact.id,
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
        contactId: contact.id,
        // addedAt는 자동으로 현재 시간 저장
      },
    });

    // 퍼널 문자(FunnelSms) 자동 시작
    const hasFunnelSms = group.funnelSmsIds.length > 0 || !!group.funnelSmsId;
    if (hasFunnelSms) {
      const { triggerGroupFunnelSms } = await import('@/lib/funnel-sms-trigger');
      triggerGroupFunnelSms({
        contactId: contact.id,
        groupId,
        organizationId: orgId,
        anchorDate: member.addedAt,
      }).catch((e) => logger.error('[GroupJoin] FunnelSms 트리거 실패', {
        error: e instanceof Error ? e.message : String(e),
      }));
    }

    // 이메일 퍼널이 연결되어 있으면 로깅
    if (group.funnelId) {
      logger.log('[GroupJoin] Funnel auto-start', {
        groupId,
        funnelId: group.funnelId,
        contactId: contact.id,
      });
    }

    // 성공 로깅 (L10 렌즈: 즉시 구매 추적)
    logger.log('[GroupJoin] Success', {
      groupId,
      contactId: contact.id,
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
