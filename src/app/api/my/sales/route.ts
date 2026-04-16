import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/my/sales
 * 내 판매 현황 조회 (FREE_SALES + AGENT + OWNER)
 *
 * FREE_SALES: affiliateUserId = 자기 자신인 것만
 * AGENT/OWNER: 자기 조직 전체 (또는 자기 affiliateCode)
 * GLOBAL_ADMIN: 전체
 */
export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = 20;

    let where: Record<string, unknown> = {};

    if (ctx.role === "FREE_SALES") {
      // 프리세일즈: 자기 판매만
      where = { affiliateUserId: ctx.userId };
    } else if (ctx.role === "GLOBAL_ADMIN") {
      // 관리자: 전체
      where = {};
    } else {
      // OWNER / AGENT: 자기 조직
      const orgId = requireOrgId(ctx);
      where = { organizationId: orgId };
    }

    const [sales, total] = await Promise.all([
      prisma.affiliateSale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          affiliateCode: true,
          productName: true,
          saleAmount: true,
          commissionRate: true,
          commissionAmount: true,
          status: true,
          travelCompletedAt: true,
          paidAt: true,
          createdAt: true,
          // 고객 전화번호는 마스킹된 채로 저장됨
          customerPhone: true,
        },
      }),
      prisma.affiliateSale.count({ where }),
    ]);

    // 요약 통계
    const summary = await prisma.affiliateSale.groupBy({
      by:    ["status"],
      where,
      _sum:  { commissionAmount: true, saleAmount: true },
      _count: { id: true },
    });

    logger.log("[GET /api/my/sales]", { role: ctx.role, total });

    return NextResponse.json({
      ok: true,
      sales,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary,
    });
  } catch (err) {
    logger.error("[GET /api/my/sales]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
