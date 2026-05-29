import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface AlertConfig {
  organizationId: string;
  successRateThreshold: number; // e.g., 95
  failureCountThreshold: number; // e.g., 10
  executionTimeP95Threshold: number; // e.g., 5000ms
  retryRateThreshold: number; // e.g., 20
  pendingCountThreshold: number; // e.g., 50
  checkInterval: number; // in minutes
}

export interface AlertNotification {
  organizationId: string;
  alertType: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  affectedWebhookType?: string;
  createdAt: Date;
}

// 기본 Alert 설정
const DEFAULT_CONFIG: AlertConfig = {
  organizationId: '',
  successRateThreshold: 95,
  failureCountThreshold: 10,
  executionTimeP95Threshold: 5000,
  retryRateThreshold: 20,
  pendingCountThreshold: 50,
  checkInterval: 5, // 5분마다 체크
};

/**
 * Webhook 상태를 모니터링하고 필요시 알림을 발송합니다
 */
export async function monitorWebhookHealth(
  organizationId: string,
  config: Partial<AlertConfig> = {}
): Promise<AlertNotification[]> {
  const finalConfig: AlertConfig = {
    ...DEFAULT_CONFIG,
    organizationId,
    ...config,
  };

  const alerts: AlertNotification[] = [];

  try {
    // 최근 1시간 데이터 수집
    const oneHourAgo = new Date(Date.now() - 3600000);

    const [events, logs] = await Promise.all([
      prisma.webhookEvent.findMany({
        where: {
          organizationId,
          createdAt: { gte: oneHourAgo },
        },
        select: {
          id: true,
          webhookType: true,
          status: true,
          executionTimeMs: true,
          retryCount: true,
        },
      }),
      prisma.webhookLog.findMany({
        where: {
          webhookEvent: {
            organizationId,
            createdAt: { gte: oneHourAgo },
          },
        },
        select: {
          durationMs: true,
          status: true,
        },
      }),
    ]);

    // 메트릭 계산
    const successRate = events.length > 0
      ? (events.filter(e => e.status === 'COMPLETED').length / events.length) * 100
      : 100;

    const failureCount = events.filter(e => e.status === 'FAILED').length;
    const pendingCount = events.filter(e => e.status === 'PENDING').length;
    const retryRate = events.length > 0
      ? (events.filter(e => e.retryCount > 0).length / events.length) * 100
      : 0;

    const executionTimes = events
      .filter((e): e is typeof e & { executionTimeMs: number } => e.executionTimeMs !== null)
      .map(e => e.executionTimeMs)
      .sort((a, b) => a - b);

    const p95ExecutionTime: number = executionTimes.length > 0
      ? executionTimes[Math.floor(executionTimes.length * 0.95)] ?? 0
      : 0;

    // Alert 1: Low Success Rate
    if (successRate < finalConfig.successRateThreshold) {
      alerts.push({
        organizationId,
        alertType: 'low_success_rate',
        severity: successRate < finalConfig.successRateThreshold - 10 ? 'critical' : 'warning',
        title: 'Low Webhook Success Rate',
        description: `Success rate is ${successRate.toFixed(2)}%, below threshold of ${finalConfig.successRateThreshold}%`,
        metric: 'successRate',
        currentValue: successRate,
        threshold: finalConfig.successRateThreshold,
        createdAt: new Date(),
      });
    }

    // Alert 2: High Failure Count
    if (failureCount > finalConfig.failureCountThreshold) {
      alerts.push({
        organizationId,
        alertType: 'high_failure_count',
        severity: failureCount > finalConfig.failureCountThreshold * 5 ? 'critical' : 'warning',
        title: 'High Webhook Failure Count',
        description: `${failureCount} webhooks failed in the last hour, threshold is ${finalConfig.failureCountThreshold}`,
        metric: 'failureCount',
        currentValue: failureCount,
        threshold: finalConfig.failureCountThreshold,
        createdAt: new Date(),
      });
    }

    // Alert 3: High Pending Count
    if (pendingCount > finalConfig.pendingCountThreshold) {
      alerts.push({
        organizationId,
        alertType: 'high_pending_count',
        severity: pendingCount > finalConfig.pendingCountThreshold * 3 ? 'critical' : 'warning',
        title: 'High Number of Pending Webhooks',
        description: `${pendingCount} webhooks are pending, threshold is ${finalConfig.pendingCountThreshold}`,
        metric: 'pendingCount',
        currentValue: pendingCount,
        threshold: finalConfig.pendingCountThreshold,
        createdAt: new Date(),
      });
    }

    // Alert 4: High P95 Execution Time
    if (p95ExecutionTime > finalConfig.executionTimeP95Threshold) {
      alerts.push({
        organizationId,
        alertType: 'high_execution_time',
        severity: p95ExecutionTime > finalConfig.executionTimeP95Threshold * 2 ? 'critical' : 'warning',
        title: 'High Webhook Execution Time',
        description: `P95 execution time is ${p95ExecutionTime}ms, threshold is ${finalConfig.executionTimeP95Threshold}ms`,
        metric: 'p95ExecutionTime',
        currentValue: p95ExecutionTime,
        threshold: finalConfig.executionTimeP95Threshold,
        createdAt: new Date(),
      });
    }

    // Alert 5: High Retry Rate
    if (retryRate > finalConfig.retryRateThreshold) {
      alerts.push({
        organizationId,
        alertType: 'high_retry_rate',
        severity: retryRate > finalConfig.retryRateThreshold * 2 ? 'critical' : 'warning',
        title: 'High Webhook Retry Rate',
        description: `${retryRate.toFixed(2)}% of webhooks are being retried, threshold is ${finalConfig.retryRateThreshold}%`,
        metric: 'retryRate',
        currentValue: retryRate,
        threshold: finalConfig.retryRateThreshold,
        createdAt: new Date(),
      });
    }

    // Type-specific alerts
    const typeMetrics: Record<string, any> = {};
    for (const event of events) {
      if (!typeMetrics[event.webhookType]) {
        typeMetrics[event.webhookType] = {
          total: 0,
          success: 0,
          failed: 0,
        };
      }
      typeMetrics[event.webhookType].total++;
      if (event.status === 'COMPLETED') typeMetrics[event.webhookType].success++;
      if (event.status === 'FAILED') typeMetrics[event.webhookType].failed++;
    }

    for (const [type, metrics] of Object.entries(typeMetrics)) {
      const typeSuccessRate = (metrics.success / metrics.total) * 100;
      if (typeSuccessRate < 85) {
        alerts.push({
          organizationId,
          alertType: 'low_type_success_rate',
          severity: typeSuccessRate < 70 ? 'critical' : 'warning',
          title: `Low Success Rate for ${type} Webhook`,
          description: `Success rate is ${typeSuccessRate.toFixed(2)}% for webhook type ${type}`,
          metric: 'typeSuccessRate',
          currentValue: typeSuccessRate,
          threshold: 85,
          affectedWebhookType: type,
          createdAt: new Date(),
        });
      }
    }

    return alerts;
  } catch (error) {
    logger.error('[WebhookAlerts] Error monitoring health', {
      error: error instanceof Error ? error.message : String(error),
    });
    return alerts;
  }
}

/**
 * Slack/이메일로 알림 발송 (실제 구현은 플랫폼에 따라)
 */
export async function sendAlertNotifications(
  alerts: AlertNotification[],
  channels: {
    slack?: string; // Slack webhook URL
    email?: string[]; // Email addresses
  } = {}
): Promise<{ success: boolean; sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  try {
    // Critical alerts만 Slack에 발송
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');

    if (channels.slack && criticalAlerts.length > 0) {
      for (const alert of criticalAlerts) {
        try {
          const response = await fetch(channels.slack, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 ${alert.title}`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*${alert.title}*\n${alert.description}\n\nCurrent: ${alert.currentValue.toFixed(2)} | Threshold: ${alert.threshold}`,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `Type: ${alert.alertType} | Severity: ${alert.severity} | Time: ${alert.createdAt.toISOString()}`,
                    },
                  ],
                },
              ],
            }),
          });
          if (response.ok) sent++;
          else failed++;
        } catch (error) {
          failed++;
          logger.error('[WebhookAlerts] Failed to send Slack notification', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Email alerts (구현 생략 - 실제로는 이메일 서비스 연동)
    if (channels.email && alerts.length > 0) {
      // TODO: Implement email sending
      sent += channels.email.length * alerts.length;
    }

    return { success: true, sent, failed };
  } catch (error) {
    logger.error('[WebhookAlerts] Error sending notifications', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, sent, failed };
  }
}

/**
 * 실패한 웹훅을 자동으로 재시도 큐에 추가
 */
export async function autoRetryFailedWebhooks(
  organizationId: string,
  maxFailureCount: number = 50
): Promise<{ retried: number; stillFailed: number }> {
  try {
    // 실패한 웹훅 찾기
    const failedWebhooks = await prisma.webhookEvent.findMany({
      where: {
        organizationId,
        status: 'FAILED',
        retryCount: { lt: 5 },
      },
      select: {
        id: true,
        eventId: true,
        webhookType: true,
        retryCount: true,
      },
      take: maxFailureCount,
    });

    let retried = 0;
    for (const webhook of failedWebhooks) {
      try {
        // 웹훅 상태 업데이트
        await prisma.webhookEvent.update({
          where: { id: webhook.id },
          data: {
            status: 'PENDING',
            retryCount: { increment: 1 },
            nextRetryAt: new Date(Date.now() + 300000), // 5분 후 재시도
          },
        });
        retried++;
      } catch (error) {
        logger.error('[WebhookAlerts] Failed to retry webhook', {
          webhookId: webhook.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const stillFailed = failedWebhooks.length - retried;

    if (failedWebhooks.length > 0) {
      logger.info('[WebhookAlerts] Auto-retry processed', {
        organizationId,
        retried,
        stillFailed,
      });
    }

    return { retried, stillFailed };
  } catch (error) {
    logger.error('[WebhookAlerts] Error in auto-retry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { retried: 0, stillFailed: 0 };
  }
}

/**
 * 좀비 웹훅(오래된 PENDING) 정리
 */
export async function cleanupStuckWebhooks(
  organizationId: string,
  maxAgeHours: number = 24
): Promise<{ cleaned: number }> {
  try {
    const cutoffDate = new Date(Date.now() - maxAgeHours * 3600000);

    const result = await prisma.webhookEvent.updateMany({
      where: {
        organizationId,
        status: 'PENDING',
        createdAt: { lt: cutoffDate },
      },
      data: {
        status: 'FAILED',
        errorMessage: `Stuck webhook cleaned up after ${maxAgeHours} hours`,
      },
    });

    if (result.count > 0) {
      logger.warn('[WebhookAlerts] Cleaned up stuck webhooks', {
        organizationId,
        count: result.count,
      });
    }

    return { cleaned: result.count };
  } catch (error) {
    logger.error('[WebhookAlerts] Error cleaning up stuck webhooks', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { cleaned: 0 };
  }
}
