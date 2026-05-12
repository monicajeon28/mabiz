import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/landing-pages
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);

    const pages = await prisma.crmLandingPage.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}) },
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
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '랜딩페이지 생성 권한이 없습니다' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { title, slug, htmlContent, groupId, editorMode, commentEnabled, ...rest } = await req.json();

    if (!title?.trim() || !slug?.trim()) {
      return NextResponse.json({ ok: false, message: "제목과 슬러그는 필수입니다." }, { status: 400 });
    }

    const mode = editorMode === 'image' ? 'image' : 'html';

    const page = await prisma.crmLandingPage.create({
      data: {
        organizationId: orgId, title, slug,
        htmlContent: htmlContent ?? "",
        groupId: groupId ?? null,
        editorMode: mode,
        commentEnabled: commentEnabled === true,
        // 결제 설정 (있으면)
        ...(rest.paymentEnabled ? {
          paymentEnabled: true,
          paymentType: rest.paymentType ?? null,
          productName: rest.productName ?? null,
          productPrice: rest.productPrice ? parseInt(rest.productPrice) : null,
          ...(rest.paymentType === 'subscription' ? {
            cycleDay: rest.cycleDay ? parseInt(rest.cycleDay) : null,
            expireDate: rest.expireDate ? new Date(rest.expireDate) : null,
          } : {}),
        } : {}),
      },
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
