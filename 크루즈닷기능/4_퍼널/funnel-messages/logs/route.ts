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

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Admin Funnel Logs] Auth check error:', error);
    return null;
  }
}

/**
 * GET /api/admin/funnel-messages/logs
 * 퍼널 메시지 발송 로그 조회 (관리자용 - partner_funnel + admin_funnel 모두 포함)
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const source = searchParams.get('source'); // 'partner' | 'admin' | null (all)
    const groupId = searchParams.get('groupId');
    const funnelId = searchParams.get('funnelId');
    const skip = (page - 1) * limit;

    // 발송 로그 조회 (AdminActionLog 기반)
    const actionFilter: string[] = [];
    if (!source || source === 'partner') {
      actionFilter.push('partner_funnel.sms.sent');
    }
    if (!source || source === 'admin') {
      actionFilter.push('admin_funnel.sms.sent');
    }

    const allLogs = await prisma.adminActionLog.findMany({
      where: {
        action: { in: actionFilter },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    // 필터링
    const filteredLogs = allLogs.filter((log) => {
      const details = log.details as any;
      if (groupId && details.groupId !== parseInt(groupId)) return false;
      if (funnelId && details.funnelMessageId !== parseInt(funnelId)) return false;
      return true;
    });

    // 그룹별, 퍼널별, 소스별 통계 집계
    const statsMap = new Map<string, {
      source: 'partner' | 'admin';
      groupId: number;
      groupName: string;
      funnelMessageId: number;
      funnelTitle: string;
      stageNumber: number;
      totalSent: number;
      lastSentAt: Date;
      logs: any[];
    }>();

    for (const log of filteredLogs) {
      const details = log.details as any;
      const logSource = log.action.includes('partner') ? 'partner' : 'admin';
      const key = `${logSource}-${details.groupId || 0}-${details.funnelMessageId || 0}-${details.stageNumber || 0}`;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          source: logSource,
          groupId: details.groupId || 0,
          groupName: '',
          funnelMessageId: details.funnelMessageId || 0,
          funnelTitle: '',
          stageNumber: details.stageNumber || 0,
          totalSent: 0,
          lastSentAt: log.createdAt,
          logs: [],
        });
      }

      const stat = statsMap.get(key)!;
      stat.totalSent++;
      if (log.createdAt > stat.lastSentAt) {
        stat.lastSentAt = log.createdAt;
      }
      stat.logs.push({
        id: log.id,
        leadId: details.leadId,
        userId: details.userId,
        phone: details.phone,
        messageLength: details.messageLength,
        sentAt: log.createdAt.toISOString(),
        profileId: details.profileId,
        adminId: details.adminId,
      });
    }

    // 그룹명, 퍼널명 조회 (파트너 그룹 + 관리자 그룹)
    const partnerGroupIds = [...new Set([...statsMap.values()].filter(s => s.source === 'partner').map(s => s.groupId).filter(id => id > 0))];
    const adminGroupIds = [...new Set([...statsMap.values()].filter(s => s.source === 'admin').map(s => s.groupId).filter(id => id > 0))];
    const funnelIds = [...new Set([...statsMap.values()].map(s => s.funnelMessageId).filter(id => id > 0))];

    const [partnerGroups, adminGroups, funnels] = await Promise.all([
      partnerGroupIds.length > 0
        ? prisma.partnerCustomerGroup.findMany({
            where: { id: { in: partnerGroupIds } },
            select: { id: true, name: true },
          })
        : [],
      adminGroupIds.length > 0
        ? prisma.customerGroup.findMany({
            where: { id: { in: adminGroupIds } },
            select: { id: true, name: true },
          })
        : [],
      funnelIds.length > 0
        ? prisma.funnelMessage.findMany({
            where: { id: { in: funnelIds } },
            select: { id: true, title: true },
          })
        : [],
    ]);

    const partnerGroupNameMap = new Map(partnerGroups.map(g => [g.id, g.name]));
    const adminGroupNameMap = new Map(adminGroups.map(g => [g.id, g.name]));
    const funnelTitleMap = new Map(funnels.map(f => [f.id, f.title]));

    // 통계에 그룹명, 퍼널명 추가
    const stats = [...statsMap.values()].map(stat => {
      const groupNameMap = stat.source === 'partner' ? partnerGroupNameMap : adminGroupNameMap;
      return {
        ...stat,
        groupName: groupNameMap.get(stat.groupId) || `그룹 #${stat.groupId}`,
        funnelTitle: funnelTitleMap.get(stat.funnelMessageId) || `퍼널 #${stat.funnelMessageId}`,
        logs: stat.logs.slice(0, 5),
      };
    });

    // 정렬: 최근 발송순
    stats.sort((a, b) => b.lastSentAt.getTime() - a.lastSentAt.getTime());

    // 페이지네이션 적용
    const paginatedStats = stats.slice(skip, skip + limit);
    const total = stats.length;

    // 전체 통계
    const totalSentAll = filteredLogs.length;
    const partnerSent = filteredLogs.filter(log => log.action.includes('partner')).length;
    const adminSent = filteredLogs.filter(log => log.action.includes('admin')).length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySent = filteredLogs.filter(log => log.createdAt >= todayStart).length;

    return NextResponse.json({
      ok: true,
      summary: {
        totalSent: totalSentAll,
        partnerSent,
        adminSent,
        todaySent,
        groupCount: partnerGroupIds.length + adminGroupIds.length,
        funnelCount: funnelIds.length,
      },
      stats: paginatedStats.map(stat => ({
        source: stat.source,
        sourceLabel: stat.source === 'partner' ? '파트너' : '관리자',
        groupId: stat.groupId,
        groupName: stat.groupName,
        funnelMessageId: stat.funnelMessageId,
        funnelTitle: stat.funnelTitle,
        stageNumber: stat.stageNumber,
        totalSent: stat.totalSent,
        lastSentAt: stat.lastSentAt.toISOString(),
        recentLogs: stat.logs,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Admin Funnel Logs GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '발송 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
