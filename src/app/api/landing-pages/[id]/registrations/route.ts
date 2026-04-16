import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/landing-pages/[id]/registrations?page=1&limit=20
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // 소유권 검증
    const page = await prisma.crmLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, title: true },
    });
    if (!page) return NextResponse.json({ ok: false }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const pageNum = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip    = (pageNum - 1) * limit;

    const [registrations, total] = await Promise.all([
      prisma.crmLandingRegistration.findMany({
        where: { landingPageId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          funnelStarted: true,
          createdAt: true,
        },
      }),
      prisma.crmLandingRegistration.count({ where: { landingPageId: id } }),
    ]);

    // phone 마스킹 (CLAUDE.md 조항 3)
    const masked = registrations.map((r) => ({
      ...r,
      phone: r.phone.substring(0, 4) + "****",
    }));

    logger.log("[GET /api/landing-pages/[id]/registrations]", {
      landingPageId: id, total, page: pageNum,
    });

    return NextResponse.json({
      ok: true,
      registrations: masked,
      total,
      page:       pageNum,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error("[GET /api/landing-pages/[id]/registrations]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
