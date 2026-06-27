import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { generateUniqueShortlink, buildClonedLandingPageData, buildLandingTargetUrl } from "@/lib/landing-page-utils";

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

    // 대리점장(AGENT)도 지사가 조직에 공유한 봇/랜딩을 본인 페이지로 복제 가능(개인 판매링크 확보).
    // 마케터(FREE_SALES)는 CRM 비로그인(크루즈닷몰 전용)이라 제외.
    if (ctx.role === "FREE_SALES") {
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

    // shortlink 생성 (3회 재시도 + 충돌 방지)
    const shortlink = await generateUniqueShortlink();

    // 트랜잭션: 복사 + 이미지 복사 + ShortLink 생성 (타임아웃 5초)
    // 거장합의: Option A + 3회 재시도 + 트랜잭션 + 타임아웃 5초
    const cloned = await prisma.$transaction(
      async (tx) => {
        const newPage = await tx.crmLandingPage.create({
          // 🔴 누수 차단: 13개 필드만 복사하던 깨진 사본 → 콘텐츠/설정 전체 승계.
          //   crossOrg:true = 타 조직에서 공유받은 복사이므로 group/funnel FK 미승계.
          data: buildClonedLandingPageData(original, {
            organizationId: orgId,
            createdByUserId: ctx.userId, // SECURITY: 복제 사용자를 소유자로 설정
            title: `${original.title} - 사본`,
            slug: newSlug,
            shortlink, // SECURITY: 고유 shortlink 저장
            crossOrg: true,
          }),
          select: {
            id: true,
            title: true,
            slug: true,
            shortlink: true,
            isActive: true,
          },
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

        // ShortLink 레코드 생성 (감사추적용) — 🔴 /p/{shortlink} 정식 경로로 수정(과거 /landing/{id} 죽은 링크)
        const targetUrl = buildLandingTargetUrl(shortlink);
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
      },
      {
        timeout: 5000, // 거장 권장: 5초 타임아웃
        maxWait: 5000, // 최대 대기 시간
      }
    );

    logger.log("[POST /api/landing-pages/[id]/clone-shared]", {
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
      logger.error("[POST /api/landing-pages/[id]/clone-shared] UNIQUE_VIOLATION", {
        err: err.message,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "DUPLICATE",
          message: "복사 중 충돌이 발생했습니다. 다시 시도해주세요.",
        },
        { status: 409 }
      );
    }

    logger.error("[POST /api/landing-pages/[id]/clone-shared]", { err });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
