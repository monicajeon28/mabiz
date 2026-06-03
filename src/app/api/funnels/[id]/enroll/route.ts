import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sendByChannel, getOrgSmsConfig } from "@/lib/aligo";

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

    // 중복 등록 방지 + VipCareSequence + Log 생성 (원자적 트랜잭션)
    const sequence = await prisma.$transaction(async (tx) => {
      const existing = await tx.vipCareSequence.findFirst({
        where: { contactId, funnelId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (existing) {
        // 트랜잭션 내에서 중복 감지 시 특수 에러를 던져 롤백 유도
        const err = new Error('ALREADY_ENROLLED');
        (err as NodeJS.ErrnoException).code = 'ALREADY_ENROLLED';
        throw err;
      }

      return tx.vipCareSequence.create({
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
                channel:     stage.channel || "SMS",
                content,
              };
            }),
          },
        },
        include: { logs: true },
      });
    }).catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ALREADY_ENROLLED') return null;
      throw err;
    });

    if (sequence === null) {
      return NextResponse.json(
        { ok: false, message: '이미 이 퍼널에 등록된 고객입니다', alreadyEnrolled: true },
        { status: 409 }
      );
    }

    // 수동 즉시 발송 (sendNow=true)
    if (sendNow && funnel.stages.length > 0) {
      const smsConfig = await getOrgSmsConfig(orgId);
      const firstLog  = sequence.logs.find((l) => l.stageOrder === 0);
      const firstStage = funnel.stages[0];
      const ch = (firstStage.channel || "SMS") as "SMS" | "EMAIL" | "KAKAO";

      if (smsConfig?.isActive && firstLog?.content && !contact.optOutAt) {
        const updated = await prisma.vipCareLog.updateMany({
          where: { id: firstLog.id, status: "PENDING" },
          data:  { status: "SENDING" },
        });

        if (updated.count > 0) {
          const result = await sendByChannel({
            channel: ch,
            smsConfig: {
              key:    smsConfig.aligoKey,
              userId: smsConfig.aligoUserId,
              sender: smsConfig.senderPhone,
            },
            receiver:       contact.phone,
            email:          contact.email,
            msg:            firstLog.content,
            linkUrl:        firstStage.linkUrl,
            organizationId: orgId,
            contactId,
          });

          const code = Number(result.result_code);
          await prisma.vipCareLog.update({
            where: { id: firstLog.id },
            data: {
              status: code === 1 ? "SENT" : code === -98 ? "NIGHT_BLOCKED" : "FAILED",
              sentAt: new Date(),
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
