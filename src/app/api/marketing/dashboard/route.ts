import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/marketing/dashboard
export async function GET(request: Request) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json({ ok: false, message: "이 기능을 사용할 권한이 없어요." }, { status: 403 });
    }

    // [API-MKT-DASHBOARD-ORG-NULL-500-001] non-GLOBAL_ADMIN인데 organizationId가 없으면 500 대신 403 반환
    if (ctx.role !== "GLOBAL_ADMIN" && !ctx.organizationId) {
      return NextResponse.json({ ok: false, message: "조직 정보가 없어요. 관리자에게 문의해주세요." }, { status: 403 });
    }

    // ── 권한 로직: organizationId 파라미터 처리 (관리자가 특정 조직 선택)
    let orgId: string | null = null;
    const selectedOrgIdParam = new URL(request.url).searchParams.get('organizationId');

    if (ctx.role === "OWNER") {
      // 대리점장: 자신의 조직만 조회 (파라미터 무시)
      orgId = ctx.organizationId || null;
    } else if (ctx.role === "GLOBAL_ADMIN") {
      if (selectedOrgIdParam) {
        // 관리자가 특정 조직 선택
        const org = await prisma.organization.findUnique({
          where: { id: selectedOrgIdParam },
          select: { id: true },
        });
        if (!org) {
          return NextResponse.json({ ok: false, message: "유효하지 않은 조직입니다." }, { status: 403 });
        }
        orgId = org.id;
      } else {
        // 관리자가 organizationId 없으면 전체 조직 데이터 조회
        orgId = null;
      }
    } else {
      // 다른 권한 (AGENT, FREE_SALES 등)
      return NextResponse.json({ ok: false, message: "이 기능을 사용할 권한이 없어요." }, { status: 403 });
    }

    // ── 1. 조직 소유 랜딩페이지 목록 + viewCount 합계
    // DB-25: take:500 제거 — 500개 초과 LP 보유 조직의 funnelEntered·trend 과소보고 수정.
    // select를 필수 필드(id·title·slug·viewCount·_count)만으로 제한해 행당 메모리 최소화.
    // orderBy 제거 — 집계 목적이므로 정렬 불필요 (topPages는 메모리 sort로 처리).
    const pages = await prisma.crmLandingPage.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}) },
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
    // [API-MKT-DASHBOARD-FUNNELREG-CROSSORG-001] GLOBAL_ADMIN의 경우 lpIds는 모든 조직의 랜딩페이지 ID를 포함하므로
    // funnelEntered는 전체 조직 합산 집계임.
    // 특정 조직 기준 대시보드가 필요하면 ?orgId= 쿼리 파라미터를 추가하고 orgId 필터를 적용할 것.
    const funnelEnteredResult =
      lpIds.length === 0
        ? 0
        : await prisma.crmLandingRegistration.count({
            where: { landingPageId: { in: lpIds }, funnelStarted: true },
          });

    // month 파라미터 파싱 (YYYY-MM 형식, 기본값: 현재 월)
    const monthParam = new URL(request.url).searchParams.get('month') ?? '';
    const isValidMonth = /^\d{4}-\d{2}$/.test(monthParam);
    let selectedYear: number;
    let selectedMonth0: number; // 0-indexed

    const nowForMonth = new Date();
    if (isValidMonth) {
      const [y, m] = monthParam.split('-').map(Number);
      if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
        selectedYear = y;
        selectedMonth0 = m - 1;
      } else {
        selectedYear = nowForMonth.getUTCFullYear();
        selectedMonth0 = nowForMonth.getUTCMonth();
      }
    } else {
      selectedYear = nowForMonth.getUTCFullYear();
      selectedMonth0 = nowForMonth.getUTCMonth();
    }

    const selectedMonthKey = `${selectedYear}-${String(selectedMonth0 + 1).padStart(2, '0')}`;

    // LIB-TYPES-014: sales/route.ts와 동일한 Date.UTC() 방식으로 통일 (setUTC* 방식 → 명시적 UTC 생성)
    // 서버 타임존에 관계없이 일관된 월 경계 보장
    const thisMonthStart = new Date(Date.UTC(selectedYear, selectedMonth0, 1));
    const thisMonthEnd   = new Date(Date.UTC(selectedYear, selectedMonth0 + 1, 1));
    const lastMonthStart = new Date(Date.UTC(selectedYear, selectedMonth0 - 1, 1));
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

    // ── 6. 선택된 월의 전체 일수 트렌드
    // [DB-DASHBOARD-TRENDMAP-UTC-KST-MISMATCH-001]
    // trendMap key는 KST(UTC+9) 기준이므로 DB 쿼리 범위도 thisMonthStart/thisMonthEnd 사용
    const trendStart = thisMonthStart; // 월 1일
    const trendEnd   = thisMonthEnd;   // 다음 월 1일

    // DB-26: findMany에 take 상한 + orderBy 추가
    // [DB-DASHBOARD-RECENTREGS-NO-ORDERBY-001] orderBy 없으면 임의 순서 → 최신 10000건 보장 안 됨
    const recentRegs =
      lpIds.length === 0
        ? []
        : await prisma.crmLandingRegistration.findMany({
            where: {
              landingPageId: { in: lpIds },
              createdAt: { gte: trendStart, lt: trendEnd },
            },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10000,  // OOM 방지 상한 — 초과 시 최신 10000건만 집계
          });

    // 선택된 월의 일수 계산 (UTC 기준)
    const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth0 + 1, 0)).getUTCDate();

    // UTC+9 기준 날짜별 집계
    const trendMap: Record<string, number> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${selectedYear}-${String(selectedMonth0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      trendMap[key] = 0;
    }

    for (const reg of recentRegs) {
      // UTC+9 변환
      const kst = new Date(reg.createdAt.getTime() + 9 * 60 * 60 * 1000);
      const key = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
      if (key in trendMap) trendMap[key] = (trendMap[key] ?? 0) + 1;
    }

    const trend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    logger.log("[GET /api/marketing/dashboard]", { orgId, totalViews, totalRegistrations });

    return NextResponse.json({
      ok: true,
      selectedMonth: selectedMonthKey,
      viewNote: 'cumulative',
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
