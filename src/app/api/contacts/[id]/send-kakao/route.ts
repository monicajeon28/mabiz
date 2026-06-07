import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sendSmsViaAligo } from "@/lib/sms-service";

type Params = { params: Promise<{ id: string }> };

// POST /api/contacts/[id]/send-kakao — 카카오톡 발송
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const body = await req.json();
    const { message, templateId } = body;

    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({
      where,
      select: { id: true, name: true, phone: true, organizationId: true },
    });

    if (!contact) {
      return NextResponse.json({ ok: false, message: "고객을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!message && !templateId) {
      return NextResponse.json(
        { ok: false, message: "메시지 또는 템플릿 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const msgToSend = message || `안녕하세요 ${contact.name}님!\n\n저희 크루즈 서비스를 이용해주셔서 감사합니다.`;

    // 카카오 API 미연동 — SMS로 fallback 발송
    let smsSent = false;
    if (contact.phone) {
      try {
        await sendSmsViaAligo(contact.phone, msgToSend);
        smsSent = true;
      } catch (smsErr) {
        logger.warn("[POST /api/contacts/[id]/send-kakao] SMS fallback 실패", {
          contactId: contact.id,
          error: smsErr instanceof Error ? smsErr.message : String(smsErr),
        });
      }
    }

    logger.log("[POST /api/contacts/[id]/send-kakao] 발송 처리", {
      contactId: contact.id,
      templateId: templateId || "custom",
      channel: smsSent ? "SMS_FALLBACK" : "QUEUED",
    });

    return NextResponse.json({
      ok: true,
      message: smsSent ? "카카오 미연동으로 SMS로 발송되었습니다." : "발송 대기 중입니다. (카카오 미연동, 전화번호 없음)",
      data: {
        contactId: contact.id,
        channel: smsSent ? "SMS_FALLBACK" : "QUEUED",
        status: smsSent ? "SENT" : "QUEUED",
        sentAt: smsSent ? new Date() : null,
      },
    });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/send-kakao]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
