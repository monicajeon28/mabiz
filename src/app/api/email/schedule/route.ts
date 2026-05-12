import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sendFunnelEmail } from "@/lib/email";

// POST /api/email/schedule — 이메일 예약 등록 (또는 즉시 발송)
// GET  /api/email/schedule — 예약 목록 조회
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const body = await req.json() as {
      contactId?:  string;
      groupId?:    string;
      subject:     string;
      content:     string;        // HTML 또는 plain text
      scheduledAt: string;        // ISO8601 (null이면 즉시 발송)
      sendNow?:    boolean;
    };

    const { contactId, groupId, subject, content, scheduledAt, sendNow = false } = body;

    if (!subject?.trim())  return NextResponse.json({ ok: false, message: "제목 필수" }, { status: 400 });
    if (!content?.trim())  return NextResponse.json({ ok: false, message: "내용 필수" }, { status: 400 });
    if (!contactId && !groupId) return NextResponse.json({ ok: false, message: "contactId 또는 groupId 필수" }, { status: 400 });

    const html = content.includes("<") ? content
      : `<div style="font-family:sans-serif;line-height:1.8;white-space:pre-wrap">${content}</div>`;

    // ── 즉시 발송 ───────────────────────────────────────────────
    if (sendNow) {
      const recipients: { id: string; name: string; email: string | null }[] = [];

      if (contactId) {
        const c = await prisma.contact.findFirst({
          where: { id: contactId, organizationId: orgId },
          select: { id: true, name: true, email: true },
        });
        if (c) recipients.push(c);
      } else if (groupId) {
        const members = await prisma.contactGroupMember.findMany({
          where: {
            groupId,
            contact: { organizationId: orgId, deletedAt: null },
          },
          include: { contact: { select: { id: true, name: true, email: true } } },
          take: 200,
        });
        recipients.push(...members.map((m) => m.contact));
      }

      let sentCount = 0; let failedCount = 0;
      for (const r of recipients) {
        if (!r.email) { failedCount++; continue; }
        const personalHtml = html
          .replace(/\[고객명\]/g, r.name)
          .replace(/\[이름\]/g,   r.name);
        const result = await sendFunnelEmail({
          organizationId: orgId,
          contactId: r.id,
          to: r.email,
          subject: subject.replace(/\[고객명\]/g, r.name).replace(/\[이름\]/g, r.name),
          html: personalHtml,
          channel: "MANUAL",
        });
        result.result_code === 1 ? sentCount++ : failedCount++;
      }

      logger.log("[POST /api/email/schedule] 즉시 발송 완료", { orgId, sentCount, failedCount });
      return NextResponse.json({ ok: true, sentNow: true, sentCount, failedCount });
    }

    // ── 예약 등록 ────────────────────────────────────────────────
    const schedAt = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 60000);
    if (isNaN(schedAt.getTime())) {
      return NextResponse.json({ ok: false, message: "scheduledAt 형식 오류" }, { status: 400 });
    }

    const scheduled = await prisma.scheduledEmail.create({
      data: {
        organizationId:  orgId,
        contactId:       contactId ?? null,
        groupId:         groupId   ?? null,
        subject,
        content:         html,
        scheduledAt:     schedAt,
        status:          "PENDING",
        createdByUserId: ctx.userId ?? null,
      },
    });

    logger.log("[POST /api/email/schedule] 예약 등록", { orgId, id: scheduled.id, scheduledAt: schedAt });
    return NextResponse.json({ ok: true, scheduled }, { status: 201 });
  } catch (err) {
    logger.error("[POST /api/email/schedule]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "PENDING";

    const list = await prisma.scheduledEmail.findMany({
      where:   { organizationId: orgId, status },
      orderBy: { scheduledAt: "asc" },
      take:    100,
    });

    return NextResponse.json({ ok: true, list });
  } catch (err) {
    logger.error("[GET /api/email/schedule]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/email/schedule?id=xxx — 예약 취소
export async function DELETE(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id 필수" }, { status: 400 });

    const updated = await prisma.scheduledEmail.updateMany({
      where: { id, organizationId: orgId, status: "PENDING" },
      data:  { status: "CANCELLED" },
    });

    return NextResponse.json({ ok: updated.count > 0 });
  } catch (err) {
    logger.error("[DELETE /api/email/schedule]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
