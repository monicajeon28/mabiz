import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

type StageInput = {
  id?:             string;   // 기존 스테이지 ID (없으면 신규 생성)
  order:           number;
  name:            string;
  triggerType:     string;   // DAYS_AFTER | DDAY
  triggerOffset:   number;
  channel:         string;   // SMS
  messageContent:  string | null;
  linkUrl?:        string | null;
};

// PUT /api/funnels/[id]/stages — 스테이지 전체 덮어쓰기 (upsert)
export async function PUT(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: funnelId } = await params;

    // 소유권 검증
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, organizationId: orgId },
      select: { id: true },
    });
    if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });

    const { stages } = await req.json() as { stages: StageInput[] };

    if (!Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ ok: false, message: "스테이지가 없습니다." }, { status: 400 });
    }

    // 트랜잭션: 기존 스테이지 삭제 → 새로 생성 (순서 보장)
    const updated = await prisma.$transaction(async (tx) => {
      await tx.funnelStage.deleteMany({ where: { funnelId } });

      await tx.funnelStage.createMany({
        data: stages.map((s, i) => ({
          funnelId,
          order:          s.order ?? i,
          name:           s.name.trim() || `스테이지 ${i + 1}`,
          triggerType:    s.triggerType   || "DAYS_AFTER",
          triggerOffset:  s.triggerOffset ?? i,
          channel:        s.channel       || "SMS",
          messageContent: s.messageContent?.trim() || null,
          linkUrl:        s.linkUrl?.trim()         || null,
        })),
      });

      return tx.funnel.findFirst({
        where: { id: funnelId },
        include: { stages: { orderBy: { order: "asc" } } },
      });
    });

    logger.log("[PUT /api/funnels/[id]/stages]", {
      funnelId, stageCount: stages.length, orgId,
    });

    return NextResponse.json({ ok: true, funnel: updated });
  } catch (err) {
    logger.error("[PUT /api/funnels/[id]/stages]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
