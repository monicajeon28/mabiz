import { NextResponse } from "next/server";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

/**
 * GET /api/contacts/stats
 * 고객 타입별 카운트 통계 (전체/문의/구매/골드)
 *
 * Query: visibility=SHARED|TEAM|ADMIN_ONLY
 * Response: { ok: true, stats: { total, inquiry, purchased, gold } }
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 권한별 WHERE 조건 구성 (visibility는 buildContactWhere에서 자동 처리)
    const baseWhere = buildContactWhere(ctx);

    // 4개 타입별 COUNT를 병렬 조회 (Prisma $transaction)
    const [total, inquiry, purchased, gold] = await prisma.$transaction([
      prisma.contact.count({ where: baseWhere }),
      prisma.contact.count({ where: { ...baseWhere, type: "잠재고객" } }),
      prisma.contact.count({ where: { ...baseWhere, type: "구매완료" } }),
      prisma.contact.count({ where: { ...baseWhere, type: "금회원" } }),
    ]);

    logger.info("[Contacts/Stats] 카운트 조회", { total, inquiry, purchased, gold });

    return NextResponse.json({
      ok: true,
      stats: { total, inquiry, purchased, gold },
    });
  } catch (err) {
    logger.error("[Contacts/Stats]", { err });
    return NextResponse.json(
      { ok: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
