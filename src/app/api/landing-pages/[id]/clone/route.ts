import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { generateUniqueShortlink, buildClonedLandingPageData, buildLandingTargetUrl } from "@/lib/landing-page-utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/landing-pages/[id]/clone
// SECURITY: 대리점장(OWNER)·시스템관리자(GLOBAL_ADMIN) 전용 + organizationId 격리
// 거장합의: Option A + 3회 재시도 + 트랜잭션 + 타임아웃 5초
export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();

    // 랜딩페이지 복제는 대리점장(OWNER)·시스템관리자(GLOBAL_ADMIN) 전용 (P0-2).
    // 판매원(AGENT)이 타 랜딩페이지를 복제하던 경로 차단.
    if (!canManageSettings(ctx)) {
      return NextResponse.json(
        {
          ok: false,
          error: "FORBIDDEN",
          message: "랜딩페이지 복제 권한이 없습니다",
        },
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
    let newSlug = baseSlug;
    const conflict = await prisma.crmLandingPage.findFirst({
      where: { slug: newSlug, organizationId: orgId },
    });
    if (conflict) newSlug = `${baseSlug}-${Date.now()}`;

    // 원본 이미지 조회 (CrmLandingPageImage는 별도 모델)
    const originalImages = await prisma.crmLandingPageImage.findMany({
      where: { landingPageId: id },
      orderBy: { sortOrder: "asc" },
      select: { imageAssetId: true, sortOrder: true, altText: true },
    });

    // shortlink 생성 (3회 재시도 + 충돌 방지)
    const shortlink = await generateUniqueShortlink();

    // 트랜잭션: CrmLandingPage 생성 + 이미지 복사 + ShortLink 생성 (타임아웃 5초)
    const cloned = await prisma.$transaction(
      async (tx) => {
        const page = await tx.crmLandingPage.create({
          // 🔴 누수 차단: 8개 필드만 복사하던 깨진 사본 → 콘텐츠/설정 전체 승계.
          //   crossOrg:false = 같은 조직 복제이므로 group/funnel FK 그대로 승계.
          data: buildClonedLandingPageData(original, {
            organizationId: orgId,
            createdByUserId: ctx.userId, // SECURITY: 복제 사용자를 소유자로 설정
            title: `${original.title} - 사본`,
            slug: newSlug,
            shortlink, // SECURITY: 고유 shortlink 저장
            crossOrg: false,
          }),
          select: {
            id: true,
            title: true,
            slug: true,
            shortlink: true,
            isActive: true,
          },
        });

        // 이미지 복사 (사본도 동일한 이미지를 보이게)
        if (originalImages.length > 0) {
          await tx.crmLandingPageImage.createMany({
            data: originalImages.map((img) => ({
              landingPageId: page.id,
              imageAssetId: img.imageAssetId,
              sortOrder: img.sortOrder,
              altText: img.altText ?? null,
            })),
            skipDuplicates: true,
          });
        }

        // ShortLink 테이블에도 저장 (감사추적용) — 🔴 /p/{shortlink} 정식 경로로 수정
        const targetUrl = buildLandingTargetUrl(shortlink);
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
      },
      {
        timeout: 5000, // 거장 권장: 5초 타임아웃
        maxWait: 5000, // 최대 대기 시간
      }
    );

    logger.log("[POST /api/landing-pages/[id]/clone]", {
      sourceId: id,
      newId: cloned.id,
      shortlink: cloned.shortlink,
      orgId,
    });

    return NextResponse.json({ ok: true, page: cloned });
  } catch (err) {
    // SECURITY: unique violation 캐치 (감사추적)
    if (
      err instanceof Error &&
      (err.message.includes("unique") || err.message.includes("Unique constraint"))
    ) {
      logger.error("[POST /api/landing-pages/[id]/clone] UNIQUE_VIOLATION", {
        err: err.message,
      });
      return NextResponse.json(
        { ok: false, error: "DUPLICATE", message: "복제 중 충돌이 발생했습니다. 다시 시도해주세요." },
        { status: 409 }
      );
    }

    logger.error("[POST /api/landing-pages/[id]/clone]", { err });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
