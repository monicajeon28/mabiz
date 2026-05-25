import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings } from "@/lib/rbac";
import { sendSms, verifySenderNumber } from "@/lib/aligo";
import { logger } from "@/lib/logger";

/**
 * GET /api/settings/sms
 * 조직의 SMS 설정 조회
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
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
      },
    });

    return NextResponse.json({
      ok: true,
      config: config || null,
    });
  } catch (err) {
    logger.error("[GET /api/settings/sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * PUT /api/settings/sms
 * 조직의 SMS 설정 저장 (aligoKey, aligoUserId, senderPhone)
 */
export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: "권한 없음" }, { status: 403 });
    }

    const orgId = resolveOrgId(ctx);
    const body = await req.json() as {
      aligoKey?: string;
      aligoUserId?: string;
      senderPhone?: string;
    };

    const { aligoKey, aligoUserId, senderPhone } = body;

    // 유효성 검사
    if (!aligoKey?.trim() || !aligoUserId?.trim() || !senderPhone?.trim()) {
      return NextResponse.json(
        { ok: false, message: "API Key, User ID, 발신번호는 필수입니다." },
        { status: 400 }
      );
    }

    // 기존 설정 확인
    const existing = await prisma.orgSmsConfig.findUnique({
      where: { organizationId: orgId },
    });

    let config;
    if (existing) {
      config = await prisma.orgSmsConfig.update({
        where: { organizationId: orgId },
        data: {
          aligoKey: aligoKey.trim(),
          aligoUserId: aligoUserId.trim(),
          senderPhone: senderPhone.trim(),
          // 설정 변경 시 검증 상태 초기화
          senderVerified: false,
          verifiedAt: null,
        },
      });
    } else {
      config = await prisma.orgSmsConfig.create({
        data: {
          organizationId: orgId,
          aligoKey: aligoKey.trim(),
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
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    logger.error("[PUT /api/settings/sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * POST /api/settings/sms
 * SMS 테스트 발송 (testPhone으로 발송)
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await req.json() as { testPhone?: string };
    const { testPhone } = body;

    if (!testPhone?.trim()) {
      return NextResponse.json(
        { ok: false, message: "수신 전화번호를 입력하세요." },
        { status: 400 }
      );
    }

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
        { ok: false, message: "발신번호가 인증되지 않았습니다. 먼저 발신번호를 인증해주세요." },
        { status: 400 }
      );
    }

    // 테스트 메시지 발송
    const testMsg = `[마비즈CRM] 테스트 메시지입니다. 정상 작동 중입니다. ${new Date().toLocaleTimeString("ko-KR")}`;
    const result = await sendSms({
      config: {
        key: smsConfig.aligoKey,
        userId: smsConfig.aligoUserId,
        sender: smsConfig.senderPhone,
      },
      receiver: testPhone.trim(),
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
    });

    if (!ok) {
      return NextResponse.json(
        { ok: false, message: result.message ?? "발송 실패" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "테스트 메시지가 발송되었습니다.",
    });
  } catch (err) {
    logger.error("[POST /api/settings/sms - TEST]", { err });
    return NextResponse.json({ ok: false, message: "발송 중 오류가 발생했습니다." }, { status: 500 });
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
    const body = await req.json() as {
      reEngageMsg1?: string | null;
      reEngageMsg2?: string | null;
    };

    const { reEngageMsg1, reEngageMsg2 } = body;

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

    return NextResponse.json({ ok: true, config: updated });
  } catch (err) {
    logger.error("[PATCH /api/settings/sms]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
