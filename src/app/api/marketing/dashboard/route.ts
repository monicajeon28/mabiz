import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/marketing/dashboard
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json({ ok: false, message: "접근 권한이 없습니다." }, { status: 403 });
    }

    const orgId = requireOrgId(ctx);

    // ── 1. 조직 소유 랜딩페이지 목록 + viewCount 합계
    const pages = await prisma.crmLandingPage.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        title: true,
        slug: true,
        viewCount: true,
        _count: { select: { registrations: true } },
      },
    });

    const totalViews = pages.reduce((sum, p) => sum + p.viewCount, 0);
    const totalRegistrations = pages.reduce((sum, p) => sum + p._count.registrations, 0);

    // ── 2. 퍼널 진입 수 (funnelStarted = true)
    const funnelEnteredResult = await prisma.crmLandingRegistration.count({
      where: {
        landingPage: { organizationId: orgId },
        funnelStarted: true,
      },
    });

    // ── 3. 구매 전환 수 (Contact.purchasedAt IS NOT NULL, orgId 소속)
    const purchasedResult = await prisma.contact.count({
      where: {
        organizationId: orgId,
        purchasedAt: { not: null },
      },
    });

    // ── 4. 전환율 계산
    const conversionRate =
      totalViews > 0
        ? Math.round((totalRegistrations / totalViews) * 1000) / 10
        : 0;
    const purchaseRate =
      totalRegistrations > 0
        ? Math.round((purchasedResult / totalRegistrations) * 1000) / 10
        : 0;

    // ── 4-1. 전월 대비 등록수
    const lpIds = pages.map((p) => p.id);
    const thisMonthStart = new Date();
    thisMonthStart.setUTCDate(1);
    thisMonthStart.setUTCHours(0, 0, 0, 0);

    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);
    const lastMonthEnd = new Date(thisMonthStart);

    const [thisMonthRegs, lastMonthRegs] = await Promise.all([
      prisma.crmLandingRegistration.count({
        where: { landingPageId: { in: lpIds }, createdAt: { gte: thisMonthStart } },
      }),
      prisma.crmLandingRegistration.count({
        where: { landingPageId: { in: lpIds }, createdAt: { gte: lastMonthStart, lt: lastMonthEnd } },
      }),
    ]);

    const regDelta =
      lastMonthRegs > 0
        ? Math.round(((thisMonthRegs - lastMonthRegs) / lastMonthRegs) * 100)
        : null;

    // ── 5. 상위 5개 랜딩페이지 (등록수 기준)
    const topPages = pages
      .map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        viewCount: p.viewCount,
        registrations: p._count.registrations,
        conversionRate:
          p.viewCount > 0
            ? Math.round((p._count.registrations / p.viewCount) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 5);

    // ── 6. 최근 7일 일별 등록수 trend
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const recentRegs = await prisma.crmLandingRegistration.findMany({
      where: {
        landingPage: { organizationId: orgId },
        createdAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true },
    });

    // UTC+9 기준 날짜별 집계
    const trendMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      trendMap[key] = 0;
    }

    for (const reg of recentRegs) {
      // UTC+9 변환
      const kst = new Date(reg.createdAt.getTime() + 9 * 60 * 60 * 1000);
      const key = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
      if (key in trendMap) {
        trendMap[key] = (trendMap[key] ?? 0) + 1;
      }
    }

    const trend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    logger.log("[GET /api/marketing/dashboard]", { orgId, totalViews, totalRegistrations });

    return NextResponse.json({
      ok: true,
      summary: {
        totalViews,
        totalRegistrations,
        totalFunnelEntered: funnelEnteredResult,
        totalPurchased: purchasedResult,
        conversionRate,
        purchaseRate,
        thisMonthRegistrations: thisMonthRegs,
        lastMonthRegistrations: lastMonthRegs,
        registrationDelta: regDelta,
      },
      topPages,
      trend,
    });
  } catch (err) {
    logger.error("[GET /api/marketing/dashboard]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
