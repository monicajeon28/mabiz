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

// GET: 세션 목록 조회
export async function GET(
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

    // 활성 세션 조회
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null }, // 만료 시간이 없는 세션
          { expiresAt: { gte: new Date() } }, // 만료되지 않은 세션
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isExpired: session.expiresAt ? session.expiresAt < new Date() : false,
      })),
    });
  } catch (error) {
    logger.error('[Admin Get Sessions] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
