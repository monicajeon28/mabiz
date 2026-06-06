import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, canManageSettings, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/landing-pages/shareable-orgs
 * 공유 가능한 조직 목록 (OWNER + GLOBAL_ADMIN)
 * - GLOBAL_ADMIN: 본사 제외 + 대리점 전체
 * - OWNER(대리점장): 자기 org 제외 + 본사("본사") + 다른 대리점
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const isGlobalAdmin = ctx.role === "GLOBAL_ADMIN";
    const myOrgId = isGlobalAdmin ? BONSA_ORG_ID : ctx.organizationId;

    // 모든 조직 조회
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // 대리점장 멤버 조회 (DB role: BRANCH_MANAGER 또는 OWNER)
    // auth.ts에서 둘 다 CRM session role 'OWNER'로 매핑됨
    const allOrgIds = orgs.map((o) => o.id);
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: { in: allOrgIds },
        role: { in: ["OWNER", "BRANCH_MANAGER"] },
      },
      select: { organizationId: true, userId: true, displayName: true, role: true },
    });

    // GlobalAdmin 테이블에서 본사 관리자 이름 수집 (모니카, 저스틴 등)
    const globalAdmins = await prisma.globalAdmin.findMany({
      select: { displayName: true, phone: true },
      orderBy: { createdAt: "asc" },
    });
    const bonsaAdmins = globalAdmins
      .map((a) => a.displayName ?? a.phone)
      .filter((v): v is string => Boolean(v))
      .slice(0, 3);

    // organizationId → 모든 대리점장 매핑
    const ownerMap: Record<string, { userIds: string[]; displayNames: string[] }> = {};
    for (const m of members) {
      if (!ownerMap[m.organizationId]) {
        ownerMap[m.organizationId] = { userIds: [], displayNames: [] };
      }
      const name = m.displayName?.trim() || "대리점장";
      if (!ownerMap[m.organizationId].displayNames.includes(name)) {
        ownerMap[m.organizationId].userIds.push(m.userId);
        ownerMap[m.organizationId].displayNames.push(name);
      }
    }

    const result = orgs
      .filter((o) => {
        // 자기 org 항상 제외
        if (o.id === myOrgId) return false;
        // GLOBAL_ADMIN은 본사 org도 제외 (자신에게 공유 불필요)
        if (isGlobalAdmin && o.id === BONSA_ORG_ID) return false;
        return true;
      })
      .map((o) => {
        const isBonsa = o.id === BONSA_ORG_ID;

        if (isBonsa) {
          // 본사 org는 "본사 (모니카, 저스틴)" 형식으로 표시
          const adminNames = bonsaAdmins.join(", ");
          return {
            orgId: o.id,
            orgName: "본사",
            ownerUserIds: [],
            ownerDisplayNames: bonsaAdmins,
            label: adminNames ? `본사 (${adminNames})` : "본사",
            isBonsa: true,
          };
        }

        const owner = ownerMap[o.id];
        const displayNamesStr = owner?.displayNames.length
          ? owner.displayNames.join(", ")
          : null;
        return {
          orgId: o.id,
          orgName: o.name,
          ownerUserIds: owner?.userIds ?? [],
          ownerDisplayNames: owner?.displayNames ?? [],
          label: displayNamesStr ? `${displayNamesStr} (${o.name})` : o.name,
          isBonsa: false,
        };
      });

    // 본사를 맨 위로, 나머지는 이름순
    result.sort((a, b) => {
      if (a.isBonsa) return -1;
      if (b.isBonsa) return 1;
      return a.label.localeCompare(b.label, "ko");
    });

    return NextResponse.json({ ok: true, orgs: result });
  } catch (err) {
    logger.error("[GET /api/landing-pages/shareable-orgs]", { err });
    return NextResponse.json(
      { ok: false, message: "조직 목록 조회 실패", orgs: [] },
      { status: 500 }
    );
  }
}
