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
    console.error('[Admin Funnel Logs Detail] Auth check error:', error);
    return null;
  }
}

/**
 * GET /api/admin/funnel-messages/logs/[id]
 * 특정 퍼널+그룹+단계의 발송 상세 로그 조회
 * id 형식: {source}-{groupId}-{funnelMessageId}-{stageNumber}
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const resolvedParams = await params;
    const idParts = resolvedParams.id.split('-');

    if (idParts.length !== 4) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID 형식입니다. (source-groupId-funnelId-stage)' }, { status: 400 });
    }

    const [source, groupIdStr, funnelIdStr, stageStr] = idParts;
    const groupId = parseInt(groupIdStr);
    const funnelMessageId = parseInt(funnelIdStr);
    const stageNumber = parseInt(stageStr);

    if (!['partner', 'admin'].includes(source) || isNaN(groupId) || isNaN(funnelMessageId) || isNaN(stageNumber)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const actionType = source === 'partner' ? 'partner_funnel.sms.sent' : 'admin_funnel.sms.sent';

    // AdminActionLog에서 해당 조건의 발송 로그 조회
    const allLogs = await prisma.adminActionLog.findMany({
      where: {
        action: actionType,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    // 필터링
    const filteredLogs = allLogs.filter((log) => {
      const details = log.details as any;
      if (details.groupId !== groupId) return false;
      if (details.funnelMessageId !== funnelMessageId) return false;
      if (details.stageNumber !== stageNumber) return false;
      return true;
    });

    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(skip, skip + limit);

    // 고객 정보 조회 (파트너: AffiliateLead, 관리자: User)
    let recipients: any[] = [];

    if (source === 'partner') {
      const leadIds = [...new Set(paginatedLogs.map(log => (log.details as any).leadId).filter(Boolean))];
      const leads = leadIds.length > 0
        ? await prisma.affiliateLead.findMany({
            where: { id: { in: leadIds } },
            select: { id: true, customerName: true, customerPhone: true },
          })
        : [];
      const leadMap = new Map<number, { id: number; customerName: string | null; customerPhone: string | null }>(
        leads.map(l => [l.id, l])
      );

      recipients = paginatedLogs.map((log) => {
        const details = log.details as any;
        const lead = leadMap.get(details.leadId);
        return {
          id: log.id,
          leadId: details.leadId,
          customerName: lead?.customerName || '알 수 없음',
          customerPhone: lead?.customerPhone || details.phone || '알 수 없음',
          sentAt: log.createdAt.toISOString(),
          messageLength: details.messageLength,
          profileId: details.profileId,
        };
      });
    } else {
      const userIds = [...new Set(paginatedLogs.map(log => (log.details as any).userId).filter(Boolean))];
      const users = userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, phone: true },
          })
        : [];
      const userMap = new Map<number, { id: number; name: string | null; phone: string | null }>(
        users.map(u => [u.id, u])
      );

      recipients = paginatedLogs.map((log) => {
        const details = log.details as any;
        const user = userMap.get(details.userId);
        return {
          id: log.id,
          userId: details.userId,
          customerName: user?.name || '알 수 없음',
          customerPhone: user?.phone || details.phone || '알 수 없음',
          sentAt: log.createdAt.toISOString(),
          messageLength: details.messageLength,
          adminId: details.adminId,
        };
      });
    }

    // 그룹, 퍼널 정보 조회
    const [group, funnel] = await Promise.all([
      source === 'partner'
        ? prisma.partnerCustomerGroup.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
          })
        : prisma.customerGroup.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
          }),
      prisma.funnelMessage.findUnique({
        where: { id: funnelMessageId },
        select: {
          id: true,
          title: true,
          FunnelMessageStage: {
            where: { stageNumber },
            select: { id: true, stageNumber: true, content: true, sendTime: true, daysAfter: true },
          },
        },
      }),
    ]);

    const stageInfo = funnel?.FunnelMessageStage?.[0] || null;

    return NextResponse.json({
      ok: true,
      info: {
        source,
        sourceLabel: source === 'partner' ? '파트너' : '관리자',
        groupId,
        groupName: group?.name || `그룹 #${groupId}`,
        funnelMessageId,
        funnelTitle: funnel?.title || `퍼널 #${funnelMessageId}`,
        stageNumber,
        stageContent: stageInfo?.content || '',
        stageSendTime: stageInfo?.sendTime || '',
        stageDaysAfter: stageInfo?.daysAfter || 0,
      },
      totalSent: total,
      recipients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Admin Funnel Logs Detail GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '발송 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
