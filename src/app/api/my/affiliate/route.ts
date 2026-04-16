import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/my/affiliate
 * 내 어필리에이트 정보 조회 (affiliateCode, 링크)
 *
 * OrganizationMember에 affiliateCode 필드 없으므로
 * → AffiliateSale에서 가장 최근 사용된 코드 추출
 * → 또는 추후 OrganizationMember.affiliateCode 필드 추가 가능
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    // 내 판매 이력에서 affiliateCode 추출
    const sale = await prisma.affiliateSale.findFirst({
      where:   { affiliateUserId: ctx.userId },
      select:  { affiliateCode: true },
      orderBy: { createdAt: "desc" },
    });

    // 조직 정보
    const orgId = ctx.organizationId;
    let orgName = "";
    if (orgId) {
      const org = await prisma.organization.findUnique({
        where:  { id: orgId },
        select: { name: true, slug: true },
      });
      orgName = org?.name ?? "";
    }

    const affiliateCode = sale?.affiliateCode ?? null;
    const cruisemallLink = affiliateCode
      ? `https://www.cruisedot.co.kr/?ref=${affiliateCode}`
      : null;

    logger.log("[GET /api/my/affiliate]", { userId: ctx.userId, affiliateCode });

    return NextResponse.json({
      ok: true,
      affiliateCode,
      cruisemallLink,
      orgName,
      role: ctx.role,
    });
  } catch (err) {
    logger.error("[GET /api/my/affiliate]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
