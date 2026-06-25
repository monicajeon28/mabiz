import "server-only";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/affiliate-issuance/branch-managers
 * GLOBAL_ADMIN 전용 — 지사장(BRANCH_MANAGER) 목록 반환
 * 발급 폼의 "소속 지사장" 드롭다운용
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    // BRANCH_MANAGER + ACTIVE 프로필 조회
    const profiles = await prisma.gmAffiliateProfile.findMany({
      where: { type: "BRANCH_MANAGER", status: "ACTIVE" },
      select: { id: true, userId: true, displayName: true },
      orderBy: { createdAt: "asc" },
    });

    // userId 목록으로 GmUser 일괄 조회
    const userIds = profiles.map((p) => p.userId);
    const users = await prisma.gmUser.findMany({
      where: { id: { in: userIds } },
      select: { id: true, mallUserId: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const managers = profiles.map((p) => {
      const u = userMap.get(p.userId);
      return {
        id: p.id,
        displayName: p.displayName,
        mallUserId: u?.mallUserId ?? null,
        name: u?.name ?? null,
      };
    });

    return NextResponse.json({ ok: true, managers });
  } catch (err) {
    logger.error("affiliate-issuance branch-managers GET 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
