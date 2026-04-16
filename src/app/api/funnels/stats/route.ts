import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/funnels/stats — 퍼널별 성과 지표
export async function GET(_req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 1. 조직의 모든 퍼널 + 연결된 그룹 수 + 그룹별 멤버 수
    const funnels = await prisma.funnel.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, name: true, isActive: true,
        stages: { select: { id: true }, orderBy: { order: "asc" } },
      },
    });

    // 2. 그룹-퍼널 연결 현황 (퍼널별 등록 고객 수)
    const groups = await prisma.contactGroup.findMany({
      where: { organizationId: orgId, funnelId: { not: null } },
      select: {
        funnelId: true,
        _count: { select: { members: true } },
      },
    });

    // 3. 채널별 SMS 발송 통계 (최근 30일)
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [smsByChannel, smsTotal] = await Promise.all([
      prisma.smsLog.groupBy({
        by:    ["channel", "status"],
        where: { organizationId: orgId, sentAt: { gte: since30d } },
        _count: { id: true },
      }),
      prisma.smsLog.count({ where: { organizationId: orgId, sentAt: { gte: since30d } } }),
    ]);

    // 퍼널별 등록 고객 수 집계
    const enrollMap: Record<string, number> = {};
    for (const g of groups) {
      if (!g.funnelId) continue;
      enrollMap[g.funnelId] = (enrollMap[g.funnelId] ?? 0) + g._count.members;
    }

    // 채널별 통계 집계
    type ChannelStat = { sent: number; failed: number; blocked: number; total: number; successRate: number };
    const channelStats: Record<string, ChannelStat> = {};
    for (const row of smsByChannel) {
      const ch = row.channel;
      if (!channelStats[ch]) channelStats[ch] = { sent: 0, failed: 0, blocked: 0, total: 0, successRate: 0 };
      const count = row._count.id;
      channelStats[ch].total += count;
      if (row.status === "SENT")    channelStats[ch].sent    += count;
      if (row.status === "FAILED")  channelStats[ch].failed  += count;
      if (row.status === "BLOCKED") channelStats[ch].blocked += count;
    }
    for (const ch of Object.keys(channelStats)) {
      const s = channelStats[ch];
      s.successRate = s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0;
    }

    const funnelStats = funnels.map((f) => ({
      id:           f.id,
      name:         f.name,
      isActive:     f.isActive,
      stageCount:   f.stages.length,
      enrolledCount: enrollMap[f.id] ?? 0,
    }));

    logger.log("[GET /api/funnels/stats]", { orgId, funnelCount: funnels.length, smsTotal });

    return NextResponse.json({
      ok: true,
      funnelStats,
      channelStats,
      smsTotal,
      period: "최근 30일",
    });
  } catch (err) {
    logger.error("[GET /api/funnels/stats]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
