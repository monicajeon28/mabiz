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

// POST: 계정 잠금
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

    const { reason } = await req.json();

    // 사용자 조회 (비밀번호 포함)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isLocked: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.isLocked) {
      return NextResponse.json(
        { ok: false, error: 'Account is already locked' },
        { status: 400 }
      );
    }

    // 비밀번호 이벤트 기록
    await prisma.passwordEvent.create({
      data: {
        userId: user.id,
        from: user.password || 'unknown',
        to: '8300',
        reason: reason || '관리자에 의해 잠금',
      },
    });

    // 계정 잠금 및 비밀번호 변경
    await prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: true,
        lockedAt: new Date(),
        lockedReason: reason || '관리자에 의해 잠금',
        password: '8300', // 잠금 시 비밀번호를 8300으로 변경하여 로그인 불가능하게 함
        customerStatus: 'locked', // 고객 상태를 'locked'로 변경
      },
    });

    return NextResponse.json({
      ok: true,
      message: '계정이 잠금되었습니다.',
    });
  } catch (error) {
    logger.error('[Admin Lock Account] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to lock account' },
      { status: 500 }
    );
  }
}

// DELETE: 계정 잠금 해제
export async function DELETE(
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

    // 사용자 조회 (비밀번호 포함)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isLocked: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.isLocked) {
      return NextResponse.json(
        { ok: false, error: 'Account is not locked' },
        { status: 400 }
      );
    }

    // 비밀번호 이벤트 기록
    await prisma.passwordEvent.create({
      data: {
        userId: user.id,
        from: user.password || 'unknown',
        to: '3800',
        reason: '관리자에 의해 잠금 해제',
      },
    });

    // 계정 잠금 해제 및 비밀번호 변경
    await prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        lockedAt: null,
        lockedReason: null,
        password: '3800', // 잠금 해제 시 비밀번호를 3800으로 변경하여 로그인 가능하게 함
        customerStatus: 'active', // 고객 상태를 'active'로 변경
      },
    });

    return NextResponse.json({
      ok: true,
      message: '계정 잠금이 해제되었습니다.',
    });
  } catch (error) {
    logger.error('[Admin Unlock Account] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to unlock account' },
      { status: 500 }
    );
  }
}
