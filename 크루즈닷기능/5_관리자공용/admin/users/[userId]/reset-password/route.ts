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

// POST: 비밀번호 초기화
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const { newPassword } = await req.json();
    const password = newPassword || '3800'; // 기본값 3800

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 비밀번호 이벤트 기록
    await prisma.passwordEvent.create({
      data: {
        userId: user.id,
        from: user.password,
        to: password,
        reason: `관리자 비밀번호 초기화 (관리자 ID: ${admin.id})`,
      },
    });

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { password },
    });

    return NextResponse.json({
      ok: true,
      message: `비밀번호가 ${password}로 초기화되었습니다.`,
    });
  } catch (error) {
    logger.error('[Admin Reset Password] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
