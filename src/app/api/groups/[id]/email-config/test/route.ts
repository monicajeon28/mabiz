/**
 * SMTP 연결 테스트 엔드포인트
 *
 * POST /api/groups/[id]/email-config/test
 * - SMTP 연결 테스트
 * - 테스트 이메일 발송
 * - 설정 자동 활성화
 *
 * 2026-06-16 Elon Musk: Email Funnel
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  testSmtpConnection,
  decryptSmtpPassword,
  sendEmailFunnel,
} from "@/lib/email-funnel";
import { TestSmtpConnectionSchema } from "@/lib/schemas/email-funnel";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.organizationId || !session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await req.json();

    // 권한 확인
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: session.organizationId,
          userId: session.userId,
        },
      },
    });

    if (!member || (member.role !== "ADMIN" && member.role !== "GROUP_MANAGER")) {
      return NextResponse.json(
        { error: "You do not have permission to test this email config" },
        { status: 403 }
      );
    }

    // 입력 검증
    const validationResult = TestSmtpConnectionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { emailConfigId, testEmail } = validationResult.data;

    // 이메일 설정 조회
    const emailConfig = await prisma.groupEmailConfig.findUnique({
      where: { id: emailConfigId },
    });

    if (!emailConfig || emailConfig.groupId !== groupId) {
      return NextResponse.json(
        { error: "Email config not found" },
        { status: 404 }
      );
    }

    if (emailConfig.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized to test this config" },
        { status: 403 }
      );
    }

    // SMTP 연결 테스트
    let testResult: { success: boolean; error?: string } = { success: false };

    if (emailConfig.emailProvider === "SMTP") {
      const password = decryptSmtpPassword(
        emailConfig.smtpPasswordEncrypted!,
        groupId
      );

      testResult = await testSmtpConnection({
        host: emailConfig.smtpHost!,
        port: emailConfig.smtpPort!,
        secure: emailConfig.smtpSecure || false,
        auth: {
          user: emailConfig.smtpUsername!,
          pass: password,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Only SMTP testing is implemented. Gmail/SendGrid/Mailgun coming soon." },
        { status: 501 }
      );
    }

    // 테스트 이메일 본문 구성
    const testEmailHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h1 style="color: #2c3e50;">마비즈 CRM — 이메일 설정 테스트</h1>
        <p>안녕하세요,</p>
        <p>이 이메일은 마비즈 CRM의 SMTP 설정이 정상적으로 작동하는지 확인하기 위한 테스트 이메일입니다.</p>
        <hr/>
        <h2 style="color: #27ae60;">✅ SMTP 설정 정보</h2>
        <ul style="line-height: 1.8;">
          <li><strong>공급자:</strong> ${emailConfig.emailProvider}</li>
          <li><strong>발신자:</strong> "${emailConfig.senderName}" &lt;${emailConfig.senderEmail}&gt;</li>
          <li><strong>호스트:</strong> ${emailConfig.smtpHost || "N/A"}</li>
          <li><strong>포트:</strong> ${emailConfig.smtpPort || "N/A"}</li>
          <li><strong>보안:</strong> ${emailConfig.smtpSecure ? "TLS (587)" : "SSL (465)"}</li>
        </ul>
        <hr/>
        <p><strong>이 이메일을 받으셨다면, 설정이 완료된 것입니다!</strong></p>
        <p>이제 고객들이 Day 0-3 자동 이메일을 받기 시작할 것입니다.</p>
        <footer style="margin-top: 30px; border-top: 1px solid #ecf0f1; padding-top: 20px; color: #95a5a6;">
          <p>마비즈 CRM © 2026</p>
        </footer>
      </body>
    </html>
    `;

    // 테스트 이메일 발송
    const emailResult = testResult.success
      ? await sendEmailFunnel({
          toEmail: testEmail,
          subject: "[테스트] 마비즈 이메일 설정 확인",
          bodyHtml: testEmailHtml,
          senderName: emailConfig.senderName,
          senderEmail: emailConfig.senderEmail,
          replyToEmail: emailConfig.replyToEmail || undefined,
          provider: emailConfig.emailProvider as Parameters<typeof sendEmailFunnel>[0]["provider"],
          config: {
            organizationId: emailConfig.organizationId,
            groupId: emailConfig.groupId,
            emailProvider: emailConfig.emailProvider as Parameters<typeof sendEmailFunnel>[0]["config"]["emailProvider"],
            senderName: emailConfig.senderName,
            senderEmail: emailConfig.senderEmail,
            replyToEmail: emailConfig.replyToEmail || undefined,
            smtpHost: emailConfig.smtpHost || undefined,
            smtpPort: emailConfig.smtpPort || undefined,
            smtpUsername: emailConfig.smtpUsername || undefined,
            smtpPasswordEncrypted: emailConfig.smtpPasswordEncrypted || undefined,
            smtpSecure: emailConfig.smtpSecure || undefined,
          },
        })
      : { success: false, error: testResult.error };

    // 테스트 결과 데이터베이스 저장
    if (emailResult.success) {
      await prisma.groupEmailConfig.update({
        where: { id: emailConfigId },
        data: {
          isVerified: true,
          testedAt: new Date(),
          testResult: "SUCCESS",
          testErrorMessage: null,
          isActive: true,
        },
      });
    } else {
      await prisma.groupEmailConfig.update({
        where: { id: emailConfigId },
        data: {
          isVerified: false,
          testedAt: new Date(),
          testResult: "FAILED",
          testErrorMessage: emailResult.error || "Unknown error",
        },
      });
    }

    // 감시로그 기록
    await prisma.emailAuditLog.create({
      data: {
        organizationId: session.organizationId,
        groupId,
        emailConfigId,
        userId: session.userId,
        action: "TEST_EMAIL",
        status: emailResult.success ? "SUCCESS" : "FAILED",
        errorMessage: emailResult.error || null,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
      },
    });

    logger.log("[EmailTest] 테스트 완료", { groupId, success: emailResult.success, testEmail });

    return NextResponse.json({
      success: emailResult.success,
      message: emailResult.success
        ? `테스트 이메일이 ${testEmail}로 발송되었습니다. 메일함을 확인해주세요.`
        : `테스트 실패: ${emailResult.error}`,
      details: {
        smtpTest: testResult.success,
        emailTest: emailResult.success,
        config: {
          provider: emailConfig.emailProvider,
          senderEmail: emailConfig.senderEmail,
          senderName: emailConfig.senderName,
        },
      },
    });
  } catch (err) {
    logger.error("[EmailTest] 오류", { err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
