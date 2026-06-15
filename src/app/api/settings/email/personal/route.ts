import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * GET /api/settings/email/personal
 * 현재 사용자의 개인 SMTP 설정(UserEmailConfig) 조회
 * - smtpPasswordEncrypted 제외하고 반환
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN은 조직 이메일 설정(/api/settings/email) 사용
    if (ctx.role === "GLOBAL_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "관리자는 조직 이메일 설정(/settings/email)에서 관리합니다." },
        { status: 403 }
      );
    }

    if (!ctx.organizationId) {
      return NextResponse.json(
        { ok: false, message: "조직 정보가 없습니다." },
        { status: 400 }
      );
    }

    const config = await prisma.userEmailConfig.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
        },
      },
      select: {
        id: true,
        emailProvider: true,
        senderName: true,
        senderEmail: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpSecure: true,
        isActive: true,
        isVerified: true,
        testedAt: true,
        testResult: true,
        testErrorMessage: true,
        createdAt: true,
        updatedAt: true,
        // smtpPasswordEncrypted 는 의도적으로 제외
      },
    });

    return NextResponse.json({ ok: true, config: config ?? null });
  } catch (err) {
    logger.error("[GET /api/settings/email/personal]", { err });
    return NextResponse.json({ ok: false, message: "조회 중 오류 발생" }, { status: 500 });
  }
}

/**
 * PUT /api/settings/email/personal
 * 개인 SMTP 설정 저장/업데이트
 * Body: { senderName, senderEmail, smtpHost, smtpPort, smtpUsername, smtpPassword, smtpSecure }
 */
export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "GLOBAL_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "관리자는 조직 이메일 설정에서 관리합니다." },
        { status: 403 }
      );
    }

    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, message: "조직 정보가 없습니다." }, { status: 400 });
    }

    const body = await req.json();
    const { senderName, senderEmail, smtpHost, smtpPort, smtpUsername, smtpPassword, smtpSecure } = body as {
      senderName?: string;
      senderEmail?: string;
      smtpHost?: string;
      smtpPort?: number | string;
      smtpUsername?: string;
      smtpPassword?: string;
      smtpSecure?: boolean;
    };

    // 필수 필드 검증
    if (!senderEmail || !smtpHost || !smtpUsername) {
      return NextResponse.json(
        { ok: false, message: "필수 필드 누락: 발신 이메일, SMTP 서버 주소, SMTP 계정" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      return NextResponse.json(
        { ok: false, message: "유효한 이메일 주소를 입력하세요" },
        { status: 400 }
      );
    }

    const port = parseInt(String(smtpPort ?? 587), 10);
    if (!port || port < 1 || port > 65535) {
      return NextResponse.json(
        { ok: false, message: "유효한 SMTP 포트 번호를 입력하세요 (1-65535)" },
        { status: 400 }
      );
    }

    // 기존 설정 조회 (비밀번호 유지 여부 판단)
    const existing = await prisma.userEmailConfig.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
        },
      },
      select: { smtpPasswordEncrypted: true },
    });

    const encryptedPass =
      smtpPassword && smtpPassword.trim()
        ? encrypt(smtpPassword, "EMAIL_ENCRYPT_KEY")
        : existing?.smtpPasswordEncrypted ?? null;

    if (!encryptedPass) {
      return NextResponse.json(
        { ok: false, message: "SMTP 비밀번호는 필수입니다." },
        { status: 400 }
      );
    }

    const config = await prisma.userEmailConfig.upsert({
      where: {
        userId_organizationId: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
        },
      },
      create: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        emailProvider: "SMTP",
        senderName: senderName ?? "",
        senderEmail,
        smtpHost,
        smtpPort: port,
        smtpUsername,
        smtpPasswordEncrypted: encryptedPass,
        smtpSecure: smtpSecure ?? false,
        isActive: true,
        isVerified: false,
      },
      update: {
        senderName: senderName ?? "",
        senderEmail,
        smtpHost,
        smtpPort: port,
        smtpUsername,
        smtpPasswordEncrypted: encryptedPass,
        smtpSecure: smtpSecure ?? false,
        isActive: true,
        // 설정 변경 시 재검증 필요
        isVerified: false,
        testResult: null,
        testErrorMessage: null,
      },
      select: {
        senderName: true,
        senderEmail: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpSecure: true,
        isActive: true,
        isVerified: true,
      },
    });

    logger.log("[PUT /api/settings/email/personal] 개인 SMTP 저장", {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      senderEmail: config.senderEmail,
    });

    return NextResponse.json({ ok: true, message: "이메일 설정이 저장되었습니다.", config });
  } catch (err) {
    logger.error("[PUT /api/settings/email/personal]", { err });
    return NextResponse.json({ ok: false, message: "설정 저장 중 오류 발생" }, { status: 500 });
  }
}

/**
 * POST /api/settings/email/personal
 * 테스트 이메일 발송 + isVerified 갱신
 * Body: { testEmail: string }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "GLOBAL_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "관리자는 조직 이메일 설정에서 관리합니다." },
        { status: 403 }
      );
    }

    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, message: "조직 정보가 없습니다." }, { status: 400 });
    }

    const body = await req.json();
    const { testEmail } = body as { testEmail?: string };

    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      return NextResponse.json(
        { ok: false, message: "유효한 수신 이메일 주소를 입력하세요." },
        { status: 400 }
      );
    }

    const config = await prisma.userEmailConfig.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
        },
      },
    });

    if (!config || !config.isActive) {
      return NextResponse.json(
        { ok: false, message: "이메일 설정이 완료되지 않았습니다. 먼저 설정을 저장하세요." },
        { status: 400 }
      );
    }

    if (!config.smtpHost || !config.smtpUsername || !config.smtpPasswordEncrypted) {
      return NextResponse.json(
        { ok: false, message: "SMTP 설정이 불완전합니다. 서버 주소, 계정, 비밀번호를 확인하세요." },
        { status: 400 }
      );
    }

    let decryptedPass: string;
    try {
      decryptedPass = decrypt(config.smtpPasswordEncrypted, "EMAIL_ENCRYPT_KEY");
    } catch {
      return NextResponse.json(
        { ok: false, message: "비밀번호 복호화 실패. 설정을 다시 저장하세요." },
        { status: 500 }
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort ?? 587,
        secure: config.smtpSecure ?? false,
        auth: {
          user: config.smtpUsername,
          pass: decryptedPass,
        },
      });

      await transporter.verify();

      await transporter.sendMail({
        from: `"${config.senderName || "마비즈 CRM"}" <${config.senderEmail || config.smtpUsername}>`,
        to: testEmail,
        subject: `[마비즈 CRM] 이메일 연결 테스트 — ${new Date().toLocaleString("ko-KR")}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 480px; color: #333;">
            <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">이메일 연결 성공!</h2>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              마비즈 CRM 이메일 설정이 정상적으로 작동합니다.<br/>
              이제 고객에게 자동 이메일을 보낼 수 있습니다.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              발신: ${config.senderName || "마비즈 CRM"} &lt;${config.senderEmail || config.smtpUsername}&gt;<br />
              SMTP: ${config.smtpHost}:${config.smtpPort ?? 587}<br />
              시간: ${new Date().toLocaleString("ko-KR")}
            </p>
          </div>
        `,
      });

      // 성공 → isVerified 갱신
      await prisma.userEmailConfig.update({
        where: {
          userId_organizationId: {
            userId: ctx.userId,
            organizationId: ctx.organizationId,
          },
        },
        data: {
          isVerified: true,
          testedAt: new Date(),
          testResult: "SUCCESS",
          testErrorMessage: null,
        },
      });

      logger.log("[POST /api/settings/email/personal] 테스트 발송 성공", {
        userId: ctx.userId,
        to: testEmail,
      });

      return NextResponse.json({ ok: true, message: `${testEmail}로 테스트 이메일이 발송되었습니다. 수신함 또는 스팸함을 확인하세요.` });
    } catch (smtpErr) {
      const errMsg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);

      // 실패 → testResult 갱신
      await prisma.userEmailConfig.update({
        where: {
          userId_organizationId: {
            userId: ctx.userId,
            organizationId: ctx.organizationId,
          },
        },
        data: {
          isVerified: false,
          testedAt: new Date(),
          testResult: "FAILED",
          testErrorMessage: errMsg.slice(0, 500),
        },
      });

      logger.error("[POST /api/settings/email/personal] SMTP 오류", { err: smtpErr, userId: ctx.userId });
      return NextResponse.json(
        { ok: false, message: `SMTP 연결 실패: ${errMsg.slice(0, 200)}` },
        { status: 400 }
      );
    }
  } catch (err) {
    logger.error("[POST /api/settings/email/personal]", { err });
    return NextResponse.json({ ok: false, message: "테스트 이메일 발송 중 오류 발생" }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/email/personal
 * 개인 이메일 설정 비활성화 (isActive: false)
 */
export async function DELETE() {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, message: "관리자는 해당 기능을 사용할 수 없습니다." }, { status: 403 });
    }

    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, message: "조직 정보가 없습니다." }, { status: 400 });
    }

    const existing = await prisma.userEmailConfig.findUnique({
      where: {
        userId_organizationId: { userId: ctx.userId, organizationId: ctx.organizationId },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: true, message: "설정이 없습니다." });
    }

    await prisma.userEmailConfig.update({
      where: {
        userId_organizationId: { userId: ctx.userId, organizationId: ctx.organizationId },
      },
      data: { isActive: false },
    });

    logger.log("[DELETE /api/settings/email/personal] 개인 이메일 설정 비활성화", {
      userId: ctx.userId,
    });

    return NextResponse.json({ ok: true, message: "이메일 설정이 비활성화되었습니다." });
  } catch (err) {
    logger.error("[DELETE /api/settings/email/personal]", { err });
    return NextResponse.json({ ok: false, message: "설정 삭제 중 오류 발생" }, { status: 500 });
  }
}
