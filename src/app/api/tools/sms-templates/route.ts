import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/tools/sms-templates?category=CARE_VIP
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const templates = await prisma.smsTemplate.findMany({
      where: {
        OR: [
          { isSystem: true },                                          // 시스템 공통
          { organizationId: ctx.organizationId ?? undefined },         // 조직 전용
        ],
        ...(category ? { category } : {}),
      },
      orderBy: [{ isSystem: "desc" }, { triggerOffset: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, category: true, title: true, content: true,
        triggerType: true, triggerOffset: true, isSystem: true, usageCount: true,
      },
    });

    return NextResponse.json({ ok: true, templates });
  } catch (err) {
    logger.error("[GET /api/tools/sms-templates]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
