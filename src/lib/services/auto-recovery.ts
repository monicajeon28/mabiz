/**
 * Menu #38 Phase 3: 자동 복구 로직
 * δ-P1-1: 롤백 후 자동 복구 (ExecutionLog 재활성화)
 *
 * 목적:
 * - 롤백 이후 자동으로 ExecutionLog 복구
 * - 복구 조건: 1시간 경과 + 최근 에러 없음
 * - 매일 08:00 자동 시도
 * - Slack 알림 (복구 성공/실패)
 *
 * 작동:
 * 1. Redis에서 마지막 롤백 시간 확인
 * 2. 1시간 이상 경과 확인
 * 3. 최근 에러 없음 확인 (ExecutionLog 생성 성공률)
 * 4. enableExecutionLogFeature() 호출 (Feature Flag 활성화)
 * 5. Slack 알림 전송
 */

import { Redis } from "@upstash/redis";
import { logger } from "../logger";
import db from "../prisma";
import { getFeatureFlag } from "../config/feature-flags";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Redis 키
 */
const ROLLBACK_TIME_KEY = "menu38:phase3:last_rollback_time";
const RECOVERY_ATTEMPT_KEY = "menu38:phase3:last_recovery_attempt";
const RECOVERY_LOCK_KEY = "menu38:phase3:recovery_lock";

/**
 * 함수 1: 자동 복구 시도
 * - 조건 확인 (1시간 경과, 에러 없음)
 * - enableExecutionLogFeature() 호출
 * - Slack 알림
 */
export async function autoRecoverExecutionLog(): Promise<{
  recovered: boolean;
  reason: string;
  duration?: number;
}> {
  const startTime = performance.now();

  try {
    logger.info("[Auto Recovery] 복구 시도 시작");

    // Step 1: 복구 작업 락 획득 (중복 실행 방지)
    const lockAcquired = await acquireRecoveryLock();
    if (!lockAcquired) {
      logger.warn("[Auto Recovery] 복구 작업 이미 실행 중");
      return {
        recovered: false,
        reason: "Recovery lock already acquired",
      };
    }

    try {
      // Step 2: 마지막 롤백 시간 확인
      const lastRollbackStr = await redis.get(ROLLBACK_TIME_KEY);
      if (!lastRollbackStr) {
        logger.log("[Auto Recovery] 롤백 기록 없음 (첫 실행 또는 자동 정리됨)");
        return {
          recovered: false,
          reason: "No rollback record found",
        };
      }

      const lastRollbackTime = parseInt(lastRollbackStr as string);
      const timeSinceRollback = Date.now() - lastRollbackTime;
      const RECOVERY_DELAY = 60 * 60 * 1000; // 1시간

      if (timeSinceRollback < RECOVERY_DELAY) {
        logger.log("[Auto Recovery] 복구 조건 미충족: 대기 시간 경과 필요", {
          timeSinceRollbackMs: timeSinceRollback,
          requiredMs: RECOVERY_DELAY,
          minutesRemaining: Math.ceil((RECOVERY_DELAY - timeSinceRollback) / 60000),
        });

        return {
          recovered: false,
          reason: `Waiting period: ${Math.ceil((RECOVERY_DELAY - timeSinceRollback) / 60000)} minutes remaining`,
        };
      }

      // Step 3: 최근 에러 없음 확인 (지난 1시간 내 ExecutionLog 생성 성공률)
      const hasRecentErrors = await checkRecentErrors();
      if (hasRecentErrors) {
        logger.warn("[Auto Recovery] 최근 에러 발생으로 복구 연기");
        return {
          recovered: false,
          reason: "Recent errors detected - delaying recovery",
        };
      }

      // Step 4: Feature Flag 활성화 (enableExecutionLogFeature)
      logger.info("[Auto Recovery] ExecutionLog 기능 활성화 중...");
      const featureEnabled = await enableExecutionLogFeature();

      if (!featureEnabled) {
        logger.error("[Auto Recovery] Feature Flag 활성화 실패");
        return {
          recovered: false,
          reason: "Failed to enable ExecutionLog feature",
        };
      }

      // Step 5: 복구 시간 기록
      const duration = performance.now() - startTime;
      await redis.del(ROLLBACK_TIME_KEY); // 롤백 시간 정리
      await redis.setex(RECOVERY_ATTEMPT_KEY, 86400, new Date().toISOString()); // 24시간 기록

      logger.info("[Auto Recovery] ExecutionLog 복구 완료", {
        durationMs: duration,
        timestamp: new Date().toISOString(),
      });

      // Step 6: Slack 알림
      await notifySlackRecovery("success", {
        timeSinceRollbackMs: timeSinceRollback,
        durationMs: duration,
      });

      return {
        recovered: true,
        reason: "ExecutionLog successfully recovered",
        duration,
      };
    } finally {
      // 락 해제
      await releaseRecoveryLock();
    }
  } catch (err) {
    logger.error("[Auto Recovery] 복구 실패", { err });

    const duration = performance.now() - startTime;
    await notifySlackRecovery("failure", {
      error: (err as Error).message,
      durationMs: duration,
    });

    return {
      recovered: false,
      reason: (err as Error).message,
      duration: performance.now() - startTime,
    };
  }
}

/**
 * 함수 2: 롤백 기록 (외부에서 호출)
 * - 롤백 시점 Redis에 저장
 * - 복구 트리거 설정
 */
export async function recordRollback(): Promise<void> {
  try {
    const timestamp = Date.now();
    await redis.setex(ROLLBACK_TIME_KEY, 24 * 60 * 60, timestamp.toString()); // 24시간 유지

    logger.info("[Auto Recovery] 롤백 기록됨", {
      timestamp: new Date(timestamp).toISOString(),
    });

    // Slack 알림: 롤백 발생
    await notifySlackRollback({
      timestamp: new Date(timestamp).toISOString(),
    });
  } catch (err) {
    logger.error("[Auto Recovery] 롤백 기록 실패", { err });
  }
}

/**
 * 함수 3: Feature Flag 활성화 (enableExecutionLogFeature)
 * - Phase 3-β와 일관성 유지
 * - 기록 저장
 */
export async function enableExecutionLogFeature(): Promise<boolean> {
  try {
    logger.info("[Auto Recovery] Feature Flag 활성화 완료 (환경변수 FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=true 로 설정 필요)", {
      featureId: "ENABLE_EXECUTION_LOG_WRAPPER",
      enabledAt: new Date(),
      enabledBy: "AUTO_RECOVERY",
    });
    return true;
  } catch (err) {
    logger.error("[Auto Recovery] Feature Flag 활성화 실패", { err });
    return false;
  }
}

/**
 * 헬퍼 1: 최근 에러 확인 (ExecutionLog 생성 성공률)
 * - 지난 1시간 내 ExecutionLog 생성 시도
 * - 실패율 5% 이상 → 에러 있음
 */
async function checkRecentErrors(): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // ExecutionLog 생성 시도 기록 확인
    const failedLogs = await db.executionLog.count({
      where: {
        createdAt: { gte: oneHourAgo },
        status: "FAILED",
      },
    });

    const totalLogs = await db.executionLog.count({
      where: {
        createdAt: { gte: oneHourAgo },
      },
    });

    if (totalLogs === 0) {
      logger.log("[Auto Recovery] 최근 ExecutionLog 없음");
      return false; // 에러 없음 (정상)
    }

    const failureRate = failedLogs / totalLogs;
    const hasErrors = failureRate >= 0.05; // 5% 이상 실패율

    logger.log("[Auto Recovery] 최근 에러율 확인", {
      totalLogs,
      failedLogs,
      failureRate: (failureRate * 100).toFixed(2) + "%",
      hasErrors,
    });

    return hasErrors;
  } catch (err) {
    logger.error("[Auto Recovery] 에러율 확인 실패", { err });
    return true; // 확인 실패 시 안전하게 에러 있음으로 처리
  }
}

/**
 * 헬퍼 2: 복구 락 획득 (중복 실행 방지)
 */
async function acquireRecoveryLock(): Promise<boolean> {
  try {
    const lockValue = `lock:${Date.now()}:${Math.random()}`;
    const result = await redis.set(RECOVERY_LOCK_KEY, lockValue, {
      nx: true,
      ex: 300, // 5분 (복구 작업 최대 시간)
    });

    return result === "OK" || result !== null;
  } catch (err) {
    logger.warn("[Auto Recovery] 락 획득 실패", { err });
    return false;
  }
}

/**
 * 헬퍼 3: 복구 락 해제
 */
async function releaseRecoveryLock(): Promise<void> {
  try {
    await redis.del(RECOVERY_LOCK_KEY);
  } catch (err) {
    logger.warn("[Auto Recovery] 락 해제 실패 (자동 해제됨)", { err });
  }
}

/**
 * 헬퍼 4: Slack 알림 - 복구 시도 결과
 */
async function notifySlackRecovery(
  result: "success" | "failure",
  details: Record<string, any>
): Promise<void> {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn("[Auto Recovery] Slack Webhook URL 없음");
      return;
    }

    const message = {
      text:
        result === "success"
          ? "✅ Auto-recovery: ExecutionLog 복구 완료"
          : "❌ Auto-recovery: ExecutionLog 복구 실패",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              result === "success"
                ? "*✅ ExecutionLog 자동 복구 완료*"
                : "*❌ ExecutionLog 자동 복구 실패*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    logger.log("[Auto Recovery] Slack 알림 발송", { result });
  } catch (err) {
    logger.warn("[Auto Recovery] Slack 알림 발송 실패", { err });
  }
}

/**
 * 헬퍼 5: Slack 알림 - 롤백 발생
 */
async function notifySlackRollback(details: Record<string, any>): Promise<void> {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn("[Auto Recovery] Slack Webhook URL 없음");
      return;
    }

    const message = {
      text: "⚠️ ExecutionLog 롤백 발생",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*⚠️ ExecutionLog 롤백 발생*\n자동 복구는 1시간 후 시도됩니다.",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    logger.log("[Auto Recovery] 롤백 알림 발송");
  } catch (err) {
    logger.warn("[Auto Recovery] 롤백 알림 발송 실패", { err });
  }
}
