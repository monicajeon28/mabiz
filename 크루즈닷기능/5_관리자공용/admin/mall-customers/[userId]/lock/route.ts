export const dynamic = 'force-dynamic';

// app/api/admin/mall-customers/[userId]/lock/route.ts
// 크루즈몰 고객 계정 잠금/해제

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';
  } catch (error) {
    logger.error('[Admin Mall Customers] Auth check error:', error);
    return false;
  }
}

// POST: 계정 잠금
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const isAdmin = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await req.json();
    const { reason } = body;

    // 사용자 조회 (비밀번호 포함)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, isLocked: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    if (user.isLocked) {
      return NextResponse.json({ ok: false, error: 'Account is already locked' }, { status: 400 });
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

    await prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: true,
        lockedAt: new Date(),
        lockedReason: reason || '관리자에 의해 잠금',
        password: '8300', // 잠금 시 비밀번호를 8300으로 변경하여 로그인 불가능하게 함
        customerStatus: 'locked', // 고객 상태를 'locked'로 변경
      }
    });

    // 모든 세션 종료
    await prisma.session.deleteMany({
      where: { userId }
    });

    return NextResponse.json({
      ok: true,
      message: 'Account locked successfully'
    });
  } catch (error: any) {
    logger.error('[Admin Mall Customer Lock API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to lock account' },
      { status: 500 }
    );
  }
}

// DELETE: 계정 잠금 해제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const isAdmin = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // 사용자 조회 (비밀번호 포함)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, isLocked: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    if (!user.isLocked) {
      return NextResponse.json({ ok: false, error: 'Account is not locked' }, { status: 400 });
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

    await prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        lockedAt: null,
        lockedReason: null,
        password: '3800', // 잠금 해제 시 비밀번호를 3800으로 변경하여 로그인 가능하게 함
        customerStatus: 'active', // 고객 상태를 'active'로 변경
      }
    });

    return NextResponse.json({
      ok: true,
      message: 'Account unlocked successfully'
    });
  } catch (error: any) {
    logger.error('[Admin Mall Customer Unlock API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to unlock account' },
      { status: 500 }
    );
  }
}
