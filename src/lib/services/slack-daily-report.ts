/**
 * Slack Daily Report Integration (TASK 6-2)
 *
 * Posts daily performance report to Slack #sales-metrics channel
 * Format: Readable text + emoji indicators
 *
 * Integration with slack-notifier.ts
 */

import { logger } from '@/lib/logger';
import { DailyReportMetrics } from '@/lib/services/daily-report-service';

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: any[];
  elements?: any[];
  accessory?: any;
  [key: string]: any;
}

interface SlackMessage {
  channel: string;
  blocks: SlackBlock[];
  text: string; // Fallback text
}

/**
 * Generate Slack message for daily report
 */
export function generateDailyReportSlackMessage(
  metrics: DailyReportMetrics,
  reportDate: Date,
  webhookUrl: string
): SlackMessage {
  const formattedDate = reportDate.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  });

  const criticalAlerts = metrics.alerts.filter((a) => a.type === 'RED');
  const warnings = metrics.alerts.filter((a) => a.type === 'YELLOW');

  // Revenue indicator
  const revenueEmoji =
    metrics.summary.revenue.today >= 5000
      ? '✅'
      : metrics.summary.revenue.today >= 3000
        ? '⚠️'
        : '🔴';
  const revenueTrend = metrics.summary.revenue.percentChange > 5 ? '📈' : metrics.summary.revenue.percentChange < -5 ? '📉' : '➡️';

  // Conversion indicator
  const conversionEmoji =
    metrics.summary.conversion.rate >= 3.0
      ? '✅'
      : metrics.summary.conversion.rate >= 2.0
        ? '⚠️'
        : '🔴';

  // Build blocks
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `📊 Daily Performance: ${formattedDate}`,
    },
  });

  // Summary metrics
  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `${revenueEmoji} *Revenue*\n$${metrics.summary.revenue.today.toFixed(0)}\n${revenueTrend} ${
          metrics.summary.revenue.percentChange > 0 ? '+' : ''
        }${metrics.summary.revenue.percentChange.toFixed(1)}%`,
      },
      {
        type: 'mrkdwn',
        text: `${conversionEmoji} *Conversion*\n${metrics.summary.conversion.rate.toFixed(2)}%\n${
          metrics.summary.conversion.percentChange > 0 ? '▲' : '▼'
        } ${Math.abs(metrics.summary.conversion.percentChange).toFixed(1)}%`,
      },
      {
        type: 'mrkdwn',
        text: `📧 *Day 0 Open*\n${metrics.summary.sequenceCompletions.day0.openRate.toFixed(1)}%\n${
          metrics.summary.sequenceCompletions.day0.openRate > 25 ? '✨' : '➡️'
        } vs 25% target`,
      },
      {
        type: 'mrkdwn',
        text: `✅ *Sequences*\n${metrics.summary.sequenceCompletions.completionRate.toFixed(1)}%\n${
          metrics.summary.sequenceCompletions.completionRate > 50 ? '✓' : '⚠️'
        } complete`,
      },
    ],
  });

  // Channel breakdown
  blocks.push({
    type: 'divider',
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Channel Performance*`,
    },
  });

  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `📱 *SMS*\nSent: ${metrics.byChannel.sms.sent}\nOpen: ${metrics.byChannel.sms.openRate.toFixed(1)}%\nClick: ${metrics.byChannel.sms.clickRate.toFixed(1)}%`,
      },
      {
        type: 'mrkdwn',
        text: `💬 *Kakao*\nSent: ${metrics.byChannel.kakao.sent}\nOpen: ${metrics.byChannel.kakao.openRate.toFixed(1)}%\nClick: ${metrics.byChannel.kakao.clickRate.toFixed(1)}%`,
      },
      {
        type: 'mrkdwn',
        text: `📨 *Email*\nSent: ${metrics.byChannel.email.sent}\nOpen: ${metrics.byChannel.email.openRate.toFixed(1)}%\nClick: ${metrics.byChannel.email.clickRate.toFixed(1)}%`,
      },
    ],
  });

  // Top partners
  if (metrics.topPerformers.partners.length > 0) {
    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⭐ Top Partners Today*`,
      },
    });

    const topPartnerText = metrics.topPerformers.partners
      .slice(0, 3)
      .map((p, i) => `${i + 1}. ${p.name}: $${p.revenue.toFixed(0)} (${p.conversionCount} conversions, ${p.conversionRate.toFixed(1)}%)`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: topPartnerText,
      },
    });
  }

  // Alerts
  if (criticalAlerts.length > 0) {
    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚨 *CRITICAL ALERTS (${criticalAlerts.length})*`,
      },
    });

    criticalAlerts.slice(0, 3).forEach((alert) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *${alert.metric}*: ${alert.message}`,
        },
      });
    });
  }

  if (warnings.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *WARNINGS (${warnings.length})*`,
      },
    });

    warnings.slice(0, 2).forEach((alert) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• ${alert.metric}: ${alert.message}`,
        },
      });
    });
  }

  // Recommendations
  if (metrics.recommendations.length > 0) {
    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💡 *Key Recommendations*`,
      },
    });

    metrics.recommendations.slice(0, 2).forEach((rec) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *${rec.title}*: ${rec.description}\n  Impact: ${rec.impact}`,
        },
      });
    });
  }

  // Footer
  blocks.push({
    type: 'divider',
  });

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📊 View Full Report',
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mabiz.com'}/analytics/reports`,
        action_id: 'view_report',
      },
    ],
  });

  // Generate fallback text
  const fallbackText = `
📊 Daily Performance Report - ${formattedDate}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${revenueEmoji} Revenue: $${metrics.summary.revenue.today.toFixed(0)} ${revenueTrend}${
    metrics.summary.revenue.percentChange > 0 ? '+' : ''
  }${metrics.summary.revenue.percentChange.toFixed(1)}%
${conversionEmoji} Conversion: ${metrics.summary.conversion.rate.toFixed(2)}% ${
    metrics.summary.conversion.percentChange > 0 ? '▲' : '▼'
  }
📧 Day 0 Open: ${metrics.summary.sequenceCompletions.day0.openRate.toFixed(1)}%
✅ Sequences: ${metrics.summary.sequenceCompletions.completionRate.toFixed(1)}% complete

Channel Performance:
📱 SMS: ${metrics.byChannel.sms.sent} sent, ${metrics.byChannel.sms.openRate.toFixed(1)}% open
💬 Kakao: ${metrics.byChannel.kakao.sent} sent, ${metrics.byChannel.kakao.clickRate.toFixed(1)}% click
📨 Email: ${metrics.byChannel.email.sent} sent, ${metrics.byChannel.email.openRate.toFixed(1)}% open

${criticalAlerts.length > 0 ? `🚨 CRITICAL: ${criticalAlerts.length} alerts\n` : ''}
${warnings.length > 0 ? `⚠️ WARNINGS: ${warnings.length} warnings\n` : ''}

View full report: ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mabiz.com'}/analytics/reports
  `;

  return {
    channel: '#sales-metrics',
    blocks,
    text: fallbackText.trim(),
  };
}

/**
 * Send Slack message
 */
export async function sendDailyReportToSlack(
  metrics: DailyReportMetrics,
  reportDate: Date,
  webhookUrl: string
): Promise<boolean> {
  try {
    if (!webhookUrl) {
      logger.warn('[SlackDailyReport] No webhook URL configured');
      return false;
    }

    const message = generateDailyReportSlackMessage(metrics, reportDate, webhookUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    logger.log('[SlackDailyReport] Message sent successfully', {
      date: reportDate.toISOString().split('T')[0],
    });

    return true;
  } catch (err) {
    logger.error('[SlackDailyReport] Failed to send', {
      err,
      date: reportDate.toISOString().split('T')[0],
    });
    return false;
  }
}

/**
 * Send critical alert to Slack (immediate)
 */
export async function sendCriticalAlertToSlack(
  metric: string,
  message: string,
  action: string,
  webhookUrl: string
): Promise<boolean> {
  try {
    if (!webhookUrl) return false;

    const payload = {
      channel: '#sales-alerts',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚨 *CRITICAL ALERT*\n*${metric}*\n${message}\n\n➜ Action: ${action}`,
          },
        },
      ],
      text: `CRITICAL ALERT: ${metric} - ${message}`,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    return true;
  } catch (err) {
    logger.error('[SlackCriticalAlert] Failed to send', { err, metric });
    return false;
  }
}
