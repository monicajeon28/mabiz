import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/marketing/branch-managers
 * 지사장 목록 조회
 * - GLOBAL_ADMIN만 접근 가능
 * - 모든 조직의 OWNER 역할(지사장) 반환
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    // GLOBAL_ADMIN 역할만 접근 가능
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "전역 관리자만 접근 가능합니다." },
        { status: 403 }
      );
    }

    // 페이지네이션 파라미터 (선택사항)
    const page = Math.max(
      1,
      parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10)
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10))
    );
    const skip = (page - 1) * limit;

    // 검색 파라미터 (선택사항)
    const searchQuery = req.nextUrl.searchParams.get("search")?.trim() ?? "";

    // ─── (A) 기본 필터 조건 ──────────────────────────────────────

    // ─── (B) COUNT 쿼리 ──────────────────────────────────────────
    let totalCount = 0;
    if (!searchQuery) {
      totalCount = await prisma.organizationMember.count({
        where: { role: "OWNER" },
      });
    } else {
      // 검색 쿼리가 있으면 목록 조회 후 필터링
      const allManagers = await prisma.organizationMember.findMany({
        where: { role: "OWNER" },
        include: { organization: { select: { name: true } } },
      });
      totalCount = allManagers.filter((m) => {
        const nameMatch = m.displayName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());
        const orgMatch = m.organization?.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        return nameMatch || orgMatch;
      }).length;
    }

    const totalPages = Math.ceil(totalCount / limit);

    // ─── (C) 페이지네이션 목록 쿼리 ──────────────────────────────
    const rawList = await prisma.organizationMember.findMany({
      where: { role: "OWNER" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: "desc" },
      skip,
      take: limit,
    });

    // 검색 쿼리로 필터링
    let filteredList = rawList;
    if (searchQuery) {
      filteredList = rawList.filter((m) => {
        const nameMatch = m.displayName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());
        const orgMatch = m.organization?.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        return nameMatch || orgMatch;
      });
    }

    // ─── (D) 각 지사장의 대리점장 수 및 판매액 조회 ──────────────────
    interface BranchManagerWithStats {
      id: string;
      userId: string;
      displayName: string | null;
      organizationId: string;
      organizationName: string;
      agentCount: number;
      totalRevenue: number;
    }

    // KST 기준 날짜 계산
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowKST = new Date(nowUTC.getTime() + KST_OFFSET);
    const thisMonthStart = new Date(
      Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), 1) - KST_OFFSET
    );
    const thisMonthEnd = new Date(
      Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() + 1, 1) -
        KST_OFFSET
    );

    const branchManagers: BranchManagerWithStats[] = await Promise.all(
      filteredList.map(async (bm) => {
        // 대리점장 수 (이 지사장 조직의 AGENT 역할 카운트)
        const agentCount = await prisma.organizationMember.count({
          where: {
            organizationId: bm.organizationId,
            role: "AGENT",
          },
        });

        // 판매액 (이 지사장 조직의 이번 달 총 결제액)
        // Prisma raw query 대신 직접 조회 (더 안전함)
        const payments = await prisma.$queryRaw<
          Array<{ total: number | null }>
        >`
          SELECT COALESCE(SUM(pp."amount"), 0)::float AS total
          FROM "CrmPayAppPayment" pp
          INNER JOIN "CrmAffiliateSale" af ON af."orderId" = pp."orderId"
          WHERE af."organizationId" = ${bm.organizationId}::uuid
            AND pp."status" = 'paid'
            AND pp."createdAt" >= ${thisMonthStart}
            AND pp."createdAt" < ${thisMonthEnd}
        `;

        const totalRevenue = Number(payments[0]?.total ?? 0);

        return {
          id: bm.id,
          userId: bm.userId,
          displayName: bm.displayName,
          organizationId: bm.organizationId,
          organizationName: bm.organization?.name ?? "알 수 없음",
          agentCount,
          totalRevenue,
        };
      })
    );

    logger.log("[GET /api/marketing/branch-managers] 조회", {
      page,
      limit,
      totalCount,
      totalPages,
      searchQuery: searchQuery ? "yes" : "no",
    });

    return NextResponse.json({
      ok: true,
      branchManagers: branchManagers.map((bm) => ({
        id: bm.id,
        userId: bm.userId,
        name: bm.displayName ?? "알 수 없음",
        organizationId: bm.organizationId,
        organizationName: bm.organizationName,
        agentCount: bm.agentCount,
        totalRevenue: bm.totalRevenue,
      })),
      pagination: { page, limit, totalCount, totalPages },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error("[GET /api/marketing/branch-managers]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
