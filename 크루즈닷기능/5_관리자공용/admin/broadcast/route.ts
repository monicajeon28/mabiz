export const dynamic = 'force-dynamic';

// app/api/admin/broadcast/route.ts
// 관리자용: 긴급 공지 발송 API

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { sendBroadcastNotification } from '@/lib/push/server';

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

export async function POST(req: Request) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    // 요청 데이터
    const {
      title,
      message,
      targetGroup, // 'all', 'active', 'inProgress', 'hibernated'
      userIds, // 특정 사용자 ID 배열 (선택사항)
    } = await req.json();

    if (!title || !message) {
      return NextResponse.json(
        { ok: false, error: 'Title and message required' },
        { status: 400 }
      );
    }

    // 대상 사용자 ID 목록 생성
    let targetUserIds: number[] = [];

    if (userIds && Array.isArray(userIds)) {
      // 특정 사용자
      targetUserIds = userIds.map((id: any) => parseInt(id));
    } else if (targetGroup === 'active') {
      // 활성 사용자
      const users = await prisma.user.findMany({
        where: { isHibernated: false },
        select: { id: true },
      });
      targetUserIds = users.map(u => u.id);
    } else if (targetGroup === 'hibernated') {
      // 동면 사용자
      const users = await prisma.user.findMany({
        where: { isHibernated: true },
        select: { id: true },
      });
      targetUserIds = users.map(u => u.id);
    } else if (targetGroup === 'inProgress') {
      // 여행 중인 사용자
      const trips = await prisma.trip.findMany({
        where: { status: 'InProgress' },
        select: { userId: true },
        distinct: ['userId'],
      });
      targetUserIds = trips.map(t => t.userId);
    }
    // targetGroup === 'all' 또는 undefined면 전체 발송 (targetUserIds 비어있음)

    // 브로드캐스트 발송
    const result = await sendBroadcastNotification(
      {
        title,
        body: message,
        tag: 'admin-broadcast',
        data: { url: '/chat', broadcast: '1' },
      },
      targetUserIds.length > 0 ? targetUserIds : undefined
    );

    // 발송 로그 기록 (각 사용자별)
    if (result.totalSent > 0) {
      const logTargetUserIds = targetUserIds.length > 0 
        ? targetUserIds 
        : (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);

      await prisma.notificationLog.createMany({
        data: logTargetUserIds.map(userId => ({
          userId,
          tripId: null,
          itineraryId: null,
          notificationType: 'ADMIN_BROADCAST',
          eventKey: `BROADCAST_${userId}_${Date.now()}`,
          title,
          body: message,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Broadcast notification sent successfully',
      result: {
        sent: result.totalSent,
        failed: result.totalErrors,
        targetCount: targetUserIds.length || '전체',
      },
    });
  } catch (error) {
    console.error('[Admin Broadcast API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
