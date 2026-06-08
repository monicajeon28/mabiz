/**
 * 파트너 어필리에이트 계약서 PDF 생성
 *
 * puppeteer를 사용해 HTML 템플릿 → PDF 변환
 */

import puppeteer, { Browser } from 'puppeteer';
import { logger } from '@/lib/logger';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

const ROLE_LABELS: Record<string, string> = {
  BRANCH_MANAGER: '대리점장',
  SALES_AGENT: '판매원',
  PRE_SALES: '프리세일즈',
  HQ: '본사',
};

/**
 * 파트너 어필리에이트 계약서 PDF 생성
 */
export async function generatePartnerContractPDF(
  partnerId: string,
  partnerName: string,
  partnerRole: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'PRE_SALES' | 'HQ',
  contractSignedAt: Date,
  signatureImageUrl?: string
): Promise<Buffer> {
  const roleLabel = ROLE_LABELS[partnerRole] || partnerRole;

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

  try {
    const browser = await getBrowser();
    const page = await browser.createPage();

    // HTML 콘텐츠 설정
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // PDF 생성
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      printBackground: true,
    });

    await page.close();

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
