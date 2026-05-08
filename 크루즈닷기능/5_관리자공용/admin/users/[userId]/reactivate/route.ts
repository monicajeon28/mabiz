export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/reactivate/route.ts
// 비활성화된 사용자 계정 재활성화 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

async function checkAdminAuth() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== 'admin') return null;
  return sessionUser;
}

/**
 * POST /api/admin/users/[userId]/reactivate
 * 잠금 또는 비활성화된 계정을 재활성화합니다.
 * 요청: { reason?: string }
 * 보안: 관리자 권한 필수
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const userId = parseInt(params.userId);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 사용자 ID입니다' }, { status: 400 });
    }

    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = body?.reason;
    } catch {
      // 바디 없을 수도 있음 — 허용
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        isLocked: true,
        customerStatus: true,
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 이미 활성 상태인 경우
    if (!user.isLocked && user.customerStatus === 'active') {
      return NextResponse.json(
        { ok: false, error: '이미 활성화된 계정입니다' },
        { status: 400 }
      );
    }

    // 비밀번호 변경 이벤트 기록
    await prisma.passwordEvent.create({
      data: {
        userId: user.id,
        from: user.password ?? 'unknown',
        to: '3800',
        reason: reason ?? '관리자에 의해 재활성화',
      },
    });

    // 트랜잭션으로 원자적 재활성화
    const updatedUser = await prisma.$transaction(async (tx) => {
      return tx.user.update({
        where: { id: userId },
        data: {
          isLocked: false,
          lockedAt: null,
          lockedReason: null,
          password: '3800', // 재활성화 시 기본 비밀번호로 초기화
          customerStatus: 'active',
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          isLocked: true,
          customerStatus: true,
          updatedAt: true,
        },
      });
    });

    logger.log('[Admin Reactivate] 사용자 재활성화 완료', {
      adminId: admin.id,
      targetUserId: userId,
      reason,
    });

    return NextResponse.json({
      ok: true,
      message: '계정이 재활성화되었습니다',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        isLocked: updatedUser.isLocked,
        customerStatus: updatedUser.customerStatus,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[Admin Reactivate] Error:', error);
    return NextResponse.json(
      { ok: false, error: '계정 재활성화 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
