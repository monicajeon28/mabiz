import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/tools/playbook?scriptTab=GENERAL&productCode=ALL&type=OBJECTION
export async function GET(req: Request) {
  try {
    await getAuthContext();
    const { searchParams } = new URL(req.url);
    const type        = searchParams.get("type");
    const scriptTab   = searchParams.get("scriptTab")   ?? "GENERAL";
    const productCode = searchParams.get("productCode") ?? "ALL";

    const items = await prisma.salesPlaybook.findMany({
      where: {
        isActive: true,
        scriptTab,
        productCode: { in: [productCode, "ALL"] },
        ...(type ? { type } : {}),
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
