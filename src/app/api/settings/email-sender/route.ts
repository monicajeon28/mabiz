import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/settings/email-sender
 * 이메일 발신자 이름(senderName)만 업데이트
 */
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body: { senderName?: string } = await req.json();
    const senderName = (body.senderName ?? "").trim();
    if (!senderName) {
      return NextResponse.json({ ok: false, error: "senderName은 필수입니다." }, { status: 400 });
    }

    await prisma.orgEmailConfig.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        senderName,
        senderEmail: "",
        smtpHost: "",
        smtpUser: "",
        smtpPassEncrypted: "",
      },
      update: { senderName },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[settings/email-sender] 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
