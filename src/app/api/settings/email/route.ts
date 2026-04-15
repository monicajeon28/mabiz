import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgId } from "@/lib/org";
import { logger } from "@/lib/logger";
import { encryptSmtpPassword } from "@/lib/email";

// GET /api/settings/email
export async function GET() {
  try {
    const orgId = await getOrgId();
    const config = await prisma.orgEmailConfig.findUnique({
      where: { organizationId: orgId },
      select: {
        id: true,
        senderName: true,
        senderEmail: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isActive: true,
        updatedAt: true,
        // 비밀번호 제외
        smtpPassEncrypted: false,
      },
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    logger.error("[GET /api/settings/email]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PUT /api/settings/email
export async function PUT(req: Request) {
  try {
    const orgId = await getOrgId();
    const { senderName, senderEmail, smtpHost, smtpPort, smtpUser, smtpPass } = await req.json();

    if (!senderEmail || !smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { ok: false, message: "발신 이메일, SMTP 호스트, 계정, 비밀번호는 필수입니다." },
        { status: 400 }
      );
    }

    const smtpPassEncrypted = encryptSmtpPassword(smtpPass);

    await prisma.orgEmailConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        senderName: senderName ?? senderEmail,
        senderEmail,
        smtpHost,
        smtpPort: smtpPort ?? 587,
        smtpUser,
        smtpPassEncrypted,
      },
      update: {
        senderName: senderName ?? senderEmail,
        senderEmail,
        smtpHost,
        smtpPort: smtpPort ?? 587,
        smtpUser,
        smtpPassEncrypted,
        isActive: true,
      },
    });

    logger.log("[PUT /api/settings/email] 이메일 설정 저장", { orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[PUT /api/settings/email]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/settings/email/test
export async function POST(req: Request) {
  try {
    const orgId = await getOrgId();
    const { testEmail } = await req.json();

    const config = await prisma.orgEmailConfig.findUnique({ where: { organizationId: orgId } });
    if (!config) {
      return NextResponse.json({ ok: false, message: "이메일 설정이 없습니다." }, { status: 400 });
    }

    const { sendEmail } = await import("@/lib/email");
    const ok = await sendEmail({
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      smtpPassEncrypted: config.smtpPassEncrypted,
      senderName: config.senderName,
      senderEmail: config.senderEmail,
      to: testEmail,
      subject: "[mabiz] 이메일 설정 테스트",
      html: "<p>mabiz 이메일 자동화 설정이 완료되었습니다! 🎉</p>",
    });

    return NextResponse.json({ ok, message: ok ? "테스트 이메일 발송 성공" : "발송 실패" });
  } catch (err) {
    logger.error("[POST /api/settings/email test]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
