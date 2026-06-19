/**
 * Daily Performance Report Generator (TASK 6-2)
 *
 * GET /api/cron/daily-performance-report
 *
 * Runs: Every day at 6 AM (before team standup)
 *
 * Generates:
 * - Revenue summary (today, week, month YTD)
 * - Conversion metrics (by day, by channel, by lens)
 * - Top performers (partners, sequences, lenses)
 * - Alerts (anomalies, below-threshold metrics)
 * - Recommendations (3-5 actionable items)
 *
 * Distributes via:
 * - Email to admin + team leads
 * - Slack message to #sales-metrics
 * - Dashboard widget (accessible 24/7)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Extended for comprehensive report generation

import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { DailyReportGenerator, saveDailyReport } from '@/lib/services/daily-report-service';
import { sendDailyReportToSlack, sendCriticalAlertToSlack } from '@/lib/services/slack-daily-report';
import { generateDailyReportEmail, generateDailyReportText } from '@/lib/templates/daily-report-email';
import { sendSystemEmail } from '@/lib/system-email';

interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export async function GET(req: Request) {
  try {
    // Verify cron secret — CRON_SECRET 미설정 시 fail-closed (503)
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    logger.log('[DailyPerfReport] Starting generation');

    const reportDate = new Date();
    reportDate.setHours(0, 0, 0, 0);

    // Get all active organizations
    const orgs = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
    });

    logger.log('[DailyPerfReport] Processing', {
      orgCount: orgs.length,
    });

    const results = {
      generated: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each organization
    for (const org of orgs) {
      try {
        await generateAndDistributeReport(org, reportDate);
        results.generated++;
      } catch (orgErr) {
        logger.error('[DailyPerfReport] Organization failed', {
          orgId: org.id,
          err: orgErr,
        });
        results.failed++;
        results.errors.push(`${org.slug}: ${(orgErr as Error).message}`);
      }
    }

    logger.log('[DailyPerfReport] Completed', {
      generated: results.generated,
      failed: results.failed,
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'Daily performance report generated',
        results,
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error('[DailyPerfReport] Fatal error', { err });
    return NextResponse.json(
      {
        ok: false,
        message: 'Failed to generate daily reports',
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate and distribute report for a single organization
 */
async function generateAndDistributeReport(org: { id: string; name: string; slug: string }, reportDate: Date) {
  logger.log('[DailyPerfReport] Processing org', { orgId: org.id, name: org.name });

  // 1. Generate metrics
  const generator = new DailyReportGenerator(org.id);
  const metrics = await generator.generateReport();

  logger.log('[DailyPerfReport] Metrics generated', {
    orgId: org.id,
    revenue: metrics.summary.revenue.today,
    conversion: metrics.summary.conversion.rate,
  });

  // 2. Save to database
  await saveDailyReport(org.id, reportDate, metrics);

  // 3. Get recipients
  const [admins, teamLeads] = await Promise.all([
    prisma.organizationMember.findMany({
      where: {
        organizationId: org.id,
        role: { in: ['ADMIN', 'OWNER'] },
      },
      select: { email: true },
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId: org.id,
        role: 'TEAM_LEAD',
      },
      select: { email: true },
    }),
  ]);

  const recipients = [...admins, ...teamLeads].map((r) => r.email).filter((e): e is string => e !== null);

  logger.log('[DailyPerfReport] Recipients identified', {
    orgId: org.id,
    count: recipients.length,
  });

  // 4. Send email
  if (recipients.length > 0) {
    await sendEmailReport(org, metrics, reportDate, recipients);
  }

  // 5. Send Slack (if configured)
  const slackUrl = process.env.SLACK_WEBHOOK_DAILY_REPORT || process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    await sendDailyReportToSlack(metrics, reportDate, slackUrl);
  }

  // 6. Send critical alerts immediately
  const criticalAlerts = metrics.alerts.filter((a) => a.type === 'RED');
  if (criticalAlerts.length > 0 && slackUrl) {
    for (const alert of criticalAlerts) {
      await sendCriticalAlertToSlack(alert.metric, alert.message, typeof alert === 'object' && alert !== null && 'action' in alert ? String((alert as { action?: unknown }).action) : 'Check dashboard', slackUrl);
    }
  }

  logger.log('[DailyPerfReport] Distribution complete', {
    orgId: org.id,
    emailsSent: recipients.length,
    criticalAlerts: criticalAlerts.length,
  });
}

/**
 * Send email report
 */
async function sendEmailReport(
  org: { id: string; name: string; slug: string },
  metrics: any,
  reportDate: Date,
  recipients: string[]
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mabiz.com';

    const htmlContent = generateDailyReportEmail(metrics, {
      baseUrl,
      teamName: org.name,
      reportDate,
    });

    const textContent = generateDailyReportText(metrics, {
      baseUrl,
      teamName: org.name,
      reportDate,
    });

    const formattedDate = reportDate.toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
    });

    // Prepare email payload
    const emailPayload: EmailPayload = {
      to: recipients,
      subject: `📊 Daily Performance Report - ${formattedDate} (${org.name})`,
      html: htmlContent,
      text: textContent,
    };

    // Send via configured email service
    // This assumes you have an email API endpoint or service
    const emailApiUrl = process.env.EMAIL_API_URL;
    if (emailApiUrl) {
      const response = await fetch(emailApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        throw new Error(`Email API error: ${response.statusText}`);
      }
    } else {
      // Fallback: sendSystemEmail (nodemailer) when EMAIL_API_URL is not configured
      const sent = await sendSystemEmail({
        to: emailPayload.to,
        subject: emailPayload.subject,
        html: emailPayload.html,
      });
      if (!sent) {
        logger.warn('[DailyPerfReport] sendSystemEmail 발송 실패 — NODEMAILER 환경변수 확인 필요', {
          orgId: org.id,
          to: recipients.join(', '),
        });
      }
    }

    logger.log('[DailyPerfReport] Email sent', {
      orgId: org.id,
      recipients: recipients.length,
    });
  } catch (err) {
    logger.error('[DailyPerfReport] Email failed', {
      orgId: org.id,
      err,
    });
    throw err;
  }
}
