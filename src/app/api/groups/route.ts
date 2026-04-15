import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/groups — 그룹 목록
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const groups = await prisma.contactGroup.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { members: true } },
        // 연결된 퍼널 이름도 같이
      },
      orderBy: { createdAt: "asc" },
    });

    // 퍼널 이름 조회 (funnelId 있는 경우)
    const funnelIds = groups
      .filter((g) => g.funnelId)
      .map((g) => g.funnelId!);

    const funnels =
      funnelIds.length > 0
        ? await prisma.funnel.findMany({
            where: { id: { in: funnelIds } },
            select: { id: true, name: true },
          })
        : [];

    const funnelMap = Object.fromEntries(funnels.map((f) => [f.id, f.name]));

    const result = groups.map((g) => ({
      ...g,
      funnelName: g.funnelId ? (funnelMap[g.funnelId] ?? null) : null,
    }));

    return NextResponse.json({ ok: true, groups: result });
  } catch (err) {
    logger.error("[GET /api/groups]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/groups — 그룹 생성
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { name, description, color, funnelId } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, message: "그룹 이름은 필수입니다." }, { status: 400 });
    }

    const group = await prisma.contactGroup.create({
      data: {
        organizationId: orgId,
        name,
        description: description ?? null,
        color:       color       ?? "#6B7280",
        funnelId:    funnelId    ?? null,
      },
    });

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (err) {
    logger.error("[POST /api/groups]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
