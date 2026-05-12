import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/landing-pages
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);
    const myOrgId = orgId ?? BONSA_ORG_ID;

    // 내 페이지
    const pages = await prisma.crmLandingPage.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { registrations: true } } },
    });

    // 공유받은 페이지 (sharedToOrgId = myOrgId OR isGlobal = true)
    const receivedShares = await prisma.crmLandingShare.findMany({
      where: {
        OR: [
          { sharedToOrgId: myOrgId },
          { isGlobal: true },
        ],
        // 내 페이지는 제외 (자기 자신이 소유한 페이지)
        landingPage: {
          organizationId: { not: myOrgId },
        },
      },
      include: {
        landingPage: {
          include: { _count: { select: { registrations: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 공유한 조직 이름 조회
    const byOrgIds = [...new Set(receivedShares.map((s) => s.sharedByOrgId))];
    const byOrgs = byOrgIds.length > 0
      ? await prisma.organization.findMany({
          where: { id: { in: byOrgIds } },
          select: { id: true, name: true },
        })
      : [];
    const byOrgMap = Object.fromEntries(byOrgs.map((o) => [o.id, o.name]));

    const sharedPages = receivedShares.map((s) => ({
      ...s.landingPage,
      isShared: true,
      sharedByName: s.sharedByName,
      sharedByOrgId: s.sharedByOrgId,
      sharedByOrgName: byOrgMap[s.sharedByOrgId] ?? s.sharedByOrgId,
      shareId: s.id,
    }));

    return NextResponse.json({ ok: true, pages, sharedPages });
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
    // GLOBAL_ADMIN은 organizationId가 null → DB에서 실제 첫 번째 조직 사용
    let orgId: string;
    if (ctx.role === 'GLOBAL_ADMIN' && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, message: '조직이 없습니다' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }
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
        // 에디터 고도화 필드
        ...(rest.description      ? { description: rest.description }            : {}),
        ...(rest.buttonTitle      ? { buttonTitle: rest.buttonTitle }             : {}),
        ...(rest.completionPageUrl ? { completionPageUrl: rest.completionPageUrl } : {}),
        ...(rest.headerScript     ? { headerScript: rest.headerScript }           : {}),
        ...(rest.exposureTitle    ? { exposureTitle: rest.exposureTitle }         : {}),
        ...(rest.exposureImage    ? { exposureImage: rest.exposureImage }         : {}),
        ...(rest.formConfig       ? { formConfig: rest.formConfig, infoCollection: true } : {}),
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
