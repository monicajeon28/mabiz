import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { encryptSmtpPassword, sendEmail } from "@/lib/email";

/**
 * GET /api/settings/email
 * 조직의 이메일 SMTP 설정 조회
 * - 비밀번호는 클라이언트로 전송하지 않음
 * - senderEmail과 smtpHost만 반환
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED", message: "인증되지 않음" },
        { status: 401 }
      );
    }

    const config = await prisma.orgEmailConfig.findUnique({
      where: { organizationId: ctx.organizationId },
      select: {
        senderName: true,
        senderEmail: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      config: config
        ? {
            senderName: config.senderName,
            senderEmail: config.senderEmail,
            smtpHost: config.smtpHost,
            smtpPort: config.smtpPort,
            smtpUser: config.smtpUser,
            isActive: config.isActive,
          }
        : null,
    });
  } catch (err) {
    logger.error("[GET /api/settings/email]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * PUT /api/settings/email
 * SMTP 설정 저장/업데이트
 * - smtpPass가 제공되지 않으면 기존 값 유지
 * - senderName, senderEmail, smtpHost, smtpPort, smtpUser, smtpPass (옵션)
 */
export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED", message: "인증되지 않음" },
        { status: 401 }
      );
    }

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: 'OWNER 또는 관리자만 이메일 설정을 변경할 수 있습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { senderName, senderEmail, smtpHost, smtpPort, smtpUser, smtpPass } = body;

    // 필수 필드 검증
    if (!senderEmail || !smtpHost || !smtpUser) {
      return NextResponse.json(
        { ok: false, message: "필수 필드 누락: senderEmail, smtpHost, smtpUser" },
        { status: 400 }
      );
    }

    if (!senderEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, message: "유효한 이메일 주소를 입력하세요" },
        { status: 400 }
      );
    }

    const port = parseInt(String(smtpPort), 10);
    if (!port || port < 1 || port > 65535) {
      return NextResponse.json(
        { ok: false, message: "유효한 SMTP 포트 번호를 입력하세요 (1-65535)" },
        { status: 400 }
      );
    }

    // 기존 설정 조회 (비밀번호 유지 여부 판단)
    const existing = await prisma.orgEmailConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const encryptedPass =
      smtpPass && smtpPass.trim()
        ? encryptSmtpPassword(smtpPass)
        : existing?.smtpPassEncrypted || "";

    if (!encryptedPass) {
      return NextResponse.json(
        { ok: false, message: "SMTP 비밀번호는 필수입니다" },
        { status: 400 }
      );
    }

    // Upsert: 기존이 있으면 update, 없으면 create
    const config = await prisma.orgEmailConfig.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        senderName: senderName || "CRM Bot",
        senderEmail,
        smtpHost,
        smtpPort: port,
        smtpUser,
        smtpPassEncrypted: encryptedPass,
        isActive: true,
      },
      update: {
        senderName: senderName || "CRM Bot",
        senderEmail,
        smtpHost,
        smtpPort: port,
        smtpUser,
        smtpPassEncrypted: encryptedPass,
        isActive: true,
      },
    });

    logger.log("[PUT /api/settings/email] SMTP 설정 저장", {
      organizationId: ctx.organizationId,
      senderEmail: config.senderEmail,
    });

    return NextResponse.json({
      ok: true,
      message: "이메일 설정이 저장되었습니다",
      config: {
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
      },
    });
  } catch (err) {
    logger.error("[PUT /api/settings/email]", { err });
    return NextResponse.json(
      { ok: false, message: "설정 저장 중 오류 발생" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/email
 * 테스트 이메일 발송
 * - testEmail: 수신 이메일 주소
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED", message: "인증되지 않음" },
        { status: 401 }
      );
    }

    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, message: 'OWNER 또는 관리자만 이메일 설정을 변경할 수 있습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { testEmail } = body;

    if (!testEmail || !testEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, message: "유효한 이메일 주소를 입력하세요" },
        { status: 400 }
      );
    }

    // 이메일 설정 조회
    const config = await prisma.orgEmailConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    if (!config || !config.isActive) {
      return NextResponse.json(
        { ok: false, message: "이메일 설정이 완료되지 않았습니다. 먼저 SMTP 설정을 저장하세요." },
        { status: 400 }
      );
    }

    // 테스트 이메일 발송
    try {
      const success = await sendEmail({
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPassEncrypted: config.smtpPassEncrypted, // sendEmail 내부에서 decrypt 처리
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        to: testEmail,
        subject: `[마비즈 CRM] 이메일 설정 테스트 - ${new Date().toLocaleString("ko-KR")}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333;">
            <h2>이메일 설정 테스트 성공</h2>
            <p>마비즈 CRM 이메일 설정이 정상적으로 작동합니다.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">
              발신: ${config.senderName} &lt;${config.senderEmail}&gt;<br />
              시간: ${new Date().toLocaleString("ko-KR")}<br />
              SMTP: ${config.smtpHost}:${config.smtpPort}
            </p>
          </div>
        `,
      });

      if (!success) {
        return NextResponse.json(
          { ok: false, message: "이메일 발송에 실패했습니다. SMTP 설정을 확인하세요." },
          { status: 400 }
        );
      }

      logger.log("[POST /api/settings/email] 테스트 이메일 발송 성공", {
        organizationId: ctx.organizationId,
        to: testEmail,
      });

      return NextResponse.json({
        ok: true,
        message: `${testEmail}로 테스트 이메일이 발송되었습니다.`,
      });
    } catch (smtpErr) {
      logger.error("[POST /api/settings/email] SMTP 오류", { err: smtpErr });
      return NextResponse.json(
        {
          ok: false,
          message: `SMTP 오류: ${smtpErr instanceof Error ? smtpErr.message : "알 수 없는 오류"}`,
        },
        { status: 400 }
      );
    }
  } catch (err) {
    logger.error("[POST /api/settings/email]", { err });
    return NextResponse.json(
      { ok: false, message: "테스트 이메일 발송 중 오류 발생" },
      { status: 500 }
    );
  }
}
