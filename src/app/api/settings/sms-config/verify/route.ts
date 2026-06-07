import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { verifySenderNumber } from "@/lib/aligo";
import { logger } from "@/lib/logger";
import { decrypt } from "@/lib/crypto";

/**
 * POST /api/settings/sms-config/verify
 * 개인 발신번호 인증 요청 (Aligo에서 검증)
 */
export async function POST() {
  try {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
      return NextResponse.json(
        { ok: false, message: "사용자 정보 없음" },
        { status: 401 }
      );
    }

    const orgId = resolveOrgId(ctx);
    const userId = ctx.userId;

    // 개인 SMS 설정 확인
    const config = await prisma.userSmsConfig.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
    });

    if (!config) {
      return NextResponse.json(
        { ok: false, message: "설정된 알리고 계정이 없습니다." },
        { status: 400 }
      );
    }

    // API Key 복호화
    let aligoKey: string;
    try {
      aligoKey = decrypt(config.aligoKeyEncrypted, "SMS_ENCRYPT_KEY");
    } catch (err) {
      logger.error("[POST /api/settings/sms-config/verify] 복호화 실패", {
        err,
      });
      return NextResponse.json(
        {
          ok: false,
          message: "설정이 손상되었습니다. 다시 설정해주세요.",
        },
        { status: 500 }
      );
    }

    // Aligo에서 발신번호 검증
    const isValid = await verifySenderNumber({
      key: aligoKey,
      userId: config.aligoUserId,
      sender: config.senderPhone,
    });

    if (!isValid) {
      logger.warn("[POST /api/settings/sms-config/verify]", {
        userId,
        orgId,
        senderPhone: config.senderPhone,
        message: "발신번호가 Aligo에 등록되지 않았습니다.",
      });

      return NextResponse.json(
        {
          ok: false,
          message:
            "발신번호가 Aligo 콘솔에 등록되지 않았습니다. Aligo 콘솔 → 문자발송 → 발신번호 관리에서 등록 후 ARS 인증을 완료하세요.",
        },
        { status: 400 }
      );
    }

    // 검증 상태 업데이트
    await prisma.userSmsConfig.update({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
      data: {
        senderVerified: true,
        verifiedAt: new Date(),
      },
    });

    logger.log("[POST /api/settings/sms-config/verify]", {
      userId,
      orgId,
      senderPhone: config.senderPhone,
      verified: true,
    });

    return NextResponse.json({
      ok: true,
      message: "발신번호가 인증되었습니다.",
      senderPhone: config.senderPhone,
      verifiedAt: new Date(),
    });
  } catch (err) {
    logger.error("[POST /api/settings/sms-config/verify]", { err });
    return NextResponse.json(
      { ok: false, message: "인증 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/sms-config/verify
 * 발신번호 인증 확인 (이미 Aligo에서 인증 완료했을 때 DB 업데이트)
 */
export async function PUT() {
  try {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
      return NextResponse.json({ ok: false, message: "사용자 정보 없음" }, { status: 401 });
    }

    const orgId = resolveOrgId(ctx);
    const userId = ctx.userId;

    // 개인 SMS 설정 확인
    const config = await prisma.userSmsConfig.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
    });

    if (!config) {
      return NextResponse.json(
        { ok: false, message: "설정된 알리고 계정이 없습니다." },
        { status: 400 }
      );
    }

    // API Key 복호화
    let aligoKey: string;
    try {
      aligoKey = decrypt(config.aligoKeyEncrypted, "SMS_ENCRYPT_KEY");
    } catch (err) {
      logger.error("[PUT /api/settings/sms-config/verify] 복호화 실패", { err });
      return NextResponse.json(
        { ok: false, message: "설정이 손상되었습니다. 다시 설정해주세요." },
        { status: 400 }
      );
    }

    // 다시 검증 확인
    const isValid = await verifySenderNumber({
      key: aligoKey,
      userId: config.aligoUserId,
      sender: config.senderPhone,
    });

    if (!isValid) {
      return NextResponse.json(
        {
          ok: false,
          message: "발신번호가 여전히 Aligo에 등록되지 않았거나 인증이 완료되지 않았습니다.",
        },
        { status: 400 }
      );
    }

    // 이미 인증된 경우
    if (config.senderVerified) {
      return NextResponse.json({
        ok: true,
        message: "발신번호가 이미 인증되어 있습니다.",
      });
    }

    // 인증 완료 처리
    await prisma.userSmsConfig.update({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
      data: {
        senderVerified: true,
        verifiedAt: new Date(),
      },
    });

    logger.log("[PUT /api/settings/sms-config/verify]", {
      userId,
      orgId,
      senderPhone: config.senderPhone,
      verified: true,
    });

    return NextResponse.json({
      ok: true,
      message: "발신번호가 인증되었습니다.",
    });
  } catch (err) {
    logger.error("[PUT /api/settings/sms-config/verify]", { err });
    return NextResponse.json(
      { ok: false, message: "인증 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
