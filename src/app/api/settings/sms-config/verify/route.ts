import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

async function getSession() {
  const session = await getMabizSession();
  if (!session || !session.userId || !session.organizationId) return null;
  return session as typeof session & { organizationId: string };
}

// POST — Aligo 콘솔 ARS 인증 안내
export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const config = await prisma.userSmsConfig.findUnique({
      where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } },
      select: { senderPhone: true },
    });

    if (!config) {
      return NextResponse.json(
        { ok: false, message: "먼저 알리고 계정을 연결하세요." },
        { status: 400 }
      );
    }

    logger.log("[sms-config/verify POST] 콘솔 인증 안내", {
      userId: session.userId,
      phone: config.senderPhone.substring(0, 4) + "***",
    });

    return NextResponse.json({
      ok: true,
      message:
        "Aligo 콘솔(https://smartsms.aligo.in)에서 발신번호 ARS 인증을 완료한 후 아래 버튼을 눌러주세요.",
    });
  } catch (err) {
    logger.error("[sms-config/verify POST]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PUT — 인증 완료 확인 처리
export async function PUT() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const config = await prisma.userSmsConfig.findUnique({
      where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } },
      select: { senderPhone: true },
    });

    if (!config) {
      return NextResponse.json(
        { ok: false, message: "먼저 알리고 계정을 연결하세요." },
        { status: 400 }
      );
    }

    await prisma.userSmsConfig.update({
      where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } },
      data: { senderVerified: true, verifiedAt: new Date() },
    });

    logger.log("[sms-config/verify PUT] 인증 완료", { userId: session.userId });
    return NextResponse.json({ ok: true, message: "발신번호 인증이 완료됐습니다!" });
  } catch (err) {
    logger.error("[sms-config/verify PUT]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
