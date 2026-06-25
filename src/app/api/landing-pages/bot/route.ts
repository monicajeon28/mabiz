/**
 * POST /api/landing-pages/bot — 크루즈닷봇 랜딩 생성(50대 간편 제작) (작업지시서 시나리오 A)
 *
 * 관리자/대리점장이 상품·인사말만 정하면 pageType='bot' 랜딩 + 고유 추적링크를 만든다.
 * 복잡한 블록에디터 없이 botConfig(persona/greeting/chips/productCatalogIds)만 저장.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { checkOrigin } from "@/lib/origin-guard";
import {
  generateUniqueShortlink,
  buildLandingTargetUrl,
} from "@/lib/landing-page-utils";

const PERSONA_PRESETS: Record<string, string> = {
  calm: "신중한 50대 고객을 위한 따뜻하고 차분한 존댓말 상담",
  friendly: "친근하고 다정하게, 옆집 자녀처럼 편안하지만 예의 바른 말투",
  pro: "전문적이고 신뢰감 있게, 차분한 여행 전문가 말투",
};

export async function POST(req: Request) {
  try {
    if (!checkOrigin(req, "BotLandingCreate")) {
      return NextResponse.json({ ok: false, message: "잘못된 접근입니다." }, { status: 403 });
    }
    const ctx = await getAuthContext();
    // 봇 랜딩 제작은 대리점장(OWNER)·관리자(GLOBAL_ADMIN) 전용
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "봇 랜딩 만들기 권한이 없습니다." }, { status: 403 });
    }
    const orgId =
      ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId ? BONSA_ORG_ID : resolveOrgId(ctx);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, message: "입력값이 없습니다." }, { status: 400 });
    }

    const title = String(body.title ?? "").trim().slice(0, 80);
    if (!title) {
      return NextResponse.json({ ok: false, message: "봇 랜딩 이름을 입력해주세요." }, { status: 400 });
    }
    const greeting = body.greeting ? String(body.greeting).trim().slice(0, 300) : undefined;
    const personaKey = String(body.persona ?? "calm");
    const persona = PERSONA_PRESETS[personaKey] ?? PERSONA_PRESETS.calm;
    const chips = Array.isArray(body.chips)
      ? body.chips
          .map((c: unknown) => String(c).trim().slice(0, 30))
          .filter((c: string) => c.length > 0)
          .slice(0, 3)
      : undefined;
    const productCatalogIds = Array.isArray(body.productCodes)
      ? body.productCodes
          .map((c: unknown) => String(c).trim())
          .filter((c: string) => c.length > 0)
          .slice(0, 20)
      : [];

    const botConfig = {
      persona,
      ...(greeting ? { greeting } : {}),
      ...(chips && chips.length ? { chips } : {}),
      productCatalogIds,
    };

    const shortlink = await generateUniqueShortlink();
    const slug = `bot-${shortlink}`;

    const created = await prisma.$transaction(
      async (tx) => {
        const page = await tx.crmLandingPage.create({
          data: {
            organizationId: orgId,
            title,
            slug,
            shortlink,
            pageType: "bot",
            botConfig,
            htmlContent: null,
            isActive: true, // 본인 원본은 바로 사용·공유 가능하게 활성
            isPublic: true,
            createdByUserId: ctx.userId,
          },
          select: { id: true, title: true, slug: true, shortlink: true },
        });
        await tx.shortLink.create({
          data: {
            code: shortlink,
            targetUrl: buildLandingTargetUrl(shortlink),
            title: page.title,
            organizationId: orgId,
            createdBy: ctx.userId,
            category: "landing",
            isActive: true,
          },
        });
        return page;
      },
      { timeout: 5000, maxWait: 5000 },
    );

    logger.log("[POST /api/landing-pages/bot]", { id: created.id, orgId });
    return NextResponse.json(
      {
        ok: true,
        page: created,
        url: buildLandingTargetUrl(created.shortlink ?? created.slug),
      },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("unique") || err.message.includes("Unique constraint"))
    ) {
      return NextResponse.json(
        { ok: false, error: "DUPLICATE", message: "잠시 후 다시 시도해주세요." },
        { status: 409 },
      );
    }
    logger.error("[POST /api/landing-pages/bot]", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, message: "봇 랜딩 생성에 실패했습니다." }, { status: 500 });
  }
}
