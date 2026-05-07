export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgId } from "@/lib/org";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { addLeadScore } from "@/lib/lead-score";
import { getAuthContext } from "@/lib/rbac";
import { backupCallLogsToGoogleDrive } from "@/lib/google-drive";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/call-logs
export async function GET(_req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const logs = await prisma.callLog.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    logger.error("[GET call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/contacts/[id]/call-logs?logId=xxx  (단건)
// DELETE /api/contacts/[id]/call-logs             (전체)
export async function DELETE(req: Request, { params }: Params) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("logId");

    const contact = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    if (logId) {
      await prisma.callLog.deleteMany({ where: { id: logId, contactId: id } });
    } else {
      await prisma.callLog.deleteMany({ where: { contactId: id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/contacts/[id]/call-logs
export async function POST(req: Request, { params }: Params) {
  try {
    const orgId    = await getOrgId();
    const ctx      = await getAuthContext();
    const session  = await getMabizSession();
    const { id }   = await params;
    const body     = await req.json();

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, name: true, phone: true },
    });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const { content, result, duration, convictionScore, nextAction, scheduledAt } = body;

    const log = await prisma.callLog.create({
      data: {
        contactId: id,
        userId: ctx.userId,
        content,
        result,
        duration:        duration        ? parseInt(duration)        : null,
        convictionScore: convictionScore ? parseInt(convictionScore) : null,
        nextAction,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    // 마지막 연락일 업데이트
    await prisma.contact.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });

    // 리드 스코어 (fire-and-forget)
    const scoreMap: Record<string, "CALL_INTERESTED" | "CALL_RESCHEDULED" | "CALL_PENDING" | "CALL_REJECTED"> = {
      INTERESTED:  "CALL_INTERESTED",
      RESCHEDULED: "CALL_RESCHEDULED",
      PENDING:     "CALL_PENDING",
      REJECTED:    "CALL_REJECTED",
    };
    if (result && scoreMap[result]) {
      addLeadScore(id, scoreMap[result]).catch(() => {});
    }

    // ★ Google Drive 자동 백업 (fire-and-forget — 실패해도 응답에 영향 없음)
    if (session && process.env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID) {
      // GLOBAL_ADMIN은 "admin" prefix + GA displayName, 일반 멤버는 memberId + displayName
      let userId: string;
      let displayName: string;
      if (ctx.role === 'GLOBAL_ADMIN') {
        userId = 'admin';
        const ga = await prisma.globalAdmin.findUnique({
          where: { id: ctx.userId },
          select: { displayName: true },
        });
        displayName = ga?.displayName ?? 'admin';
      } else {
        userId = ctx.userId;
        displayName = ctx.member?.displayName ?? userId;
      }

      // 전체 콜 기록 (새로 저장된 것 포함) 가져와서 백업
      prisma.callLog.findMany({
        where:   { contactId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, result: true, convictionScore: true, content: true, nextAction: true },
      }).then(allLogs => {
        return backupCallLogsToGoogleDrive({
          userId,
          displayName,
          customerName:  contact.name,
          customerPhone: contact.phone,
          callLogs: allLogs,
        });
      }).then(({ fileId }) => {
        logger.log('[CallLog] Drive 자동 백업 완료', { contactId: id, fileId });
      }).catch(err => {
        logger.error('[CallLog] Drive 자동 백업 실패 (무시)', { err });
      });
    }

    return NextResponse.json({ ok: true, log }, { status: 201 });
  } catch (err) {
    logger.error("[POST call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
