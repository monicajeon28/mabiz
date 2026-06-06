export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/shortlink
 * 파트너 대시보드 숏링크 성과 탭 — 내 숏링크 클릭 통계
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '7', 10) || 7));

    const userId = ctx.sessionUser?.id;
    const orgId  = ctx.organizationId;

    if (!userId || !orgId) {
      return NextResponse.json({
        ok: true,
        total: { clickCount: 0, averageClicksPerDay: 0, linkCount: 0 },
        dailyClicks: [],
        shortLinks: [],
      });
    }

    // 역할에 따른 링크 필터: GLOBAL_ADMIN/OWNER = 조직 전체, AGENT = 본인 것만
    const isAdmin = ctx.sessionUser?.role === 'admin' || ctx.sessionUser?.role === 'owner';
    const linkWhere = isAdmin
      ? { organizationId: orgId, isActive: true }
      : { organizationId: orgId, createdBy: String(userId), isActive: true };

    const links = await prisma.shortLink.findMany({
      where: linkWhere,
      select: { id: true, code: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (links.length === 0) {
      return NextResponse.json({
        ok: true,
        total: { clickCount: 0, averageClicksPerDay: 0, linkCount: 0 },
        dailyClicks: [],
        shortLinks: [],
      });
    }

    const linkIds = links.map((l) => l.id);
    const since = new Date(Date.now() - days * 86_400_000);

    // 링크별 전체 클릭 수
    const clicksByLink = await prisma.shortLinkClick.groupBy({
      by: ['linkId'],
      where: { linkId: { in: linkIds } },
      _count: { id: true },
    });
    const clickMap = new Map(clicksByLink.map((c) => [c.linkId, c._count.id]));

    // 일별 클릭 집계 (raw query)
    const dailyRaw = await prisma.$queryRaw<Array<{ date: string; clicks: bigint }>>`
      SELECT
        TO_CHAR(DATE("clickedAt"), 'YYYY-MM-DD') AS date,
        COUNT(*) AS clicks
      FROM "ShortLinkClick"
      WHERE "linkId" = ANY(${linkIds}::TEXT[])
        AND "clickedAt" >= ${since}
      GROUP BY DATE("clickedAt")
      ORDER BY DATE("clickedAt") ASC
    `;

    const dailyClicks = dailyRaw.map((r) => ({
      date: r.date,
      clicks: Number(r.clicks),
    }));

    const totalClicks = clicksByLink.reduce((s, c) => s + c._count.id, 0);

    const shortLinks = links.map((l) => ({
      id: l.id,
      title: l.title ?? l.code,
      shortCode: l.code,
      clickCount: clickMap.get(l.id) ?? 0,
      createdAt: l.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      total: {
        clickCount: totalClicks,
        averageClicksPerDay: Math.round((totalClicks / days) * 100) / 100,
        linkCount: links.length,
      },
      dailyClicks,
      shortLinks: shortLinks.sort((a, b) => b.clickCount - a.clickCount),
    });
  } catch (err) {
    logger.error('[partner/shortlink] 오류', err);
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
