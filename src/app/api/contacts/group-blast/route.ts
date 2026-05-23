import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, requireOrgId } from "@/lib/rbac";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";
import { logger } from "@/lib/logger";

const MAX_RECIPIENTS = 200;
const BATCH_SIZE     = 10;

/**
 * POST /api/contacts/group-blast
 * 특정 그룹의 고객 전체에게 SMS 일괄 발송
 *
 * body: { groupId: string; message: string; dryRun?: boolean }
 */
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { groupId, message, dryRun = false } = await req.json() as {
      groupId?: string;
      message?: string;
      dryRun?: boolean;
    };

    if (!groupId?.trim()) {
      return NextResponse.json({ ok: false, message: "그룹을 선택하세요." }, { status: 400 });
    }
    if (!message?.trim()) {
      return NextResponse.json({ ok: false, message: "메시지를 입력하세요." }, { status: 400 });
    }

    // 그룹 소유권 확인
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true },
    });
    if (!group) {
      return NextResponse.json({ ok: false, message: "그룹을 찾을 수 없습니다." }, { status: 404 });
    }

    // 그룹 고객 조회 (수신거부 제외, 소프트 삭제 제외)
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: orgId,
        deletedAt:      null,
        groups:         { some: { groupId } },
        optOutAt:       null,
        phone:          { not: "" },
      },
      select: { id: true, name: true, phone: true },
      take: MAX_RECIPIENTS + 1,
    });

    const isOverLimit = contacts.length > MAX_RECIPIENTS;
    const targets     = contacts.slice(0, MAX_RECIPIENTS);

    logger.log("[GroupBlast] 대상 파악", { groupId, groupName: group.name, total: contacts.length, dryRun });

    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true,
        groupId, groupName: group.name,
        willSend: targets.length, isOverLimit,
        overLimitMsg: isOverLimit
          ? `200명 제한 초과 — 첫 ${MAX_RECIPIENTS}명에게만 발송됩니다.`
          : null,
      });
    }

    const smsConfig = await getOrgSmsConfig(orgId);
    if (!smsConfig) {
      return NextResponse.json(
        { ok: false, message: "SMS 설정이 없습니다. 설정 → SMS에서 Aligo 정보를 입력하세요." },
        { status: 400 }
      );
    }

    const config = { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone };
    let sentCount = 0, failedCount = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (c) => {
          const msg = message
            .replace(/\[고객명\]/g, c.name)
            .replace(/\[이름\]/g,   c.name);

          const result = await sendSms({
            config, receiver: c.phone, msg,
            organizationId: orgId, contactId: c.id, channel: "GROUP",
          });

          if (Number(result.result_code) === 1) sentCount++;
          else failedCount++;
        })
      );
    }

    logger.log("[GroupBlast] 발송 완료", { groupId, groupName: group.name, sentCount, failedCount });

    return NextResponse.json({ ok: true, groupId, groupName: group.name, sentCount, failedCount, total: targets.length });
  } catch (err) {
    logger.error("[GroupBlast]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
