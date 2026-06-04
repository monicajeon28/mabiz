import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sendSystemEmail } from "@/lib/system-email";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/contract-instances/[id]/send-email
 * 옵션 B: 이메일 발송 — 서명 링크를 계약자 이메일로 발송
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = authContext;
    const { id } = await params;

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      include: {
        template: { select: { name: true } },
      },
    });

    if (!instance) {
      return NextResponse.json({ ok: false, error: "계약서를 찾을 수 없습니다" }, { status: 404 });
    }

    if (instance.organizationId !== organizationId) {
      return NextResponse.json({ ok: false, error: "접근 권한이 없습니다" }, { status: 403 });
    }

    if (instance.status === "SIGNED" || instance.status === "COMPLETED") {
      return NextResponse.json(
        { ok: false, error: "이미 서명 완료된 계약서입니다" },
        { status: 422 }
      );
    }

    // boundData에서 이메일 및 이름 추출
    const boundData =
      instance.boundData && typeof instance.boundData === "object"
        ? (instance.boundData as Record<string, unknown>)
        : {};

    const recipientEmail =
      typeof boundData.email === "string"
        ? boundData.email
        : typeof boundData.buyerEmail === "string"
        ? boundData.buyerEmail
        : null;

    const recipientName =
      typeof boundData.buyerName === "string"
        ? boundData.buyerName
        : typeof boundData.name === "string"
        ? boundData.name
        : "고객";

    if (!recipientEmail) {
      return NextResponse.json(
        { ok: false, error: "계약서에 이메일 주소가 없습니다. boundData에 email 또는 buyerEmail 필드가 필요합니다." },
        { status: 422 }
      );
    }

    // DRAFT → SENT 전환
    if (instance.status === "DRAFT") {
      await prisma.contractInstance.update({
        where: { id },
        data: { status: "SENT" },
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "https://mabizcruisedot.com";

    const signUrl = `${baseUrl}/contract/sign/${id}`;
    const templateName = instance.template?.name ?? "계약서";

    const emailHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; max-width: 560px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    h1 { color: #1a2e4a; font-size: 22px; margin: 0 0 8px; }
    p { color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px; }
    .note { font-size: 13px; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
    .url { font-size: 12px; color: #a0aec0; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📝 ${templateName} 서명 요청</h1>
    <p>안녕하세요, <strong>${recipientName}</strong>님!</p>
    <p>마비즈에서 계약서 서명을 요청드립니다. 아래 버튼을 클릭하여 5~10분 내에 간편하게 전자서명을 완료하실 수 있습니다.</p>
    <a href="${signUrl}" class="btn">⚡ 지금 바로 서명하기</a>
    <p>버튼이 작동하지 않는 경우 아래 주소를 직접 복사하여 브라우저에 붙여넣기 해주세요.</p>
    <p class="url">${signUrl}</p>
    <div class="note">
      본 이메일은 마비즈 CRM에서 자동 발송된 메일입니다. 문의사항은 담당자에게 연락해 주세요.
    </div>
  </div>
</body>
</html>`;

    const sent = await sendSystemEmail({
      to: recipientEmail,
      subject: `[마비즈] ${recipientName}님, ${templateName} 서명 요청드립니다`,
      html: emailHtml,
    });

    if (!sent) {
      logger.error("[POST /api/contract-instances/[id]/send-email] 이메일 발송 실패", {
        instanceId: id,
        recipientEmail,
      });
      return NextResponse.json(
        { ok: false, error: "이메일 발송에 실패했습니다. SMTP 설정을 확인해주세요." },
        { status: 500 }
      );
    }

    logger.log("[POST /api/contract-instances/[id]/send-email] 이메일 발송 완료", {
      instanceId: id,
      recipientEmail,
    });

    return NextResponse.json({
      ok: true,
      message: `${recipientEmail}로 서명 링크가 발송되었습니다.`,
      recipientEmail,
    });
  } catch (error) {
    logger.error("[POST /api/contract-instances/[id]/send-email]", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
