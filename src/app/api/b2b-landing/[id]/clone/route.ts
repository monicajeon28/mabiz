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

    // partnerId가 있으면 " (복사)" 추가, 없으면 제목만 추가
    const newPartnerName = original.partnerId ? `${original.partnerId} (복사)` : null;

    const cloned = await prisma.b2BLandingPage.create({
      data: {
        organizationId: orgId,
        title:          `${original.title} - 사본`,
        partnerId:      newPartnerName,
        htmlContent:    original.htmlContent,
        isActive:       false,   // 사본은 비활성 상태로 시작
        groupId:        original.groupId,
        viewCount:      0,
      },
      select: { id: true, title: true, partnerId: true, isActive: true },
    });

    logger.log("[POST /api/b2b-landing/[id]/clone]", {
      sourceId: id, newId: cloned.id, orgId,
    });

    return NextResponse.json({ ok: true, data: cloned, page: cloned });
  } catch (err) {
    logger.error("[POST /api/b2b-landing/[id]/clone]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
