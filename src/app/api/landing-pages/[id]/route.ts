import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { registrations: true } }, registrations: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    logger.error("[GET /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;
    const body   = await req.json();

    const existing = await prisma.crmLandingPage.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const { title, slug, htmlContent, isActive } = body;
    const page = await prisma.crmLandingPage.update({
      where: { id },
      data: {
        ...(title       !== undefined ? { title }       : {}),
        ...(slug        !== undefined ? { slug }        : {}),
        ...(htmlContent !== undefined ? { htmlContent } : {}),
        ...(isActive    !== undefined ? { isActive }    : {}),
      },
    });
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    logger.error("[PATCH /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    const existing = await prisma.crmLandingPage.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.crmLandingPage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
