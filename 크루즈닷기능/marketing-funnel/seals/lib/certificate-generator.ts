// lib/certificate-generator.ts
// 구매확인증서 PNG 이미지 생성 (Puppeteer 사용 - 한글 폰트 지원)
// 관리자 패널 Certificate.tsx와 동일한 양식

import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { existsSync } from 'fs';
import { logger } from '@/lib/logger';

// 환경 감지 - Vercel 서버리스 환경인지 확인
const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

interface ProductDetails {
  tags?: string[];
  visitedCountries?: string[];
  destinations?: string[];
  nights?: number;
  days?: number;
  cruiseLine?: string;
  shipName?: string;
  included?: string[];
  excluded?: string[];
  refundPolicy?: string;
  hasGuide?: boolean;
  hasEscort?: boolean;
  hasCruiseDotStaff?: boolean;
  hasTravelInsurance?: boolean;
  flightIncluded?: boolean;
}

interface CertificateData {
  customerName: string;
  birthDate: string;
  productName: string;
  paymentAmount: number;
  paymentDate: string;
  orderId: string;
  managerName?: string;
  productDetails?: ProductDetails;
}

/**
 * 구매확인서 HTML 생성
 */
function generateCertificateHTML(data: CertificateData): string {
  const formattedAmount = data.paymentAmount.toLocaleString('ko-KR');
  const now = new Date();
  const issueDate = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  const pd = data.productDetails;

  // 상품 상세 정보 행들
  const detailRows: { label: string; value: string }[] = [];
  if (pd) {
    if (pd.destinations && pd.destinations.length > 0) {
      detailRows.push({ label: '목적지', value: pd.destinations.join(', ') });
    }
    if (pd.nights != null || pd.days != null) {
      // pd.days가 0일 때 truthy 체크 오류로 nights+1이 대신 표시되는 버그 수정:
      // undefined/null 여부로만 판단하고, 0은 명시적인 값으로 취급합니다.
      const nightsVal = pd.nights ?? 0;
      const daysVal = pd.days != null ? pd.days : (pd.nights != null ? pd.nights + 1 : 0);
      detailRows.push({ label: '여행기간', value: `${nightsVal}박 ${daysVal}일` });
    }
    if (pd.cruiseLine) {
      detailRows.push({ label: '크루즈 회사', value: pd.cruiseLine });
    }
    if (pd.shipName) {
      detailRows.push({ label: '선박명', value: pd.shipName });
    }
    if (pd.flightIncluded !== undefined) {
      detailRows.push({ label: '비행기', value: pd.flightIncluded ? '포함' : '불포함' });
    }
  }

  const detailRowsHTML = detailRows.length > 0
    ? `<tr>
        <td class="label-cell">상품 상세</td>
        <td class="value-cell">
          ${detailRows.map(r => `<div class="detail-row"><span class="detail-label">${r.label}:</span> ${r.value}</div>`).join('')}
        </td>
      </tr>`
    : '';

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      background: #fff;
      width: 800px;
      min-height: 1100px;
      padding: 60px 80px;
    }
    .certificate {
      display: flex;
      flex-direction: column;
      min-height: 980px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .title {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: #111827;
      margin-bottom: 5px;
    }
    .subtitle {
      font-size: 14px;
      color: #6b7280;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #d1d5db;
      margin-bottom: 20px;
    }
    .info-table tr {
      border-bottom: 1px solid #d1d5db;
    }
    .info-table tr:last-child {
      border-bottom: none;
    }
    .label-cell {
      background: #f9fafb;
      padding: 12px 16px;
      font-weight: 600;
      color: #374151;
      width: 25%;
      font-size: 14px;
      border-right: 1px solid #d1d5db;
    }
    .value-cell {
      padding: 12px 16px;
      color: #111827;
      font-size: 14px;
    }
    .value-cell.amount {
      font-weight: 700;
      font-size: 18px;
      color: #1d4ed8;
    }
    .detail-row {
      margin-bottom: 4px;
    }
    .detail-row:last-child {
      margin-bottom: 0;
    }
    .detail-label {
      font-weight: 500;
      color: #6b7280;
    }
    .footer {
      margin-top: auto;
      padding-top: 40px;
    }
    .issue-date {
      text-align: right;
      font-size: 14px;
      color: #374151;
      margin-bottom: 20px;
    }
    .company-section {
      text-align: right;
      margin-bottom: 30px;
    }
    .company-name {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 5px;
    }
    .seal {
      display: inline-block;
      width: 60px;
      height: 60px;
      border: 2px solid #dc2626;
      border-radius: 50%;
      text-align: center;
      line-height: 56px;
      font-size: 14px;
      font-weight: 700;
      color: #dc2626;
      margin-left: 10px;
    }
    .slogan {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #9ca3af;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <h1 class="title">구 매 확 인 증 서</h1>
      <p class="subtitle">Purchase Certificate</p>
    </div>

    <table class="info-table">
      <tr>
        <td class="label-cell">성명</td>
        <td class="value-cell">${data.customerName || '(고객명)'}</td>
      </tr>
      <tr>
        <td class="label-cell">생년월일</td>
        <td class="value-cell">${data.birthDate || '-'}</td>
      </tr>
      <tr>
        <td class="label-cell">상품명</td>
        <td class="value-cell">${data.productName || '(상품명)'}</td>
      </tr>
      ${detailRowsHTML}
      <tr>
        <td class="label-cell">결제금액</td>
        <td class="value-cell amount">${formattedAmount}원</td>
      </tr>
      <tr>
        <td class="label-cell">결제일자</td>
        <td class="value-cell">${data.paymentDate || '-'}</td>
      </tr>
      <tr>
        <td class="label-cell">주문번호</td>
        <td class="value-cell">${data.orderId}</td>
      </tr>
      ${data.managerName ? `
      <tr>
        <td class="label-cell">담당자</td>
        <td class="value-cell">${data.managerName}</td>
      </tr>` : ''}
    </table>

    <div class="footer">
      <div class="issue-date">${issueDate}</div>
      <div class="company-section">
        <span class="company-name">크루즈닷 대표이사</span>
        <span class="seal">인</span>
      </div>
      <div class="slogan">크루즈 첫여행 크루즈닷, 두번째 부터 행복하게 크루즈닷 감사합니다</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates a PNG image of the certificate.
 * Uses Puppeteer for proper Korean font rendering.
 */
export async function generateCertificatePng(data: CertificateData): Promise<Buffer> {
  let browser;

  try {
    logger.log('[Certificate Generator] Starting browser launch...', { isVercel });

    if (isVercel) {
      // Vercel 서버리스 환경: @sparticuz/chromium 사용
      const executablePath = await chromium.executablePath();
      logger.log('[Certificate Generator] Using chromium executable:', executablePath);

      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: { width: 800, height: 1100 },
        executablePath,
        headless: true,
      });
    } else {
      // 로컬 개발 환경: 시스템 Chrome 사용
      const possiblePaths = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        process.env.CHROME_PATH,
      ].filter(Boolean);

      let executablePath: string | undefined;
      for (const path of possiblePaths) {
        if (path && existsSync(path)) {
          executablePath = path;
          break;
        }
      }

      if (!executablePath) {
        throw new Error('Chrome/Chromium 브라우저를 찾을 수 없습니다. 로컬 환경에서 Chrome을 설치해주세요.');
      }

      logger.log('[Certificate Generator] Using local Chrome:', executablePath);

      browser = await puppeteerCore.launch({
        headless: true,
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ],
      });
    }

    logger.log('[Certificate Generator] Browser launched successfully');

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1100, deviceScaleFactor: 2 });

    // 한글 폰트 지원 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    // HTML 생성 및 로드
    const html = generateCertificateHTML(data);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // 폰트 로드 대기
    await page.evaluateHandle(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 스크린샷으로 PNG 생성
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      omitBackground: false,
    });

    logger.log(`[Certificate Generator] PNG generated successfully (${screenshot.length} bytes)`);
    return Buffer.from(screenshot);

  } catch (error: unknown) {
    logger.error('[Certificate Generator] Error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Test function for local development
 */
export async function testCertificateGeneration(): Promise<void> {
  const testData: CertificateData = {
    customerName: '홍길동',
    birthDate: '1990-01-01',
    productName: 'MSC 그랜디오사 지중해 7박 8일',
    paymentAmount: 2500000,
    paymentDate: new Date().toISOString().split('T')[0],
    orderId: 'TEST-ORDER-12345',
    managerName: '김담당',
  };

  try {
    logger.log('[Test] Generating certificate...');
    const buffer = await generateCertificatePng(testData);
    logger.log(`[Test] Certificate generated successfully (${buffer.length} bytes)`);
    return;
  } catch (error) {
    logger.error('[Test] Certificate generation failed:', error);
    throw error;
  }
}
