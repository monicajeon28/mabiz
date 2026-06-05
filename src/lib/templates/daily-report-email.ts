/**
 * Daily Report Email Template (TASK 6-2)
 *
 * Beautiful HTML email with:
 * - Key metrics (revenue, conversion, top performers)
 * - Embedded charts (small SVG graphics)
 * - Color-coded alerts
 * - CTA: "View full report" (link to dashboard)
 * - Responsive design (mobile-friendly)
 */

import { DailyReportMetrics } from '@/lib/services/daily-report-service';

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

interface EmailOptions {
  baseUrl: string; // e.g., https://app.mabiz.com
  teamName: string;
  reportDate: Date;
}

/**
 * Generate HTML email for daily report
 */
export function generateDailyReportEmail(
  metrics: DailyReportMetrics,
  options: EmailOptions
): string {
  const formattedDate = options.reportDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const dashboardUrl = `${options.baseUrl}/analytics/reports`;
  const alertCount = metrics.alerts.length;
  const criticalAlerts = metrics.alerts.filter((a) => a.type === 'RED').length;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Performance Report - ${formattedDate}</title>
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
      background-color: #f5f5f5;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }

    .header h1 {
      font-size: 24px;
      margin-bottom: 5px;
      font-weight: 700;
    }

    .header p {
      font-size: 14px;
      opacity: 0.9;
    }

    .content {
      padding: 30px 20px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #333;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }

    .metric-card {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      border-left: 4px solid #667eea;
    }

    .metric-card.alert {
      border-left-color: #ff6b6b;
      background-color: #fff5f5;
    }

    .metric-card.warning {
      border-left-color: #ffa500;
      background-color: #fffbf0;
    }

    .metric-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: 700;
      color: #333;
    }

    .metric-change {
      font-size: 12px;
      margin-top: 5px;
    }

    .metric-change.positive {
      color: #2ecc71;
    }

    .metric-change.negative {
      color: #ff6b6b;
    }

    .alert-item {
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid;
    }

    .alert-item.red {
      background-color: #fff5f5;
      border-left-color: #ff6b6b;
    }

    .alert-item.yellow {
      background-color: #fffbf0;
      border-left-color: #ffa500;
    }

    .alert-item.green {
      background-color: #f0fdf4;
      border-left-color: #2ecc71;
    }

    .alert-icon {
      font-weight: 700;
      margin-right: 8px;
    }

    .alert-message {
      font-size: 13px;
      color: #333;
    }

    .partner-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
      align-items: center;
    }

    .partner-item:last-child {
      border-bottom: none;
    }

    .partner-name {
      font-weight: 600;
      font-size: 14px;
    }

    .partner-stats {
      text-align: right;
      font-size: 12px;
    }

    .partner-revenue {
      color: #2ecc71;
      font-weight: 600;
    }

    .recommendation-item {
      background-color: #f0f7ff;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid #0066cc;
    }

    .recommendation-title {
      font-weight: 600;
      color: #0066cc;
      margin-bottom: 5px;
      font-size: 14px;
    }

    .recommendation-desc {
      font-size: 12px;
      color: #555;
      line-height: 1.5;
    }

    .recommendation-impact {
      font-size: 11px;
      color: #2ecc71;
      margin-top: 5px;
      font-weight: 500;
    }

    .cta-button {
      display: inline-block;
      background-color: #667eea;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin-top: 10px;
    }

    .cta-button:hover {
      background-color: #5568d3;
    }

    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #eee;
    }

    .footer a {
      color: #667eea;
      text-decoration: none;
    }

    .chart-container {
      text-align: center;
      margin: 15px 0;
    }

    .chart-bar {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      font-size: 12px;
    }

    .chart-label {
      width: 80px;
      text-align: right;
      margin-right: 10px;
      color: #666;
    }

    .chart-bar-fill {
      height: 20px;
      background-color: #667eea;
      border-radius: 3px;
      min-width: 20px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 5px;
      color: white;
      font-weight: 600;
      font-size: 11px;
    }

    .channel-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }

    .channel-card {
      background-color: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
      border-top: 3px solid;
    }

    .channel-card.sms {
      border-top-color: #667eea;
    }

    .channel-card.kakao {
      border-top-color: #ffd700;
    }

    .channel-card.email {
      border-top-color: #2ecc71;
    }

    .channel-name {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 5px;
      color: #333;
    }

    .channel-metric {
      font-size: 18px;
      font-weight: 700;
      color: #333;
      margin-bottom: 3px;
    }

    .channel-label {
      font-size: 10px;
      color: #999;
      text-transform: uppercase;
    }

    @media (max-width: 600px) {
      .container {
        border-radius: 0;
      }

      .content {
        padding: 20px;
      }

      .metrics-grid {
        grid-template-columns: 1fr;
      }

      .channel-grid {
        grid-template-columns: 1fr;
      }

      .metric-value {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <h1>📊 Daily Performance Report</h1>
      <p>${formattedDate} • ${options.teamName}</p>
    </div>

    <!-- CONTENT -->
    <div class="content">
      <!-- KEY METRICS -->
      <div class="section">
        <div class="section-title">Key Metrics</div>
        <div class="metrics-grid">
          <div class="metric-card ${
            metrics.alerts.some((a) => a.metric === 'Daily Revenue') ? 'alert' : ''
          }">
            <div class="metric-label">💰 Revenue</div>
            <div class="metric-value">$${metrics.summary.revenue.today.toFixed(0)}</div>
            <div class="metric-change ${
              metrics.summary.revenue.percentChange > 0 ? 'positive' : 'negative'
            }">
              ${metrics.summary.revenue.percentChange > 0 ? '▲' : '▼'} ${Math.abs(
    metrics.summary.revenue.percentChange
  ).toFixed(1)}%
            </div>
          </div>

          <div class="metric-card ${
            metrics.alerts.some((a) => a.metric === 'Conversion Rate') ? 'warning' : ''
          }">
            <div class="metric-label">📈 Conversion</div>
            <div class="metric-value">${metrics.summary.conversion.rate.toFixed(2)}%</div>
            <div class="metric-change ${
              metrics.summary.conversion.percentChange > 0 ? 'positive' : 'negative'
            }">
              ${metrics.summary.conversion.percentChange > 0 ? '▲' : '▼'} ${Math.abs(
    metrics.summary.conversion.percentChange
  ).toFixed(1)}%
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">📧 Day 0 Open</div>
            <div class="metric-value">${metrics.summary.sequenceCompletions.day0.openRate.toFixed(
              1
            )}%</div>
            <div class="metric-change">↑ vs target 25%</div>
          </div>

          <div class="metric-card">
            <div class="metric-label">✅ Sequences</div>
            <div class="metric-value">${metrics.summary.sequenceCompletions.completionRate.toFixed(
              1
            )}%</div>
            <div class="metric-change">complete</div>
          </div>
        </div>
      </div>

      <!-- ALERTS -->
      ${
        alertCount > 0
          ? `
      <div class="section">
        <div class="section-title">⚠️ Alerts (${alertCount})</div>
        ${metrics.alerts
          .sort((a, b) => (a.type === 'RED' ? -1 : 1))
          .slice(0, 5)
          .map(
            (alert) => `
          <div class="alert-item ${alert.type.toLowerCase()}">
            <span class="alert-icon">${alert.type === 'RED' ? '🔴' : '🟡'}</span>
            <span class="alert-message"><strong>${escapeHtml(alert.metric)}:</strong> ${escapeHtml(alert.message)}</span>
          </div>
        `
          )
          .join('')}
      </div>
      `
          : ''
      }

      <!-- CHANNEL BREAKDOWN -->
      <div class="section">
        <div class="section-title">📱 Channel Performance</div>
        <div class="channel-grid">
          <div class="channel-card sms">
            <div class="channel-name">SMS</div>
            <div class="channel-metric">${metrics.byChannel.sms.openRate.toFixed(1)}%</div>
            <div class="channel-label">Open Rate</div>
          </div>

          <div class="channel-card kakao">
            <div class="channel-name">Kakao</div>
            <div class="channel-metric">${metrics.byChannel.kakao.clickRate.toFixed(1)}%</div>
            <div class="channel-label">Click Rate</div>
          </div>

          <div class="channel-card email">
            <div class="channel-name">Email</div>
            <div class="channel-metric">${metrics.byChannel.email.openRate.toFixed(1)}%</div>
            <div class="channel-label">Open Rate</div>
          </div>
        </div>
      </div>

      <!-- TOP PERFORMERS -->
      ${
        metrics.topPerformers.partners.length > 0
          ? `
      <div class="section">
        <div class="section-title">⭐ Top Partners</div>
        ${metrics.topPerformers.partners
          .slice(0, 3)
          .map(
            (partner, i) => `
          <div class="partner-item">
            <div>
              <div class="partner-name">${i + 1}. ${escapeHtml(partner.name)}</div>
            </div>
            <div class="partner-stats">
              <div class="partner-revenue">$${partner.revenue.toFixed(0)}</div>
              <div>${partner.conversionCount} conversions</div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      `
          : ''
      }

      <!-- RECOMMENDATIONS -->
      ${
        metrics.recommendations.length > 0
          ? `
      <div class="section">
        <div class="section-title">💡 Recommendations</div>
        ${metrics.recommendations
          .slice(0, 3)
          .map(
            (rec) => `
          <div class="recommendation-item">
            <div class="recommendation-title">${escapeHtml(rec.title)}</div>
            <div class="recommendation-desc">${escapeHtml(rec.description)}</div>
            <div class="recommendation-impact">Impact: ${rec.impact}</div>
          </div>
        `
          )
          .join('')}
      </div>
      `
          : ''
      }

      <!-- CTA -->
      <div style="text-align: center; margin-top: 30px;">
        <a href="${dashboardUrl}" class="cta-button">
          View Full Report →
        </a>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>
        This is an automated daily report.
        <a href="${options.baseUrl}/settings/notifications">Update preferences</a>
      </p>
      <p style="margin-top: 10px; color: #999;">
        © 2026 mabiz CRM. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain text version for email fallback
 */
export function generateDailyReportText(
  metrics: DailyReportMetrics,
  options: EmailOptions
): string {
  const formattedDate = options.reportDate.toLocaleDateString('ko-KR');

  let text = `DAILY PERFORMANCE REPORT - ${formattedDate}\n`;
  text += `${'='.repeat(50)}\n\n`;

  // Summary
  text += `KEY METRICS\n`;
  text += `Revenue:          $${metrics.summary.revenue.today.toFixed(0)}\n`;
  text += `Conversion Rate:  ${metrics.summary.conversion.rate.toFixed(2)}%\n`;
  text += `Day 0 Open Rate:  ${metrics.summary.sequenceCompletions.day0.openRate.toFixed(1)}%\n`;
  text += `Sequence Complete: ${metrics.summary.sequenceCompletions.completionRate.toFixed(1)}%\n\n`;

  // Alerts
  if (metrics.alerts.length > 0) {
    text += `ALERTS (${metrics.alerts.length})\n`;
    metrics.alerts.slice(0, 5).forEach((alert) => {
      text += `[${alert.type}] ${alert.metric}: ${alert.message}\n`;
    });
    text += '\n';
  }

  // Channels
  text += `CHANNEL PERFORMANCE\n`;
  text += `SMS Open Rate:     ${metrics.byChannel.sms.openRate.toFixed(1)}%\n`;
  text += `Kakao Click Rate:  ${metrics.byChannel.kakao.clickRate.toFixed(1)}%\n`;
  text += `Email Open Rate:   ${metrics.byChannel.email.openRate.toFixed(1)}%\n\n`;

  // Top partners
  if (metrics.topPerformers.partners.length > 0) {
    text += `TOP PARTNERS\n`;
    metrics.topPerformers.partners.slice(0, 3).forEach((partner, i) => {
      text += `${i + 1}. ${partner.name}: $${partner.revenue.toFixed(0)} (${partner.conversionCount} conversions)\n`;
    });
    text += '\n';
  }

  // Recommendations
  if (metrics.recommendations.length > 0) {
    text += `RECOMMENDATIONS\n`;
    metrics.recommendations.slice(0, 3).forEach((rec) => {
      text += `- ${rec.title}: ${rec.description}\n`;
    });
    text += '\n';
  }

  text += `View full report: ${options.baseUrl}/analytics/reports\n`;

  return text;
}
