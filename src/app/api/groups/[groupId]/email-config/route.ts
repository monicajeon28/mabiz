/**
 * Group Email SMTP Configuration API
 * - GET: 이메일 설정 조회
 * - PUT: 이메일 설정 저장
 *
 * 2026-06-16 Elon Musk: Email Funnel
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  encryptSmtpPassword,
  decryptSmtpPassword,
  encryptSendGridApiKey,
  encryptMailgunApiKey,
  testSmtpConnection,
  validateSmtpConfig,
  validateEmail,
  validateSenderName,
} from "@/lib/email-funnel";
import { CreateGroupEmailConfigSchema } from "@/lib/schemas/email-funnel";

// ============================================================================
// GET: 이메일 설정 조회
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.organizationId || !session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;

    // 권한 확인: GroupAdmin 또는 조직 관리자
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
        { error: "You do not have permission to view this email config" },
        { status: 403 }
      );
    }

    // Group 존재 확인 (같은 조직)
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId: session.organizationId,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // 이메일 설정 조회
    const emailConfig = await prisma.groupEmailConfig.findUnique({
      where: { groupId },
      select: {
        id: true,
        groupId: true,
        emailProvider: true,
        senderName: true,
        senderEmail: true,
        replyToEmail: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        // smtpPasswordEncrypted는 응답하지 않음 (보안)
        smtpSecure: true,
        isActive: true,
        isVerified: true,
        testedAt: true,
        testResult: true,
        gmailExpireAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!emailConfig) {
      return NextResponse.json(
        { message: "No email config found for this group" },
        { status: 200 }
      );
    }

    return NextResponse.json(emailConfig);
  } catch (err) {
    logger.error("[EmailConfig:GET] 오류", { err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// PUT: 이메일 설정 저장
// ============================================================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.organizationId || !session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
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
        { error: "You do not have permission to modify this email config" },
        { status: 403 }
      );
    }

    // 입력 검증
    const validationResult = CreateGroupEmailConfigSchema.safeParse({
      groupId,
      ...body,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 추가 검증
    if (!validateEmail(data.senderEmail)) {
      return NextResponse.json(
        { error: "Invalid sender email" },
        { status: 400 }
      );
    }

    if (!validateSenderName(data.senderName)) {
      return NextResponse.json(
        { error: "Invalid sender name" },
        { status: 400 }
      );
    }

    if (data.replyToEmail && !validateEmail(data.replyToEmail)) {
      return NextResponse.json(
        { error: "Invalid reply-to email" },
        { status: 400 }
      );
    }

    // SMTP 설정 검증
    if (data.emailProvider === "SMTP") {
      const smtpValidation = validateSmtpConfig({
        host: data.smtpHost!,
        port: data.smtpPort!,
        username: data.smtpUsername!,
        password: data.smtpPassword!,
      });

      if (!smtpValidation.valid) {
        return NextResponse.json(
          {
            error: "SMTP configuration is invalid",
            details: smtpValidation.errors,
          },
          { status: 400 }
        );
      }
    }

    // Group 존재 확인
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId: session.organizationId,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // 암호화할 필드들 준비
    const encryptedData: any = {
      organizationId: session.organizationId,
      groupId,
      emailProvider: data.emailProvider,
      senderName: data.senderName,
      senderEmail: data.senderEmail,
      replyToEmail: data.replyToEmail,
      isActive: false, // 테스트 후 활성화
      isVerified: false,
    };

    if (data.emailProvider === "SMTP" && data.smtpPassword) {
      encryptedData.smtpHost = data.smtpHost;
      encryptedData.smtpPort = data.smtpPort;
      encryptedData.smtpUsername = data.smtpUsername;
      encryptedData.smtpPasswordEncrypted = encryptSmtpPassword(
        data.smtpPassword,
        groupId
      );
      encryptedData.smtpSecure = data.smtpSecure || false;
    }

    if (data.emailProvider === "GMAIL") {
      encryptedData.gmailAccessToken = data.gmailAccessToken;
      encryptedData.gmailRefreshToken = data.gmailRefreshToken;
    }

    if (data.emailProvider === "SENDGRID" && data.sendGridApiKey) {
      encryptedData.sendGridApiKeyEncrypted = encryptSendGridApiKey(
        data.sendGridApiKey,
        groupId
      );
    }

    if (data.emailProvider === "MAILGUN" && data.mailgunApiKey) {
      encryptedData.mailgunApiKeyEncrypted = encryptMailgunApiKey(
        data.mailgunApiKey,
        groupId
      );
      encryptedData.mailgunDomain = data.mailgunDomain;
    }

    // 데이터베이스 저장
    const emailConfig = await prisma.groupEmailConfig.upsert({
      where: { groupId },
      update: encryptedData,
      create: encryptedData,
    });

    // 감시로그 기록
    await prisma.emailAuditLog.create({
      data: {
        organizationId: session.organizationId,
        groupId,
        emailConfigId: emailConfig.id,
        userId: session.userId,
        action: "UPDATE_SMTP",
        status: "SUCCESS",
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
      },
    });

    logger.log("[EmailConfig:PUT] 저장 성공", { groupId });

    return NextResponse.json({
      message: "Email config saved successfully",
      config: {
        id: emailConfig.id,
        groupId: emailConfig.groupId,
        emailProvider: emailConfig.emailProvider,
        senderEmail: emailConfig.senderEmail,
        senderName: emailConfig.senderName,
        isActive: emailConfig.isActive,
      },
    });
  } catch (err) {
    logger.error("[EmailConfig:PUT] 오류", { err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
