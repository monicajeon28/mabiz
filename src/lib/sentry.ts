import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';

/**
 * Sentry + Slack 통합 모니터링 설정
 * - 실시간 에러 추적
 * - Slack 즉시 알림
 * - 성능 모니터링
 */

export function initializeSentry() {
  if (!process.env.SENTRY_DSN) {
    logger.warn('[Sentry] SENTRY_DSN 환경변수가 없습니다. 에러 모니터링을 사용할 수 없습니다.');
    return;
  }

  Sentry.init({
    // 기본 설정
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',

    // 성능 모니터링
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // 통합 구성
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
      ...(process.env.NODE_ENV === 'production'
        ? [new Sentry.Integrations.CaptureConsole({ levels: ['error', 'warn'] })]
        : []),
    ],

    // 에러 필터링
    beforeSend(event, hint) {
      // 개발 환경에서 무시할 에러
      if (process.env.NODE_ENV === 'development') {
        if (event.exception?.values?.[0]?.value?.includes('Cannot find module')) {
          return null;
        }
      }

      // Slack 알림 (critical 레벨만)
      const isCritical = event.level === 'fatal' || event.level === 'error';
      if (isCritical && process.env.SLACK_WEBHOOK_URL) {
        notifySlack({
          channel: '#alerts',
          severity: 'high',
          message: event.message || event.exception?.values?.[0]?.value || 'Unknown error',
          context: {
            environment: event.environment,
            timestamp: new Date().toISOString(),
            tags: event.tags,
            url: event.request?.url,
          },
        });
      }

      return event;
    },

    // 로컬 개발에서는 로깅만 (실제 전송 안 함)
    transport:
      process.env.NODE_ENV === 'development'
        ? undefined // 개발: 전송 안 함
        : undefined, // 프로덕션: 기본 HTTP transport 사용
  });

  logger.log('[Sentry] 초기화 완료', {
    dsn: process.env.SENTRY_DSN?.substring(0, 50) + '...',
    environment: process.env.NODE_ENV,
  });
}

/**
 * Slack 알림 전송
 */
async function notifySlack({
  channel = '#alerts',
  severity = 'medium',
  message,
  context = {},
}: {
  channel?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context?: Record<string, any>;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const severityEmoji = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '💥',
  };

  const payload = {
    channel,
    text: `${severityEmoji[severity]} ${severity.toUpperCase()}: ${message}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji[severity]} ${severity.toUpperCase()} ERROR ALERT`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Message*\n${message}`,
          },
          {
            type: 'mrkdwn',
            text: `*Timestamp*\n${context.timestamp || new Date().toISOString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Environment*\n${context.environment || 'unknown'}`,
          },
          {
            type: 'mrkdwn',
            text: `*URL*\n${context.url || 'N/A'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${JSON.stringify(context, null, 2)}\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in Sentry',
            },
            url: process.env.SENTRY_DSN ? `${process.env.SENTRY_DSN.split('@')[1]}/issues` : '#',
            style: 'danger',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error('[SlackNotification] 전송 실패', {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (err) {
    logger.error('[SlackNotification] 네트워크 오류', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * 수동으로 Sentry에 에러 보고
 */
export function captureException(error: Error | string, context?: Record<string, any>) {
  if (typeof error === 'string') {
    Sentry.captureMessage(error, 'error');
  } else {
    Sentry.captureException(error, { contexts: context ? { custom: context } : undefined });
  }
}

/**
 * 수동으로 Sentry에 메시지 보고
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * 성능 메트릭 기록
 */
export function recordPerformanceMetric(name: string, value: number, unit: string = 'ms') {
  Sentry.captureMessage(`[PERF] ${name}: ${value}${unit}`, 'info');
}
