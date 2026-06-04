import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contract-instances/[id]/pdf
 * 옵션 C: PDF 다운로드 — 계약서 내용을 인쇄용 HTML로 반환 (브라우저 인쇄 → PDF 저장)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
        template: { select: { name: true, htmlContent: true, fieldMapping: true } },
      },
    });

    if (!instance) {
      return NextResponse.json({ ok: false, error: "계약서를 찾을 수 없습니다" }, { status: 404 });
    }

    if (instance.organizationId !== organizationId) {
      return NextResponse.json({ ok: false, error: "접근 권한이 없습니다" }, { status: 403 });
    }

    const boundData =
      instance.boundData && typeof instance.boundData === "object"
        ? (instance.boundData as Record<string, unknown>)
        : {};

    const customerName =
      (typeof boundData.buyerName === "string" ? boundData.buyerName : "") ||
      (typeof boundData.signerName === "string" ? boundData.signerName : "") ||
      (typeof boundData.name === "string" ? boundData.name : "") ||
      "고객";

    const templateName = instance.template?.name ?? "계약서";

    // 템플릿 HTML에 boundData 치환 (fieldMapping 적용)
    let bodyContent = instance.template?.htmlContent ?? "";
    const fieldMapping =
      instance.template?.fieldMapping &&
      typeof instance.template.fieldMapping === "object"
        ? (instance.template.fieldMapping as Record<string, string>)
        : {};

    for (const [placeholder, fieldKey] of Object.entries(fieldMapping)) {
      const value =
        typeof boundData[fieldKey] === "string"
          ? (boundData[fieldKey] as string)
          : typeof boundData[fieldKey] === "number"
          ? String(boundData[fieldKey])
          : "";
      bodyContent = bodyContent.replace(new RegExp(`{{${placeholder}}}`, "g"), value);
    }

    // 치환 후에도 남은 {{...}} 플레이스홀더는 빈 값으로 제거
    bodyContent = bodyContent.replace(/\{\{[^}]+\}\}/g, "");

    // 서명/완료 날짜
    const signedAtStr = instance.signedAt
      ? instance.signedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
      : "-";

    const createdAtStr = instance.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    // 인쇄용 HTML 생성 (브라우저에서 Ctrl+P → PDF 저장 안내 포함)
    const printHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${templateName} — ${customerName}</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 32px 24px;
      color: #1a202c;
      line-height: 1.7;
    }
    .print-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 14px;
      color: #1d4ed8;
    }
    .print-banner strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .header {
      border-bottom: 2px solid #1a2e4a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 { color: #1a2e4a; font-size: 24px; margin: 0 0 8px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .meta-table th, .meta-table td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
      font-size: 14px;
    }
    .meta-table th { background: #f7fafc; color: #2d3748; width: 28%; font-weight: 600; }
    .contract-body { margin-bottom: 32px; }
    .footer { font-size: 12px; color: #718096; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      background: #d1fae5;
      color: #065f46;
    }
  </style>
</head>
<body>
  <div class="no-print print-banner">
    <strong>📄 PDF로 저장하려면: Ctrl+P (Windows) / Cmd+P (Mac) → 대상: PDF로 저장 → 저장</strong>
    이 페이지를 인쇄하면 계약서 PDF로 저장할 수 있습니다.
  </div>

  <div class="header">
    <h1>${templateName}</h1>
    <p style="color:#718096;font-size:14px;margin:0;">마비즈 CRM 전자 계약서 | 문서 ID: ${instance.id}</p>
  </div>

  <table class="meta-table">
    <tr><th>계약자명</th><td>${customerName}</td></tr>
    <tr><th>계약서 상태</th><td><span class="status-badge">${instance.status}</span></td></tr>
    <tr><th>생성일시</th><td>${createdAtStr}</td></tr>
    <tr><th>서명일시</th><td>${signedAtStr}</td></tr>
  </table>

  <div class="contract-body">
    ${bodyContent || `<p style="color:#718096;">계약 내용이 없습니다.</p>`}
  </div>

  <div class="footer">
    이 문서는 마비즈 CRM에서 자동 생성된 전자 계약서입니다.
    출력일시: <script>document.write(new Date().toLocaleString('ko-KR'));</script>
  </div>
</body>
</html>`;

    logger.log("[GET /api/contract-instances/[id]/pdf]", { instanceId: id, customerName });

    return new NextResponse(printHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${encodeURIComponent(templateName)}_${encodeURIComponent(customerName)}.html"`,
      },
    });
  } catch (error) {
    logger.error("[GET /api/contract-instances/[id]/pdf]", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
