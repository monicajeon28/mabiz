import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgId } from "@/lib/org";
import { logger } from "@/lib/logger";

// GET /api/settings/sms
export async function GET() {
  try {
    const orgId = await getOrgId();
    const config = await prisma.orgSmsConfig.findUnique({
      where: { organizationId: orgId },
      select: {
        id: true,
        aligoUserId: true,
        senderPhone: true,
        isActive: true,
        senderVerified: true,
        verifiedAt: true,
        reEngageMsg1: true,
        reEngageMsg2: true,
        updatedAt: true,
        aligoKey: false,
      },
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    logger.error("[GET /api/settings/sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/settings/sms — 재진입 메시지 등 부분 업데이트
export async function PATCH(req: Request) {
  try {
    const orgId = await getOrgId();
    const body  = await req.json() as { reEngageMsg1?: string | null; reEngageMsg2?: string | null };

    const existing = await prisma.orgSmsConfig.findUnique({ where: { organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ ok: false, message: "SMS 설정을 먼저 저장하세요." }, { status: 400 });
    }

    await prisma.orgSmsConfig.update({
      where: { organizationId: orgId },
      data: {
        ...(body.reEngageMsg1 !== undefined ? { reEngageMsg1: body.reEngageMsg1 } : {}),
        ...(body.reEngageMsg2 !== undefined ? { reEngageMsg2: body.reEngageMsg2 } : {}),
      },
    });

    logger.log("[PATCH /api/settings/sms] 재진입 메시지 저장", { orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[PATCH /api/settings/sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PUT /api/settings/sms — 저장/수정
export async function PUT(req: Request) {
  try {
    const orgId = await getOrgId();
    const { aligoKey, aligoUserId, senderPhone } = await req.json();

    if (!aligoKey || !aligoUserId || !senderPhone) {
      return NextResponse.json(
        { ok: false, message: "Aligo API Key, User ID, 발신번호는 필수입니다." },
        { status: 400 }
      );
    }

    const { verifySenderNumber } = await import("@/lib/aligo");
    const senderVerified = await verifySenderNumber({ key: aligoKey, userId: aligoUserId, sender: senderPhone });

    if (!senderVerified) {
      logger.log("[PUT /api/settings/sms] 발신번호 미인증 상태로 저장", { orgId });
    }

    const config = await prisma.orgSmsConfig.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, aligoKey, aligoUserId, senderPhone, senderVerified, verifiedAt: senderVerified ? new Date() : null },
      update: { aligoKey, aligoUserId, senderPhone, isActive: true, senderVerified, verifiedAt: senderVerified ? new Date() : null },
    });

    logger.log("[PUT /api/settings/sms] SMS 설정 저장", { orgId, senderVerified });
    return NextResponse.json({ ok: true, config: { id: config.id }, senderVerified });
  } catch (err) {
    logger.error("[PUT /api/settings/sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/settings/sms/test — 테스트 발송
export async function POST(req: Request) {
  try {
    const orgId = await getOrgId();
    const { testPhone } = await req.json();

    const config = await prisma.orgSmsConfig.findUnique({ where: { organizationId: orgId } });
    if (!config) {
      return NextResponse.json({ ok: false, message: "SMS 설정이 없습니다." }, { status: 400 });
    }

    const { sendSms } = await import("@/lib/aligo");
    const result = await sendSms({
      config: { key: config.aligoKey, userId: config.aligoUserId, sender: config.senderPhone },
      receiver: testPhone,
      msg: "[mabiz] SMS 설정 테스트 발송입니다.",
    });

    return NextResponse.json({ ok: result.result_code === 1, message: result.message });
  } catch (err) {
    logger.error("[POST /api/settings/sms test]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
