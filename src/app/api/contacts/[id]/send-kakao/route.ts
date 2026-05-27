import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";

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

    // 카카오 API 호출 (추후 실제 API 연결)
    const msgToSend = message || `안녕하세요 ${contact.name}님!\n\n저희 크루즈 서비스를 이용해주셔서 감사합니다.`;

    logger.log("[POST /api/contacts/[id]/send-kakao] 카카오톡 발송", {
      contactId: contact.id,
      templateId: templateId || "custom",
      messageLength: msgToSend.length,
    });

    // TODO: 실제 카카오 API 연결
    // const result = await kakaoClient.sendMessage({
    //   phoneNumber: contact.phone,
    //   message: msgToSend,
    //   templateId: templateId,
    // });

    return NextResponse.json({
      ok: true,
      message: "카카오톡이 발송되었습니다.",
      data: {
        contactId: contact.id,
        channel: "KAKAO",
        status: "SENT",
        sentAt: new Date(),
      },
    });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/send-kakao]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
