import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings } from "@/lib/rbac";
import { sendSms, verifySenderNumber } from "@/lib/aligo";
import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  orgSmsSettingsSchema,
  smsSendTestSchema,
  smsReEngageMessagesSchema,
} from "@/lib/validations/settings";

/**
 * GET /api/settings/sms
 * 조직의 SMS 설정 조회
 * - aligoKey는 반환하지 않음 (보안)
 * - 비밀번호 같은 민감 데이터는 제외
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "OWNER 또는 관리자만 SMS 설정을 조회할 수 있습니다." }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);

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
        // aligoKey는 의도적으로 제외
      },
    });

    return NextResponse.json({
      ok: true,
      config: config || null,
    });
  } catch (err) {
    logger.error("[GET /api/settings/sms]", { err });
    return NextResponse.json(
      { ok: false, message: "설정 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/sms
 * 조직의 SMS 설정 저장 (aligoKey, aligoUserId, senderPhone)
 * - aligoKey는 암호화하여 저장
 * - senderPhone 변경 시 검증 상태 초기화
 */
export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한 없음" }, { status: 403 });
    }

    const orgId = resolveOrgId(ctx);
    const body = await req.json();

    // Zod 검증
    const parsed = orgSmsSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "입력값 검증 실패",
          errors: parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { aligoKey, aligoUserId, senderPhone } = parsed.data;

    // 기존 설정 확인
    const existing = await prisma.orgSmsConfig.findUnique({
      where: { organizationId: orgId },
    });

    // aligoKey 암호화
    let aligoKeyEncrypted: string;
    try {
      aligoKeyEncrypted = encrypt(aligoKey.trim(), "SMS_ENCRYPT_KEY");
    } catch (err) {
      logger.error("[PUT /api/settings/sms] 암호화 실패", { err });
      return NextResponse.json(
        { ok: false, message: "설정 저장 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 발신번호 변경 여부 확인 (기존과 다르면 검증 초기화)
    const phoneChanged = existing && existing.senderPhone !== senderPhone.trim();

    let config;
    if (existing) {
      config = await prisma.orgSmsConfig.update({
        where: { organizationId: orgId },
        data: {
          aligoKey: aligoKeyEncrypted,
          aligoUserId: aligoUserId.trim(),
          senderPhone: senderPhone.trim(),
          // 발신번호 변경 시만 검증 상태 초기화
          senderVerified: phoneChanged ? false : existing.senderVerified,
          verifiedAt: phoneChanged ? null : existing.verifiedAt,
        },
      });
    } else {
      config = await prisma.orgSmsConfig.create({
        data: {
          organizationId: orgId,
          aligoKey: aligoKeyEncrypted,
          aligoUserId: aligoUserId.trim(),
          senderPhone: senderPhone.trim(),
          isActive: true,
        },
      });
    }

    logger.log("[PUT /api/settings/sms]", {
      orgId,
      aligoUserId: aligoUserId.trim(),
      senderPhone: senderPhone.trim(),
      action: existing ? "update" : "create",
      phoneChanged,
    });

    // 응답: aligoKey는 반환하지 않음 (보안)
    return NextResponse.json({
      ok: true,
      config: {
        id: config.id,
        aligoUserId: config.aligoUserId,
        senderPhone: config.senderPhone,
        isActive: config.isActive,
        senderVerified: config.senderVerified,
        verifiedAt: config.verifiedAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (err) {
    logger.error("[PUT /api/settings/sms]", { err });
    return NextResponse.json(
      { ok: false, message: "설정 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/sms
 * SMS 테스트 발송 (testPhone으로 발송)
 * - 발신번호 검증 필수
 * - 수신번호 형식 검증
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canManageSettings(ctx)) {
      return NextResponse.json(
        { ok: false, message: "OWNER 또는 관리자만 테스트 문자를 발송할 수 있습니다." },
        { status: 403 }
      );
    }
    const orgId = resolveOrgId(ctx);

    const body = await req.json();

    // Zod 검증
    const parsed = smsSendTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "입력값 검증 실패",
          errors: parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { testPhone } = parsed.data;

    // SMS 설정 확인
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!smsConfig) {
      return NextResponse.json(
        { ok: false, message: "SMS 설정이 없습니다. 위에서 먼저 설정해주세요." },
        { status: 400 }
      );
    }

    // 발신번호 검증 상태 확인
    if (!smsConfig.senderVerified) {
      return NextResponse.json(
        {
          ok: false,
          message: "발신번호가 인증되지 않았습니다. 먼저 발신번호를 인증해주세요.",
        },
        { status: 403 }
      );
    }

    // aligoKey 복호화
    let aligoKey: string;
    try {
      aligoKey = decrypt(smsConfig.aligoKey, "SMS_ENCRYPT_KEY");
    } catch (err) {
      logger.error("[POST /api/settings/sms] 복호화 실패", { err });
      return NextResponse.json(
        { ok: false, message: "설정이 손상되었습니다. 다시 설정해주세요." },
        { status: 500 }
      );
    }

    // 테스트 메시지 발송
    const testMsg = `[마비즈CRM] 테스트 메시지입니다. 정상 작동 중입니다. ${new Date().toLocaleTimeString("ko-KR")}`;
    const result = await sendSms({
      config: {
        key: aligoKey,
        userId: smsConfig.aligoUserId,
        sender: smsConfig.senderPhone,
      },
      receiver: testPhone.replace(/-/g, ""), // 하이픈 제거
      msg: testMsg,
      organizationId: orgId,
      channel: "MANUAL",
    });

    const resultCode = Number(result.result_code);
    const ok = resultCode === 1;

    logger.log("[POST /api/settings/sms - TEST]", {
      orgId,
      testPhone: testPhone.substring(0, 4) + "***",
      resultCode,
      success: ok,
    });

    if (!ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            result.message ||
            `발송 실패 (코드: ${resultCode})`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "테스트 메시지가 발송되었습니다.",
    });
  } catch (err) {
    logger.error("[POST /api/settings/sms - TEST]", { err });
    return NextResponse.json(
      { ok: false, message: "발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/sms
 * 재진입 메시지 저장 (reEngageMsg1, reEngageMsg2)
 */
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한 없음" }, { status: 403 });
    }

    const orgId = resolveOrgId(ctx);
    const body = await req.json();

    // Zod 검증
    const parsed = smsReEngageMessagesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "입력값 검증 실패",
          errors: parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { reEngageMsg1, reEngageMsg2 } = parsed.data;

    // SMS 설정 확인
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!smsConfig) {
      return NextResponse.json(
        { ok: false, message: "SMS 설정이 없습니다." },
        { status: 400 }
      );
    }

    // 재진입 메시지 저장
    const updated = await prisma.orgSmsConfig.update({
      where: { organizationId: orgId },
      data: {
        reEngageMsg1: reEngageMsg1 || null,
        reEngageMsg2: reEngageMsg2 || null,
      },
    });

    logger.log("[PATCH /api/settings/sms]", {
      orgId,
      msg1Length: reEngageMsg1?.length ?? 0,
      msg2Length: reEngageMsg2?.length ?? 0,
    });

    return NextResponse.json({
      ok: true,
      config: {
        id: updated.id,
        aligoUserId: updated.aligoUserId,
        senderPhone: updated.senderPhone,
        isActive: updated.isActive,
        senderVerified: updated.senderVerified,
        reEngageMsg1: updated.reEngageMsg1,
        reEngageMsg2: updated.reEngageMsg2,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    logger.error("[PATCH /api/settings/sms]", { err });
    return NextResponse.json(
      { ok: false, message: "메시지 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
