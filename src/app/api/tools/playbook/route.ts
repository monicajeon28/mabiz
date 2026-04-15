import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/tools/playbook?type=REJECTION
export async function GET(req: Request) {
  try {
    await getAuthContext();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const items = await prisma.salesPlaybook.findMany({
      where: {
        isActive: true,
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: "asc" }, { priority: "asc" }],
      select: { id: true, type: true, title: true, content: true, priority: true },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    logger.error("[GET /api/tools/playbook]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
