import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const ShareSchema = z.object({
  userId: z.string().min(1), // 공유받을 파트너(OWNER) userId
}).strict();

/**
 * GET /api/landing-pages/[id]/share
 * 공유된 파트너 목록 조회 (OWNER + GLOBAL_ADMIN만)
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    // 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });

    const shares = await prisma.crmLandingShare.findMany({
      where: { landingPageId: id },
      select: {
        id: true,
        userId: true,
        sharedByUserId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, shares });
  } catch (err) {
    logger.error("[GET /api/landing-pages/[id]/share]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * POST /api/landing-pages/[id]/share
 * 파트너에게 랜딩페이지 공유 (OWNER + GLOBAL_ADMIN만)
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다. 대리점장 또는 관리자만 공유할 수 있습니다." }, { status: 403 });
    }

    const body   = await req.json();
    const parsed = ShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "잘못된 요청", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });

    // 공유받을 사용자가 같은 조직 OWNER인지 검증
    const targetMember = await prisma.organizationMember.findFirst({
      where: { userId: parsed.data.userId, organizationId: orgId, role: "OWNER" },
      select: { id: true },
    });
    if (!targetMember) {
      return NextResponse.json({ ok: false, message: "해당 파트너(대리점장)를 찾을 수 없습니다." }, { status: 400 });
    }

    const share = await prisma.crmLandingShare.upsert({
      where: { landingPageId_userId: { landingPageId: id, userId: parsed.data.userId } },
      create: { landingPageId: id, userId: parsed.data.userId, sharedByUserId: ctx.userId },
      update: {},
    });

    logger.log("[LandingShare] 공유 추가", { landingPageId: id, userId: parsed.data.userId });
    return NextResponse.json({ ok: true, share });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/share]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * DELETE /api/landing-pages/[id]/share?userId=xxx
 * 파트너 공유 취소 (OWNER + GLOBAL_ADMIN만)
 */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ ok: false, message: "userId가 필요합니다." }, { status: 400 });
    }

    // 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.crmLandingShare.deleteMany({
      where: { landingPageId: id, userId },
    });

    logger.log("[LandingShare] 공유 취소", { landingPageId: id, userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]/share]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
