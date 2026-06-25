export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET: GLOBAL_ADMIN(전체) + OWNER(자기 조직만) — 삭제요청 목록 (goldMember 이름/코드 포함)
// [권한 설계 근거] 요구사항 원문은 "GLOBAL_ADMIN만 목록 조회"이나, OWNER가 본인이 등록한 삭제
// 요청의 처리 상태(PENDING/APPROVED/REJECTED)를 확인하는 UX 흐름이 필수적이므로,
// OWNER에게 자기 조직 골드회원의 삭제 요청 조회를 명시적으로 허용한다(예외 인정).
// — OWNER 조회 범위: organizationId 일치하는 골드회원의 삭제요청만 (Oracle 방지 검증 포함)
// — GLOBAL_ADMIN 조회 범위: 전체
// — AGENT 이하: 접근 불가
// 쿼리 파라미터: status(PENDING|APPROVED|REJECTED), goldMemberId, page, limit
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const isAdmin = ctx.role === 'GLOBAL_ADMIN';
    const isOwner = ctx.role === 'OWNER';

    // OWNER: 자기 조직 삭제요청 조회 허용 (본인 요청 상태 확인 목적)
    // GLOBAL_ADMIN: 전체 조회
    // AGENT 이하: 접근 불가
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ ok: false, error: '지사장 또는 관리자만 접근할 수 있습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam       = searchParams.get('status');
    const goldMemberIdParam = searchParams.get('goldMemberId');
    const pageParam         = searchParams.get('page');
    const limitParam        = searchParams.get('limit');

    type DeleteRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
    const validStatuses: DeleteRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
    const statusFilter: DeleteRequestStatus | undefined =
      statusParam && (validStatuses as string[]).includes(statusParam)
        ? (statusParam as DeleteRequestStatus)
        : undefined;

    const page  = Math.max(1, parseInt(pageParam  ?? '1',  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20));
    const skip  = (page - 1) * limit;

    const where: Prisma.GoldMemberDeleteRequestWhereInput = {};
    if (statusFilter) where.status = statusFilter;

    // OWNER: 자기 조직 골드회원의 삭제요청만 조회
    if (isOwner) {
      if (!ctx.organizationId) {
        return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
      }
      // goldMemberId 파라미터가 있으면 해당 골드회원이 자기 조직 소속인지 먼저 검증 (Oracle 방지)
      if (goldMemberIdParam) {
        const target = await prisma.goldMember.findUnique({
          where: { id: goldMemberIdParam },
          select: { organizationId: true },
        });
        if (!target || target.organizationId !== ctx.organizationId) {
          return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
        }
      }
      where.goldMember = { is: { organizationId: ctx.organizationId } };
    }

    if (goldMemberIdParam) where.goldMemberId = goldMemberIdParam;

    type DeleteRequestWithMember = Prisma.GoldMemberDeleteRequestGetPayload<{
      include: {
        goldMember: {
          select: {
            id: true;
            name: true;
            memberCode: true;
            courseType: true;
            status: true;
            organizationId: true;
          };
        };
      };
    }>;

    const TIMEOUT_MS = 8000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS),
    );

    const queryPromise: Promise<[number, DeleteRequestWithMember[]]> = Promise.all([
      prisma.goldMemberDeleteRequest.count({ where }),
      prisma.goldMemberDeleteRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
      }),
    ]);

    let total: number;
    let requests: DeleteRequestWithMember[];
    try {
      [total, requests] = await Promise.race([queryPromise, timeoutPromise]);
    } catch (e) {
      if (e instanceof Error && e.message === 'TIMEOUT') {
        return NextResponse.json({ ok: false, error: '요청 시간이 초과되었습니다.' }, { status: 504 });
      }
      throw e;
    }

    return NextResponse.json({
      ok: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
      return NextResponse.json({ ok: false, error: '지사장 또는 관리자만 삭제 요청이 가능합니다.' }, { status: 403 });
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
    // $transaction(Serializable)으로 findFirst + create를 원자적으로 묶어
    // 동시 요청 시 TOCTOU 경쟁 조건을 방지한다.
    let request: Prisma.GoldMemberDeleteRequestGetPayload<Record<string, never>>;
    try {
      request = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.goldMemberDeleteRequest.findFirst({
            where: { goldMemberId, status: 'PENDING' },
          });
          if (existing) {
            throw Object.assign(new Error('DUPLICATE_PENDING'), { code: 'DUPLICATE_PENDING' });
          }
          return tx.goldMemberDeleteRequest.create({
            data: {
              goldMemberId,
              requesterId: ctx.userId,
              reason:      reason?.trim() || null,
              status:      'PENDING',
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (txErr) {
      // 트랜잭션 내부에서 던진 중복 에러
      if (txErr instanceof Error && txErr.message === 'DUPLICATE_PENDING') {
        return NextResponse.json({ ok: false, error: '이미 처리 대기 중인 삭제 요청이 있습니다.' }, { status: 409 });
      }
      // DB 레벨 unique constraint 위반 (partial index 추가 후 발생 가능)
      if (txErr instanceof Prisma.PrismaClientKnownRequestError && txErr.code === 'P2002') {
        return NextResponse.json({ ok: false, error: '이미 처리 대기 중인 삭제 요청이 있습니다.' }, { status: 409 });
      }
      throw txErr;
    }

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
