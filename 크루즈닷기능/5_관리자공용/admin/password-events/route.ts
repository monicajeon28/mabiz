export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';  // ✅ 대문자 U로 변경
  } catch (error) {
    console.error('[Admin Password Events] Auth check error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    // URL 파라미터에서 userId 추출
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid userId' },
        { status: 400 }
      );
    }

    // 비밀번호 변경 이력 조회
    const passwordEvents = await prisma.passwordEvent.findMany({
      where: { userId: userIdNum },
      orderBy: { createdAt: 'desc' },
      take: 50, // 최근 50개만
    });

    return NextResponse.json({
      ok: true,
      events: passwordEvents.map(event => ({
        id: event.id,
        from: event.from ? '***' : null, // 보안을 위해 마스킹
        to: event.to ? '***' : null,
        reason: event.reason,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Admin Password Events API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
