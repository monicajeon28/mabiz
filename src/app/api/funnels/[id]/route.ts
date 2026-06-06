import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgIdOrNull, resolveOrgId, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/funnels/[id]
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;

    const funnel = await prisma.funnel.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
      include: { stages: { orderBy: { order: "asc" } } },
    });
    if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });

    return NextResponse.json({ ok: true, funnel });
  } catch (err) {
    logger.error("[GET /api/funnels/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/funnels/[id] — 퍼널 기본 정보 수정
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const existing = await prisma.funnel.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const body = await req.json() as {
      name?: string; description?: string; isActive?: boolean;
    };

    // updateMany로 organizationId 포함: findFirst → update 사이 TOCTOU 방지
    await prisma.funnel.updateMany({
      where: { id, organizationId: orgId },
      data: {
        ...(body.name        !== undefined ? { name: body.name }               : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive    !== undefined ? { isActive: body.isActive }       : {}),
      },
    });
    const funnel = await prisma.funnel.findFirst({
      where: { id, organizationId: orgId },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    logger.log("[PATCH /api/funnels/[id]]", { id, orgId });

    return NextResponse.json({ ok: true, funnel });
  } catch (err) {
    logger.error("[PATCH /api/funnels/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/funnels/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    const existing = await prisma.funnel.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    // deleteMany로 organizationId 포함: findFirst → delete 사이 TOCTOU 방지
    await prisma.funnel.deleteMany({ where: { id, organizationId: orgId } });

    logger.log("[DELETE /api/funnels/[id]]", { id, orgId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/funnels/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
