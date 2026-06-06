import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { generateUniqueShortlink } from "@/lib/landing-page-utils";

type Params = { params: Promise<{ id: string }> };

/** GLOBAL_ADMIN orgId 해결 */
async function getOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): Promise<string> {
  if (ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId) {
    return BONSA_ORG_ID;
  }
  return resolveOrgId(ctx);
}

/**
 * POST /api/landing-pages/[id]/clone-shared
 * 공유받은 랜딩페이지를 내 조직으로 복사 (내 페이지로 복사)
 * 공유 조건: CrmLandingShare에 sharedToOrgId = orgId OR isGlobal = true
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = await getOrgId(ctx);
    const { id } = await params;

    if (ctx.role === "FREE_SALES" || ctx.role === "AGENT") {
      return NextResponse.json({ ok: false, message: "복사 권한이 없습니다." }, { status: 403 });
    }

    // 공유 유효성 확인 (내 조직 또는 전체 공유)
    const share = await prisma.crmLandingShare.findFirst({
      where: {
        landingPageId: id,
        OR: [
          { sharedToOrgId: orgId },
          { isGlobal: true },
        ],
      },
    });
    if (!share) {
      return NextResponse.json({ ok: false, message: "공유받은 랜딩페이지가 아닙니다." }, { status: 403 });
    }

    // 원본 페이지 조회 (다른 조직 소유)
    const original = await prisma.crmLandingPage.findUnique({
      where: { id },
    });
    if (!original) return NextResponse.json({ ok: false, message: "원본 페이지를 찾을 수 없습니다." }, { status: 404 });

    // 이미지 별도 조회 (CrmLandingPageImage는 별도 모델)
    const originalImages = await prisma.crmLandingPageImage.findMany({
      where: { landingPageId: id },
      orderBy: { sortOrder: "asc" },
      select: { imageAssetId: true, sortOrder: true, altText: true },
    });

    // slug 중복 방지
    const baseSlug = `${original.slug}-copy`;
    let newSlug = baseSlug;
    const conflict = await prisma.crmLandingPage.findFirst({
      where: { slug: newSlug, organizationId: orgId },
    });
    if (conflict) newSlug = `${baseSlug}-${Date.now()}`;

    // shortlink 생성
    const shortlink = await generateUniqueShortlink();

    // 트랜잭션: 복사 + 이미지 복사 + ShortLink 생성
    const cloned = await prisma.$transaction(async (tx) => {
      const newPage = await tx.crmLandingPage.create({
        data: {
          organizationId: orgId,
          title: `${original.title} - 사본`,
          slug: newSlug,
          shortlink: shortlink,  // ← 생성된 shortlink 저장
          htmlContent: original.htmlContent,
          editorMode: original.editorMode,
          isActive: false,
          isPublic: original.isPublic,
          groupId: null,
          description: original.description,
          buttonTitle: original.buttonTitle,
          completionPageUrl: original.completionPageUrl,
          headerScript: original.headerScript,
          exposureTitle: original.exposureTitle,
          exposureImage: original.exposureImage,
          infoCollection: original.infoCollection,
          formConfig: original.formConfig ?? undefined,
          viewCount: 0,
        },
        select: { id: true, title: true, slug: true, shortlink: true, isActive: true },
      });

      // 이미지 복사
      if (originalImages.length > 0) {
        await tx.crmLandingPageImage.createMany({
          data: originalImages.map((img) => ({
            landingPageId: newPage.id,
            imageAssetId: img.imageAssetId,
            sortOrder: img.sortOrder,
            altText: img.altText ?? null,
          })),
          skipDuplicates: true,
        });
      }

      // ShortLink 레코드 생성
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const targetUrl = `${appUrl}/landing/${newPage.id}`;
      await tx.shortLink.create({
        data: {
          code: shortlink,
          targetUrl,
          title: newPage.title,
          organizationId: orgId,
          createdBy: ctx.userId,
          category: "landing",
          isActive: true,
        },
      });

      return newPage;
    });

    logger.log("[POST /api/landing-pages/[id]/clone-shared]", {
      sourceId: id, newId: cloned.id, orgId,
    });

    return NextResponse.json({ ok: true, page: cloned });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/clone-shared]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
