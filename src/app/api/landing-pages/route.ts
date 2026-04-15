import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/landing-pages
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const pages = await prisma.crmLandingPage.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { registrations: true } } },
    });

    return NextResponse.json({ ok: true, pages });
  } catch (err) {
    logger.error("[GET /api/landing-pages]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/landing-pages
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { title, slug, htmlContent, groupId } = await req.json();

    if (!title?.trim() || !slug?.trim()) {
      return NextResponse.json({ ok: false, message: "제목과 슬러그는 필수입니다." }, { status: 400 });
    }

    const page = await prisma.crmLandingPage.create({
      data: { organizationId: orgId, title, slug, htmlContent: htmlContent ?? "", groupId: groupId ?? null },
    });

    logger.log("[POST /api/landing-pages] 생성", { id: page.id });
    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ ok: false, message: "이미 사용 중인 슬러그입니다." }, { status: 409 });
    }
    logger.error("[POST /api/landing-pages]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
