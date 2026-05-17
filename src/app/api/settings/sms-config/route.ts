import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

const SMS_KEY = "SMS_ENCRYPT_KEY";

async function getSession() {
  const session = await getMabizSession();
  if (!session || !session.userId || !session.organizationId) return null;
  return session;
}

// GET — 내 알리고 연결 상태 조회 (키는 마지막 4자리만 노출)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const config = await prisma.userSmsConfig.findUnique({
      where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } },
      select: {
        id: true,
        aligoUserId: true,
        senderPhone: true,
        senderVerified: true,
        verifiedAt: true,
        isActive: true,
        updatedAt: true,
        aligoKeyEncrypted: true,
      },
    });

    if (!config) return NextResponse.json({ ok: true, config: null });

    let keyTail = "****";
    try {
      const plain = decrypt(config.aligoKeyEncrypted, SMS_KEY);
      keyTail = plain.slice(-4);
    } catch (err) {
      logger.error("[GET /api/settings/sms-config] 키 복호화 실패", { err });
    }

    return NextResponse.json({
      ok: true,
      config: {
        id: config.id,
        aligoUserId: config.aligoUserId,
        senderPhone: config.senderPhone,
        senderVerified: config.senderVerified,
        verifiedAt: config.verifiedAt,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        aligoKeyTail: keyTail,
      },
    });
  } catch (err) {
    logger.error("[GET /api/settings/sms-config]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST — 알리고 계정 연결 저장 (암호화)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { aligoKey, aligoUserId, senderPhone } = await req.json() as {
      aligoKey: string;
      aligoUserId: string;
      senderPhone: string;
    };

    if (!aligoKey?.trim() || !aligoUserId?.trim() || !senderPhone?.trim()) {
      return NextResponse.json(
        { ok: false, message: "Aligo API Key, User ID, 발신번호는 필수입니다." },
        { status: 400 }
      );
    }

    const aligoKeyEncrypted = encrypt(aligoKey.trim(), SMS_KEY);

    const config = await prisma.userSmsConfig.upsert({
      where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } },
      create: {
        userId: session.userId,
        organizationId: session.organizationId,
        aligoKeyEncrypted,
        aligoUserId: aligoUserId.trim(),
        senderPhone: senderPhone.trim(),
      },
      update: {
        aligoKeyEncrypted,
        aligoUserId: aligoUserId.trim(),
        senderPhone: senderPhone.trim(),
        senderVerified: false,
        verifiedAt: null,
        isActive: true,
      },
    });

    logger.log("[POST /api/settings/sms-config] 알리고 개인 계정 저장", { userId: session.userId });
    return NextResponse.json({ ok: true, configId: config.id });
  } catch (err) {
    logger.error("[POST /api/settings/sms-config]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE — 연결 해제 (즉시 삭제)
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    await prisma.userSmsConfig.deleteMany({
      where: { userId: session.userId, organizationId: session.organizationId },
    });

    logger.log("[DELETE /api/settings/sms-config] 알리고 개인 계정 삭제", { userId: session.userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/settings/sms-config]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
