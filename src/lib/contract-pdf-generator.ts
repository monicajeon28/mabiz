/**
 * 계약서 PDF 생성 (감사추적 포함)
 *
 * Puppeteer를 사용해 HTML 템플릿 → PDF 변환
 * - generatePartnerContractPDF: 파트너 어필리에이트 계약서
 * - generateContractPdf: 계약서 + 감사추적 로그 포함
 */

import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { logger } from '@/lib/logger';
import { DEFAULT_CONTRACT_TEMPLATES, AFFILIATE_CONTRACT_TEMPLATE } from '@/lib/contract-templates-data';

// puppeteer / puppeteer-core 공통 최소 인터페이스 (Browser 타입 충돌 회피)
type PdfPage = {
  setContent: (html: string, opts?: { waitUntil?: string }) => Promise<void>;
  setViewport: (vp: { width: number; height: number }) => Promise<void>;
  pdf: (opts?: Record<string, unknown>) => Promise<Uint8Array>;
  close: () => Promise<void>;
};
type LaunchedBrowser = { newPage: () => Promise<PdfPage>; close: () => Promise<void>; connected?: boolean };

interface AuditLogRecord {
  id: string | number | bigint;
  action: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  status: string;
  errorMessage?: string | null;
  changeDescription?: string | null;
}

interface ContractPdfOptions {
  contractId: string;
  templateName: string;
  issueDate: Date;
  contactName?: string;
  contactEmail?: string;
  contractStatus?: string;
  signedAt?: Date;
  auditLogs?: AuditLogRecord[];
}

let browserInstance: LaunchedBrowser | null = null;

async function getBrowser(): Promise<LaunchedBrowser> {
  if (browserInstance && browserInstance.connected !== false) return browserInstance;
  // Vercel/Lambda 서버리스: puppeteer-core + @sparticuz/chromium (번들 Chromium은 서버리스 미동작)
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless) {
    const executablePath = await chromium.executablePath();
    browserInstance = (await puppeteerCore.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    })) as unknown as LaunchedBrowser;
  } else {
    browserInstance = (await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })) as unknown as LaunchedBrowser;
  }
  return browserInstance;
}

// 확정 용어: BRANCH_MANAGER=대리점장2 / SALES_AGENT=대리점장1 / PRE_SALES=마케터 / BRANCH_OFFICE=지사
const ROLE_LABELS: Record<string, string> = {
  BRANCH_MANAGER: '대리점장2',
  SALES_AGENT: '대리점장1',
  PRE_SALES: '마케터',
  BRANCH_OFFICE: '지사',
  HQ: '본사',
};

/**
 * 파트너 어필리에이트 계약서 PDF 생성
 */
export async function generatePartnerContractPDF(
  partnerId: string,
  partnerName: string,
  partnerRole: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'PRE_SALES' | 'HQ' | 'BRANCH_OFFICE',
  contractSignedAt: Date,
  signatureImageUrl?: string
): Promise<Uint8Array> {
  const roleLabel = ROLE_LABELS[partnerRole] || partnerRole;

  // 계약 본문 조항(제1조~) — grade별 계약 템플릿 전체를 PDF에 그대로 포함(서명+내용 완비).
  // ⚠️ partnerRole(역할 라벨용)을 그대로 템플릿키로 쓰면 금액 오매핑(대리점장1 540이 330짜리)됨.
  //    금액 정합 매핑: 마케터330(PRE_SALES)→SALES_AGENT(330만) / 대리점장1=540(SALES_AGENT)→
  //    CRUISE_STAFF(540만) / 대리점장2=750(BRANCH_MANAGER)→BRANCH_MANAGER(750만).
  const TEMPLATE_KEY_BY_ROLE: Record<string, string> = {
    PRE_SALES: 'SALES_AGENT',       // 330만
    SALES_AGENT: 'CRUISE_STAFF',    // 540만
    BRANCH_MANAGER: 'BRANCH_MANAGER', // 750만
    BRANCH_OFFICE: 'BRANCH_OFFICE', // 지사 협력계약(금액 없음)
    HQ: 'AFFILIATE',
  };
  const templateKey = TEMPLATE_KEY_BY_ROLE[partnerRole] ?? 'AFFILIATE';
  const template = DEFAULT_CONTRACT_TEMPLATES[templateKey] ?? AFFILIATE_CONTRACT_TEMPLATE;
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const articlesHtml = template.sections
    .map((sec) => `
      <div class="article">
        <h3 class="article-title">${escapeHtml(sec.title)}</h3>
        <p class="article-content">${escapeHtml(sec.content).replace(/\n/g, '<br/>')}</p>
      </div>`)
    .join('');

  // HTML 템플릿 생성
  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>파트너 어필리에이트 계약서</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Noto Sans KR', sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 28px;
      color: #1e3a5f;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 14px;
      color: #666;
    }
    .info-section {
      margin-bottom: 30px;
    }
    .info-section h2 {
      font-size: 16px;
      color: #1e3a5f;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
    }
    .info-row {
      display: flex;
      margin-bottom: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label {
      width: 150px;
      font-weight: 600;
      color: #555;
      flex-shrink: 0;
    }
    .info-value {
      flex: 1;
      color: #333;
    }
    .contract-body {
      margin-top: 32px;
    }
    .contract-body > h2 {
      font-size: 17px;
      color: #1a1a2e;
      margin-bottom: 16px;
      text-align: center;
    }
    .article {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .article-title {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 6px;
    }
    .article-content {
      font-size: 12.5px;
      line-height: 1.7;
      color: #333;
      margin: 0;
      white-space: normal;
    }
    .signature-section {
      margin-top: 50px;
      text-align: center;
    }
    .signature-image {
      max-width: 200px;
      max-height: 100px;
      margin: 20px 0;
      border: 1px solid #ddd;
      padding: 10px;
      display: inline-block;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    .stamp {
      display: inline-block;
      padding: 10px 20px;
      border: 2px solid #1e3a5f;
      border-radius: 50%;
      color: #1e3a5f;
      font-weight: bold;
      margin: 20px 0;
      transform: rotate(-15deg);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚢 파트너 어필리에이트 계약서</h1>
      <p>크루즈닷 CRM 시스템</p>
    </div>

    <div class="info-section">
      <h2>파트너 정보</h2>
      <div class="info-row">
        <div class="info-label">파트너명</div>
        <div class="info-value">${partnerName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">역할</div>
        <div class="info-value">${roleLabel}</div>
      </div>
      <div class="info-row">
        <div class="info-label">파트너 ID</div>
        <div class="info-value">${partnerId}</div>
      </div>
    </div>

    <div class="info-section">
      <h2>계약 정보</h2>
      <div class="info-row">
        <div class="info-label">계약 서명일</div>
        <div class="info-value">${contractSignedAt.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })}</div>
      </div>
      <div class="info-row">
        <div class="info-label">계약 상태</div>
        <div class="info-value">✅ 서명 완료</div>
      </div>
    </div>

    <div class="contract-body">
      <h2>${escapeHtml(template.title)}</h2>
      ${articlesHtml}
    </div>

    ${
      signatureImageUrl
        ? `
    <div class="signature-section">
      <h2>서명</h2>
      <img src="${signatureImageUrl}" alt="서명" class="signature-image" />
      <p style="color: #666; font-size: 12px;">위 파트너가 본 계약서에 서명하였습니다.</p>
    </div>
    `
        : ''
    }

    <div class="footer">
      <p>본 계약서는 크루즈닷 CRM 시스템에서 자동 생성되었습니다.</p>
      <p>생성 일시: ${new Date().toLocaleString('ko-KR')}</p>
      <p>문의: jmonica@cruisedot.co.kr</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  let page: PdfPage | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // HTML 콘텐츠 설정
    await page.setContent(htmlContent, { waitUntil: 'load' });

    // PDF 생성
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      printBackground: true,
    });

    logger.log('[ContractPDF] PDF 생성 완료', {
      partnerId,
      partnerName,
      pdfSize: pdfBuffer.length,
    });

    return pdfBuffer;
  } catch (error) {
    logger.error('[ContractPDF] PDF 생성 실패', {
      partnerId,
      partnerName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (page) await page.close().catch(() => {}); // throw 시에도 page 정리(누수 방지)
  }
}

/**
 * 감사추적 로그 HTML 테이블 생성
 */
function generateAuditLogTable(auditLogs?: AuditLogRecord[]): string {
  if (!auditLogs || auditLogs.length === 0) {
    return '<p style="color: #999; font-size: 14px;">감사추적 기록 없음</p>';
  }

  const rows = auditLogs
    .map(
      (log) => `
    <tr>
      <td>${new Date(log.createdAt).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}</td>
      <td>${escapeHtml(log.action)}</td>
      <td>${log.userId ? escapeHtml(log.userId) : '-'}</td>
      <td>${log.ipAddress ? escapeHtml(log.ipAddress) : '-'}</td>
      <td>${log.status === 'SUCCESS' ? '✅ 성공' : '❌ 실패'}</td>
      <td style="font-size: 12px;">${
        log.changeDescription
          ? escapeHtml(log.changeDescription)
          : log.errorMessage
            ? `오류: ${escapeHtml(log.errorMessage)}`
            : '-'
      }</td>
    </tr>
  `
    )
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background-color: #f0f0f0; border: 1px solid #ddd;">
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">시간</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">작업</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">사용자</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">IP</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">상태</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">상세</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * HTML 특수문자 이스케이프
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * 계약서 감사추적 포함 PDF 생성
 */
export async function generateContractPdf(
  options: ContractPdfOptions
): Promise<Uint8Array> {
  const {
    contractId,
    templateName,
    issueDate,
    contactName = '미지정',
    contactEmail = '-',
    contractStatus = 'COMPLETED',
    signedAt,
    auditLogs = [],
  } = options;

  const auditTableHtml = generateAuditLogTable(auditLogs);
  const statusBadge =
    contractStatus === 'COMPLETED'
      ? '✅ 체결 완료'
      : contractStatus === 'SENT'
        ? '📧 발송됨'
        : contractStatus === 'SIGNED'
          ? '✍️ 서명됨'
          : '📝 작성 중';

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>계약서 - ${templateName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
    }
    .container {
      max-width: 950px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #1e3a5f;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 26px;
      color: #1e3a5f;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 13px;
      color: #666;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-section {
      page-break-inside: avoid;
    }
    .info-section h2 {
      font-size: 15px;
      color: #1e3a5f;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #ddd;
    }
    .info-row {
      display: flex;
      margin-bottom: 10px;
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label {
      width: 140px;
      font-weight: 600;
      color: #555;
      flex-shrink: 0;
      font-size: 13px;
    }
    .info-value {
      flex: 1;
      color: #333;
      font-size: 13px;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      color: #333;
      font-weight: 500;
    }
    .audit-section {
      margin-top: 30px;
      page-break-inside: avoid;
    }
    .audit-section h2 {
      font-size: 15px;
      color: #1e3a5f;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #ddd;
    }
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #999;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-date {
      margin-top: 20px;
      padding: 15px;
      background-color: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .container { max-width: 100%; padding: 40px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 계약서</h1>
      <p>${escapeHtml(templateName)}</p>
    </div>

    <div class="info-grid">
      <div class="info-section">
        <h2>계약 정보</h2>
        <div class="info-row">
          <div class="info-label">계약 ID</div>
          <div class="info-value"><code>${escapeHtml(contractId)}</code></div>
        </div>
        <div class="info-row">
          <div class="info-label">계약 템플릿</div>
          <div class="info-value">${escapeHtml(templateName)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">발급일</div>
          <div class="info-value">${issueDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}</div>
        </div>
        <div class="info-row">
          <div class="info-label">상태</div>
          <div class="info-value"><span class="status-badge">${statusBadge}</span></div>
        </div>
      </div>

      <div class="info-section">
        <h2>계약자 정보</h2>
        <div class="info-row">
          <div class="info-label">이름</div>
          <div class="info-value">${escapeHtml(contactName)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">이메일</div>
          <div class="info-value">${escapeHtml(contactEmail)}</div>
        </div>
        ${
          signedAt
            ? `
        <div class="info-row">
          <div class="info-label">서명일시</div>
          <div class="info-value">${signedAt.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}</div>
        </div>
        `
            : ''
        }
      </div>
    </div>

    <div class="audit-section">
      <h2>감사 추적 기록</h2>
      ${auditTableHtml}
    </div>

    <div class="footer">
      <p>본 계약서는 마비즈 CRM 시스템에서 자동 생성되었습니다.</p>
      <p>생성 일시: ${new Date().toLocaleString('ko-KR')}</p>
      <p>문의: support@mabiz.io</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // 페이지 크기 및 마진 설정
    await page.setViewport({ width: 1200, height: 1600 });
    await page.setContent(htmlContent, { waitUntil: 'load' });

    // PDF 생성 (A4 크기, 20px 마진)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
      printBackground: true,
      displayHeaderFooter: false,
    });

    await page.close();

    logger.log('[ContractPDF] 감사추적 포함 PDF 생성 완료', {
      contractId,
      templateName,
      auditLogCount: auditLogs.length,
      pdfSize: pdfBuffer.length,
    });

    return pdfBuffer;
  } catch (error) {
    logger.error('[ContractPDF] PDF 생성 실패', {
      contractId,
      templateName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 브라우저 인스턴스 종료 (서버 종료 시 호출)
 */
export async function closePDFBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
