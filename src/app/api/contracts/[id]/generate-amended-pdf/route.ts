import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import puppeteer from "puppeteer";
import { logger } from "@/lib/logger";

interface AmendedPdfRequest {
  modificationRequestId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  let browser;
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id: contractId } = resolvedParams;

    let body: AmendedPdfRequest;
    try {
      body = (await req.json()) as AmendedPdfRequest;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // 1️⃣ 데이터 로드
    const contract = await prisma.contractInstance.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // 권한 확인
    const isOwner = contract.contactId === session.userId;
    const isOrgAdmin = contract.organizationId === session.organizationId &&
                      (session.role === "OWNER" || session.role === "AGENT");

    if (!isOwner && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const modRequest = await prisma.contractModificationRequest.findUnique({
      where: { id: body.modificationRequestId },
    });

    if (!modRequest) {
      return NextResponse.json(
        { error: "Modification request not found" },
        { status: 404 }
      );
    }

    // 템플릿 정보 로드
    const template = await prisma.contractTemplate.findUnique({
      where: { id: contract.templateId },
      select: { name: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // 고객 정보 로드
    const contact = contract.contactId
      ? await prisma.contact.findUnique({
          where: { id: contract.contactId },
          select: { name: true },
        })
      : null;

    // 2️⃣ HTML 생성 (수정 사항 강조)
    const boundData = contract.boundData as any;
    const html = generateAmendedPdfHtml(
      template.name,
      boundData,
      modRequest,
      contact?.name || "고객"
    );

    // 3️⃣ Puppeteer PDF 생성
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    } as any);
    const page = await (browser as any).newPage();
    await page.setContent(html, { waitUntil: "networkidle2" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
    });

    const fileName = `contract-${contractId}-amended-${Date.now()}.pdf`;

    logger.log("[GenerateAmendedPdf] PDF 생성 성공", {
      contractId,
      modificationRequestId: body.modificationRequestId,
      fileName,
    });

    // 5️⃣ 응답
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[AMENDED_PDF_ERROR]", error);
    logger.error("[GenerateAmendedPdf] PDF 생성 실패", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.error("[BrowserCloseError]", err);
      }
    }
  }
}

function generateAmendedPdfHtml(
  templateName: string,
  boundData: any,
  modRequest: any,
  customerName: string
): string {
  const fieldMods = modRequest.fieldModifications as any;
  const mods = Array.isArray(fieldMods) ? fieldMods : [fieldMods];

  const modificationsHtml = mods
    .map(
      (mod: any) => `
    <div style="margin: 20px 0; padding: 16px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
      <p style="color: #856404; font-weight: 600; margin: 0 0 12px 0;">📌 ${mod.fieldName}</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 12px 0;">
        <div>
          <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">변경 전:</p>
          <div style="background: #f9f9f9; padding: 12px; border: 1px solid #ddd; border-radius: 4px;">
            <code style="color: #333; font-family: 'Courier New', monospace; word-break: break-word;">
              ${escapeHtml(String(mod.oldValue))}
            </code>
          </div>
        </div>
        <div>
          <p style="color: #2e7d32; font-size: 12px; margin: 0 0 8px 0;">변경 후:</p>
          <div style="background: #e8f5e9; padding: 12px; border: 2px solid #4caf50; border-radius: 4px;">
            <code style="color: #2e7d32; font-family: 'Courier New', monospace; font-weight: bold; word-break: break-word;">
              ${escapeHtml(String(mod.newValue))}
            </code>
          </div>
        </div>
      </div>
      ${mod.reason ? `<p style="color: #666; font-size: 13px; margin: 12px 0 0 0;"><strong>사유:</strong> ${escapeHtml(mod.reason)}</p>` : ""}
    </div>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>수정된 계약서 - ${escapeHtml(templateName)}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #fff;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          margin: -40px -20px 30px -20px;
          border-radius: 0;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        .alert-box {
          background: #fee;
          border: 2px solid #fcc;
          border-left: 6px solid #f88;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .alert-box strong {
          color: #c33;
          display: block;
          margin-bottom: 8px;
        }
        .alert-box p {
          color: #633;
          font-size: 14px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin: 30px 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
        }
        table th {
          background: #f3f4f6;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #d1d5db;
        }
        table td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        table tr:nth-child(even) {
          background: #fafafa;
        }
        .modification-item {
          margin: 20px 0;
          padding: 16px;
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 4px;
        }
        .modification-item h4 {
          color: #856404;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .before-after {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 12px 0;
        }
        .before-box, .after-box {
          padding: 12px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          word-break: break-word;
        }
        .before-box {
          background: #f9f9f9;
          border: 1px solid #ddd;
          color: #666;
        }
        .before-box::before {
          content: "변경 전: ";
          display: block;
          font-size: 12px;
          color: #999;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .after-box {
          background: #e8f5e9;
          border: 2px solid #4caf50;
          color: #2e7d32;
          font-weight: bold;
        }
        .after-box::before {
          content: "변경 후: ";
          display: block;
          font-size: 12px;
          color: #2e7d32;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .metadata {
          background: #f3f4f6;
          padding: 16px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .metadata-row {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 16px;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .metadata-row:last-child {
          border-bottom: none;
        }
        .metadata-label {
          font-weight: 600;
          color: #374151;
        }
        .metadata-value {
          color: #6b7280;
          word-break: break-word;
        }
        .checkmark {
          color: #10b981;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 ${escapeHtml(templateName)}</h1>
          <p>수정된 계약서 (Amended Contract)</p>
        </div>

        <div class="alert-box">
          <strong>⚠️ 중요 알림</strong>
          <p>
            이 계약서는 고객의 재서명을 완료한 수정 계약서입니다.<br>
            아래의 항목들이 원본으로부터 변경되었습니다.
          </p>
        </div>

        <div class="section-title">🔄 수정 항목</div>
        ${modificationsHtml}

        <div class="section-title">📋 계약 정보</div>
        <div class="metadata">
          <div class="metadata-row">
            <div class="metadata-label">고객명</div>
            <div class="metadata-value">${escapeHtml(customerName)}</div>
          </div>
          <div class="metadata-row">
            <div class="metadata-label">계약서 ID</div>
            <div class="metadata-value"><code>${escapeHtml(modRequest.contractId)}</code></div>
          </div>
          <div class="metadata-row">
            <div class="metadata-label">재서명 완료일</div>
            <div class="metadata-value">${new Date().toLocaleString("ko-KR")}</div>
          </div>
          <div class="metadata-row">
            <div class="metadata-label">상태</div>
            <div class="metadata-value"><span class="checkmark">✓ 최종 확정</span></div>
          </div>
          ${modRequest.respondedAt ? `
          <div class="metadata-row">
            <div class="metadata-label">승인 일시</div>
            <div class="metadata-value">${new Date(modRequest.respondedAt).toLocaleString("ko-KR")}</div>
          </div>
          ` : ""}
        </div>

        <div class="footer">
          <p>
            이 계약서는 수정 승인 후 재서명되었습니다.<br>
            모든 변경 사항은 감사 로그에 기록되며, 필요 시 조회하실 수 있습니다.
          </p>
          <p style="margin-top: 12px; color: #9ca3af;">
            마비즈 CRM 시스템 | ${new Date().getFullYear()}년
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
