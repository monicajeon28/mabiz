import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

const nanoid = customAlphabet('0-9a-z', 8);

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

    // ShortLink 코드 사전 생성 (충돌 방지)
    let shortlinkCode = '';
    let shortlinkFound = false;
    for (let i = 0; i < 10; i++) {
      const candidate = nanoid();
      const existing = await prisma.shortLink.findFirst({ where: { code: candidate }, select: { id: true } });
      if (!existing) { shortlinkCode = candidate; shortlinkFound = true; break; }
    }
    if (!shortlinkFound) {
      return NextResponse.json({ ok: false, error: 'SHORTLINK_FAILED', message: '숏링크 코드 생성 실패' }, { status: 500 });
    }

    // P2-8: page + ShortLink 트랜잭션, 결제/폼 필드 전체 복사
    const cloned = await prisma.$transaction(async (tx) => {
      const newPage = await tx.b2BLandingPage.create({
        data: {
          organizationId: orgId,
          title:             `${original.title} - 사본`,
          partnerId:         newPartnerName,
          htmlContent:       original.htmlContent,
          editorMode:        original.editorMode,
          isActive:          false,
          groupId:           original.groupId,
          viewCount:         0,
          formConfig:        original.formConfig ?? undefined,
          buttonTitle:       original.buttonTitle,
          completionPageUrl: original.completionPageUrl,
          commentEnabled:    original.commentEnabled,
          autoFunnelId:      original.autoFunnelId,
          paymentEnabled:    original.paymentEnabled,
          paymentType:       original.paymentType,
          productName:       original.productName,
          productPrice:      original.productPrice,
          cycleDay:          original.cycleDay,
          expireDate:        original.expireDate,
          exposureTitle:     original.exposureTitle,
          exposureImage:     original.exposureImage,
          headerScript:      original.headerScript,
          description:       original.description,
          footerText:        original.footerText,
        },
        select: { id: true, title: true, partnerId: true, isActive: true },
      });

      const targetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/b2b-landing/${newPage.id}`;
      await tx.shortLink.create({
        data: {
          code: shortlinkCode,
          targetUrl,
          title: newPage.title,
          organizationId: orgId,
          createdBy: ctx.userId,
          category: 'b2b-landing',
          isActive: true,
        },
      });

      return newPage;
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
      sourceId: id, newId: cloned.id, orgId, shortlinkCode,
    });

    return NextResponse.json({ ok: true, data: cloned, page: cloned, shortlinkCode });
  } catch (err) {
    logger.error("[POST /api/b2b-landing/[id]/clone]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
