import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/tools/playbook?phase=X&customerSegment=Y&type=Z
export async function GET(req: Request) {
  try {
    await getAuthContext();
    const { searchParams } = new URL(req.url);
    const phase           = searchParams.get("phase");
    const customerSegment = searchParams.get("customerSegment");
    const type            = searchParams.get("type");
    const scriptTab       = searchParams.get("scriptTab")   ?? "GENERAL";
    const productCode     = searchParams.get("productCode") ?? "ALL";

    // phase를 sectionOrder로 매핑 (0-9)
    const phaseFilters = phase ? { sectionOrder: parseInt(phase) } : {};

    // customerSegment를 productCode로 매핑
    const segmentFilters = customerSegment && customerSegment !== "ALL"
      ? { productCode: { in: [customerSegment, "ALL"] } }
      : { productCode: { in: [productCode, "ALL"] } };

    const items = await prisma.salesPlaybook.findMany({
      where: {
        isActive: true,
        scriptTab,
        ...segmentFilters,
        ...(type ? { type } : {}),
        ...phaseFilters,
      },
      orderBy: [
        { productCode: "desc" },
        { sectionOrder: "asc" },
        { priority: "asc" },
      ],
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        priority: true,
        scriptTab: true,
        productCode: true,
        sectionOrder: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    logger.error("[GET /api/tools/playbook]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
