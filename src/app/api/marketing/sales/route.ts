import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/marketing-utils";

/** 이름 마스킹: 첫 글자만 유지, 나머지 최대 3자리 * 처리 */
function maskCustomerName(name: string | null | undefined): string {
  if (!name) return '-';
  if (name.length <= 1) return name;
  return name[0] + '*'.repeat(Math.min(name.length - 1, 3));
}

// GET /api/marketing/sales?page=1&limit=20
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    // API-SALES-AGENT-ORG-MISSING-CHECK-001: today-stats와 동일한 명시적 가드 패턴으로 통일
    // GLOBAL_ADMIN은 organizationId가 null이어도 전체 조회 허용
    if (ctx.role !== 'GLOBAL_ADMIN' && !ctx.organizationId) {
      return NextResponse.json({ ok: false, message: '조직 정보가 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);

    // 페이지네이션 파라미터
    const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)));
    const skip  = (page - 1) * limit;

    const now   = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const thisMonthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const sixMonthsAgo   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    // DB-27/API-SALES-006: AffiliateSale ↔ PayAppPayment DB 레벨 INNER JOIN 단일 쿼리.
    // 기존 두 단계(AffiliateSale 5000건 IN-메모리 → PayAppPayment IN 쿼리) 방식 제거.
    // PostgreSQL이 INNER JOIN + index scan으로 처리하므로 왕복 1회로 줄고 IN절 크기 문제 해소.

    // 집계용 타입 정의 (Prisma $queryRaw는 snake_case 컬럼명 반환)
    type RawPayment = {
      id:              string;
      order_id:        string | null;
      organization_id: string | null;
      amount:          number | bigint;
      status:          string;
      customer_name:   string | null;
      customer_phone:  string | null;
      landing_page_id: string | null;
      created_at:      Date;
      paid_at:         Date | null;
    };

    // GLOBAL_ADMIN(orgId=null)이면 org 필터 없이 전체 조회
    const rawPayments: RawPayment[] = orgId
      ? await prisma.$queryRaw<RawPayment[]>`
          SELECT pp.id, pp.order_id, pp.organization_id, pp.amount, pp.status,
                 pp.customer_name, pp.customer_phone, pp.landing_page_id,
                 pp.created_at, pp.paid_at
          FROM payapp_payments pp
          INNER JOIN affiliate_sales af ON af.order_id = pp.order_id
          WHERE af.organization_id = ${orgId}
            AND pp.created_at >= ${sixMonthsAgo}
          ORDER BY pp.created_at DESC
        `
      : await prisma.$queryRaw<RawPayment[]>`
          SELECT pp.id, pp.order_id, pp.organization_id, pp.amount, pp.status,
                 pp.customer_name, pp.customer_phone, pp.landing_page_id,
                 pp.created_at, pp.paid_at
          FROM payapp_payments pp
          INNER JOIN affiliate_sales af ON af.order_id = pp.order_id
          WHERE pp.created_at >= ${sixMonthsAgo}
          ORDER BY pp.created_at DESC
        `;

    // snake_case → camelCase 정규화 + BigInt 방어 (PostgreSQL numeric → JS number)
    const normalizedPayments = rawPayments.map((p) => ({
      id:             p.id,
      orderId:        p.order_id,
      organizationId: p.organization_id,
      amount:         Number(p.amount),
      status:         p.status,
      customerName:   p.customer_name,
      customerPhone:  p.customer_phone,
      landingPageId:  p.landing_page_id,
      createdAt:      p.created_at instanceof Date ? p.created_at : new Date(p.created_at),
      paidAt:         p.paid_at
                        ? (p.paid_at instanceof Date ? p.paid_at : new Date(p.paid_at))
                        : null,
    }));

    // 메모리 페이지네이션 (JOIN 결과는 이미 전체이므로 DB 재조회 불필요)
    const totalCount    = normalizedPayments.length;
    const recentPayments = normalizedPayments.slice(skip, skip + limit);

    // 집계 루프에서 사용할 payments 별칭 (기존 변수명 유지)
    const payments = normalizedPayments;
    const truncated = false; // JOIN 방식으로 5000건 상한 제거
    const paymentsTruncated = false; // 10000건 상한 제거

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
          where: { id: { in: landingIds }, ...(orgId ? { organizationId: orgId } : {}) },
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

    // ─── 페이지네이션 최근 결제 내역 ──────────────────────────
    const totalPages = Math.ceil(totalCount / limit);
    // API-SALES-ROLE-TYPE-001: masked 플래그를 포함해 UI 소비자가 PII 마스킹 여부를 명확히 인지
    const isGlobalAdmin = ctx.role === 'GLOBAL_ADMIN';
    const recent = recentPayments.map((p) => ({
      orderId:       p.orderId,
      amount:        p.amount,
      status:        p.status,
      buyerName:     isGlobalAdmin ? (p.customerName ?? '') : maskCustomerName(p.customerName),
      buyerTel:      isGlobalAdmin ? (p.customerPhone ?? '') : maskPhone(p.customerPhone ?? ''),
      paidAt:        p.paidAt?.toISOString() ?? null,
      landingPageId: p.landingPageId ?? null,
      masked:        !isGlobalAdmin,
    }));

    logger.log("[GET /api/marketing/sales] 조회", { orgId, page, limit, totalCount, orderCount: payments.length, truncated, paymentsTruncated });

    return NextResponse.json({
      ok: true,
      summary,
      monthly,
      byLanding,
      recent,
      pagination: { page, limit, totalCount, totalPages },
      ...((truncated || paymentsTruncated) ? { warning: '데이터가 많아 일부 통계가 불완전할 수 있습니다.' } : {}),
    });
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
