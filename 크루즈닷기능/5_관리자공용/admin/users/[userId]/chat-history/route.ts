export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/chat-history/route.ts
// 관리자용: 사용자 AI 대화 기록 조회 API

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  const session = await prisma.session.findUnique({
    where: { id: sid },
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { role: true },
        },
      },
    });

  return session?.User.role === 'admin';  // ✅ 대문자 U로 변경
}

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);

    // URL 파라미터
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get('tripId');

    // ChatHistory 조회
    const chatHistories = await prisma.chatHistory.findMany({
      where: {
        userId,
        ...(tripId && { tripId: parseInt(tripId) }),
      },
      include: {
        trip: {
          select: {
            cruiseName: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      ok: true,
      chatHistories: chatHistories.map(ch => ({
        id: ch.id,
        sessionId: ch.sessionId,
        messages: ch.messages,
        tripId: ch.tripId,
        tripName: ch.trip?.cruiseName,
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('[Admin Chat History API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
