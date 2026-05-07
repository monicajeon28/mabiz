import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/org/agents
 * DB 전달 대상 목록 (역할별 섹션 구분)
 * 각 멤버: { id, displayName, loginId(phone), orgName }
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const memberSelect = {
      id: true, displayName: true, role: true, phone: true,
      organization: { select: { name: true } },
    } as const;

    const toMember = (m: { id: string; displayName: string | null; role: string; phone: string | null; organization: { name: string } }) => ({
      id:          m.id,
      displayName: m.displayName,
      loginId:     m.phone ?? m.id,   // boss1, sales1 등
      orgName:     m.organization.name,
    });

    const toAdmin = (g: { id: string; displayName: string | null; phone: string | null }) => ({
      id:          g.id,
      displayName: g.displayName,
      loginId:     g.phone ?? g.id,   // admin1, admin2 등
      orgName:     "본사",
    });

    // ── GLOBAL_ADMIN ────────────────────────────────────────────
    if (ctx.role === "GLOBAL_ADMIN") {
      const [members, globalAdmins] = await Promise.all([
        prisma.organizationMember.findMany({
          where: { isActive: true },
          select: memberSelect,
          orderBy: [{ role: "asc" }, { displayName: "asc" }],
        }),
        prisma.globalAdmin.findMany({
          select: { id: true, displayName: true, phone: true },
          orderBy: { displayName: "asc" },
        }),
      ]);

      return NextResponse.json({
        ok: true, myRole: "GLOBAL_ADMIN",
        sections: [
          { label: "대리점장", members: members.filter(m => m.role === "OWNER" || m.role === "BRANCH_MANAGER").map(toMember) },
          { label: "판매원",   members: members.filter(m => m.role === "AGENT" || m.role === "SALES_AGENT").map(toMember) },
          { label: "본사",     members: globalAdmins.map(toAdmin) },
        ],
      });
    }

    const orgId = ctx.organizationId!;

    // ── BRANCH_MANAGER(OWNER) ────────────────────────────────────
    if (ctx.role === "OWNER") {
      const [allBMs, myAgents, globalAdmins] = await Promise.all([
        prisma.organizationMember.findMany({
          where: { role: { in: ["OWNER", "BRANCH_MANAGER"] }, isActive: true },
          select: memberSelect, orderBy: { displayName: "asc" },
        }),
        prisma.organizationMember.findMany({
          where: { organizationId: orgId, role: { in: ["AGENT", "SALES_AGENT"] }, isActive: true },
          select: memberSelect, orderBy: { displayName: "asc" },
        }),
        prisma.globalAdmin.findMany({
          select: { id: true, displayName: true, phone: true },
          orderBy: { displayName: "asc" },
        }),
      ]);

      return NextResponse.json({
        ok: true, myRole: "OWNER",
        sections: [
          { label: "대리점장", members: allBMs.map(toMember) },
          { label: "판매원",   members: myAgents.map(toMember) },
          { label: "본사",     members: globalAdmins.map(toAdmin) },
        ],
      });
    }

    // ── SALES_AGENT(AGENT) ───────────────────────────────────────
    if (ctx.role === "AGENT") {
      const [myBMs, globalAdmins] = await Promise.all([
        prisma.organizationMember.findMany({
          where: { organizationId: orgId, role: { in: ["OWNER", "BRANCH_MANAGER"] }, isActive: true },
          select: memberSelect, orderBy: { displayName: "asc" },
        }),
        prisma.globalAdmin.findMany({
          select: { id: true, displayName: true, phone: true },
          orderBy: { displayName: "asc" },
        }),
      ]);

      return NextResponse.json({
        ok: true, myRole: "AGENT",
        sections: [
          { label: "대리점장", members: myBMs.map(toMember) },
          { label: "본사",     members: globalAdmins.map(toAdmin) },
        ],
      });
    }

    return NextResponse.json({ ok: false }, { status: 403 });
  } catch (err) {
    logger.error("[GET /api/org/agents]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
