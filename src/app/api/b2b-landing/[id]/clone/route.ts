import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// POST /api/b2b-landing/[id]/clone
export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // 소유권 검증
    const original = await prisma.b2BLandingPage.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!original) return NextResponse.json({ ok: false, error: 'NOT_FOUND', message: '원본 페이지를 찾을 수 없습니다.' }, { status: 404 });

    // 이미지형 페이지용 이미지 목록 조회 (relation 없으므로 별도 쿼리)
    const originalImages = await prisma.b2BLandingPageImage.findMany({
      where: { landingPageId: id },
      orderBy: { sortOrder: 'asc' },
    });

    const newPartnerName = original.partnerId ? `${original.partnerId} (복사)` : null;

    const cloned = await prisma.b2BLandingPage.create({
      data: {
        organizationId: orgId,
        title:          `${original.title} - 사본`,
        partnerId:      newPartnerName,
        htmlContent:    original.htmlContent,
        isActive:       false,
        groupId:        original.groupId,
        viewCount:      0,
      },
      select: { id: true, title: true, partnerId: true, isActive: true },
    });

    // 이미지 복사 (ImageAsset 공유, 순서 재기록)
    if (originalImages.length > 0) {
      await prisma.b2BLandingPageImage.createMany({
        data: originalImages.map((img) => ({
          landingPageId: cloned.id,
          imageAssetId:  img.imageAssetId,
          sortOrder:     img.sortOrder,
          altText:       img.altText ?? null,
        })),
      });
    }

    logger.log("[POST /api/b2b-landing/[id]/clone]", {
      sourceId: id, newId: cloned.id, orgId,
    });

    return NextResponse.json({ ok: true, data: cloned, page: cloned });
  } catch (err) {
    logger.error("[POST /api/b2b-landing/[id]/clone]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
