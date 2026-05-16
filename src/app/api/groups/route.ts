import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/groups — 그룹 목록
export async function GET() {
  try {
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN은 organizationId가 null — 첫 번째 조직 사용
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: true, groups: [] });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }

    // 내 그룹(ownerId === ctx.userId) + 조직 공유 그룹(ownerId === null) 만 반환
    // GLOBAL_ADMIN은 ownerId 필터 없이 조직 전체 조회
    const ownerFilter = ctx.role !== 'GLOBAL_ADMIN'
      ? { OR: [{ ownerId: ctx.userId }, { ownerId: null }] }
      : {};

    const groups = await prisma.contactGroup.findMany({
      where: { organizationId: orgId, ...ownerFilter },
      include: {
        _count: { select: { members: true } },
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
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN은 organizationId가 null — 첫 번째 조직 사용
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: '조직이 없습니다.' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '조직 정보가 없습니다' }, { status: 403 });
    }

    const { name, description, color, funnelId } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, message: "그룹 이름은 필수입니다." }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ ok: false, message: "그룹 이름은 100자 이하여야 합니다." }, { status: 400 });
    }
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ ok: false, message: "color는 #RRGGBB 형식이어야 합니다." }, { status: 400 });
    }

    const group = await prisma.contactGroup.create({
      data: {
        organizationId: orgId,
        name,
        description: description ?? null,
        color:       color       ?? "#6B7280",
        funnelId:    funnelId    ?? null,
        ownerId:     ctx.userId,  // 개인 그룹으로 생성
      },
      include: {
        _count: { select: { members: true } },
        funnel: { select: { name: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      group: {
        ...group,
        funnelName: group.funnel?.name ?? null,
      },
    }, { status: 201 });
  } catch (err) {
    logger.error("[POST /api/groups]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
