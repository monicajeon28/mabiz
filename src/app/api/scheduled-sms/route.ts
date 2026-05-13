import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/scheduled-sms?status=PENDING
export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;

    const list = await prisma.scheduledSms.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      select: {
        id: true, contactId: true, groupId: true,
        message: true, scheduledAt: true, status: true,
        sentAt: true, sentCount: true, failedCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, list });
  } catch (err) {
    logger.error("[GET /api/scheduled-sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/scheduled-sms — 예약 등록
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await req.json() as {
      contactId?: string;
      groupId?:   string;
      message?:   string;
      scheduledAt?: string;
    };

    const { contactId, groupId, message, scheduledAt } = body;

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, message: "메시지를 입력하세요." }, { status: 400 });
    }
    if (!scheduledAt) {
      return NextResponse.json({ ok: false, message: "발송 예정 시각을 입력하세요." }, { status: 400 });
    }
    if (!contactId && !groupId) {
      return NextResponse.json({ ok: false, message: "수신자(고객 또는 그룹)를 선택하세요." }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ ok: false, message: "과거 시간으로는 예약할 수 없습니다." }, { status: 400 });
    }

    // 소유권 검증
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, organizationId: orgId },
        select: { id: true },
      });
      if (!contact) return NextResponse.json({ ok: false }, { status: 404 });
    }
    if (groupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: groupId, organizationId: orgId },
        select: { id: true },
      });
      if (!group) return NextResponse.json({ ok: false }, { status: 404 });
    }

    const scheduled = await prisma.scheduledSms.create({
      data: {
        organizationId: orgId,
        contactId:      contactId ?? null,
        groupId:        groupId   ?? null,
        message:        message.trim(),
        scheduledAt:    scheduledDate,
        status:         "PENDING",
      },
      select: { id: true, scheduledAt: true, status: true },
    });

    logger.log("[POST /api/scheduled-sms]", { id: scheduled.id, orgId, scheduledAt });

    return NextResponse.json({ ok: true, scheduled });
  } catch (err) {
    logger.error("[POST /api/scheduled-sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/scheduled-sms — 일시정지(pause) / 재개(resume) / 재발송(retry)
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const body = await req.json() as { id: string; action: "pause" | "resume" | "retry" };

    if (!body.id || !body.action) {
      return NextResponse.json({ ok: false, message: "id와 action(pause/resume/retry)은 필수입니다" }, { status: 400 });
    }

    const item = await prisma.scheduledSms.findFirst({
      where: { id: body.id, organizationId: orgId },
    });
    if (!item) return NextResponse.json({ ok: false, message: "예약 메시지를 찾을 수 없습니다" }, { status: 404 });

    if (body.action === "pause") {
      if (item.status !== "PENDING" && item.status !== "NIGHT_BLOCKED") {
        return NextResponse.json({ ok: false, message: `${item.status} 상태는 일시정지할 수 없습니다 (PENDING/NIGHT_BLOCKED만 가능)` }, { status: 400 });
      }
      await prisma.scheduledSms.update({
        where: { id: body.id },
        data: { status: "PAUSED", pausedAt: new Date(), pausedBy: ctx.userId },
      });
      logger.log("[PATCH /api/scheduled-sms] pause", { id: body.id, orgId });
    }

    if (body.action === "resume") {
      if (item.status !== "PAUSED") {
        return NextResponse.json({ ok: false, message: "일시정지 상태만 재개할 수 있습니다" }, { status: 400 });
      }
      await prisma.scheduledSms.update({
        where: { id: body.id },
        data: { status: "PENDING", pausedAt: null, pausedBy: null },
      });
      logger.log("[PATCH /api/scheduled-sms] resume", { id: body.id, orgId });
    }

    if (body.action === "retry") {
      if (item.status !== "FAILED") {
        return NextResponse.json({ ok: false, message: "실패한 메시지만 재발송할 수 있습니다" }, { status: 400 });
      }
      await prisma.scheduledSms.update({
        where: { id: body.id },
        data: { status: "PENDING", scheduledAt: new Date(), failureReason: null },
      });
      logger.log("[PATCH /api/scheduled-sms] retry", { id: body.id, orgId });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false }, { status: 401 });
    logger.error("[PATCH /api/scheduled-sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/scheduled-sms?id=xxx — 예약 취소
export async function DELETE(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false }, { status: 400 });

    const item = await prisma.scheduledSms.findFirst({
      where: { id, organizationId: orgId, status: { in: ["PENDING", "PAUSED", "NIGHT_BLOCKED"] } },
    });
    if (!item) return NextResponse.json({ ok: false, message: "취소 가능한 예약 메시지를 찾을 수 없습니다 (PENDING/PAUSED/NIGHT_BLOCKED만 취소 가능)" }, { status: 404 });

    await prisma.scheduledSms.update({
      where: { id },
      data:  { status: "CANCELLED" },
    });

    logger.log("[DELETE /api/scheduled-sms]", { id, orgId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/scheduled-sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
