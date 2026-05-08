export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

// 관리자 권한 확인
async function checkAdminAuth() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  // 사용자 role 확인
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true },
  });

  if (!user || user.role !== 'admin') {
    return null;
  }

  return sessionUser;
}

// DELETE: 세션 강제 종료
export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string; sessionId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    const sessionId = params.sessionId;

    if (isNaN(userId) || !sessionId) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID or session ID' },
        { status: 400 }
      );
    }

    // 세션 조회 및 소유권 확인
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.userId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    // 세션 삭제
    await prisma.session.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({
      ok: true,
      message: '세션이 강제 종료되었습니다.',
    });
  } catch (error) {
    logger.error('[Admin Delete Session] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
