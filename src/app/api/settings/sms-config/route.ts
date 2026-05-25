import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * GET /api/settings/sms-config
 * 현재 사용자의 개인 SMS 설정 조회
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx.member?.id) {
      return NextResponse.json({ ok: false, message: "사용자 정보 없음" }, { status: 401 });
    }

    const orgId = resolveOrgId(ctx);
    const userId = ctx.member.id;

    const config = await prisma.userSmsConfig.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
    });

    // API Key 마지막 4자리 계산 (복호화 후)
    let configWithTail = null;
    if (config) {
      try {
        const decrypted = decrypt(config.aligoKeyEncrypted, "SMS_ENCRYPT_KEY");
        const tail = decrypted.substring(decrypted.length - 4);
        configWithTail = {
          id: config.id,
          aligoUserId: config.aligoUserId,
          senderPhone: config.senderPhone,
          aligoKeyTail: tail,
          senderVerified: config.senderVerified,
          verifiedAt: config.verifiedAt,
          isActive: config.isActive,
          updatedAt: config.updatedAt,
        };
      } catch (err) {
        logger.warn("[GET /api/settings/sms-config] 복호화 실패", { err });
        configWithTail = {
          id: config.id,
          aligoUserId: config.aligoUserId,
          senderPhone: config.senderPhone,
          aligoKeyTail: "****", // 실패 시 마스킹
          senderVerified: config.senderVerified,
          verifiedAt: config.verifiedAt,
          isActive: config.isActive,
          updatedAt: config.updatedAt,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      config: configWithTail,
    });
  } catch (err) {
    logger.error("[GET /api/settings/sms-config]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * POST /api/settings/sms-config
 * 개인 SMS 설정 저장/업데이트
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.member?.id) {
      return NextResponse.json({ ok: false, message: "사용자 정보 없음" }, { status: 401 });
    }

    const orgId = resolveOrgId(ctx);
    const userId = ctx.member.id;

    const body = await req.json() as {
      aligoKey?: string;
      aligoUserId?: string;
      senderPhone?: string;
    };

    const { aligoKey, aligoUserId, senderPhone } = body;

    // User ID와 발신번호는 필수
    if (!aligoUserId?.trim() || !senderPhone?.trim()) {
      return NextResponse.json(
        { ok: false, message: "User ID와 발신번호는 필수입니다." },
        { status: 400 }
      );
    }

    // 기존 설정 확인
    const existing = await prisma.userSmsConfig.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
    });

    // API Key 처리
    let aligoKeyEncrypted: string | undefined;

    if (aligoKey?.trim()) {
      // 새로운 API Key 제공: 암호화하여 저장
      aligoKeyEncrypted = encrypt(aligoKey.trim(), "SMS_ENCRYPT_KEY");
    } else if (existing) {
      // 기존 설정이 있고 API Key 미제공: 기존 값 유지
      aligoKeyEncrypted = existing.aligoKeyEncrypted;
    } else {
      // 새 설정이고 API Key 미제공: 에러
      return NextResponse.json(
        { ok: false, message: "API Key를 입력해주세요." },
        { status: 400 }
      );
    }

    let config;
    if (existing) {
      // 업데이트
      config = await prisma.userSmsConfig.update({
        where: {
          userId_organizationId: { userId, organizationId: orgId },
        },
        data: {
          aligoKeyEncrypted,
          aligoUserId: aligoUserId.trim(),
          senderPhone: senderPhone.trim(),
          // Key 변경 시 검증 상태 초기화
          senderVerified: aligoKey ? false : existing.senderVerified,
          verifiedAt: aligoKey ? null : existing.verifiedAt,
          isActive: true,
        },
      });
    } else {
      // 생성
      config = await prisma.userSmsConfig.create({
        data: {
          userId,
          organizationId: orgId,
          aligoKeyEncrypted,
          aligoUserId: aligoUserId.trim(),
          senderPhone: senderPhone.trim(),
          isActive: true,
        },
      });
    }

    // API Key 마지막 4자리 계산
    let aligoKeyTail = "****";
    try {
      const decrypted = decrypt(config.aligoKeyEncrypted, "SMS_ENCRYPT_KEY");
      aligoKeyTail = decrypted.substring(decrypted.length - 4);
    } catch (err) {
      logger.warn("[POST /api/settings/sms-config] 복호화 실패", { err });
    }

    const responseConfig = {
      id: config.id,
      aligoUserId: config.aligoUserId,
      senderPhone: config.senderPhone,
      aligoKeyTail,
      senderVerified: config.senderVerified,
      verifiedAt: config.verifiedAt,
      isActive: config.isActive,
      updatedAt: config.updatedAt,
    };

    logger.log("[POST /api/settings/sms-config]", {
      orgId,
      userId,
      action: existing ? "update" : "create",
      aligoUserId: aligoUserId.trim(),
      senderPhone: senderPhone.trim(),
    });

    return NextResponse.json({ ok: true, config: responseConfig });
  } catch (err) {
    logger.error("[POST /api/settings/sms-config]", { err });
    return NextResponse.json({ ok: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/sms-config
 * 개인 SMS 설정 삭제
 */
export async function DELETE() {
  try {
    const ctx = await getAuthContext();
    if (!ctx.member?.id) {
      return NextResponse.json({ ok: false, message: "사용자 정보 없음" }, { status: 401 });
    }

    const orgId = resolveOrgId(ctx);
    const userId = ctx.member.id;

    // 설정 삭제
    await prisma.userSmsConfig.delete({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
    });

    logger.log("[DELETE /api/settings/sms-config]", {
      orgId,
      userId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/settings/sms-config]", { err });
    return NextResponse.json({ ok: false, message: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
