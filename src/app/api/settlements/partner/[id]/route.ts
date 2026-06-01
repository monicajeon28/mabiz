import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

interface PartnerSettlement {
  settlementId: number;
  month: string;
  status: string;
  ledgerCount: number;
  totalCommission: string;
  totalWithholding: string;
  netPayout: string;
  approvedAt: string | null;
  expectedPaymentDate: string | null;
}

interface PartnerDetailsResponse {
  ok: boolean;
  data?: {
    partner?: {
      profileId: number;
      name: string;
      tier: string;
      totalPayouts: string;
      avgMonthlyCommission: string;
      paymentRate: string;
    };
    settlements?: PartnerSettlement[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      hasNext: boolean;
    };
  };
  performance?: {
    elapsedMs: number;
  };
  error?: string;
}

/**
 * GET /api/settlements/partner/:id
 * 파트너별 정산 내역 조회 (페이지네이션 지원)
 *
 * Path Parameters:
 * - id: 파트너 profileId (정수)
 *
 * Query Parameters:
 * - page: 1-based (기본값: 1)
 * - limit: 1-100 (기본값: 20)
 * - sortBy: 'date' | 'amount' | 'status' (기본값: date)
 * - status?: 'DRAFT,APPROVED,PAID' (필터)
 * - periodStart?: '2026-01-01' (ISO 8601)
 * - periodEnd?: '2026-05-31' (ISO 8601)
 *
 * Performance Target: <200ms
 * Uses: idx_commission_ledger_partner_settled_date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<PartnerDetailsResponse>> {
  const startTime = Date.now();

  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    if (!ctx?.role?.includes("ADMIN")) {
      return NextResponse.json<PartnerDetailsResponse>(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 403 }
      );
    }

    const partnerId = parseInt(params.id, 10);
    if (isNaN(partnerId)) {
      return NextResponse.json<PartnerDetailsResponse>(
        { ok: false, error: "INVALID_PARTNER_ID" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const sortBy = searchParams.get("sortBy") || "date";
    const statusFilter = searchParams.get("status")?.split(",") || [];
    const periodStart = searchParams.get("periodStart")
      ? new Date(searchParams.get("periodStart")!)
      : null;
    const periodEnd = searchParams.get("periodEnd")
      ? new Date(searchParams.get("periodEnd")!)
      : null;

    const offset = (page - 1) * limit;

    // 1. 파트너 정보 조회 (병렬)
    const partnerQuery = prisma.$queryRaw<
      Array<{
        profileId: number;
        name: string;
        tier: string;
        totalPayouts: string;
        avgMonthlyCommission: string;
        paymentRate: string;
      }>
    >(
      Prisma.sql`
        SELECT
          cl."profileId"::integer,
          COALESCE(p.name, 'Unknown Partner') AS "name",
          COALESCE(p.tier, 'Bronze') AS "tier",
          COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::text AS "totalPayouts",
          COALESCE(
            AVG(cl.amount),
            0
          )::text AS "avgMonthlyCommission",
          COALESCE(
            ROUND(
              100 * COUNT(CASE WHEN ms.status = 'PAID' THEN 1 END)
              / NULLIF(COUNT(DISTINCT ms.id), 0),
              1
            ),
            0
          )::text || '%' AS "paymentRate"
        FROM "CommissionLedger" cl
        LEFT JOIN "Partner" p ON cl."profileId" = p.id
        LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."profileId" = ${partnerId}
          AND cl."isSettled" = true
          AND cl."organizationId" = ${orgId}
        GROUP BY cl."profileId", p.id, p.name, p.tier
      `
    );

    // 2. 정산 내역 조회 (인덱스: idx_commission_ledger_partner_settled_date)
    let settlementQuery = Prisma.sql`
      SELECT
        ms.id AS "settlementId",
        TO_CHAR(ms."periodStart", 'YYYY-MM') AS "month",
        ms.status,
        COUNT(cl.id)::integer AS "ledgerCount",
        COALESCE(SUM(cl.amount), 0)::text AS "totalCommission",
        COALESCE(SUM(cl."withholdingAmount"), 0)::text AS "totalWithholding",
        COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::text AS "netPayout",
        TO_CHAR(ms."approvedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "approvedAt",
        TO_CHAR(
          COALESCE(ms."paymentDate", ms."approvedAt") + INTERVAL '6 days',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        ) AS "expectedPaymentDate"
      FROM "CommissionLedger" cl
      LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
      WHERE cl."profileId" = ${partnerId}
        AND cl."isSettled" = true
        AND cl."organizationId" = ${orgId}
    `;

    // 필터 추가
    const filters: Prisma.Sql[] = [];

    if (statusFilter.length > 0) {
      filters.push(Prisma.sql`AND ms.status = ANY(${statusFilter})`);
    }

    if (periodStart) {
      filters.push(Prisma.sql`AND ms."periodStart" >= ${periodStart}`);
    }

    if (periodEnd) {
      filters.push(Prisma.sql`AND ms."periodEnd" <= ${periodEnd}`);
    }

    if (filters.length > 0) {
      settlementQuery = Prisma.sql`${settlementQuery}
      ${Prisma.join(filters, " ")}
      `;
    }

    // 정렬 추가
    if (sortBy === "amount") {
      settlementQuery = Prisma.sql`${settlementQuery}
      GROUP BY ms.id, ms."periodStart", ms.status, ms."approvedAt", ms."paymentDate"
      ORDER BY COALESCE(SUM(cl.amount), 0) DESC
      `;
    } else if (sortBy === "status") {
      settlementQuery = Prisma.sql`${settlementQuery}
      GROUP BY ms.id, ms."periodStart", ms.status, ms."approvedAt", ms."paymentDate"
      ORDER BY ms.status ASC, ms."periodStart" DESC
      `;
    } else {
      // default: date
      settlementQuery = Prisma.sql`${settlementQuery}
      GROUP BY ms.id, ms."periodStart", ms.status, ms."approvedAt", ms."paymentDate"
      ORDER BY ms."periodStart" DESC
      `;
    }

    // 3. 총 건수 조회 (COUNT)
    const countQuery = prisma.$queryRaw<[{ total: bigint }]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT ms.id)::bigint AS total
        FROM "CommissionLedger" cl
        LEFT JOIN "MonthlySettlement" ms ON cl."settlementId" = ms.id
        WHERE cl."profileId" = ${partnerId}
          AND cl."isSettled" = true
          AND cl."organizationId" = ${orgId}
          ${Prisma.join(filters, " ")}
      `
    );

    // 페이지네이션 적용
    settlementQuery = Prisma.sql`${settlementQuery}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // 병렬 실행
    const [partner, settlements, [countResult]] = await Promise.all([
      partnerQuery,
      prisma.$queryRaw<PartnerSettlement[]>(settlementQuery),
      countQuery,
    ]);

    const elapsed = Date.now() - startTime;
    const total = Number(countResult?.total || 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json<PartnerDetailsResponse>(
      {
        ok: true,
        data: {
          partner: partner[0],
          settlements: settlements,
          pagination: {
            total,
            page,
            pageSize: limit,
            totalPages,
            hasNext: page < totalPages,
          },
        },
        performance: {
          elapsedMs: elapsed,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=600", // 10분 캐싱
        },
      }
    );
  } catch (err) {
    logger.error("[GET /api/settlements/partner/:id]", { err });
    const elapsed = Date.now() - startTime;

    return NextResponse.json<PartnerDetailsResponse>(
      {
        ok: false,
        error: "QUERY_FAILED",
        performance: { elapsedMs: elapsed },
      },
      { status: 500 }
    );
  }
}
