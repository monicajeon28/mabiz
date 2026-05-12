import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type RawSale = {
  id: number;
  affiliateCode: string | null;
  productCode: string | null;
  cabinType: string | null;
  headcount: number | null;
  saleAmount: number;
  salesCommission: number | null;
  commissionRate: number | null;
  status: string;
  yearMonth: string | null;
  saleDate: Date | null;
  confirmedAt: Date | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
};

type RawSummary = {
  status: string;
  totalSaleAmount: bigint;
  totalCommission: bigint;
  count: bigint;
};

function parsePage(raw: string | null): number {
  return Math.max(1, parseInt(raw ?? "1") || 1);
}

/**
 * GET /api/my/sales
 * 내 판매 현황 조회
 *
 * mallUser 세션: GMcruise AffiliateSale 직접 조회 (파라미터화된 쿼리)
 * 일반 세션: CRM AffiliateSale 조회
 */
export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const page   = parsePage(searchParams.get("page"));
    const limit  = 20;
    const offset = (page - 1) * limit;

    // ── GMcruise mallUser 세션 ─────────────────────────────────
    if (ctx.mallUser) {
      const { affiliateProfileId } = ctx.mallUser;

      if (!affiliateProfileId) {
        return NextResponse.json({ ok: true, sales: [], total: 0, page, totalPages: 0, summary: [] });
      }

      // 역할별 WHERE 조건 (파라미터화)
      let roleCondition: Prisma.Sql;
      if (ctx.role === "AGENT" || ctx.role === "FREE_SALES") {
        roleCondition = Prisma.sql`AND als."agentId" = ${affiliateProfileId}`;
      } else if (ctx.role === "OWNER") {
        roleCondition = Prisma.sql`AND (als."agentId" = ${affiliateProfileId} OR als."managerId" = ${affiliateProfileId})`;
      } else {
        // GLOBAL_ADMIN: 전체 조회
        roleCondition = Prisma.empty;
      }

      const salesRows = await prisma.$queryRaw<RawSale[]>`
        SELECT
          als.id,
          u."affiliateCode",
          als."productCode",
          als."cabinType",
          als.headcount,
          als."saleAmount",
          als."salesCommission",
          als."commissionRate",
          als.status,
          als."yearMonth",
          als."saleDate",
          als."confirmedAt",
          als."paidAt",
          als."refundedAt",
          als."createdAt",
          lead."customerName",
          lead."customerPhone"
        FROM "AffiliateSale" als
        LEFT JOIN "AffiliateProfile" ap ON ap.id = als."agentId"
        LEFT JOIN "User" u ON u.id = ap."userId"
        LEFT JOIN "AffiliateLead" lead ON lead.id = als."leadId"
        WHERE 1=1 ${roleCondition}
        ORDER BY als."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countRows = await prisma.$queryRaw<[{ total: bigint }]>`
        SELECT COUNT(*) AS total
        FROM "AffiliateSale" als
        WHERE 1=1 ${roleCondition}
      `;
      const total = Number(countRows[0]?.total ?? 0);

      const summaryRows = await prisma.$queryRaw<RawSummary[]>`
        SELECT
          als.status,
          SUM(als."saleAmount")::bigint AS "totalSaleAmount",
          COALESCE(SUM(als."salesCommission"), 0)::bigint AS "totalCommission",
          COUNT(*)::bigint AS count
        FROM "AffiliateSale" als
        WHERE 1=1 ${roleCondition}
        GROUP BY als.status
      `;

      const sales = salesRows.map((s) => ({
        id: String(s.id),
        affiliateCode: s.affiliateCode ?? "",
        productName: s.productCode ?? "",
        saleAmount: Number(s.saleAmount),
        commissionRate: s.commissionRate != null ? Number(s.commissionRate) : null,
        commissionAmount: s.salesCommission != null ? Number(s.salesCommission) : null,
        status: s.status,
        travelCompletedAt: s.confirmedAt?.toISOString() ?? null,
        paidAt: s.paidAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        customerPhone: s.customerPhone ? `${s.customerPhone.slice(0, 3)}-****-****` : null,
        yearMonth: s.yearMonth ?? null,
        cabinType: s.cabinType ?? null,
        headcount: s.headcount ?? null,
        refundedAt: s.refundedAt?.toISOString() ?? null,
      }));

      const summary = summaryRows.map((s) => ({
        status: s.status,
        _sum:   { saleAmount: Number(s.totalSaleAmount), commissionAmount: Number(s.totalCommission) },
        _count: { id: Number(s.count) },
      }));

      logger.log("[GET /api/my/sales] mallUser", { affiliateProfileId, total });
      return NextResponse.json({ ok: true, sales, total, page, totalPages: Math.ceil(total / limit), summary });
    }

    // ── 기존 CRM 세션 ─────────────────────────────────────────
    let where: Record<string, unknown> = {};
    if (ctx.role === "FREE_SALES") {
      where = { affiliateUserId: ctx.userId };
    } else if (ctx.role === "GLOBAL_ADMIN") {
      where = {};
    } else {
      where = { organizationId: requireOrgId(ctx) };
    }

    const [sales, total] = await Promise.all([
      prisma.affiliateSale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true, affiliateCode: true, productName: true,
          saleAmount: true, commissionRate: true, commissionAmount: true,
          status: true, travelCompletedAt: true, paidAt: true,
          createdAt: true, customerPhone: true,
        },
      }),
      prisma.affiliateSale.count({ where }),
    ]);

    const summary = await prisma.affiliateSale.groupBy({
      by: ["status"], where,
      _sum:   { commissionAmount: true, saleAmount: true },
      _count: { id: true },
    });

    logger.log("[GET /api/my/sales]", { role: ctx.role, total });
    return NextResponse.json({ ok: true, sales, total, page, totalPages: Math.ceil(total / limit), summary });

  } catch (err) {
    logger.error("[GET /api/my/sales]", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
