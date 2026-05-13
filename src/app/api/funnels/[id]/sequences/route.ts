import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgIdOrNull, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/funnels/[id]/sequences — 퍼널 등록 고객 목록
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { id: funnelId } = await params;

    // 퍼널 소유권 확인
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true },
    });
    if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });

    const sequences = await prisma.vipCareSequence.findMany({
      where: { funnelId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        _count: { select: { logs: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      sequences: sequences.map((s) => ({
        id: s.id,
        contactName: s.contact.name,
        contactPhone: s.contact.phone.slice(0, 4) + "****",
        status: s.status,
        currentStage: s.currentStage,
        startDate: s.startDate.toISOString(),
        pausedAt: s.pausedAt?.toISOString() ?? null,
        logCount: s._count.logs,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false }, { status: 401 });
    logger.error("[GET /api/funnels/[id]/sequences]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * PATCH /api/funnels/[id]/sequences — 퍼널 시퀀스 일시정지/재개/취소
 * Body: { sequenceId, action: "pause" | "resume" | "cancel" }
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id: funnelId } = await params;
    const body = await req.json() as { sequenceId: string; action: "pause" | "resume" | "cancel" };

    if (!body.sequenceId || !body.action) {
      return NextResponse.json({ ok: false, message: "sequenceId와 action 필수" }, { status: 400 });
    }

    // 퍼널 소유권 확인
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, organizationId: orgId },
      select: { id: true },
    });
    if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });

    const seq = await prisma.vipCareSequence.findFirst({
      where: { id: body.sequenceId, funnelId },
    });
    if (!seq) return NextResponse.json({ ok: false, message: "시퀀스를 찾을 수 없습니다" }, { status: 404 });

    if (body.action === "pause") {
      if (seq.status !== "ACTIVE") {
        return NextResponse.json({ ok: false, message: "ACTIVE 상태만 일시정지할 수 있습니다" }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.vipCareSequence.update({
          where: { id: body.sequenceId },
          data: { status: "PAUSED", pausedAt: new Date(), pausedBy: ctx.userId },
        }),
        // PENDING 상태의 미발송 로그도 일시정지
        prisma.vipCareLog.updateMany({
          where: { sequenceId: body.sequenceId, status: "PENDING" },
          data: { status: "PAUSED" },
        }),
      ]);
      logger.log("[PATCH sequences] pause", { sequenceId: body.sequenceId, funnelId });
    }

    if (body.action === "resume") {
      if (seq.status !== "PAUSED") {
        return NextResponse.json({ ok: false, message: "일시정지 상태만 재개할 수 있습니다" }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.vipCareSequence.update({
          where: { id: body.sequenceId },
          data: { status: "ACTIVE", pausedAt: null, pausedBy: null },
        }),
        // PAUSED 로그를 다시 PENDING으로
        prisma.vipCareLog.updateMany({
          where: { sequenceId: body.sequenceId, status: "PAUSED" },
          data: { status: "PENDING" },
        }),
      ]);
      logger.log("[PATCH sequences] resume", { sequenceId: body.sequenceId, funnelId });
    }

    if (body.action === "cancel") {
      if (seq.status === "CANCELLED") {
        return NextResponse.json({ ok: false, message: "이미 취소된 시퀀스입니다" }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.vipCareSequence.update({
          where: { id: body.sequenceId },
          data: { status: "CANCELLED" },
        }),
        // 미발송 로그 전부 취소
        prisma.vipCareLog.updateMany({
          where: { sequenceId: body.sequenceId, status: { in: ["PENDING", "PAUSED", "NIGHT_BLOCKED"] } },
          data: { status: "CANCELLED" },
        }),
      ]);
      logger.log("[PATCH sequences] cancel", { sequenceId: body.sequenceId, funnelId });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false }, { status: 401 });
    logger.error("[PATCH /api/funnels/[id]/sequences]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
