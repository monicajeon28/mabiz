import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/marketing-utils";
import type { OrgBreakdown, AdminPersonalSales } from "@/types/marketing";

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
    // API-SALES-001: OWNER + GLOBAL_ADMIN만 허용. FREE_SALES·AGENT 완전 차단
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }
    // GLOBAL_ADMIN은 organizationId가 null이어도 전체 조회 허용
    if (ctx.role !== 'GLOBAL_ADMIN' && !ctx.organizationId) {
      return NextResponse.json({ ok: false, message: '조직 정보가 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);

    // [API-SALES-GLOBALADMIN-AUDIT-001] GLOBAL_ADMIN cross-org 매출 읽기 감사 로그
    if (ctx.role === 'GLOBAL_ADMIN') {
      logger.info('[GET /api/marketing/sales] GLOBAL_ADMIN cross-org read', {
        actorId: ctx.userId,
      });
    }

    // 페이지네이션 파라미터
    const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)));
    const skip  = (page - 1) * limit;

    const now             = new Date();
    const thisMonthStart  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const thisMonthEnd    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const sixMonthsAgo    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    // ─── (A) COUNT 쿼리: DB 레벨 전체 건수 ──────────────────────
    // DB-SALES-INMEMORY-PAGINATION-001 / API-SALES-007: in-memory slice 제거
    // INNER JOIN 의도: AffiliateSale과 연결된 결제만 집계 (직접 결제/웹훅 미처리 건 제외)
    // 직접 결제 포함이 필요하면 LEFT JOIN으로 변경하고 pp.organizationId 필터를 추가할 것
    // af.orderId IS NULL인 AffiliateSale은 자동으로 제외됨 (SQL NULL 비교 규칙)
    type CountRow = { total: number | bigint };
    const countRows: CountRow[] = orgId
      ? await prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::int AS total
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE af."organizationId" = ${orgId}::uuid
            AND pp."createdAt" >= ${sixMonthsAgo}
        `
      : await prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::int AS total
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE pp."createdAt" >= ${sixMonthsAgo}
        `;
    const totalCount = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    // ─── (B) 목록 쿼리: DB LIMIT/OFFSET ─────────────────────────
    // INNER JOIN 의도: AffiliateSale과 연결된 결제만 집계 (직접 결제/웹훅 미처리 건 제외)
    // 직접 결제 포함이 필요하면 LEFT JOIN으로 변경하고 pp.organizationId 필터를 추가할 것
    // af.orderId IS NULL인 AffiliateSale은 자동으로 제외됨 (SQL NULL 비교 규칙)
    type RawPayment = {
      orderId:       string | null;
      amount:        number | bigint;
      status:        string;
      customerName:  string | null;
      customerPhone: string | null;
      landingPageId: string | null;
      paidAt:        Date | null;
    };
    const rawPage: RawPayment[] = orgId
      ? await prisma.$queryRaw<RawPayment[]>`
          SELECT pp."orderId", pp."amount", pp."status",
                 pp."customerName", pp."customerPhone",
                 pp."landingPageId", pp."paidAt"
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE af."organizationId" = ${orgId}::uuid
            AND pp."createdAt" >= ${sixMonthsAgo}
          ORDER BY pp."createdAt" DESC
          LIMIT ${limit} OFFSET ${skip}
        `
      : await prisma.$queryRaw<RawPayment[]>`
          SELECT pp."orderId", pp."amount", pp."status",
                 pp."customerName", pp."customerPhone",
                 pp."landingPageId", pp."paidAt"
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE pp."createdAt" >= ${sixMonthsAgo}
          ORDER BY pp."createdAt" DESC
          LIMIT ${limit} OFFSET ${skip}
        `;

    // ─── (C) 월별 집계: DB GROUP BY ──────────────────────────────
    // INNER JOIN 의도: AffiliateSale과 연결된 결제만 집계 (직접 결제/웹훅 미처리 건 제외)
    // 직접 결제 포함이 필요하면 LEFT JOIN으로 변경하고 pp.organizationId 필터를 추가할 것
    // af.orderId IS NULL인 AffiliateSale은 자동으로 제외됨 (SQL NULL 비교 규칙)
    type RawMonthly = { month: Date; revenue: number | bigint; count: number | bigint };
    const rawMonthly: RawMonthly[] = orgId
      ? await prisma.$queryRaw<RawMonthly[]>`
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
        `
      : await prisma.$queryRaw<RawMonthly[]>`
          SELECT DATE_TRUNC('month', pp."createdAt") AS month,
                 SUM(pp."amount")::float AS revenue,
                 COUNT(*)::int AS count
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE pp."status" = 'paid'
            AND pp."createdAt" >= ${sixMonthsAgo}
          GROUP BY 1
          ORDER BY 1
        `;

    // 6개월 빈 슬롯 보장 후 DB 결과 병합
    const monthlyMap: Record<string, { revenue: number; count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: 0, count: 0 };
    }
    for (const row of rawMonthly) {
      const d   = row.month instanceof Date ? row.month : new Date(row.month);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: Number(row.revenue), count: Number(row.count) };
    }
    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({
      month:   m,
      revenue: v.revenue,
      count:   v.count,
    }));

    // ─── (D) 이번 달 요약: monthly 결과에서 추출 + 별도 환불 SUM ─
    const monthKey    = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const thisMonth   = monthlyMap[monthKey] ?? { revenue: 0, count: 0 };

    // INNER JOIN 의도: AffiliateSale과 연결된 결제만 집계 (직접 결제/웹훅 미처리 건 제외)
    // 직접 결제 포함이 필요하면 LEFT JOIN으로 변경하고 pp.organizationId 필터를 추가할 것
    // af.orderId IS NULL인 AffiliateSale은 자동으로 제외됨 (SQL NULL 비교 규칙)
    type SumRow = { total: number | bigint | null };
    const refundRows: SumRow[] = orgId
      ? await prisma.$queryRaw<SumRow[]>`
          SELECT SUM(pp."amount")::float AS total
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE af."organizationId" = ${orgId}::uuid
            AND pp."status" = 'cancelled'
            AND pp."createdAt" >= ${thisMonthStart}
            AND pp."createdAt" < ${thisMonthEnd}
        `
      : await prisma.$queryRaw<SumRow[]>`
          SELECT SUM(pp."amount")::float AS total
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE pp."status" = 'cancelled'
            AND pp."createdAt" >= ${thisMonthStart}
            AND pp."createdAt" < ${thisMonthEnd}
        `;

    const totalRevenue = thisMonth.revenue;
    const totalRefund  = Number(refundRows[0]?.total ?? 0);
    const paidCount    = thisMonth.count;
    const summary = {
      totalRevenue,
      totalRefund,
      netRevenue: totalRevenue - totalRefund,
      paidCount,
      month: monthKey,
    };

    // ─── (E) 랜딩페이지별 집계: DB GROUP BY ──────────────────────
    // INNER JOIN 의도: AffiliateSale과 연결된 결제만 집계 (직접 결제/웹훅 미처리 건 제외)
    // 직접 결제 포함이 필요하면 LEFT JOIN으로 변경하고 pp.organizationId 필터를 추가할 것
    // af.orderId IS NULL인 AffiliateSale은 자동으로 제외됨 (SQL NULL 비교 규칙)
    type RawByLanding = {
      landingPageId: string | null;
      revenue:       number | bigint;
      count:         number | bigint;
    };
    const rawByLanding: RawByLanding[] = orgId
      ? await prisma.$queryRaw<RawByLanding[]>`
          SELECT pp."landingPageId",
                 SUM(pp."amount")::float AS revenue,
                 COUNT(*)::int AS count
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE af."organizationId" = ${orgId}::uuid
            AND pp."status" = 'paid'
            AND pp."createdAt" >= ${sixMonthsAgo}
          GROUP BY pp."landingPageId"
        `
      : await prisma.$queryRaw<RawByLanding[]>`
          SELECT pp."landingPageId",
                 SUM(pp."amount")::float AS revenue,
                 COUNT(*)::int AS count
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE pp."status" = 'paid'
            AND pp."createdAt" >= ${sixMonthsAgo}
          GROUP BY pp."landingPageId"
        `;

    // landingPageId → title 조회 (집계된 고유 ID만)
    const landingIds = rawByLanding
      .map((r) => r.landingPageId)
      .filter((id): id is string => !!id);
    const landingPages = landingIds.length > 0
      ? await prisma.crmLandingPage.findMany({
          where: { id: { in: landingIds }, ...(orgId ? { organizationId: orgId } : {}) },
          select: { id: true, title: true },
        })
      : [];
    const landingTitleMap: Record<string, string> = {};
    for (const lp of landingPages) landingTitleMap[lp.id] = lp.title;

    const byLanding = rawByLanding
      .map((r) => ({
        landingPageId:    r.landingPageId ?? null,
        landingPageTitle: r.landingPageId
          ? (landingTitleMap[r.landingPageId] ?? "알 수 없는 랜딩페이지")
          : "직접 유입",
        revenue: Number(r.revenue),
        count:   Number(r.count),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ─── 페이지네이션 최근 결제 내역 ──────────────────────────────
    // API-SALES-ROLE-TYPE-001: masked 플래그를 포함해 UI 소비자가 PII 마스킹 여부를 명확히 인지
    // [API-SALES-MASKING-NULL-001] 빈 문자열 전화번호는 마스킹 없이 빈 문자열로, masked 플래그도 false
    const isGlobalAdmin = ctx.role === 'GLOBAL_ADMIN';
    const recent = rawPage.map((p) => ({
      orderId:       p.orderId,
      amount:        Number(p.amount),
      status:        p.status,
      buyerName:     isGlobalAdmin ? (p.customerName ?? '') : maskCustomerName(p.customerName),
      buyerTel:      isGlobalAdmin
        ? (p.customerPhone ?? '')
        : (p.customerPhone ? maskPhone(p.customerPhone) : ''),
      paidAt:        p.paidAt
                       ? (p.paidAt instanceof Date ? p.paidAt : new Date(p.paidAt)).toISOString()
                       : null,
      landingPageId: p.landingPageId ?? null,
      // 전화번호가 실제 존재할 때만 masked=true (빈 문자열은 마스킹 없음으로 표시)
      masked:        !isGlobalAdmin && !!p.customerPhone,
    }));

    // ─── (F) GLOBAL_ADMIN 전용: 대리점별 매출 breakdown ──────────
    // API-SALES-002: OWNER는 빈 배열, GLOBAL_ADMIN만 조직별 집계 실행
    let orgBreakdown: OrgBreakdown[] = [];
    let adminPersonalSales: AdminPersonalSales | null = null;

    if (ctx.role === 'GLOBAL_ADMIN') {
      // 1. 모든 조직 목록 조회
      const orgs = await prisma.organization.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      // 2. 이번 달 조직별 매출(paid) 집계
      type OrgRevRow = { organizationId: string; revenue: number | bigint; count: number | bigint };
      const orgRevRows: OrgRevRow[] = await prisma.$queryRaw<OrgRevRow[]>`
        SELECT af."organizationId",
               COALESCE(SUM(CASE WHEN pp."status" = 'paid' THEN pp."amount" ELSE 0 END), 0)::float AS revenue,
               COUNT(CASE WHEN pp."status" = 'paid' THEN 1 END)::int AS count
        FROM "CrmPayAppPayment" pp
        INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
        WHERE pp."createdAt" >= ${thisMonthStart}
          AND pp."createdAt" < ${thisMonthEnd}
        GROUP BY af."organizationId"
      `;

      // 3. 이번 달 조직별 환불(cancelled) 집계
      type OrgRefundRow = { organizationId: string; refund: number | bigint };
      const orgRefundRows: OrgRefundRow[] = await prisma.$queryRaw<OrgRefundRow[]>`
        SELECT af."organizationId",
               COALESCE(SUM(pp."amount"), 0)::float AS refund
        FROM "CrmPayAppPayment" pp
        INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
        WHERE pp."status" = 'cancelled'
          AND pp."createdAt" >= ${thisMonthStart}
          AND pp."createdAt" < ${thisMonthEnd}
        GROUP BY af."organizationId"
      `;

      const revMap    = new Map(orgRevRows.map(r => [r.organizationId, { revenue: Number(r.revenue), count: Number(r.count) }]));
      const refundMap = new Map(orgRefundRows.map(r => [r.organizationId, Number(r.refund)]));

      orgBreakdown = orgs
        .map(org => ({
          orgId:        org.id,
          orgName:      org.name ?? '알 수 없는 대리점',
          totalRevenue: revMap.get(org.id)?.revenue ?? 0,
          paidCount:    revMap.get(org.id)?.count   ?? 0,
          netRevenue:   (revMap.get(org.id)?.revenue ?? 0) - (refundMap.get(org.id) ?? 0),
        }))
        .filter(o => o.totalRevenue > 0 || o.paidCount > 0) // 실적 있는 조직만
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // ─── (G) GLOBAL_ADMIN 본인 링크(개인 랜딩페이지) 이번 달 매출 ──
      // API-SALES-003: CrmLandingPage.createdByUserId = ctx.userId 기준으로 별도 집계
      // OrganizationMember.userId(String) 타입이므로 캐스팅 불필요
      type AdminSalesSumRow = { revenue: number | bigint; count: number | bigint };
      type AdminRefundSumRow = { refund: number | bigint };

      const adminSalesRows: AdminSalesSumRow[] = await prisma.$queryRaw<AdminSalesSumRow[]>`
        SELECT COALESCE(SUM(pp."amount"), 0)::float AS revenue,
               COUNT(*)::int AS count
        FROM "CrmPayAppPayment" pp
        INNER JOIN "CrmLandingPage" lp ON lp."id" = pp."landingPageId"
        WHERE lp."createdByUserId" = ${ctx.userId}
          AND pp."status" = 'paid'
          AND pp."createdAt" >= ${thisMonthStart}
          AND pp."createdAt" < ${thisMonthEnd}
      `;

      const adminRefundRows: AdminRefundSumRow[] = await prisma.$queryRaw<AdminRefundSumRow[]>`
        SELECT COALESCE(SUM(pp."amount"), 0)::float AS refund
        FROM "CrmPayAppPayment" pp
        INNER JOIN "CrmLandingPage" lp ON lp."id" = pp."landingPageId"
        WHERE lp."createdByUserId" = ${ctx.userId}
          AND pp."status" = 'cancelled'
          AND pp."createdAt" >= ${thisMonthStart}
          AND pp."createdAt" < ${thisMonthEnd}
      `;

      const adminRev    = Number(adminSalesRows[0]?.revenue ?? 0);
      const adminCount  = Number(adminSalesRows[0]?.count   ?? 0);
      const adminRefund = Number(adminRefundRows[0]?.refund  ?? 0);
      adminPersonalSales = {
        totalRevenue: adminRev,
        paidCount:    adminCount,
        totalRefund:  adminRefund,
        netRevenue:   adminRev - adminRefund,
      };
    }

    logger.log("[GET /api/marketing/sales] 조회", { orgId, page, limit, totalCount, totalPages });

    return NextResponse.json({
      ok: true,
      summary,
      monthly,
      byLanding,
      recent,
      orgBreakdown,
      adminPersonalSales,
      isGlobalAdmin: ctx.role === 'GLOBAL_ADMIN',
      pagination: { page, limit, totalCount, totalPages },
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
