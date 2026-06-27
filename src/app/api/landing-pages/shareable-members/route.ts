import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/landing-pages/shareable-members
 * 봇/랜딩 지정공유 대상 목록 — 지사(OWNER)·대리점장(AGENT). 관리자(GLOBAL_ADMIN) 전용.
 * (마케터 FREE_SALES는 CRM 비로그인이라 제외)
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const members = await prisma.organizationMember.findMany({
      where: { isActive: true, role: { in: ["OWNER", "AGENT"] } },
      select: { userId: true, displayName: true, role: true, organizationId: true },
      orderBy: { displayName: "asc" },
      take: 500,
    });

    const orgIds = [...new Set(members.map((m) => m.organizationId))];
    const orgs = orgIds.length > 0
      ? await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
      : [];
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

    const list = members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName ?? m.userId,
      role: m.role,
      roleLabel: m.role === "OWNER" ? "지사" : "대리점장",
      orgName: orgMap[m.organizationId] ?? m.organizationId,
    }));

    return NextResponse.json({ ok: true, members: list });
  } catch (err) {
    logger.error("[GET /api/landing-pages/shareable-members]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
