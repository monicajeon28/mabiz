export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

type DeclineRequest = {
  reason?: string;
};

/**
 * POST /api/groups/[id]/decline - 그룹 거절 (L10 렌즈: False Choice)
 *
 * 목적: "관심없음" 버튼 클릭 → CRM에 거절 기록
 * 동작:
 * 1. Contact 생성 또는 업데이트
 * 2. "group-declined" 태그 추가
 * 3. 거절 사유 기록 (재타겟팅용)
 *
 * L10 렌즈 심리학:
 * - False Choice: 거부 옵션이 있다는 착각 → 실제로는 상담받기로 유도
 * - Reciprocity: "모든 선택을 환영합니다"는 메시지로 신뢰도 유지
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id: groupId } = await params;

    const body = (await req.json()) as DeclineRequest;
    const reason = body.reason || '기타';

    // IDOR 보안: organizationId 체크
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 사용자(Contact) 정보
    const currentUserId = ctx.userId;
    if (!currentUserId) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // Contact에 태그 및 거절 사유 추가
    const contact = await prisma.contact.findUnique({
      where: { id: currentUserId },
    });

    if (contact) {
      await prisma.contact.update({
        where: { id: currentUserId },
        data: {
          tags: {
            push: 'group-declined',
          },
          lensMetadata: {
            declinedGroupId: groupId,
            declinedGroupName: group.name,
            declineReason: reason,
            declinedAt: new Date().toISOString(),
          },
        },
      });
    }

    // 거절 기록 (분석용)
    logger.info('[Decline] 그룹 거절 기록', {
      groupId,
      contactId: currentUserId,
      reason,
    });

    return NextResponse.json({
      ok: true,
      message: '피드백이 기록되었습니다.',
    });
  } catch (err) {
    logger.error('[Decline] 거절 기록 실패', { err });
    return NextResponse.json(
      { ok: false, message: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
