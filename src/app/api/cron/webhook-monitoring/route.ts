import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  monitorWebhookHealth,
  sendAlertNotifications,
  autoRetryFailedWebhooks,
  cleanupStuckWebhooks,
} from '@/lib/webhook-alerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 모든 Organization에 대해 Webhook 건강도 모니터링
 * 매 5분마다 실행되어야 함 (외부 cron job 필요)
 */
export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('[CronWebhookMonitoring] Unauthorized cron call');
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    logger.info('[CronWebhookMonitoring] Starting webhook health check', {
      organizationCount: organizations.length,
    });

    const results = {
      totalOrgs: organizations.length,
      processedOrgs: 0,
      totalAlerts: 0,
      alertsBySeverity: { critical: 0, warning: 0, info: 0 },
      retried: 0,
      cleaned: 0,
      errors: 0,
    };

    // 각 조직별로 모니터링 실행
    for (const org of organizations) {
      try {
        // 1. Webhook 건강도 모니터링
        const alerts = await monitorWebhookHealth(org.id, {
          successRateThreshold: 95,
          failureCountThreshold: 10,
          executionTimeP95Threshold: 5000,
          retryRateThreshold: 20,
          pendingCountThreshold: 50,
        });

        results.totalAlerts += alerts.length;
        alerts.forEach(a => results.alertsBySeverity[a.severity]++);

        // 2. Critical alert 발송
        if (alerts.filter(a => a.severity === 'critical').length > 0) {
          const slackWebhook = process.env.SLACK_WEBHOOK_URL;
          await sendAlertNotifications(alerts, {
            slack: slackWebhook,
          });
        }

        // 3. 실패한 웹훅 자동 재시도
        const retryResult = await autoRetryFailedWebhooks(org.id);
        results.retried += retryResult.retried;

        // 4. 좀비 웹훅 정리
        const cleanupResult = await cleanupStuckWebhooks(org.id);
        results.cleaned += cleanupResult.cleaned;

        results.processedOrgs++;

        if (alerts.length > 0 || retryResult.retried > 0 || cleanupResult.cleaned > 0) {
          logger.info('[CronWebhookMonitoring] Organization processed', {
            organizationId: org.id,
            organizationName: org.name,
            alertCount: alerts.length,
            retried: retryResult.retried,
            cleaned: cleanupResult.cleaned,
          });
        }
      } catch (error) {
        results.errors++;
        logger.error('[CronWebhookMonitoring] Error processing organization', {
          organizationId: org.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('[CronWebhookMonitoring] Webhook health check completed', results);

    return NextResponse.json({
      ok: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[CronWebhookMonitoring] Critical error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
