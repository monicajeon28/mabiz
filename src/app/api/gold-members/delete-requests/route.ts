export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET: GLOBAL_ADMIN + OWNER — 삭제요청 목록 (goldMember 이름/코드 포함)
// 쿼리 파라미터: status(PENDING|APPROVED|REJECTED), goldMemberId
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const isAdmin = ctx.role === 'GLOBAL_ADMIN';
    const isOwner = ctx.role === 'OWNER';

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ ok: false, error: '대리점장 또는 관리자만 접근할 수 있습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam      = searchParams.get('status');
    const goldMemberIdParam = searchParams.get('goldMemberId');

    type DeleteRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
    const validStatuses: DeleteRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
    const statusFilter: DeleteRequestStatus | undefined =
      statusParam && (validStatuses as string[]).includes(statusParam)
        ? (statusParam as DeleteRequestStatus)
        : undefined;

    const where: Prisma.GoldMemberDeleteRequestWhereInput = {};
    if (statusFilter)       where.status       = statusFilter;
    if (goldMemberIdParam)  where.goldMemberId = goldMemberIdParam;

    // OWNER: 자기 조직 골드회원의 삭제요청만 조회
    if (isOwner) {
      if (!ctx.organizationId) {
        return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
      }
      where.goldMember = { is: { organizationId: ctx.organizationId } };
    }

    const requests = await prisma.goldMemberDeleteRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        goldMember: {
          select: {
            id: true,
            name: true,
            memberCode: true,
            courseType: true,
            status: true,
            organizationId: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      total: requests.length,
      requests: requests.map((r) => ({
        id:           r.id,
        goldMemberId: r.goldMemberId,
        goldMember:   r.goldMember,
        requesterId:  r.requesterId,
        reason:       r.reason,
        status:       r.status,
        reviewerId:   r.reviewerId,
        reviewedAt:   r.reviewedAt?.toISOString() ?? null,
        createdAt:    r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error('[GET /api/gold-members/delete-requests]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

// POST: OWNER + GLOBAL_ADMIN — 삭제 요청 등록
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const allowedRoles: string[] = ['OWNER', 'GLOBAL_ADMIN'];
    if (!allowedRoles.includes(ctx.role)) {
      return NextResponse.json({ ok: false, error: '대리점장 또는 관리자만 삭제 요청이 가능합니다.' }, { status: 403 });
    }

    const body = await req.json() as { goldMemberId?: string; reason?: string };
    const { goldMemberId, reason } = body;

    if (!goldMemberId || typeof goldMemberId !== 'string' || !goldMemberId.trim()) {
      return NextResponse.json({ ok: false, error: '골드회원 ID는 필수입니다.' }, { status: 400 });
    }

    // 골드회원 존재 및 소프트삭제 여부 확인
    const member = await prisma.goldMember.findUnique({
      where: { id: goldMemberId },
      select: { id: true, name: true, organizationId: true, deletedAt: true },
    });
    if (!member || member.deletedAt !== null) {
      return NextResponse.json({ ok: false, error: '골드회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // OWNER는 자기 조직 골드회원만 요청 가능
    if (ctx.role === 'OWNER') {
      if (!ctx.organizationId || member.organizationId !== ctx.organizationId) {
        return NextResponse.json({ ok: false, error: '다른 조직의 골드회원은 삭제 요청할 수 없습니다.' }, { status: 403 });
      }
    }

    // 이미 PENDING 요청이 있으면 409
    const existing = await prisma.goldMemberDeleteRequest.findFirst({
      where: { goldMemberId, status: 'PENDING' },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: '이미 처리 대기 중인 삭제 요청이 있습니다.' }, { status: 409 });
    }

    const request = await prisma.goldMemberDeleteRequest.create({
      data: {
        goldMemberId,
        requesterId: ctx.userId,
        reason:      reason?.trim() || null,
        status:      'PENDING',
      },
    });

    logger.info('[POST /api/gold-members/delete-requests] 삭제 요청 등록', {
      requestId: request.id,
      goldMemberId,
      requesterId: ctx.userId,
    });

    return NextResponse.json({ ok: true, request }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/gold-members/delete-requests]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
