import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

type AssignBody = {
  assignedUserId: string;
  partnerType?: string;
  reason?: string;
};

// POST /api/members/[id]/assign
// GmUser에 담당자 지정 + ContactChangeLog 기록
export async function POST(req: Request, { params }: Params) {
  try {
    // 권한 확인 — OWNER, GLOBAL_ADMIN만
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (session.role !== 'OWNER' && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const gmUserId = parseInt(id, 10);

    if (isNaN(gmUserId)) {
      return NextResponse.json({ ok: false, error: '잘못된 ID입니다.' }, { status: 400 });
    }

    const body: AssignBody = await req.json();
    const { assignedUserId, partnerType, reason } = body;

    if (!assignedUserId) {
      return NextResponse.json({ ok: false, error: '담당자 ID가 필요합니다.' }, { status: 400 });
    }

    // GmUser 존재 확인
    const user = await prisma.gmUser.findUnique({
      where: { id: gmUserId },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // assignedUserId가 활성 대리점장/세일즈 유저인지 확인
    // GET /api/org/agents의 응답 구조를 따르면, 활성 유저만 반환된다고 가정
    // 하지만 검증을 위해 organizationMember 테이블에서 확인
    const assignedUser = await prisma.organizationMember.findFirst({
      where: {
        id: assignedUserId,
        isActive: true,
        role: { in: ['BRANCH_MANAGER', 'AGENT', 'SALES_AGENT'] },
      },
    });

    if (!assignedUser) {
      return NextResponse.json(
        { ok: false, error: '활성화된 담당자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이전 affiliateCode 값 저장 (변경 기록용)
    const oldAffiliateCode = user.affiliateCode || '';

    // 이전 partnerType 값 (ContactChangeLog 기록)
    const oldPartnerType = user.partnerType || '';
    const newPartnerType = partnerType || '';

    // GmUser 업데이트
    const updatedUser = await prisma.gmUser.update({
      where: { id: gmUserId },
      data: {
        affiliateCode: assignedUserId,
        partnerType: partnerType,
      },
    });

    // ContactChangeLog 생성 - assignedUserId 변경 기록
    await prisma.contactChangeLog.create({
      data: {
        gmUserId,
        field: 'assignedUserId',
        oldValue: oldAffiliateCode || null,
        newValue: assignedUserId,
        reason: reason || null,
        changedBy: session.userId,
      },
    });

    // partnerType도 변경되면 로그 추가
    if (oldPartnerType !== newPartnerType) {
      await prisma.contactChangeLog.create({
        data: {
          gmUserId,
          field: 'partnerType',
          oldValue: oldPartnerType || null,
          newValue: newPartnerType || null,
          reason: reason || null,
          changedBy: session.userId,
        },
      });
    }

    logger.info('[POST /api/members/[id]/assign]', {
      gmUserId,
      assignedUserId,
      changedBy: session.userId,
      reason,
    });

    return NextResponse.json({
      ok: true,
      user: updatedUser,
    });
  } catch (err) {
    logger.error('[POST /api/members/[id]/assign]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
