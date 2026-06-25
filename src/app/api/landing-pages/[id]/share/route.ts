import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/** GLOBAL_ADMIN orgId 해결 */
async function getOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): Promise<string> {
  if (ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId) {
    return BONSA_ORG_ID;
  }
  return resolveOrgId(ctx);
}

const ShareSchema = z.union([
  z.object({ isGlobal: z.literal(true) }),
  z.object({ isGlobal: z.literal(false).optional(), sharedToOrgId: z.string().min(1) }),
]);

/**
 * GET /api/landing-pages/[id]/share
 * 해당 페이지의 공유 목록 (OWNER + GLOBAL_ADMIN)
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const orgId = await getOrgId(ctx);

    // 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });

    const shares = await prisma.crmLandingShare.findMany({
      where: { landingPageId: id },
      orderBy: { createdAt: "desc" },
    });

    // 공유받은 조직 이름 보강
    const orgIds = shares.map((s) => s.sharedToOrgId).filter((o) => o !== "__ALL__");
    const orgs = orgIds.length > 0
      ? await prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : [];
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

    return NextResponse.json({
      ok: true,
      shares: shares.map((s) => ({
        id: s.id,
        sharedToOrgId: s.sharedToOrgId,
        sharedToOrgName: s.sharedToOrgId === "__ALL__" ? "전체 공유" : (orgMap[s.sharedToOrgId] ?? s.sharedToOrgId),
        isGlobal: s.isGlobal,
        sharedByName: s.sharedByName,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    logger.error("[GET /api/landing-pages/[id]/share]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * POST /api/landing-pages/[id]/share
 * 랜딩페이지 공유 (OWNER + GLOBAL_ADMIN)
 * Body: { sharedToOrgId: "org_xxx" } | { isGlobal: true }
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다. 지사장 또는 관리자만 공유할 수 있습니다." }, { status: 403 });
    }

    const orgId = await getOrgId(ctx);

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
    if (!page) return NextResponse.json({ ok: false, message: "랜딩페이지를 찾을 수 없습니다." }, { status: 404 });

    const isGlobal = "isGlobal" in parsed.data && parsed.data.isGlobal === true;
    const targetOrgId = isGlobal ? "__ALL__" : (parsed.data as { sharedToOrgId: string }).sharedToOrgId;

    // 자기 자신에게 공유 방지
    if (targetOrgId === orgId) {
      return NextResponse.json({ ok: false, message: "자기 조직에는 공유할 수 없습니다." }, { status: 400 });
    }

    const sharedByName = ctx.member?.displayName ?? ctx.userId;
    const sharedByOrgId = orgId;

    const share = await prisma.crmLandingShare.upsert({
      where: { landingPageId_sharedToOrgId: { landingPageId: id, sharedToOrgId: targetOrgId } },
      create: {
        landingPageId: id,
        sharedToOrgId: targetOrgId,
        sharedByUserId: ctx.userId,
        sharedByOrgId,
        sharedByName,
        isGlobal,
      },
      update: {
        sharedByUserId: ctx.userId,
        sharedByOrgId,
        sharedByName,
        isGlobal,
      },
    });

    logger.log("[LandingShare] 공유 추가", { landingPageId: id, targetOrgId, isGlobal });
    return NextResponse.json({ ok: true, share });
  } catch (err) {
    logger.error("[POST /api/landing-pages/[id]/share]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * DELETE /api/landing-pages/[id]/share?sharedToOrgId=xxx
 * 공유 취소 (OWNER + GLOBAL_ADMIN)
 */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const orgId = await getOrgId(ctx);
    const sharedToOrgId = new URL(req.url).searchParams.get("sharedToOrgId");
    if (!sharedToOrgId) {
      return NextResponse.json({ ok: false, message: "sharedToOrgId가 필요합니다." }, { status: 400 });
    }

    // 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ ok: false, message: "랜딩페이지를 찾을 수 없습니다." }, { status: 404 });

    await prisma.crmLandingShare.deleteMany({
      where: { landingPageId: id, sharedToOrgId },
    });

    logger.log("[LandingShare] 공유 취소", { landingPageId: id, sharedToOrgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]/share]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
