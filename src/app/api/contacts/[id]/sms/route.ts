import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// POST /api/contacts/[id]/sms — 개별 고객 수동 SMS 발송
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx     = await getAuthContext();
    const orgId   = requireOrgId(ctx);
    const { id: contactId } = await params;

    // 소유권 검증 (IDOR 방지)
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true, name: true, phone: true, optOutAt: true },
    });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 수신거부 체크
    if (contact.optOutAt) {
      return NextResponse.json(
        { ok: false, message: "수신거부 고객에게는 발송할 수 없습니다." },
        { status: 400 }
      );
    }

    const { message } = await req.json() as { message?: string };
    if (!message?.trim()) {
      return NextResponse.json({ ok: false, message: "메시지를 입력하세요." }, { status: 400 });
    }

    const smsConfig = await getOrgSmsConfig(orgId);
    if (!smsConfig) {
      return NextResponse.json(
        { ok: false, message: "SMS 설정이 없습니다. 설정 → SMS에서 Aligo 정보를 입력하세요." },
        { status: 400 }
      );
    }

    // [고객명] / [이름] 치환
    const personalizedMsg = message
      .replace(/\[고객명\]/g, contact.name)
      .replace(/\[이름\]/g,   contact.name);

    const result = await sendSms({
      config:         { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
      receiver:       contact.phone,
      msg:            personalizedMsg,
      organizationId: orgId,
      contactId:      contact.id,
      channel:        "MANUAL",
    });

    const resultCode = Number(result.result_code);
    const ok = resultCode === 1;

    logger.log("[POST /api/contacts/[id]/sms]", {
      contactId,
      phone: contact.phone.substring(0, 4) + "***",
      resultCode,
    });

    if (!ok) {
      return NextResponse.json(
        { ok: false, message: result.message ?? "발송 실패" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
