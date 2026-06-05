import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/contacts/share-targets
 * DB 공유 가능한 대상 목록 반환
 * - AGENT: 자기 대리점장 + 본사
 * - OWNER: 대리점장 전체 + 자기 직속 판매원 + 본사
 * - GLOBAL_ADMIN: 모든 멤버
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const targets: { id: string; displayName: string; role: string; orgName: string }[] = [];

    // 본사(GlobalAdmin) 목록
    const admins = await prisma.globalAdmin.findMany({
      select: { id: true, displayName: true },
      take: 20,
    });
    for (const a of admins) {
      targets.push({
        id: a.id,
        displayName: a.displayName ?? "본사 관리자",
        role: "본사",
        orgName: "본사",
      });
    }

    if (ctx.role === "AGENT" && ctx.organizationId) {
      // AGENT: 자기 조직의 OWNER/BRANCH_MANAGER만
      const managers = await prisma.organizationMember.findMany({
        where: {
          organizationId: ctx.organizationId,
          role: { in: ["OWNER", "BRANCH_MANAGER"] },
          isActive: true,
          id: { not: ctx.userId },
        },
        select: { id: true, displayName: true, role: true, organization: { select: { name: true } } },
        take: 30,
      });
      for (const m of managers) {
        targets.push({
          id: m.id,
          displayName: m.displayName ?? "이름없음",
          role: m.role === "OWNER" ? "대리점장" : "지점장",
          orgName: m.organization.name,
        });
      }
    } else if (ctx.role === "OWNER" && ctx.organizationId) {
      // OWNER: 모든 조직의 OWNER/BRANCH_MANAGER + 자기 직속 AGENT
      const [allManagers, myAgents] = await Promise.all([
        prisma.organizationMember.findMany({
          where: {
            role: { in: ["OWNER", "BRANCH_MANAGER"] },
            isActive: true,
            id: { not: ctx.userId },
          },
          select: { id: true, displayName: true, role: true, organization: { select: { name: true } } },
          take: 50,
        }),
        prisma.organizationMember.findMany({
          where: {
            organizationId: ctx.organizationId,
            role: { in: ["AGENT", "SALES_AGENT"] },
            isActive: true,
          },
          select: { id: true, displayName: true, role: true, organization: { select: { name: true } } },
          take: 50,
        }),
      ]);
      for (const m of [...allManagers, ...myAgents]) {
        if (targets.some(t => t.id === m.id)) continue;
        targets.push({
          id: m.id,
          displayName: m.displayName ?? "이름없음",
          role: m.role === "OWNER" ? "대리점장" : m.role === "AGENT" || m.role === "SALES_AGENT" ? "판매원" : "지점장",
          orgName: m.organization.name,
        });
      }
    } else if (ctx.role === "GLOBAL_ADMIN") {
      // GLOBAL_ADMIN: 모든 활성 멤버
      const allMembers = await prisma.organizationMember.findMany({
        where: { isActive: true },
        select: { id: true, displayName: true, role: true, organization: { select: { name: true } } },
        take: 100,
        orderBy: { displayName: "asc" },
      });
      for (const m of allMembers) {
        if (targets.some(t => t.id === m.id)) continue;
        targets.push({
          id: m.id,
          displayName: m.displayName ?? "이름없음",
          role: m.role,
          orgName: m.organization.name,
        });
      }
    }

    // 중복 제거: id 기준 + displayName+role 기준 (globalAdmin↔organizationMember 교집합 방지)
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const unique = targets.filter(t => {
      if (seenIds.has(t.id)) return false;
      const nameKey = `${t.displayName}__${t.role}__${t.orgName}`;
      if (seenNames.has(nameKey)) return false;
      seenIds.add(t.id);
      seenNames.add(nameKey);
      return true;
    });

    // 역할 라벨 정리 (OWNER → 대리점장, AGENT → 판매원 등)
    const ROLE_LABEL: Record<string, string> = {
      OWNER: "대리점장", AGENT: "판매원", FREE_SALES: "프리세일즈",
      BRANCH_MANAGER: "지점장", SALES_AGENT: "판매원",
    };
    const labeled = unique.map(t => ({
      ...t,
      role: ROLE_LABEL[t.role] ?? t.role,
    }));

    logger.log("[GET /api/contacts/share-targets]", { count: labeled.length, role: ctx.role });
    return NextResponse.json({ ok: true, targets: labeled });
  } catch (err) {
    logger.error("[GET /api/contacts/share-targets]", { err });
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, message: "인증이 필요합니다" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "서버 오류" }, { status: 500 });
  }
}
