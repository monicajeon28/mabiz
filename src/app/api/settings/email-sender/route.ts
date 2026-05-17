import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// PATCH /api/settings/email-sender — 멤버별 이메일 발신자 이름 저장
export async function PATCH(req: Request) {
  try {
    const session = await getMabizSession();
    if (!session?.userId || !session.organizationId) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { senderName } = await req.json() as { senderName: string };

    if (typeof senderName !== "string" || senderName.trim().length > 100) {
      return NextResponse.json(
        { ok: false, message: "발신자 이름은 100자 이하여야 합니다." },
        { status: 400 }
      );
    }

    await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: session.organizationId,
          userId: session.userId,
        },
      },
      data: { emailSenderName: senderName?.trim() || null },
    });

    logger.log("[PATCH /api/settings/email-sender] 발신자 이름 저장", { userId: session.userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[PATCH /api/settings/email-sender]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
