export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {
      return null;
    }

    if (session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    logger.error('[Admin Messages Statistics] Auth check error:', error);
    return null;
  }
}

// GET: 메시지 통계 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다. 다시 로그인해 주세요.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: any = {
      messageType: 'team-dashboard',
      isActive: true, // 삭제되지 않은 메시지만
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // 전체 메시지 통계
    const allMessages = await prisma.adminMessage.findMany({
      where,
      include: {
        UserMessageRead: true,
        User_AdminMessage_adminIdToUser: {
          select: { id: true, name: true }
        }
      }
    });

    // 그룹화하여 통계 계산
    const groupedMessages = new Map<string, {
      title: string;
      content: string;
      admin: { id: number; name: string | null };
      createdAt: Date;
      totalSent: number;
      totalRead: number;
      messageIds: number[];
    }>();

    allMessages.forEach(msg => {
      const createdAtMinute = new Date(msg.createdAt).setSeconds(0, 0);
      const key = `${msg.title}|${msg.content}|${msg.adminId}|${createdAtMinute}`;
      
      if (!groupedMessages.has(key)) {
        groupedMessages.set(key, {
          title: msg.title,
          content: msg.content,
          admin: msg.User_AdminMessage_adminIdToUser,
          createdAt: msg.createdAt,
          totalSent: 0,
          totalRead: 0,
          messageIds: [],
        });
      }
      
      const group = groupedMessages.get(key)!;
      group.totalSent += 1;
      group.totalRead += msg.UserMessageRead.length;
      group.messageIds.push(msg.id);
    });

    const groups = Array.from(groupedMessages.values());

    // 전체 통계
    const totalSent = allMessages.length;
    const totalRead = allMessages.reduce((sum, msg) => sum + msg.UserMessageRead.length, 0);
    const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) : '0';

    // 일별 통계
    const dailyStatsMap = new Map<string, { sent: number; read: number }>();
    allMessages.forEach(msg => {
      const date = msg.createdAt.toISOString().split('T')[0];
      if (!dailyStatsMap.has(date)) {
        dailyStatsMap.set(date, { sent: 0, read: 0 });
      }
      const stat = dailyStatsMap.get(date)!;
      stat.sent += 1;
      stat.read += msg.UserMessageRead.length;
    });

    const dailyStats = Array.from(dailyStatsMap.entries())
      .map(([date, stat]) => ({
        date,
        sent: stat.sent,
        read: stat.read,
        readRate: stat.sent > 0 ? ((stat.read / stat.sent) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 발신자별 통계
    const adminStatsMap = new Map<number, {
      admin: { id: number; name: string | null };
      sent: number;
      read: number;
    }>();

    allMessages.forEach(msg => {
      const adminId = msg.adminId;
      if (!adminStatsMap.has(adminId)) {
        adminStatsMap.set(adminId, {
          admin: msg.User_AdminMessage_adminIdToUser,
          sent: 0,
          read: 0,
        });
      }
      const stat = adminStatsMap.get(adminId)!;
      stat.sent += 1;
      stat.read += msg.UserMessageRead.length;
    });

    const adminStats = Array.from(adminStatsMap.values()).map(stat => ({
      admin: stat.admin,
      sent: stat.sent,
      read: stat.read,
      readRate: stat.sent > 0 ? ((stat.read / stat.sent) * 100).toFixed(1) : '0',
    }));

    // 인기 메시지 TOP 10
    const topMessages = groups
      .sort((a, b) => b.totalSent - a.totalSent)
      .slice(0, 10)
      .map(group => ({
        title: group.title,
        admin: group.admin,
        totalSent: group.totalSent,
        totalRead: group.totalRead,
        readRate: group.totalSent > 0 ? ((group.totalRead / group.totalSent) * 100).toFixed(1) : '0',
        createdAt: group.createdAt.toISOString(),
      }));

    return NextResponse.json({
      ok: true,
      summary: {
        totalSent,
        totalRead,
        readRate: parseFloat(readRate),
        totalGroups: groups.length,
      },
      dailyStats,
      adminStats,
      topMessages,
    });
  } catch (error) {
    logger.error('[Admin Messages Statistics GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

