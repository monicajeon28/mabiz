export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

type ConsultRequest = {
  action?: 'consult';
};

/**
 * POST /api/groups/[id]/consult-request - 상담 신청 (L10 렌즈: 중간 선택지)
 *
 * 목적: "상담받기" 버튼 클릭 → CRM에 상담 신청 기록
 * 동작:
 * 1. Contact 생성 또는 업데이트
 * 2. "상담 신청" 태그 추가
 * 3. 다음 액션 자동 스케줄링 (Day 0 전화 콜)
 *
 * L10 렌즈 심리학:
 * - Action Bias: 결정하기 쉬운 중간 선택지
 * - Lowered Barrier: 불안한 고객도 참여 가능
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: groupId } = await params;

    const body = (await req.json()) as ConsultRequest;

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

    // 기존 Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id: currentUserId },
      select: { id: true, name: true, phone: true, email: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 상담 신청 기록 (CallLog 생성)
    // 목적: Day 0 (신청 후 24시간 이내) 전화 콜 스케줄링
    const consultLog = await prisma.callLog.create({
      data: {
        contactId: currentUserId,
        userId: ctx.userId,
        content: `[L10 상담신청] ${group.name} 그룹\n상담 신청 - 감정적 마무리 및 최종 신청 유도 필요`,
        nextAction: 'CONSULT_CALLBACK_24H',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간 후
        result: 'SCHEDULED',
        convictionScore: 70, // L10 Action Bias로 높은 engagement 예상
      },
    });

    // Contact에 태그 추가
    if (contact) {
      await prisma.contact.update({
        where: { id: currentUserId },
        data: {
          tags: {
            push: 'consult-request',
          },
          lensMetadata: {
            consultRequestedAt: new Date().toISOString(),
            consultGroupName: group.name,
            consultGroupId: groupId,
          },
        },
      });
    }

    logger.info('[ConsultRequest] 상담 신청 완료', {
      groupId,
      contactId: currentUserId,
      callLogId: consultLog.id,
    });

    return NextResponse.json({
      ok: true,
      message: '상담 신청이 완료되었습니다. 전문가가 곧 연락드리겠습니다.',
      contactId: currentUserId,
      callLogId: consultLog.id,
    });
  } catch (err) {
    logger.error('[ConsultRequest] 상담 신청 실패', { err });
    return NextResponse.json(
      { ok: false, message: '상담 신청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
