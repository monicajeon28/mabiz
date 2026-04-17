import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";

type Params = { params: Promise<{ id: string }> };

// POST /api/funnels/[id]/enroll — 고객을 퍼널에 등록 + 수동 발송 가능
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: funnelId } = await params;

    const body = await req.json();
    const { contactId, startDate, sendNow = false } = body;

    if (!contactId) {
      return NextResponse.json({ ok: false, message: "contactId 필수" }, { status: 400 });
    }

    // 퍼널 + 스테이지 조회
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, organizationId: orgId },
      include: { stages: { orderBy: { order: "asc" } } },
    });
    if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });

    // 고객 조회
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
    });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const baseDate = startDate ? new Date(startDate) : new Date();

    // 중복 등록 방지
    const existing = await prisma.vipCareSequence.findFirst({
      where: { contactId, funnelId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, message: '이미 이 퍼널에 등록된 고객입니다', alreadyEnrolled: true },
        { status: 409 }
      );
    }

    // VipCareSequence + Log 생성
    const sequence = await prisma.vipCareSequence.create({
      data: {
        contactId,
        funnelId,
        startDate: baseDate,
        status:    "ACTIVE",
        logs: {
          create: funnel.stages.map((stage) => {
            const scheduledAt = new Date(baseDate);
            if (stage.triggerType === "DDAY") {
              scheduledAt.setUTCDate(scheduledAt.getUTCDate() + stage.triggerOffset);
            } else {
              scheduledAt.setUTCDate(scheduledAt.getUTCDate() + stage.triggerOffset);
            }
            scheduledAt.setUTCHours(10, 0, 0, 0); // 오전 10시 발송

            const content = stage.messageContent
              ? stage.messageContent
                  .replace(/\[고객명\]/g, contact.name)
                  .replace(/\[이름\]/g, contact.name)
              : null;

            return {
              stageOrder:  stage.order,
              scheduledAt,
              status:      "PENDING",
              content,
            };
          }),
        },
      },
      include: { logs: true },
    });

    // 수동 즉시 발송 (sendNow=true)
    if (sendNow && funnel.stages.length > 0) {
      const smsConfig = await getOrgSmsConfig(orgId);
      const firstLog  = sequence.logs.find((l) => l.stageOrder === 0);
      const firstStage = funnel.stages[0];

      if (smsConfig?.isActive && firstLog?.content && !contact.optOutAt) {
        const updated = await prisma.vipCareLog.updateMany({
          where: { id: firstLog.id, status: "PENDING" },
          data:  { status: "SENDING" },
        });

        if (updated.count > 0) {
          const result = await sendSms({
            config: {
              key:    smsConfig.aligoKey,
              userId: smsConfig.aligoUserId,
              sender: smsConfig.senderPhone,
            },
            receiver: contact.phone,
            msg:      firstLog.content,
            msgType:  firstLog.content.length > 90 ? "LMS" : "SMS",
          });

          await prisma.vipCareLog.update({
            where: { id: firstLog.id },
            data: {
              status:  result.result_code === 1 ? "SENT" : "FAILED",
              sentAt:  new Date(),
            },
          });
        }
      }
    }

    logger.log("[POST /api/funnels/enroll] 등록 완료", {
      contactId, funnelId, logsCount: sequence.logs.length,
    });

    return NextResponse.json({ ok: true, sequence }, { status: 201 });
  } catch (err) {
    logger.error("[POST /api/funnels/[id]/enroll]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
