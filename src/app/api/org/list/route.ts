import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/org/list
 * DB 전달 대상 조직 목록 조회
 * - GLOBAL_ADMIN: 전체 조직
 * - OWNER: 전체 조직 (대리점장끼리 교환 가능)
 * - AGENT: 접근 불가
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "AGENT") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

    // 자기 조직 제외 (전달 대상이니까)
    const filtered = ctx.role === "OWNER"
      ? orgs.filter((o) => o.id !== ctx.organizationId)
      : orgs;

    return NextResponse.json({ ok: true, orgs: filtered });
  } catch (err) {
    logger.error("[GET /api/org/list]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
