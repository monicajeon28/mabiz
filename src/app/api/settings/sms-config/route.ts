import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto";
import { userSmsSettingsSchema } from "@/lib/validations/settings";

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
 * - API Key는 암호화하여 저장
 * - 발신번호 변경 시 검증 상태 초기화
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.member?.id) {
      return NextResponse.json(
        { ok: false, message: "사용자 정보 없음" },
        { status: 401 }
      );
    }

    const orgId = resolveOrgId(ctx);
    const userId = ctx.member.id;

    const body = await req.json();

    // 기존 설정 확인 (업데이트 판단용)
    const existing = await prisma.userSmsConfig.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
    });

    // Zod 검증
    const parsed = userSmsSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "입력값 검증 실패",
          errors: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { aligoKey, aligoUserId, senderPhone } = parsed.data;

    // API Key 처리
    let aligoKeyEncrypted: string;

    if (aligoKey?.trim()) {
      // 새로운 API Key 제공: 암호화하여 저장
      try {
        aligoKeyEncrypted = encrypt(aligoKey.trim(), "SMS_ENCRYPT_KEY");
      } catch (err) {
        logger.error("[POST /api/settings/sms-config] 암호화 실패", { err });
        return NextResponse.json(
          { ok: false, message: "설정 저장 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }
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

    // 발신번호 변경 여부 확인
    const phoneChanged = existing && existing.senderPhone !== senderPhone.trim();

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
          // 발신번호 변경 시만 검증 상태 초기화
          senderVerified: phoneChanged ? false : existing.senderVerified,
          verifiedAt: phoneChanged ? null : existing.verifiedAt,
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
      phoneChanged,
    });

    return NextResponse.json({ ok: true, config: responseConfig });
  } catch (err) {
    logger.error("[POST /api/settings/sms-config]", { err });
    return NextResponse.json(
      { ok: false, message: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
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
