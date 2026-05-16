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

    // GmUser 조회
    const user = await prisma.gmUser.findUnique({
      where: { id: gmUserId },
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
