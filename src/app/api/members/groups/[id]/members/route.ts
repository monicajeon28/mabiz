import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

// POST /api/members/groups/[id]/members
// 그룹에 회원 추가 (upsert)
export async function POST(req: Request, { params }: Params) {
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
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '잘못된 그룹 ID입니다.' }, { status: 400 });
    }

    // 그룹 존재 확인
    const group = await prisma.gmUserGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { gmUserId } = body;

    if (typeof gmUserId !== 'number' || gmUserId <= 0) {
      return NextResponse.json({ ok: false, error: '유효한 회원 ID가 필요합니다.' }, { status: 400 });
    }

    // 회원 존재 확인
    const member = await prisma.gmUser.findUnique({
      where: { id: gmUserId },
    });

    if (!member) {
      return NextResponse.json({ ok: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // upsert: 이미 있으면 무시, 없으면 생성
    const result = await prisma.gmUserGroupMember.upsert({
      where: {
        groupId_gmUserId: {
          groupId,
          gmUserId,
        },
      },
      create: {
        groupId,
        gmUserId,
      },
      update: {},
    });

    logger.info('[POST /api/members/groups/[id]/members]', { groupId, gmUserId });

    return NextResponse.json({
      ok: true,
      member: result,
    });
  } catch (err) {
    logger.error('[POST /api/members/groups/[id]/members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/members/groups/[id]/members
// 그룹에서 회원 제거
export async function DELETE(req: Request, { params }: Params) {
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
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '잘못된 그룹 ID입니다.' }, { status: 400 });
    }

    const body = await req.json();
    const { gmUserId } = body;

    if (typeof gmUserId !== 'number' || gmUserId <= 0) {
      return NextResponse.json({ ok: false, error: '유효한 회원 ID가 필요합니다.' }, { status: 400 });
    }

    // 그룹에서 회원 제거
    const result = await prisma.gmUserGroupMember.deleteMany({
      where: {
        groupId,
        gmUserId,
      },
    });

    logger.info('[DELETE /api/members/groups/[id]/members]', { groupId, gmUserId, deletedCount: result.count });

    return NextResponse.json({
      ok: true,
      deletedCount: result.count,
    });
  } catch (err) {
    logger.error('[DELETE /api/members/groups/[id]/members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
