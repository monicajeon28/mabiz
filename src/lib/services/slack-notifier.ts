/**
 * Phase 3-δ: Slack 알림 서비스
 *
 * 목적:
 * - 검증 결과 일일 알림 (매일 07:00)
 * - 롤백 발생 시 즉시 긴급 알림
 * - 상세 알림 메시지 + 복구 가이드
 *
 * Webhook URL: env.SLACK_WEBHOOK_VERIFY
 */

import { logger } from "@/lib/logger";
import type { SlackNotificationPayload, VerificationResult } from "@/types/notification";

interface SlackMessage {
  type:
    | "DAILY_VERIFICATION"
    | "CRITICAL_ROLLBACK"
    | "ERROR_ROLLBACK"
    | "RECOVERY_STARTED"
    | "RECOVERY_COMPLETED";
  message: string;
  details?: any;
}

/**
 * 1. Slack 메시지 템플릿 생성
 */
function createSlackPayload(data: SlackMessage): SlackNotificationPayload {
  const { type, message, details } = data;

  const colorMap: Record<string, string> = {
    DAILY_VERIFICATION: "#36a64f", // 초록색: 정상
    CRITICAL_ROLLBACK: "#ff0000", // 빨강색: 긴급
    ERROR_ROLLBACK: "#ff6600", // 주황색: 오류
    RECOVERY_STARTED: "#0099ff", // 파랑색: 진행중
    RECOVERY_COMPLETED: "#36a64f", // 초록색: 완료
  };

  const color = colorMap[type] || "#808080";
  const timestamp = new Date().toISOString();

  const attachments: any[] = [
    {
      fallback: message,
      color,
      title: `[${type}] ${message}`,
      text: details ? JSON.stringify(details, null, 2) : "상세 정보 없음",
      ts: Math.floor(Date.now() / 1000),
      footer: "ExecutionLog Verification System",
      footer_icon:
        "https://platform.slack-edge.com/img/default_application_icon.png",
    },
  ];

  return {
    text: `[CRM] ExecutionLog Monitoring - ${type}`,
    attachments,
  };
}

/**
 * 2. Slack Webhook 전송
 */
async function sendSlackWebhook(payload: SlackNotificationPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_VERIFY;

  if (!webhookUrl) {
    logger.warn("[Slack] SLACK_WEBHOOK_VERIFY 환경변수 미설정");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error("[Slack] Webhook 전송 실패", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Webhook error: ${response.statusText}`);
    }

    logger.info("[Slack] Webhook 전송 성공");
  } catch (error) {
    logger.error("[Slack] Webhook 전송 중 오류", { error });
    // Slack 알림 실패는 롤백 자체를 방해하지 않음
  }
}

/**
 * 3. 일일 검증 알림
 */
async function notifyDailyVerification(result: VerificationResult): Promise<void> {
  const statusText = result.isHealthy ? "✅ 정상" : "⚠️ 경고";
  const message = `일일 검증 완료 - ${statusText}`;

  const details = {
    timestamp: result.timestamp,
    duration: `${result.duration}ms`,
    results: {
      행수_일관성: {
        value: `${result.rowConsistency.consistency}%`,
        threshold: "95%",
        status: result.rowConsistency.passed ? "PASS" : "FAIL",
        details: {
          SendingHistory: result.rowConsistency.sendingCount,
          ExecutionLog: result.rowConsistency.executionCount,
        },
      },
      채널별_동기화율: {
        value: `${result.channelDistribution.syncRate}%`,
        threshold: "99%",
        status: result.channelDistribution.passed ? "PASS" : "FAIL",
        distribution: {
          SendingHistory: result.channelDistribution.sendingStats,
          ExecutionLog: result.channelDistribution.executionStats,
        },
      },
      CAMPAIGN_필터_정확도: {
        value: `${result.campaignFilter.accuracy}%`,
        threshold: "100%",
        status: result.campaignFilter.passed ? "PASS" : "FAIL",
        details: {
          totalCampaigns: result.campaignFilter.executionCampaignCount,
          mismatches: result.campaignFilter.mismatchCount,
        },
      },
      타임스탬프_오차: {
        p99: `${result.timestampCheck.percentile99}초`,
        threshold: "< 5초",
        status: result.timestampCheck.passed ? "PASS" : "FAIL",
        stats: {
          샘플크기: result.timestampCheck.sampleSize,
          최대오차: `${result.timestampCheck.maxDiff}초`,
          평균오차: `${result.timestampCheck.avgDiff}초`,
        },
      },
    },
    rollbackTriggered: result.rollbackTriggered || false,
  };

  const payload = createSlackPayload({
    type: "DAILY_VERIFICATION",
    message,
    details,
  });

  await sendSlackWebhook(payload);
}

/**
 * 4. 긴급 롤백 알림 (즉시)
 */
async function notifyCriticalRollback(message: string, details: any): Promise<void> {
  const payload = createSlackPayload({
    type: "CRITICAL_ROLLBACK",
    message: `🚨 ${message}`,
    details: {
      ...details,
      action: "자동 롤백 진행 중",
      targetSystem: "SendingHistory (Safe mode)",
      timestamp: new Date().toISOString(),
      autoRecoveryEnabled: true,
    },
  });

  await sendSlackWebhook(payload);
}

/**
 * 5. 오류 롤백 알림
 */
async function notifyErrorRollback(message: string, details: any): Promise<void> {
  const payload = createSlackPayload({
    type: "ERROR_ROLLBACK",
    message: `⚠️ ${message}`,
    details: {
      ...details,
      action: "검증 중 오류 발생으로 안전 모드 활성화",
      timestamp: new Date().toISOString(),
      manualReviewRequired: true,
    },
  });

  await sendSlackWebhook(payload);
}

/**
 * 6. 복구 시작 알림
 */
async function notifyRecoveryStarted(details: any): Promise<void> {
  const payload = createSlackPayload({
    type: "RECOVERY_STARTED",
    message: "🔄 ExecutionLog 복구 시작",
    details: {
      ...details,
      status: "in_progress",
      timestamp: new Date().toISOString(),
    },
  });

  await sendSlackWebhook(payload);
}

/**
 * 7. 복구 완료 알림
 */
async function notifyRecoveryCompleted(details: any): Promise<void> {
  const payload = createSlackPayload({
    type: "RECOVERY_COMPLETED",
    message: "✅ ExecutionLog 복구 완료",
    details: {
      ...details,
      status: "completed",
      timestamp: new Date().toISOString(),
    },
  });

  await sendSlackWebhook(payload);
}

/**
 * 통합 알림 인터페이스
 */
export async function notifySlack(
  notification:
    | {
        type: "DAILY_VERIFICATION";
        message?: string;
        details?: VerificationResult;
      }
    | {
        type: "CRITICAL_ROLLBACK";
        message: string;
        details: any;
      }
    | {
        type: "ERROR_ROLLBACK";
        message: string;
        details: any;
      }
    | { type: "RECOVERY_STARTED"; details: any }
    | { type: "RECOVERY_COMPLETED"; details: any }
): Promise<void> {
  try {
    switch (notification.type) {
      case "DAILY_VERIFICATION":
        if (notification.details) {
          await notifyDailyVerification(notification.details);
        }
        break;

      case "CRITICAL_ROLLBACK":
        await notifyCriticalRollback(
          notification.message,
          notification.details
        );
        break;

      case "ERROR_ROLLBACK":
        await notifyErrorRollback(notification.message, notification.details);
        break;

      case "RECOVERY_STARTED":
        await notifyRecoveryStarted(notification.details);
        break;

      case "RECOVERY_COMPLETED":
        await notifyRecoveryCompleted(notification.details);
        break;

      default:
        logger.warn("[Slack] 알 수 없는 알림 타입", { type: (notification as any).type });
    }
  } catch (error) {
    logger.error("[Slack] 알림 전송 중 오류", { error });
    // Slack 오류는 메인 로직에 영향을 주지 않음
  }
}

/**
 * 운영팀용: 상세 복구 가이드
 */
export function getRecoveryGuide(): string {
  return `
## ExecutionLog 롤백 복구 가이드

### 상황
- ExecutionLog ↔ SendingHistory 데이터 일관성 오류
- 자동 롤백 트리거 (Feature Flag 비활성화)
- 현재 시스템: SendingHistory 안전 모드 운영 중

### 복구 절차

**1단계: 데이터 검증 (필수)**
\`\`\`sql
-- SendingHistory 정합성 확인
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN channel='SMS' AND phone IS NULL THEN 1 ELSE 0 END) as null_phones,
  SUM(CASE WHEN channel='EMAIL' AND email IS NULL THEN 1 ELSE 0 END) as null_emails
FROM SendingHistory
WHERE campaignId IS NOT NULL AND createdAt > NOW() - INTERVAL '7 days';
\`\`\`

**2단계: ExecutionLog 재검증**
\`\`\`sql
-- ExecutionLog 정합성 확인
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN sourceType='CAMPAIGN' AND campaignId IS NULL THEN 1 ELSE 0 END) as mismatches
FROM ExecutionLog
WHERE createdAt > NOW() - INTERVAL '7 days';
\`\`\`

**3단계: 수동 복구 (검증 후)**
- API 호출: PUT /api/admin/verification/rollback-recovery
- Feature Flag 재활성화 (환경변수: ENABLE_EXECUTION_LOG=true)
- Vercel 자동 재배포

**4단계: 모니터링**
- 다음 크론잡 (06:00) 검증 결과 확인
- Slack 알림 구독 (SLACK_WEBHOOK_VERIFY)

### 긴급 연락처
- 개발팀: dev@mabiz.com
- 데이터팀: data@mabiz.com
- 온콜: /pagerduty-oncall

### 복구 실패 시
- 모든 웹훅 일시 중단
- 메시지 발송 일시 중단 (수동 모드)
- 데이터베이스 백업 확인 (Supabase)
  `;
}
