import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { sendFunnelEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// POST /api/contacts/[id]/send-email — 이메일 발송
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const body = await req.json();
    const { subject, htmlContent, templateId } = body;

    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({
      where,
      select: { id: true, name: true, email: true, organizationId: true },
    });

    if (!contact || !contact.email) {
      return NextResponse.json(
        { ok: false, message: "이메일 주소가 없습니다." },
        { status: 404 }
      );
    }

    if (!subject && !templateId) {
      return NextResponse.json(
        { ok: false, message: "제목 또는 템플릿 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const emailSubject = subject || "마비즈 크루즈 - 특별한 소식";
    const emailBody =
      htmlContent ||
      `<h1>안녕하세요 ${contact.name}님!</h1>
       <p>저희 크루즈 서비스를 이용해주셔서 감사합니다.</p>
       <p>더 많은 정보는 <a href="https://crm.mabiz.dev">여기</a>를 방문해주세요.</p>`;

    logger.log("[POST /api/contacts/[id]/send-email] 이메일 발송 시작", {
      contactId: contact.id,
      templateId: templateId || "custom",
    });

    const result = await sendFunnelEmail({
      organizationId: contact.organizationId,
      contactId: contact.id,
      to: contact.email,
      subject: emailSubject,
      html: emailBody,
      channel: "MANUAL_EMAIL",
    });

    if (result.result_code !== 1) {
      const status = result.result_code === -97 ? 503 : 502;
      return NextResponse.json(
        { ok: false, message: result.message },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "이메일이 발송되었습니다.",
      data: {
        contactId: contact.id,
        email: contact.email,
        channel: "MANUAL_EMAIL",
        status: "SENT",
        sentAt: new Date(),
      },
    });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/send-email]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
