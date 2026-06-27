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
  z.object({ sharedToUserId: z.string().min(1) }), // 지정공유(특정 지사/대리점장) — 관리자 전용
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
    // 지정공유 대상 담당자 이름 보강
    const userIds = shares.map((s) => s.sharedToUserId).filter((u): u is string => !!u && u !== "");
    const users = userIds.length > 0
      ? await prisma.organizationMember.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, displayName: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.userId, u.displayName ?? u.userId]));

    return NextResponse.json({
      ok: true,
      shares: shares.map((s) => ({
        id: s.id,
        sharedToOrgId: s.sharedToOrgId,
        sharedToUserId: s.sharedToUserId || null,
        // 표시 라벨 — 지정공유면 담당자명, 아니면 조직/전체
        sharedToLabel: s.sharedToUserId
          ? `담당자: ${userMap[s.sharedToUserId] ?? s.sharedToUserId}`
          : (s.sharedToOrgId === "__ALL__" ? "전체 공유" : (orgMap[s.sharedToOrgId] ?? s.sharedToOrgId)),
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

    const sharedByName = ctx.member?.displayName ?? ctx.userId;
    const sharedByOrgId = orgId;

    // ── 지정공유(특정 지사/대리점장) — 관리자(GLOBAL_ADMIN) 전용 ──
    if ("sharedToUserId" in parsed.data) {
      if (ctx.role !== "GLOBAL_ADMIN") {
        return NextResponse.json({ ok: false, message: "지정 공유는 관리자만 가능합니다." }, { status: 403 });
      }
      const targetUserId = parsed.data.sharedToUserId;
      // org는 클라가 못 정함 — 활성 멤버십에서 서버가 유도(열거/스푸핑 차단). 지사(OWNER)·대리점장(AGENT)만.
      const member = await prisma.organizationMember.findFirst({
        where: { userId: targetUserId, isActive: true, role: { in: ["OWNER", "AGENT"] } },
        select: { organizationId: true },
        orderBy: { id: "asc" }, // 복수 멤버십 시 결정적(라벨·유니크키 안정)
      });
      if (!member) {
        return NextResponse.json({ ok: false, message: "공유 대상을 찾을 수 없습니다." }, { status: 400 });
      }
      const share = await prisma.crmLandingShare.upsert({
        where: { landingPageId_sharedToOrgId_sharedToUserId: { landingPageId: id, sharedToOrgId: member.organizationId, sharedToUserId: targetUserId } },
        create: { landingPageId: id, sharedToOrgId: member.organizationId, sharedToUserId: targetUserId, sharedByUserId: ctx.userId, sharedByOrgId, sharedByName, isGlobal: false },
        update: { sharedByUserId: ctx.userId, sharedByOrgId, sharedByName, isGlobal: false },
      });
      logger.log("[LandingShare] 지정공유", { landingPageId: id, targetUserId, targetOrg: member.organizationId });
      return NextResponse.json({ ok: true, share });
    }

    const isGlobal = "isGlobal" in parsed.data && parsed.data.isGlobal === true;
    const targetOrgId = isGlobal ? "__ALL__" : (parsed.data as { sharedToOrgId: string }).sharedToOrgId;

    // 자기 자신에게 공유 방지
    if (targetOrgId === orgId) {
      return NextResponse.json({ ok: false, message: "자기 조직에는 공유할 수 없습니다." }, { status: 400 });
    }

    const share = await prisma.crmLandingShare.upsert({
      // 센티넬 sharedToUserId:"" = 조직/전체 공유(지정공유와 구분)
      where: { landingPageId_sharedToOrgId_sharedToUserId: { landingPageId: id, sharedToOrgId: targetOrgId, sharedToUserId: "" } },
      create: {
        landingPageId: id,
        sharedToOrgId: targetOrgId,
        sharedToUserId: "",
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
    const sp = new URL(req.url).searchParams;
    const sharedToUserId = sp.get("sharedToUserId");
    const sharedToOrgId = sp.get("sharedToOrgId");
    if (!sharedToUserId && !sharedToOrgId) {
      return NextResponse.json({ ok: false, message: "sharedToOrgId 또는 sharedToUserId가 필요합니다." }, { status: 400 });
    }

    // 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!page) return NextResponse.json({ ok: false, message: "랜딩페이지를 찾을 수 없습니다." }, { status: 404 });

    // 지정공유 취소(sharedToUserId) vs 조직/전체 공유 취소(sharedToOrgId + 센티넬 "")
    const delWhere = sharedToUserId
      ? { landingPageId: id, sharedToUserId }
      : { landingPageId: id, sharedToOrgId: sharedToOrgId as string, sharedToUserId: "" };
    await prisma.crmLandingShare.deleteMany({ where: delWhere });

    logger.log("[LandingShare] 공유 취소", { landingPageId: id, sharedToUserId, sharedToOrgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/landing-pages/[id]/share]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
