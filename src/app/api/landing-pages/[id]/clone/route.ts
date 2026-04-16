import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// POST /api/landing-pages/[id]/clone
export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // 소유권 검증
    const original = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!original) return NextResponse.json({ ok: false }, { status: 404 });

    // slug 중복 방지
    const baseSlug = `${original.slug}-copy`;
    let   newSlug  = baseSlug;
    const conflict = await prisma.crmLandingPage.findFirst({
      where: { slug: newSlug, organizationId: orgId },
    });
    if (conflict) newSlug = `${baseSlug}-${Date.now()}`;

    const cloned = await prisma.crmLandingPage.create({
      data: {
        organizationId: orgId,
        title:          `${original.title} - 사본`,
        slug:           newSlug,
        htmlContent:    original.htmlContent,
        isActive:       false,   // 사본은 비활성 상태로 시작
        isPublic:       original.isPublic,
        groupId:        original.groupId,
        viewCount:      0,
      },
      select: { id: true, title: true, slug: true, isActive: true },
    });

    logger.log("[POST /api/landing-pages/[id]/clone]", {
      sourceId: id, newId: cloned.id, orgId,
    });

    return NextResponse.json({ ok: true, page: cloned });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/clone]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
