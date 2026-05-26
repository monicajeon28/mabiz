import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/b2b-landing/[id]/registrations?skip=0&limit=20
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // 소유권 검증
    const landingPage = await prisma.b2BLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, title: true },
    });
    if (!landingPage) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip   = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      prisma.b2BLandingRegistration.findMany({
        where: { landingPageId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          company: true,
          packageInterest: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          createdAt: true,
        },
      }),
      prisma.b2BLandingRegistration.count({ where: { landingPageId: id } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.log("[GET /api/b2b-landing/[id]/registrations]", {
      landingPageId: id, total, page, limit, totalPages,
    });

    return NextResponse.json({
      ok: true,
      registrations,
      pagination: { page, limit, total, totalPages },
    });
  } catch (err) {
    logger.error("[GET /api/b2b-landing/[id]/registrations]", { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
