import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/funnels
export async function GET() {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const funnels = await prisma.funnel.findMany({
      where: { organizationId: orgId },
      include: { stages: { orderBy: { order: "asc" } }, _count: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, funnels });
  } catch (err) {
    logger.error("[GET /api/funnels]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/funnels
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { name, description, stages } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, message: "퍼널 이름은 필수입니다." }, { status: 400 });
    }

    const funnel = await prisma.funnel.create({
      data: {
        organizationId: orgId,
        name,
        description: description ?? null,
        stages: stages?.length
          ? {
              create: stages.map((s: {
                order: number; name: string; triggerType?: string;
                triggerOffset?: number; channel?: string; messageContent?: string;
              }, i: number) => ({
                order:          s.order ?? i,
                name:           s.name,
                triggerType:    s.triggerType    ?? "DAYS_AFTER",
                triggerOffset:  s.triggerOffset  ?? i,
                channel:        s.channel        ?? "SMS",
                messageContent: s.messageContent ?? null,
              })),
            }
          : undefined,
      },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ ok: true, funnel }, { status: 201 });
  } catch (err) {
    logger.error("[POST /api/funnels]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
