import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

// GET /api/members/[id]
// GmUser 상세 정보 + ContactChangeLog 이력 조회
export async function GET(_req: Request, { params }: Params) {
  try {
    // 권한 확인 — GLOBAL_ADMIN 전용
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const gmUserId = parseInt(id, 10);

    if (isNaN(gmUserId)) {
      return NextResponse.json({ ok: false, error: '잘못된 ID입니다.' }, { status: 400 });
    }

    // GmUser 조회 (groups 포함)
    const user = await prisma.gmUser.findUnique({
      where: { id: gmUserId },
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // ContactChangeLog 이력 조회 (시간 역순)
    const changeHistory = await prisma.contactChangeLog.findMany({
      where: { gmUserId },
      orderBy: { changedAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      user,
      changeHistory,
    });
  } catch (err) {
    logger.error('[GET /api/members/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/members/[id]
// 회원 상태(memberStatus) + 태그(memberTags) 업데이트
export async function PATCH(req: Request, { params }: Params) {
  try {
    // 권한 확인 — GLOBAL_ADMIN 전용
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const gmUserId = parseInt(id, 10);

    if (isNaN(gmUserId)) {
      return NextResponse.json({ ok: false, error: '잘못된 ID입니다.' }, { status: 400 });
    }

    // 회원 존재 확인
    const user = await prisma.gmUser.findUnique({
      where: { id: gmUserId },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { memberStatus, memberTags } = body;

    // 업데이트 데이터 구성
    const updateData: { memberStatus?: string | null; memberTags?: string[] } = {};

    if (memberStatus !== undefined) {
      updateData.memberStatus = memberStatus;
    }

    if (Array.isArray(memberTags)) {
      updateData.memberTags = memberTags;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: '업데이트할 필드가 없습니다.' }, { status: 400 });
    }

    // GmUser 업데이트
    const updated = await prisma.gmUser.update({
      where: { id: gmUserId },
      data: updateData,
    });

    logger.info('[PATCH /api/members/[id]]', { gmUserId, updateData });

    return NextResponse.json({
      ok: true,
      user: updated,
    });
  } catch (err) {
    logger.error('[PATCH /api/members/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
