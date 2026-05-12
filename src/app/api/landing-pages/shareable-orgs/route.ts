import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/landing-pages/shareable-orgs
 * 공유 가능한 조직 목록 (OWNER + GLOBAL_ADMIN)
 * 각 조직의 대리점장(OWNER) 정보 포함
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const myOrgId = ctx.organizationId;

    // 모든 조직 조회
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // OWNER 멤버들 일괄 조회
    const ownerOrgIds = orgs.map((o) => o.id);
    const owners = await prisma.organizationMember.findMany({
      where: {
        organizationId: { in: ownerOrgIds },
        role: "OWNER",
      },
      select: { organizationId: true, userId: true, displayName: true },
    });

    // organizationId → 첫 번째 OWNER 매핑
    const ownerMap: Record<string, { userId: string; displayName: string | null }> = {};
    for (const o of owners) {
      if (!ownerMap[o.organizationId]) {
        ownerMap[o.organizationId] = { userId: o.userId, displayName: o.displayName };
      }
    }

    // 현재 사용자 조직 제외
    const result = orgs
      .filter((o) => o.id !== myOrgId)
      .map((o) => {
        const owner = ownerMap[o.id];
        return {
          orgId: o.id,
          orgName: o.name,
          ownerUserId: owner?.userId ?? null,
          ownerDisplayName: owner?.displayName ?? null,
          label: owner?.displayName ? `${owner.displayName} (${o.name})` : o.name,
        };
      });

    return NextResponse.json({ ok: true, orgs: result });
  } catch (err) {
    logger.error("[GET /api/landing-pages/shareable-orgs]", { err });
    return NextResponse.json({ ok: false, orgs: [] }, { status: 500 });
  }
}
