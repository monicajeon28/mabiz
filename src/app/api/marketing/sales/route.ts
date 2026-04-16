import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/marketing/sales
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const now   = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const thisMonthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const sixMonthsAgo   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    // 이 조직의 AffiliateSale(orderId 있는 것)을 기준으로 PayAppPayment를 조인
    const sales = await prisma.affiliateSale.findMany({
      where: {
        organizationId: orgId,
        orderId:        { not: null },
      },
      select: { orderId: true },
    });

    const orderIds = sales
      .map((s) => s.orderId)
      .filter((id): id is string => id !== null);

    // 전체 결제 내역 (최근 6개월 + 이번 달 집계용)
    const payments = await prisma.payAppPayment.findMany({
      where: {
        orderId: { in: orderIds },
        createdAt: { gte: sixMonthsAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    // ─── 이번 달 요약 ────────────────────────────────────────
    const thisMonthPayments = payments.filter((p) => {
      const d = p.createdAt;
      return d >= thisMonthStart && d < thisMonthEnd;
    });

    const totalRevenue = thisMonthPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    const totalRefund = thisMonthPayments
      .filter((p) => p.status === "cancelled")
      .reduce((sum, p) => sum + p.amount, 0);

    const paidCount = thisMonthPayments.filter((p) => p.status === "paid").length;

    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const summary = {
      totalRevenue,
      totalRefund,
      netRevenue: totalRevenue - totalRefund,
      paidCount,
      month,
    };

    // ─── 최근 6개월 월별 집계 ────────────────────────────────
    const monthlyMap: Record<string, { revenue: number; count: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const d   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: 0, count: 0 };
    }

    for (const p of payments) {
      if (p.status !== "paid") continue;
      const d   = p.createdAt;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (monthlyMap[key]) {
        monthlyMap[key].revenue += p.amount;
        monthlyMap[key].count   += 1;
      }
    }

    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({
      month: m,
      revenue: v.revenue,
      count:   v.count,
    }));

    // ─── 랜딩페이지별 매출 기여 ──────────────────────────────
    // landingPageId → CrmLandingPage.title 조회
    const landingIds = [
      ...new Set(
        payments
          .filter((p) => p.status === "paid" && p.landingPageId)
          .map((p) => p.landingPageId as string)
      ),
    ];

    const landingPages = landingIds.length > 0
      ? await prisma.crmLandingPage.findMany({
          where: { id: { in: landingIds }, organizationId: orgId },
          select: { id: true, title: true },
        })
      : [];

    const landingTitleMap: Record<string, string> = {};
    for (const lp of landingPages) landingTitleMap[lp.id] = lp.title;

    const byLandingMap: Record<string, { revenue: number; count: number; title: string }> = {};

    for (const p of payments) {
      if (p.status !== "paid") continue;
      const key   = p.landingPageId ?? "__none__";
      const title = p.landingPageId
        ? (landingTitleMap[p.landingPageId] ?? "알 수 없는 랜딩페이지")
        : "직접 유입";
      if (!byLandingMap[key]) {
        byLandingMap[key] = { revenue: 0, count: 0, title };
      }
      byLandingMap[key].revenue += p.amount;
      byLandingMap[key].count   += 1;
    }

    const byLanding = Object.entries(byLandingMap)
      .map(([id, v]) => ({
        landingPageId:    id === "__none__" ? null : id,
        landingPageTitle: v.title,
        revenue:          v.revenue,
        count:            v.count,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ─── 최근 20건 ───────────────────────────────────────────
    const recent = payments.slice(0, 20).map((p) => ({
      orderId:       p.orderId,
      amount:        p.amount,
      status:        p.status,
      buyerName:     p.customerName,
      buyerTel:      p.customerPhone.substring(0, 4) + "****",
      paidAt:        p.paidAt?.toISOString() ?? null,
      landingPageId: p.landingPageId ?? null,
    }));

    logger.log("[GET /api/marketing/sales] 조회", { orgId, orderCount: payments.length });

    return NextResponse.json({ ok: true, summary, monthly, byLanding, recent });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (err instanceof Error && err.message === "ORGANIZATION_REQUIRED") {
      return NextResponse.json({ ok: false, message: "조직 정보가 없습니다." }, { status: 403 });
    }
    logger.error("[GET /api/marketing/sales]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
