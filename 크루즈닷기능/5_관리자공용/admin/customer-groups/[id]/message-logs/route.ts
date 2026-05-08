export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: {
        User: {
          select: {
            id: true,
            role: true,
            name: true,
          },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return null;
    }

    return session.User;
  } catch (error) {
    console.error('[Customer Group Message Logs] Auth check error:', error);
    return null;
  }
}

/**
 * GET /api/admin/customer-groups/[id]/message-logs
 * 고객 그룹의 예약 메시지 전송 기록 조회
 *
 * 반환 정보:
 * - 고객별 유입날짜 (addedAt)
 * - 유입 후 경과일수
 * - 예약메시지 전송 횟수
 * - 최근 전송 내역
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 고객 그룹 존재 확인
    const group = await prisma.customerGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: '고객 그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 그룹 멤버와 전송 기록 조회
    const members = await prisma.customerGroupMember.findMany({
      where: {
        groupId: groupId,
        releasedAt: null, // 해제되지 않은 멤버만
      },
      include: {
        User_CustomerGroupMember_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    // 각 멤버별 전송 기록 집계
    const now = new Date();
    const memberStats = await Promise.all(
      members.map(async (member) => {
        const user = member.User_CustomerGroupMember_userIdToUser;
        const addedAt = new Date(member.addedAt);
        const daysSinceAdded = Math.floor((now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24));

        // 전송 기록 조회
        const logs = await prisma.scheduledMessageLog.findMany({
          where: {
            userId: user.id,
            ScheduledMessage: {
              targetGroupId: groupId,
            },
          },
          include: {
            ScheduledMessage: {
              select: {
                id: true,
                title: true,
                sendMethod: true,
              },
            },
          },
          orderBy: { sentAt: 'desc' },
        });

        // 전송 횟수 집계
        const sentCount = logs.filter((log) => log.status === 'sent').length;
        const failedCount = logs.filter((log) => log.status === 'failed').length;

        // 최근 전송 내역 (최대 5개)
        const recentLogs = logs.slice(0, 5).map((log) => ({
          id: log.id,
          messageTitle: log.ScheduledMessage.title,
          sendMethod: log.ScheduledMessage.sendMethod,
          stageNumber: log.stageNumber,
          sentAt: log.sentAt.toISOString(),
          status: log.status,
          errorMessage: log.errorMessage,
        }));

        return {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          addedAt: addedAt.toISOString(),
          daysSinceAdded,
          sentCount,
          failedCount,
          totalCount: sentCount + failedCount,
          recentLogs,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
      },
      members: memberStats,
      summary: {
        totalMembers: members.length,
        totalSent: memberStats.reduce((sum, m) => sum + m.sentCount, 0),
        totalFailed: memberStats.reduce((sum, m) => sum + m.failedCount, 0),
      },
    });
  } catch (error: any) {
    console.error('[Customer Group Message Logs] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch message logs',
      },
      { status: 500 }
    );
  }
}
