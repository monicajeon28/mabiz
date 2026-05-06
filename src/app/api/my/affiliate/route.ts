import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type RawProfile = {
  affiliateCode: string | null;
  type: string;
  status: string;
  displayName: string | null;
  landingSlug: string | null;
};

/**
 * GET /api/my/affiliate
 * 내 어필리에이트 정보 조회 (affiliateCode, 링크)
 *
 * mallUser 세션: GMcruise AffiliateProfile 직접 조회 (파라미터화)
 * 일반 세션: AffiliateSale에서 코드 추출 (기존)
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    // ── GMcruise mallUser 세션 ──────────────────────────────────
    if (ctx.mallUser) {
      const { affiliateProfileId, mallUserId, name } = ctx.mallUser;

      if (!affiliateProfileId) {
        return NextResponse.json({ ok: true, affiliateCode: null, cruisemallLink: null, role: ctx.role });
      }

      const profiles = await prisma.$queryRaw<RawProfile[]>`
        SELECT
          u."affiliateCode",
          ap.type,
          ap.status,
          ap."displayName",
          ap."landingSlug"
        FROM "AffiliateProfile" ap
        JOIN "User" u ON u.id = ap."userId"
        WHERE ap.id = ${affiliateProfileId}
        LIMIT 1
      `;

      const profile = profiles[0];
      if (!profile) {
        return NextResponse.json({ ok: true, affiliateCode: null, cruisemallLink: null, role: ctx.role });
      }

      const affiliateCode = profile.affiliateCode ?? null;
      const cruisemallLink = affiliateCode
        ? `https://www.cruisedot.co.kr/?ref=${affiliateCode}`
        : null;

      logger.log("[GET /api/my/affiliate] mallUser", { mallUserId, affiliateCode });
      return NextResponse.json({
        ok: true,
        affiliateCode,
        cruisemallLink,
        displayName: profile.displayName ?? name ?? null,
        affiliateType: profile.type,
        affiliateStatus: profile.status,
        landingSlug: profile.landingSlug ?? null,
        role: ctx.role,
      });
    }

    // ── 기존 CRM 세션 ──────────────────────────────────────────
    const sale = await prisma.affiliateSale.findFirst({
      where:   { affiliateUserId: ctx.userId },
      select:  { affiliateCode: true },
      orderBy: { createdAt: "desc" },
    });

    let orgName = "";
    if (ctx.organizationId) {
      const org = await prisma.organization.findUnique({
        where:  { id: ctx.organizationId },
        select: { name: true },
      });
      orgName = org?.name ?? "";
    }

    const affiliateCode = sale?.affiliateCode ?? null;
    const cruisemallLink = affiliateCode
      ? `https://www.cruisedot.co.kr/?ref=${affiliateCode}`
      : null;

    logger.log("[GET /api/my/affiliate]", { userId: ctx.userId, affiliateCode });
    return NextResponse.json({ ok: true, affiliateCode, cruisemallLink, orgName, role: ctx.role });

  } catch (err) {
    logger.error("[GET /api/my/affiliate]", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
