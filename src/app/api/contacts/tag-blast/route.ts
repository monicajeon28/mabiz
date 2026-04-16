import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";
import { logger } from "@/lib/logger";

const MAX_RECIPIENTS = 200;
const BATCH_SIZE     = 10;

/**
 * POST /api/contacts/tag-blast
 * 특정 태그를 가진 고객 전체에게 SMS 일괄 발송
 *
 * body: { tags: string[]; message: string; dryRun?: boolean }
 */
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { tags, message, dryRun = false } = await req.json() as {
      tags?: string[];
      message?: string;
      dryRun?: boolean;
    };

    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ ok: false, message: "태그를 1개 이상 선택하세요." }, { status: 400 });
    }
    if (!message?.trim()) {
      return NextResponse.json({ ok: false, message: "메시지를 입력하세요." }, { status: 400 });
    }

    // 태그 조건 고객 조회 (수신거부 제외)
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: orgId,
        tags:   { hasEvery: tags },
        optOutAt: null,
        phone:  { not: "" },
      },
      select: { id: true, name: true, phone: true },
      take: MAX_RECIPIENTS + 1,
    });

    const isOverLimit = contacts.length > MAX_RECIPIENTS;
    const targets     = contacts.slice(0, MAX_RECIPIENTS);

    logger.log("[TagBlast] 대상 파악", { tags, total: contacts.length, dryRun });

    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true,
        tags, willSend: targets.length, isOverLimit,
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
            organizationId: orgId, contactId: c.id, channel: "MANUAL",
          });

          if (Number(result.result_code) === 1) sentCount++;
          else failedCount++;
        })
      );
    }

    logger.log("[TagBlast] 발송 완료", { tags, sentCount, failedCount });

    return NextResponse.json({ ok: true, tags, sentCount, failedCount, total: targets.length });
  } catch (err) {
    logger.error("[TagBlast]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
