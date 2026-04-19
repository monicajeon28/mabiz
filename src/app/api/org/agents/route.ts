import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/org/agents
 * 자기 조직의 AGENT 목록 (DB 할당 대상)
 * OWNER/GLOBAL_ADMIN만 사용
 */
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    const orgId = ctx.role === "GLOBAL_ADMIN"
      ? null  // GLOBAL_ADMIN은 별도로 쿼리
      : requireOrgId(ctx);

    if (ctx.role === "AGENT" || ctx.role === "FREE_SALES") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const members = await prisma.organizationMember.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        role:     "AGENT",
        isActive: true,
      },
      select: {
        userId: true,
        displayName: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json({ ok: true, agents: members });
  } catch (err) {
    logger.error("[GET /api/org/agents]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
