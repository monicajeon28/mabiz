import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { generateUniqueShortlink, createShortLinkForPage } from "@/lib/landing-page-utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/landing-pages/[id]/clone
export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();

    // SECURITY: 권한 검증 (FREE_SALES는 제외)
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '랜딩페이지 복제 권한이 없습니다' },
        { status: 403 }
      );
    }

    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // SECURITY: 소유권 + 조직 격리 검증
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

    // shortlink 생성 (충돌 방지 로직 포함)
    const shortlink = await generateUniqueShortlink();

    // 트랜잭션: CrmLandingPage 생성 + shortlink 업데이트
    const cloned = await prisma.$transaction(async (tx) => {
      const page = await tx.crmLandingPage.create({
        data: {
          organizationId: orgId,
          title:          `${original.title} - 사본`,
          slug:           newSlug,
          shortlink:      shortlink,  // ← 이제 생성된 shortlink 저장
          htmlContent:    original.htmlContent,
          isActive:       false,   // 사본은 비활성 상태로 시작
          isPublic:       original.isPublic,
          groupId:        original.groupId,
          viewCount:      0,
          createdByUserId: ctx.userId,  // ← SECURITY: 복제 사용자를 소유자로 설정
        },
        select: { id: true, title: true, slug: true, shortlink: true, isActive: true },
      });

      // ShortLink 테이블에도 저장
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const targetUrl = `${appUrl}/landing/${page.id}`;
      await tx.shortLink.create({
        data: {
          code: shortlink,
          targetUrl,
          title: page.title,
          organizationId: orgId,
          createdBy: ctx.userId,
          category: "landing",
          isActive: true,
        },
      });

      return page;
    });

    logger.log("[POST /api/landing-pages/[id]/clone]", {
      sourceId: id, newId: cloned.id, shortlink: cloned.shortlink, orgId,
    });

    return NextResponse.json({ ok: true, page: cloned });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/clone]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
