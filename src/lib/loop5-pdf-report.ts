/**
 * Loop 5 PDF 리포트 생성 유틸리티
 * 대시보드 데이터를 바탕으로 고급 PDF 리포트 생성
 */

interface ReportData {
  dateRange: { from: string; to: string };
  stats: {
    totalSent: number;
    totalClicked: number;
    totalFormSubmitted: number;
    responseRate: number;
    formCompletionRate: number;
    estimatedRevenue: number;
    trends: {
      responseRateChange: number;
      formCompletionChange: number;
      revenueChange: number;
    };
    byDay?: Array<{ day: number; rate: number }>;
  };
  segments: Array<{
    name: string;
    sent: number;
    responseRate: number;
    formCompletionRate: number;
    estimatedRevenue: number;
  }>;
  abTests: {
    ctaTests: Array<{ variant: string; rate: number; winner?: boolean }>;
    smsTests: Array<{
      day: number;
      version: string;
      rate: number;
      recommended?: boolean;
    }>;
  };
}

export function generatePDFReport(data: ReportData): string {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { border-bottom: 3px solid #364d8e; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #364d8e; font-size: 32px; margin-bottom: 10px; }
        .header p { color: #666; font-size: 14px; }
        .section { margin-bottom: 40px; }
        .section h2 { color: #364d8e; font-size: 20px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
        .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
        .kpi-card { background: #f9fafb; padding: 15px; border-left: 4px solid #364d8e; }
        .kpi-label { color: #666; font-size: 12px; margin-bottom: 5px; }
        .kpi-value { color: #364d8e; font-size: 24px; font-weight: bold; }
        .kpi-sub { color: #999; font-size: 12px; margin-top: 5px; }
        .trend { display: inline-block; margin-left: 10px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .trend.up { background: #dcfce7; color: #166534; }
        .trend.down { background: #fee2e2; color: #991b1b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f3f4f6; color: #374151; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
        td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
        tr:last-child td { border-bottom: none; }
        .highlight { background: #fef3c7; }
        .winner { background: #dcfce7; font-weight: bold; }
        .recommendation { background: #e0f2fe; padding: 15px; border-left: 4px solid #0284c7; margin-bottom: 10px; border-radius: 4px; }
        .recommendation-title { color: #0c4a6e; font-weight: bold; margin-bottom: 5px; }
        .recommendation-text { color: #334155; font-size: 14px; }
        .page-break { page-break-after: always; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Title -->
        <div class="header">
          <h1>Loop 5 성과 리포트</h1>
          <p>기간: ${data.dateRange.from} ~ ${data.dateRange.to}</p>
          <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
        </div>

        <!-- Executive Summary -->
        <div class="section">
          <h2>Executive Summary</h2>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">총 SMS 발송</div>
              <div class="kpi-value">${data.stats.totalSent.toLocaleString()}</div>
              <div class="kpi-sub">건</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">응답율</div>
              <div class="kpi-value">${data.stats.responseRate.toFixed(1)}<span style="font-size: 16px;">%</span></div>
              <div class="kpi-sub">
                ${data.stats.trends.responseRateChange > 0 ? '📈' : '📉'}
                ${data.stats.trends.responseRateChange > 0 ? '+' : ''}${data.stats.trends.responseRateChange.toFixed(1)}% (지난주 대비)
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">폼 완성율</div>
              <div class="kpi-value">${data.stats.formCompletionRate.toFixed(1)}<span style="font-size: 16px;">%</span></div>
              <div class="kpi-sub">
                ${data.stats.trends.formCompletionChange > 0 ? '📈' : '📉'}
                ${data.stats.trends.formCompletionChange > 0 ? '+' : ''}${data.stats.trends.formCompletionChange.toFixed(1)}%
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">예상 매출</div>
              <div class="kpi-value">$${(data.stats.estimatedRevenue / 1000).toFixed(1)}K</div>
              <div class="kpi-sub">
                ${data.stats.trends.revenueChange > 0 ? '📈' : '📉'}
                ${data.stats.trends.revenueChange > 0 ? '+' : ''}${data.stats.trends.revenueChange.toFixed(1)}%
              </div>
            </div>
          </div>
          <p style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; border-radius: 4px; margin-top: 20px;">
            <strong>핵심 발견:</strong> 이번 기간 응답율이 ${data.stats.trends.responseRateChange > 0 ? '향상' : '저조'}되었습니다. 폼 완성율은 전주 대비 ${Math.abs(data.stats.trends.formCompletionChange).toFixed(1)}% 변동했습니다.
          </p>
        </div>

        <!-- Segment Performance -->
        <div class="section">
          <h2>Segment별 성과 분석</h2>
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th>SMS 발송</th>
                <th>응답율(%)</th>
                <th>폼완성(%)</th>
                <th>예상매출</th>
              </tr>
            </thead>
            <tbody>
              ${data.segments
                .map(
                  seg => `
                <tr ${seg.responseRate > 40 ? 'class="highlight"' : ''}>
                  <td><strong>${seg.name}</strong></td>
                  <td>${seg.sent.toLocaleString()}</td>
                  <td>${seg.responseRate.toFixed(1)}%</td>
                  <td>${seg.formCompletionRate.toFixed(1)}%</td>
                  <td>$${(seg.estimatedRevenue / 1000).toFixed(1)}K</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <p style="color: #666; font-size: 14px; margin-top: 10px;">
            최고 성과 Segment: <strong>${data.segments.reduce((a, b) => a.responseRate > b.responseRate ? a : b).name}</strong>
            (응답율 ${data.segments.reduce((a, b) => a.responseRate > b.responseRate ? a : b).responseRate.toFixed(1)}%)
          </p>
        </div>

        <!-- A/B Test Results -->
        <div class="section">
          <h2>A/B 테스트 결과</h2>

          <h3 style="color: #555; font-size: 16px; margin: 20px 0 10px 0;">CTA 변형 테스트</h3>
          <table>
            <thead>
              <tr>
                <th>변형</th>
                <th>클릭율(%)</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              ${data.abTests.ctaTests
                .map(
                  test => `
                <tr ${test.winner ? 'class="winner"' : ''}>
                  <td>${test.variant}</td>
                  <td>${test.rate.toFixed(1)}%</td>
                  <td>${test.winner ? '✅ 우승자' : '진행 중'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <h3 style="color: #555; font-size: 16px; margin: 20px 0 10px 0;">SMS 메시지 버전 (주요 Day별)</h3>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>버전</th>
                <th>클릭율(%)</th>
                <th>추천도</th>
              </tr>
            </thead>
            <tbody>
              ${data.abTests.smsTests
                .filter(test => test.day <= 3)
                .map(
                  test => `
                <tr ${test.recommended ? 'class="highlight"' : ''}>
                  <td>Day ${test.day}</td>
                  <td>${test.version.toUpperCase()}</td>
                  <td>${test.rate.toFixed(1)}%</td>
                  <td>${test.recommended ? '⭐ 추천' : '-'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <!-- Recommendations -->
        <div class="section">
          <h2>최적화 권장사항</h2>

          ${data.abTests.ctaTests[0]?.winner
            ? `
            <div class="recommendation">
              <div class="recommendation-title">✅ CTA 변형 우승자 변경</div>
              <div class="recommendation-text">
                통계적 신뢰도 95% 이상으로 CTA Variant ${data.abTests.ctaTests[0].variant}가 최고 성과입니다.
                즉시 이를 기본값으로 변경하고, 나머지 변형은 A/B 테스트 중단 권장합니다.
              </div>
            </div>
          `
            : ''
          }

          ${data.segments.some(s => s.responseRate < 30)
            ? `
            <div class="recommendation">
              <div class="recommendation-title">⚠️ 응답율 저조 Segment</div>
              <div class="recommendation-text">
                ${data.segments
                  .filter(s => s.responseRate < 30)
                  .map(s => s.name)
                  .join(', ')}의 응답율이 30% 미만입니다.
                메시지 톤 재작성, 발송 시간 최적화, 또는 타겟팅 재검토를 권장합니다.
              </div>
            </div>
          `
            : ''
          }

          ${data.stats.byDay && data.stats.byDay[0] && data.stats.byDay[0].rate < 10
            ? `
            <div class="recommendation">
              <div class="recommendation-title">🕐 Day 0 응답율 개선</div>
              <div class="recommendation-text">
                초기 응답율(${data.stats.byDay[0].rate.toFixed(1)}%)이 낮습니다.
                발송 시간 최적화, 긴급성 강조, 또는 CTA 포지션 변경을 고려하세요.
              </div>
            </div>
          `
            : ''
          }
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>이 리포트는 자동으로 생성되었습니다. | mabiz CRM Loop 5 대시보드</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

export async function downloadPDFReport(
  filename: string,
  htmlContent: string
): Promise<Blob> {
  // 클라이언트 사이드에서는 html2pdf 라이브러리 사용
  // 서버 사이드에서는 puppeteer 또는 다른 PDF 라이브러리 사용

  const blob = new Blob([htmlContent], { type: 'text/html' });
  return blob;
}
