import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type RawAffiliate = {
  profileId: number;
  userId: number;
  type: string;
  status: string;
  isActive: boolean;
  autoSuspended: boolean;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string | null;
  mallUserId: string | null;
  phone: string | null;
  name: string | null;
  contactPhone: string | null;
  contractStatus: string | null;
  onboardedAt: Date | null;
  lastSalesDate: Date | null;
  createdAt: Date;
  confirmedSales: bigint;
  totalSaleAmount: bigint;
  refundAmount: bigint;
};

const ALLOWED_TYPES   = new Set(["BRANCH_MANAGER", "SALES_AGENT", "HQ"]);
const ALLOWED_STATUSES = new Set(["ACTIVE", "SUSPENDED", "DRAFT", "AWAITING_APPROVAL", "TERMINATED"]);

/**
 * GET /api/affiliates
 * 판매원/대리점장 목록 조회 (GMcruise AffiliateProfile 직접 조회)
 *
 * GLOBAL_ADMIN: 전체
 * OWNER: AffiliateRelation으로 소속 판매원만
 * AGENT / FREE_SALES: 403
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (!ctx) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }

    if (ctx.role === "AGENT" || ctx.role === "FREE_SALES") {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit  = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10) || 20);
    const offset = (page - 1) * limit;

    // 화이트리스트 검증된 필터
    const rawType   = searchParams.get("type");
    const rawStatus = searchParams.get("status");
    const q         = searchParams.get("q")?.trim() ?? "";

    const type   = rawType   && ALLOWED_TYPES.has(rawType)     ? rawType   : null;
    const status = rawStatus && ALLOWED_STATUSES.has(rawStatus) ? rawStatus : null;

    // 파라미터화된 조건 빌딩
    const typeCondition:   Prisma.Sql = type   ? Prisma.sql`AND ap.type = ${type}`     : Prisma.empty;
    const statusCondition: Prisma.Sql = status ? Prisma.sql`AND ap.status = ${status}` : Prisma.empty;
    const searchCondition: Prisma.Sql = q
      ? Prisma.sql`AND (u.name ILIKE ${'%' + q + '%'} OR u."mallUserId" ILIKE ${'%' + q + '%'} OR ap."displayName" ILIKE ${'%' + q + '%'})`
      : Prisma.empty;

    // OWNER: affiliateProfileId 필수 확인 후 소속 판매원만
    let relationCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === "OWNER") {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        return NextResponse.json({ ok: false, error: "파트너 프로필이 없습니다." }, { status: 403 });
      }
      relationCondition = Prisma.sql`
        AND ap.id IN (
          SELECT ar."agentId" FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId}
            AND ar.status = 'ACTIVE'
        )
      `;
    }

    const rows = await prisma.$queryRaw<RawAffiliate[]>`
      SELECT
        ap.id                    AS "profileId",
        ap."userId",
        ap.type,
        ap.status,
        ap."isActive",
        ap."autoSuspended",
        ap."suspendedAt",
        ap."suspensionReason",
        ap."displayName",
        ap."branchLabel",
        ap."affiliateCode",
        ap."contactPhone",
        ap."contractStatus",
        ap."onboardedAt",
        ap."lastSalesDate",
        ap."createdAt",
        u."mallUserId",
        u.phone,
        u.name,
        COUNT(DISTINCT als.id) FILTER (WHERE als.status IN ('APPROVED','CONFIRMED'))::bigint AS "confirmedSales",
        COALESCE(SUM(CASE WHEN als.status IN ('APPROVED','CONFIRMED') THEN als."saleAmount" ELSE 0 END), 0)::bigint AS "totalSaleAmount",
        COALESCE(SUM(CASE WHEN als.status = 'REFUNDED' THEN als."saleAmount" ELSE 0 END), 0)::bigint AS "refundAmount"
      FROM "AffiliateProfile" ap
      JOIN "User" u ON u.id = ap."userId"
      LEFT JOIN "AffiliateSale" als ON als."agentId" = ap.id
      WHERE 1=1
        ${typeCondition}
        ${statusCondition}
        ${searchCondition}
        ${relationCondition}
      GROUP BY
        ap.id, ap."userId", ap.type, ap.status, ap."isActive", ap."autoSuspended",
        ap."suspendedAt", ap."suspensionReason", ap."displayName",
        ap."branchLabel", ap."affiliateCode", ap."contractStatus",
        ap."onboardedAt", ap."lastSalesDate", ap."createdAt", ap."contactPhone",
        u."mallUserId", u.phone, u.name
      ORDER BY ap."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countRows = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(DISTINCT ap.id)::bigint AS total
      FROM "AffiliateProfile" ap
      JOIN "User" u ON u.id = ap."userId"
      WHERE 1=1
        ${typeCondition}
        ${statusCondition}
        ${searchCondition}
        ${relationCondition}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const affiliates = rows.map((r) => {
      const totalSale   = Number(r.totalSaleAmount);
      const refundAmt   = Number(r.refundAmount);
      const refundBase  = totalSale + refundAmt;
      return {
        profileId:       r.profileId,
        userId:          r.userId,
        type:            r.type,
        status:          r.status,
        isActive:        r.isActive,
        autoSuspended:   r.autoSuspended,
        suspendedAt:     r.suspendedAt?.toISOString() ?? null,
        suspensionReason: r.suspensionReason,
        displayName:     r.displayName ?? r.name ?? "",
        branchLabel:     r.branchLabel,
        affiliateCode:   r.affiliateCode,
        mallUserId:      r.mallUserId,
        phone:           r.phone,
        contactPhone:    r.contactPhone,
        contractStatus:  r.contractStatus,
        onboardedAt:     r.onboardedAt?.toISOString() ?? null,
        lastSalesDate:   r.lastSalesDate?.toISOString() ?? null,
        createdAt:       r.createdAt.toISOString(),
        confirmedSales:  Number(r.confirmedSales),
        totalSaleAmount: totalSale,
        refundAmount:    refundAmt,
        refundRate:      refundBase > 0
          ? Math.round((refundAmt / refundBase) * 1000) / 10
          : 0,
      };
    });

    logger.log("[GET /api/affiliates]", { role: ctx.role, total });
    return NextResponse.json({ ok: true, affiliates, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error("[GET /api/affiliates]", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
