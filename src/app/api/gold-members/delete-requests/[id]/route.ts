export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// PATCH: GLOBAL_ADMIN만 — 삭제 요청 승인(APPROVED) 또는 거부(REJECTED)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '관리자만 삭제 요청을 처리할 수 있습니다.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json() as { action?: string };
    const { action } = body;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { ok: false, error: "action은 'approve' 또는 'reject' 중 하나여야 합니다." },
        { status: 400 },
      );
    }

    // 삭제 요청 존재 확인
    const deleteRequest = await prisma.goldMemberDeleteRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        goldMemberId: true,
        goldMember: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
    });

    if (!deleteRequest) {
      return NextResponse.json({ ok: false, error: '삭제 요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (deleteRequest.status !== 'PENDING') {
      return NextResponse.json(
        { ok: false, error: '이미 처리된 삭제 요청입니다.' },
        { status: 409 },
      );
    }

    const now = new Date();

    if (action === 'approve') {
      // 트랜잭션: GoldMember 소프트삭제 + 요청 상태 APPROVED 동시 처리
      const [updatedRequest] = await prisma.$transaction([
        prisma.goldMemberDeleteRequest.update({
          where: { id },
          data: {
            status:     'APPROVED',
            reviewerId: ctx.userId,
            reviewedAt: now,
          },
        }),
        prisma.goldMember.update({
          where: { id: deleteRequest.goldMemberId },
          data:  { deletedAt: now },
        }),
      ]);

      logger.info('[PATCH /api/gold-members/delete-requests/[id]] 삭제 요청 승인', {
        requestId: id,
        goldMemberId: deleteRequest.goldMemberId,
        reviewerId: ctx.userId,
      });

      return NextResponse.json({ ok: true, request: updatedRequest });
    } else {
      // reject: 요청 상태만 REJECTED로 변경, 실제 삭제 없음
      const updatedRequest = await prisma.goldMemberDeleteRequest.update({
        where: { id },
        data: {
          status:     'REJECTED',
          reviewerId: ctx.userId,
          reviewedAt: now,
        },
      });

      logger.info('[PATCH /api/gold-members/delete-requests/[id]] 삭제 요청 거부', {
        requestId: id,
        goldMemberId: deleteRequest.goldMemberId,
        reviewerId: ctx.userId,
      });

      return NextResponse.json({ ok: true, request: updatedRequest });
    }
  } catch (err) {
    logger.error('[PATCH /api/gold-members/delete-requests/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
