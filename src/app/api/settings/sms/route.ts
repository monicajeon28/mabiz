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
        updatedAt: true,
        // aligoKey는 보안상 마스킹
        aligoKey: false,
      },
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    logger.error("[GET /api/settings/sms]", { err });
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

    const config = await prisma.orgSmsConfig.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, aligoKey, aligoUserId, senderPhone },
      update: { aligoKey, aligoUserId, senderPhone, isActive: true },
    });

    logger.log("[PUT /api/settings/sms] SMS 설정 저장", { orgId });
    return NextResponse.json({ ok: true, config: { id: config.id } });
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
