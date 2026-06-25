import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { maskPhone, maskCustomerName } from "@/lib/marketing-utils";

// GET /api/marketing/sales/branch?page=1&limit=20
// BRANCH_MANAGER 전용: 본인 조직 대리점장들의 집계 매출
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    // OWNER(지사장) 역할 확인
    if (ctx.role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, message: '지사장만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // organizationId 필수 확인
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, message: '조직 정보가 없습니다.' },
        { status: 403 }
      );
    }

    // 페이지네이션 파라미터
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // KST 기준 날짜 계산
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowKST = new Date(nowUTC.getTime() + KST_OFFSET);
    const thisMonthStart = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), 1) - KST_OFFSET);
    const thisMonthEnd = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() + 1, 1) - KST_OFFSET);
    const sixMonthsAgo = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() - 5, 1) - KST_OFFSET);
    const now = nowKST;

    // ─── (A) COUNT 쿼리 ──────────────────────────────────────────
    type CountRow = { total: number | bigint };
    const countRows: CountRow[] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS total
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."createdAt" >= ${sixMonthsAgo}
    `;
    const totalCount = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    // ─── (B) 페이지네이션 목록 쿼리 ──────────────────────────────
    type RawPayment = {
      orderId: string;
      amount: number | bigint;
      status: string;
      customerName: string | null;
      customerPhone: string | null;
      landingPageId: string | null;
      paidAt: Date | null;
    };
    const rawPage: RawPayment[] = await prisma.$queryRaw<RawPayment[]>`
      SELECT pp."orderId", pp."amount", pp."status",
             pp."customerName", pp."customerPhone",
             pp."landingPageId", pp."paidAt"
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."createdAt" >= ${sixMonthsAgo}
      ORDER BY pp."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // ─── (C) 월별 집계 ──────────────────────────────────────────
    type RawMonthly = {
      month: Date;
      revenue: number | bigint;
      count: number | bigint;
    };
    const rawMonthly: RawMonthly[] = await prisma.$queryRaw<RawMonthly[]>`
      SELECT DATE_TRUNC('month', pp."createdAt") AS month,
             SUM(pp."amount")::float AS revenue,
             COUNT(*)::int AS count
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."status" = 'paid'
        AND pp."createdAt" >= ${sixMonthsAgo}
      GROUP BY 1
      ORDER BY 1
    `;

    // 6개월 빈 슬롯 보장
    const monthlyMap: Record<string, { revenue: number; count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: 0, count: 0 };
    }
    for (const row of rawMonthly) {
      const d = row.month instanceof Date ? row.month : new Date(row.month);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: Number(row.revenue), count: Number(row.count) };
    }
    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({
      month: m,
      revenue: v.revenue,
      count: v.count,
    }));

    // ─── (D) 이번 달 요약 ──────────────────────────────────────
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const thisMonth = monthlyMap[monthKey] ?? { revenue: 0, count: 0 };

    type SumRow = { total: number | bigint | null };
    const refundRows: SumRow[] = await prisma.$queryRaw<SumRow[]>`
      SELECT SUM(pp."amount")::float AS total
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."status" = 'cancelled'
        AND pp."createdAt" >= ${thisMonthStart}
        AND pp."createdAt" < ${thisMonthEnd}
    `;

    const totalRevenue = thisMonth.revenue;
    const totalRefund = Number(refundRows[0]?.total ?? 0);
    const paidCount = thisMonth.count;
    const summary = {
      totalRevenue,
      totalRefund,
      netRevenue: totalRevenue - totalRefund,
      paidCount,
      month: monthKey,
    };

    // ─── (E) 랜딩페이지별 집계 ──────────────────────────────────
    type RawByLanding = {
      landingPageId: string | null;
      revenue: number | bigint;
      count: number | bigint;
    };
    const rawByLanding: RawByLanding[] = await prisma.$queryRaw<RawByLanding[]>`
      SELECT pp."landingPageId",
             SUM(pp."amount")::float AS revenue,
             COUNT(*)::int AS count
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."status" = 'paid'
        AND pp."createdAt" >= ${sixMonthsAgo}
      GROUP BY pp."landingPageId"
    `;

    // landingPageId → title 조회
    const landingIds = rawByLanding
      .map((r) => r.landingPageId)
      .filter((id): id is string => !!id);
    const landingPages = landingIds.length > 0
      ? await prisma.crmLandingPage.findMany({
          where: { id: { in: landingIds }, organizationId: orgId },
          select: { id: true, title: true },
        })
      : [];
    const landingTitleMap: Record<string, string> = {};
    for (const lp of landingPages) landingTitleMap[lp.id] = lp.title;

    const byLanding = rawByLanding
      .map((r) => ({
        landingPageId: r.landingPageId ?? null,
        landingPageTitle: r.landingPageId
          ? (landingTitleMap[r.landingPageId] ?? "알 수 없는 랜딩페이지")
          : "직접 유입",
        revenue: Number(r.revenue),
        count: Number(r.count),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ─── (F) 대리점장별 집계 ──────────────────────────────────────
    type RawAgentSales = {
      agentId: string | null;
      agentName: string | null;
      revenue: number | bigint;
      count: number | bigint;
    };
    const rawAgentSales: RawAgentSales[] = await prisma.$queryRaw<RawAgentSales[]>`
      SELECT COALESCE(om."userId", af."agentId") AS "agentId",
             om."name" AS "agentName",
             SUM(pp."amount")::float AS revenue,
             COUNT(*)::int AS count
      FROM "CrmPayAppPayment" pp
      INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
      LEFT JOIN "OrganizationMember" om ON om."userId" = af."agentId" AND om."organizationId" = ${orgId}::uuid
      WHERE af."organizationId" = ${orgId}::uuid
        AND pp."status" = 'paid'
        AND pp."createdAt" >= ${thisMonthStart}
        AND pp."createdAt" < ${thisMonthEnd}
      GROUP BY COALESCE(om."userId", af."agentId"), om."name"
      ORDER BY revenue DESC
    `;

    const salesByAgent = rawAgentSales
      .map((r) => {
        const agentId = r.agentId ?? '';
        const agentName = r.agentName ?? '알 수 없는 대리점장';
        const revenue = Number(r.revenue);
        const count = Number(r.count);
        // 조회수 계산: 같은 기간의 전체 조회수 대비
        const conversionRate = (count > 0 ? ((count / totalCount) * 100) : 0).toFixed(1);
        return {
          agentId,
          agentName,
          revenue,
          count,
          conversionRate: `${conversionRate}%`,
        };
      })
      .filter(agent => agent.agentId.length > 0);

    // ─── (G) TOP 3 대리점장 ───────────────────────────────────────
    const topAgents = salesByAgent
      .slice(0, 3)
      .map((agent, index) => ({
        rank: (index + 1) as 1 | 2 | 3,
        agentName: agent.agentName,
        revenue: agent.revenue,
      }));

    // ─── 최근 결제 내역 (마스킹 O) ──────────────────────────────
    const recent = rawPage.map((p) => ({
      orderId: p.orderId,
      amount: Number(p.amount),
      status: p.status,
      buyerName: maskCustomerName(p.customerName),
      buyerTel: p.customerPhone ? maskPhone(p.customerPhone) : '',
      paidAt: p.paidAt
        ? (p.paidAt instanceof Date ? p.paidAt : new Date(p.paidAt)).toISOString()
        : null,
      landingPageId: p.landingPageId ?? null,
      masked: !!p.customerPhone,
    }));

    logger.log("[GET /api/marketing/sales/branch] 조회", {
      orgId,
      page,
      limit,
      totalCount,
      totalPages,
      agentCount: salesByAgent.length,
    });

    return NextResponse.json({
      ok: true,
      summary,
      monthly,
      byLanding,
      salesByAgent,
      topAgents,
      recent,
      pagination: { page, limit, totalCount, totalPages },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error("[GET /api/marketing/sales/branch]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
