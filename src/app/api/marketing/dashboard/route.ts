import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/marketing/dashboard
export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json({ ok: false, message: "접근 권한이 없습니다." }, { status: 403 });
    }

    const orgId = resolveOrgIdOrNull(ctx);

    // ── 1. 조직 소유 랜딩페이지 목록 + viewCount 합계
    // DB-23: GLOBAL_ADMIN 전체 조회 시 OOM 방지를 위해 take:500 상한 적용
    const pages = await prisma.crmLandingPage.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}) },
      select: {
        id: true,
        title: true,
        slug: true,
        viewCount: true,
        _count: { select: { registrations: true } },
      },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    const totalViews = pages.reduce((sum, p) => sum + p.viewCount, 0);
    const totalRegistrations = pages.reduce((sum, p) => sum + p._count.registrations, 0);

    // ── 3. 구매 전환 수 (Contact.purchasedAt IS NOT NULL, orgId 소속)
    // API-MKT-013: 소프트 삭제된 연락처가 집계에 포함되지 않도록 deletedAt:null 필터 추가
    const purchasedResult = await prisma.contact.count({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        purchasedAt: { not: null },
        deletedAt: null,
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

    // ── 2. 퍼널 진입 수 (funnelStarted = true) — lpIds 기반 인덱스 최적화
    const funnelEnteredResult =
      lpIds.length === 0
        ? 0
        : await prisma.crmLandingRegistration.count({
            where: { landingPageId: { in: lpIds }, funnelStarted: true },
          });

    // LIB-TYPES-014: sales/route.ts와 동일한 Date.UTC() 방식으로 통일 (setUTC* 방식 → 명시적 UTC 생성)
    // 서버 타임존에 관계없이 일관된 월 경계 보장
    const nowForMonth = new Date();
    const thisMonthStart = new Date(Date.UTC(nowForMonth.getUTCFullYear(), nowForMonth.getUTCMonth(), 1));
    const thisMonthEnd   = new Date(Date.UTC(nowForMonth.getUTCFullYear(), nowForMonth.getUTCMonth() + 1, 1));
    const lastMonthStart = new Date(Date.UTC(nowForMonth.getUTCFullYear(), nowForMonth.getUTCMonth() - 1, 1));
    const lastMonthEnd   = thisMonthStart;

    const [thisMonthRegs, lastMonthRegs] = await Promise.all([
      prisma.crmLandingRegistration.count({
        where: {
          landingPageId: { in: lpIds },
          createdAt: { gte: thisMonthStart, lt: thisMonthEnd },
        },
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

    // DB-26: findMany에 take 상한 추가 + select: { createdAt: true }만 로드하여 메모리 최소화
    const recentRegs =
      lpIds.length === 0
        ? []
        : await prisma.crmLandingRegistration.findMany({
            where: {
              landingPageId: { in: lpIds },
              createdAt: { gte: sevenDaysAgo },
            },
            select: { createdAt: true },
            take: 5000,  // OOM 방지 상한 — 초과 시 최신 5000건만 집계
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
