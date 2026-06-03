import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/tools/playbook?phase=X&customerSegment=Y&type=Z
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { searchParams } = new URL(req.url);
    const phase           = searchParams.get("phase");
    const customerSegment = searchParams.get("customerSegment");
    const type            = searchParams.get("type");
    const scriptTab       = searchParams.get("scriptTab")   ?? "GENERAL";
    const productCode     = searchParams.get("productCode") ?? "ALL";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgFilter: any = orgId ? { organizationId: orgId } : {};
    const items = await prisma.salesPlaybook.findMany({
      where: {
        isActive: true,
        scriptTab,
        ...orgFilter,
        ...(phase !== null && { sectionOrder: parseInt(phase) }),
        ...(customerSegment && customerSegment !== "ALL" && { customerSegment }),
        ...(type ? { type } : {}),
        ...(productCode && productCode !== "ALL" && { productCode }),
      },
      select: {
        id: true,
        key: true,
        phase: true,
        type: true,
        script: true,
        trigger: true,
        customerSegment: true,
        psychology: true,
        shinminStep: true,
        monikaAmplifyLevel: true,
        source: true,
        notes: true,
        priority: true,
        scriptTab: true,
        sectionOrder: true,
        title: true,
        content: true,
        productCode: true,
        pasonaStage: true,
        effectivenessScore: true,
      },
      orderBy: { sectionOrder: "asc" },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    logger.error("[GET /api/tools/playbook]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
